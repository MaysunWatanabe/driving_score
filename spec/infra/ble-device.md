<!-- 作成: 2026-09-18 17:45:40 JST | 更新: 2026-09-29 15:08:38 JST -->

# BLE デバイス接続仕様（infra.ble.device）

## 1. 目的と責務

本ノードは、車載 CAN データ送信機（BLE ペリフェラル）との接続と通知購読を担う、インフラ層の仕様を定義する。

責務範囲：

- BLE スタックの初期化
- 対象デバイスのスキャンと選択
- GATT 接続、サービス発見、通知購読
- 受信した通知ペイロードを呼び出し元へ引き渡すこと

責務外：

- 12 バイト CAN ペイロードのデコード（`middleware.sensor.service` の責務）
- スコア算出（`middleware.score-logic` の責務）
- センサーモードの判定とライフサイクル制御（呼び出し元の責務）

### 1.1 実装真実源

本ノードの実装真実源は `src/data/src/app/data/ble.ts` である。仕様と実装が乖離した場合は、本仕様書を真として `ble.ts` を改訂する。

## 2. 依存プラグイン

BLE 実装は `@capacitor-community/bluetooth-le` の `BleClient` に依存する。初期化、スキャン、接続、サービス発見、通知購読はすべて `BleClient` 経由で行う。

- `@capacitor-community/bluetooth-le` のバージョンは、本仕様の範囲では変更しない（§9）。

## 3. 対象デバイスの識別

| 項目 | 値 | 備考 |
| --- | --- | --- |
| `BLE_DEVICE_NAME` | `DrivingCanData` | 固定。完全一致で判定する |
| `BLE_DEVICE_ID` | `D8:3A:DD:6A:A2:15` | 既定値として存在するが**識別には使用しない** |

- スキャン結果は、`device.name` と `localName` の**どちらか一方**が `BLE_DEVICE_NAME`（`DrivingCanData`）と**完全一致**する広告だけを採用する。どちらも一致しない広告は無視する。
- 部分一致、前後空白の除去、大文字小文字の無視といった名前の正規化は行わない。恒久的な正規化の要否は、調査結果に基づいて別途判断する（§12）。
- `BLE_DEVICE_ID` は設定上の既定値にとどまる。実装上の識別キーとして参照してはならない。
- マッチ条件、`BLE_DEVICE_NAME`、`BLE_DEVICE_ID` は変更禁止範囲に含まれる（§9）。

## 4. GATT プロファイル

| 項目 | UUID |
| --- | --- |
| サービス | `numberToUUID(0x2310)` |
| 通知キャラクタリスティック | `numberToUUID(0x2311)` |

## 5. スキャン仕様

### 5.1 タイミング定数

| 定数 | 値 | 意味 |
| --- | --- | --- |
| スキャン窓長 | 3,000 ms | `requestLEScan` を開始してから `stopLEScan` するまでの時間 |
| `SCAN_RETRY_INTERVAL_MS` | 2,000 ms | 0 件だったときの再スキャン待機時間 |
| `SCAN_MAX_ATTEMPTS` | 3 回 | 初回を含む最大試行回数 |
| スキャン総計（上限） | 13,000 ms | 3,000 × 3 + 2,000 × 2 |

スキャン総計 13,000 ms は、上記の内訳から導かれる設計上の上限値である。実装上のタイマ誤差は含まない。

### 5.2 スキャンリトライ制御

1. `requestLEScan` を開始し、3,000 ms 後に `stopLEScan` する。
2. 窓内で `DrivingCanData`（§3 のマッチ条件を満たす広告）が 1 件以上見つかった場合は、§5.3 の分岐へ進む。
3. 窓内が 0 件だった場合は 2,000 ms 待機してから再スキャンする。
4. 1〜3 を、初回を含めて**最大 3 回**試行する。
5. 3 回とも 0 件だった場合に**初めて** `showConnectFailedDialog()` を表示する。1 回目・2 回目の 0 件では表示してはならない。

#### リトライ操作

接続失敗ダイアログで「リトライ」が選択された場合は、スキャン試行回数を初期化し、1 回目から再開する。

#### 待機中の打ち切り

再スキャン待機中に `bluetoothFunc === null` となった場合は、リトライを継続せずにスキャン処理を打ち切る。

### 5.3 発見時の分岐（現行維持）

| 発見件数 | 挙動 |
| --- | --- |
| 0 件 | §5.2 に従い待機→再スキャン（最大 3 回）。3 回とも 0 件なら失敗ダイアログを表示 |
| 1 件 | 即 `connect` |
| 複数件 | ユーザーが選択した後に `connect`（無条件に先頭を選んではならない） |

### 5.4 スキャン関連ログ

- proposal #77 に由来する `scanStart` / `scanStop` / `requestLEScan` ヒットログは、恒久ログとして維持する。
- 上記以外に、マッチ判定の前でスキャン結果を列挙する調査用ログ（`scanResult id=...`）を恒久的に置いてはならない。経緯は §12 に記す。
- 件数だけを出す恒久ログは、今回は追加しない。

## 6. 接続シーケンス

### 6.1 前提条件

接続対象デバイスの広告アドレスタイプは **public** でなければならない。random static アドレスで広告された場合、GATT 接続が status `0x3E` で失敗し得る。

### 6.2 手順

1. 事前に `disconnect` を実行する。
2. `BleClient.connect` を `timeout: 10000`（10,000 ms）で実行する。
3. 接続に成功したら、`BleClient.discoverServices` を **await** する。
4. `startNotifications` で通知を購読する。

### 6.3 異常系

| 事象 | 挙動 |
| --- | --- |
| `connect` 失敗 | `showConnectFailedDialog()` を表示 |
| `discoverServices` 失敗 | 当該デバイスを `disconnect` してから `showConnectFailedDialog()` を表示する（ダイアログより**前に** disconnect） |

`discoverServices` の await 追加と失敗時の disconnect は、エミュレータ作業から切り離した**独立バグ修正**として承認されており、`src/data/src/app/data/ble.ts` の変更が許可されている。

## 7. 通知ペイロードの引き渡し

- `startNotifications` の `valueCb` は、`value.buffer`（12 バイト）を**加工せず**に呼び出し元の `bluetoothFunc` へ渡す。
- CAN デコードは `middleware.sensor.service` の責務であり、本ノードはペイロードの内容を解釈しない。
- 12 バイトの CAN 符号化仕様と列挙値定義は fact として記載する。ただし、**符号化仕様そのものを変更してはならない**。

### 7.1 通知周期

`notify_interval_ms` は、本ノードの確定定数として定義しない。エミュレータの `--rate-ms` 既定値 100 は暫定値であり、実機の必須周期が確定するまでは仕様として固定しない。

### 7.2 物理値域

以下の物理値域は確定値であり、本ノード配下の fact として昇格済みである。量子化と状態別規則は、この物理値域の内側で定義しなければならない。

| フィールド | 物理値域上限 | 改訂内容 |
| --- | --- | --- |
| `accelPedalPosition` | 100 | 120 → 100 |
| `brakePressure` | 126 | 200 → 126 |
| `steeringAngle` | 1080 | 上限を 1080 に設定 |
| `frontDistance` | 127 | 上限を 127 に設定 |

- 設計書 #12 §7 の量子化と #13 §4 の状態別規則は、上記の物理値域内に収まるよう改訂する。
- 列挙値も fact として扱う。
- 物理値域の改訂にともない、`gen-mock-sensorlog.mjs` と正準モック 6 ファイルを再生成する。
- この改訂では、12 バイト符号化、`ble.ts`、エミュレータ B、スコアロジックを変更しない。

## 8. 呼び出し元との契約

- センサーモードが `smartphoneOnly` のとき、呼び出し元は BLE の開始（`BLEDevice.start`）を**スキップ**しなければならない。
- 打ち切り判定に使う `bluetoothFunc` のライフサイクル管理は、呼び出し元の責務である。

## 9. 変更禁止範囲

`discoverServices` の追加（§6）とスキャンリトライ制御（§5）を除き、以下を変更してはならない。

- `ble.ts` の受信パス
- マッチ条件（`device.name` または `localName` が `BLE_DEVICE_NAME` と完全一致）
- `SCAN_MAX_ATTEMPTS` / `SCAN_RETRY_INTERVAL_MS`
- `connect` / `discoverServices` / `startNotifications` / `showConnectFailedDialog` の既存挙動
- `BLE_DEVICE_ID` / `BLE_DEVICE_NAME`
- proposal #77 由来の `scanStart` / `scanStop` / `requestLEScan` ヒットログ
- `ble-can-emulator.py`
- エミュレータ B（実装 B）
- スコアロジック
- `@capacitor-community/bluetooth-le` のバージョン

## 10. 2026 年度改修要求に伴う未確定事項

2026 年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17）のうち、本ノードに関係するのは次の 2 本である。

### 10.1 CAN データ項目の追加

CAN データに**標識認識・先行車検知・ウインカー**の 3 項目が追加される。

- ウインカーは、現行ペイロードの `turnSignal`（offset 11）に相当する可能性がある。ただし先方資料に対応関係の明記はなく、推測にとどまる（assumption）。
- 現行の notify ペイロードは 12 バイト固定長（`PAYLOAD_LEN=12`、offset 5–6 のみ u16 BE）である。項目追加にともなうバイト長・割り当ての変更は**未確定**のため、確定するまでは §7 の 12 バイト前提を維持する。
- 長さや割り当てが変わった場合は、`qa.mockdata.ble.emulator` の 12 バイト前提（`--inject-invalid` の short11 / long13 を含む）と、正準モックの符号化規則がすべて影響を受ける。

### 10.2 BLE 通信の安定化

先方から報告されている不具合の現象は次の 2 点である。これらを再現・検証の対象とする。

1. 起動時に車両データを取得できないことがある。
2. 演算負荷が高いと不安定になり、車両データを受信できないことがある（具体例：駐車時にデータを取得できないことがあった）。

改善方針について、先方から「シーケンス処理ではなくパラレル処理にすれば改善するのではないか」との指摘がある。これは**想定であって、確定した原因・対策ではない**。実機で確認しながら調整する領域であり、設計判断として確定させてはならない（assumption）。

再現・調整に必要なテスト用ナビ端末は先方に用意いただけるが、**提供時期は未定**である。

なお、§12 で扱うエミュレータ A への接続不能は開発用検証環境の問題であり、原因はアプリ外にあった。上記 2 現象の原因として扱ってはならない。

### 10.3 スケジュール制約

アプリ開発は 2026 年 11 月末までの完了を目標とする（2026 年 12 月から高齢者を招いた実験が始まるため）。本ノードの BLE 安定化作業も、この期限内に収める必要がある。

## 11. 検証環境の運用前提（BLE エミュレータ）

BLE エミュレータ（エミュレータ A）を使って実機検証するときは、次の運用前提を守る。いずれも調査の結果として確認された運用知見であり、コードやコメントには記載しない。

1. **他の BLE クライアントを必ず終了させる。** 実機検証の前に、nRF Connect などの BLE クライアントを終了させなければならない。接続を張ったまま放置すると BlueZ の広告が止まる。一度止まると、クライアント側で切断してもエミュレータを再起動するまで復帰しない。
2. **`ActiveInstances` を電波送出の確認に使わない。** `bluetoothctl show` の `ActiveInstances` は広告の登録状態を示すだけであり、電波が実際に出ていることの確認にはならない。

## 12. 調査用一時ログの経緯と後始末

### 12.1 経緯

- エミュレータ A に接続できない問題を調査するため、`scanOnce()` のマッチ判定の前に、スキャン結果を 1 デバイス 1 回ずつ出力する調査用一時ログの追加を許可した（commit `484a486`）。ログの形式は `[DrivingScore][BLEDevice]scanResult id=... name=... localName=... rssi=...` で、`JSON.stringify` を使って前後空白・`\u0000` の混入や短縮名を判別できるようにしていた。
- 調査の結果、原因はアプリ外（nRF Connect が接続を保持していたこと）にあると判明した（§11）。

### 12.2 決定：調査ログを全削除する（revert-all）

commit `484a486` による `ble.ts` の変更は、すべて元に戻す。削除対象は次の 4 点である。

- (a) `BLEDevice` の private フィールド `debugLoggedScanIds: Set<string> = new Set()`
- (b) `scanOnce()` 冒頭の `this.debugLoggedScanIds.clear();`
- (c) `requestLEScan` コールバック内、マッチ判定前にある `scanResult` ログ出力ブロック（`key` / `debugKey` の算出、`has` / `add` の判定、`logService.debug('[DrivingScore][BLEDevice]scanResult ...')` を含む）
- (d) 付随する `// TEMP(investigation)` コメント

### 12.3 手順

1. `git revert 484a486` を第一の手段とする。
2. `484a486` 以降に `ble.ts` へ別のコミット（例：`discoverServices` の await や catch での disconnect の修正）が入っていて競合する場合は、`484a486` の hunk だけを手で逆適用し、他の変更は残す。
3. 変更は削除だけの単独コミットにする。コミットメッセージには、proposal #261 §2-2 の後始末であること、および原因がアプリ外（nRF Connect の接続保持）だったことを書く。
4. 後始末では §9 の変更禁止範囲に触れない。README も変更しない。

### 12.4 受入確認

- (a) `git show 484a486 -- src/data/src/app/data/ble.ts` で追加された行が、HEAD の `ble.ts` に 1 行も残っていないこと。`grep -n 'debugLoggedScanIds\|scanResult id=\|TEMP(investigation)' src/data/src/app/data/ble.ts` の結果が 0 件であること。
- (b) `ng build` と `gradlew assembleDebug` が成功すること。
- (c) nRF Connect を終了させた状態で、実機からエミュレータ A に接続し、診断を開始できること。

結果は PR #16 の evidence に残す。

### 12.5 関連する扱い

- 4-2 の実機確認結果（`videoStartOffset=20ms`、`movie.webm` 非生成、`[●REC]` 表示、設定画面の確認）は、観測事実として E2E 記録に残してよい。ただし「補正は不要」という結論は proposal #243 の保留判断を確定させるものであり、本ノードでは確定させない。別途 propose する。
- 恒久対処（プラグイン変更や名前の正規化など）の方針が必要になった場合は、別の proposal で判断する。

## 13. 本ノードの対象外事項

- B 案の GPS 追加投入と、実機 GPS 受信との競合可否は、エミュレータ／センサー経路で判断する事項であり、BLEDevice の接続・通知仕様の必要条件ではない。
- CAN データを確認用に保存できるかは先方の宿題として未確定である。本ノードでは保存機構を規定しない。

---

```json
{
  "required_changes": [
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§3 のマッチ条件を『device.name と localName のどちらかが BLE_DEVICE_NAME と完全一致』に改訂し、device.name のみとしていた既存記述を fact に合わせて修正する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§5.1 に定数名 SCAN_MAX_ATTEMPTS / SCAN_RETRY_INTERVAL_MS を明記し、§5.4 として proposal #77 由来の scanStart/scanStop/requestLEScan ヒットログの維持、調査用 scanResult ログの恒久化禁止、件数ログを追加しないことを追記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§7.2 物理値域に改訂内容（120→100、200→126、steering 上限 1080、frontDistance 上限 127）、設計書 #12 §7 / #13 §4 の改訂、列挙値の fact 化、gen-mock-sensorlog.mjs と正準 6 ファイルの再生成、12 バイト符号化・ble.ts・エミュレータ B・スコアロジックの非変更を追記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§9 変更禁止範囲に、マッチ条件、SCAN_MAX_ATTEMPTS/SCAN_RETRY_INTERVAL_MS、connect/discoverServices/startNotifications/showConnectFailedDialog、BLE_DEVICE_ID/BLE_DEVICE_NAME、#77 由来ログ、ble-can-emulator.py、プラグインバージョンを追加する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§11 を新設し、BLE エミュレータ検証前に nRF Connect 等の他クライアントを必ず終了させること、bluetoothctl show の ActiveInstances は電波送出の確認にならないことを運用前提として記載する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§12 を新設し、調査用一時ログ（commit 484a486）の経緯、revert-all の決定、削除対象 4 点、git revert 優先と競合時の hunk 手動逆適用、単独コミット要件、受入確認 3 点（grep 0 件・ng build/assembleDebug 成功・nRF Connect 終了状態での接続と診断開始、PR #16 evidence）を記載する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "§12.5 に、4-2 実機確認結果は観測事実として E2E 記録可だが『補正不要』の結論は本ノードで確定させず別途 propose する旨を記載し、§10.2 にエミュレータ接続不能の原因（アプリ外）と先方報告の不具合 2 現象を混同しない旨を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "qa", "severity": "must", "reason": "BLE エミュレータを使う実機 E2E の前提手順に『nRF Connect 等の他 BLE クライアント終了』と『広告停止時はエミュレータ再起動』を組み込まないと、アプリ外要因で接続不能となり検証結果が誤判定される"},
    {"domain": "qa", "severity": "must", "reason": "調査ログ revert の受入確認（grep 0 件、ng build / gradlew assembleDebug 成功、エミュレータ A への接続と診断開始）を PR #16 evidence として取得する必要がある"},
    {"domain": "qa", "severity": "must", "reason": "CAN ペイロードのバイト長・割り当てが変わった場合、qa.mockdata.ble.emulator の 12 バイト前提（short11/long13 の --inject-invalid を含む）と正準モック 6 ファイルが全面的に影響を受ける"},
    {"domain": "qa", "severity": "should", "reason": "物理値域の改訂（100/126/1080/127）にともない gen-mock-sensorlog.mjs と正準 6 ファイルの再生成が必要で、モック期待値の更新を伴う"},
    {"domain": "qa", "severity": "should", "reason": "10-10 は BLE 接続の回復まで blocked とする決定があるため、revert 後の接続確認をもって blocked 解除してよいかの判断が必要"},
    {"domain": "middleware", "severity": "must", "reason": "標識認識・先行車検知・ウインカーの 3 項目追加により、middleware.sensor.service のデコード仕様と CanData 構造が変わる可能性がある"},
    {"domain": "middleware", "severity": "should", "reason": "演算負荷が高いときの受信不能に対してパラレル処理化を検討する場合、受信コールバックとスコア算出の実行順序・負荷設計が sensor.service 側に依存する"},
    {"domain": "ui", "severity": "should", "reason": "スキャンリトライで最大 13 秒待つ間の表示（ローディング／進捗）が未定義で、無表示だと応答なしと誤認される"},
    {"domain": "db", "severity": "could", "reason": "CAN データを確認用に保存する要求が確定した場合、保存先テーブルと保持期間の定義が必要になる"}
  ],
  "requirements_context": "BLEDevice は @capacitor-community/bluetooth-le の BleClient を用いて、初期化・スキャン・接続・サービス発見・通知購読を行う。実装真実源は src/data/src/app/data/ble.ts で、仕様と乖離した場合は仕様を真として改訂する。対象デバイスは BLE_DEVICE_NAME='DrivingCanData' で、スキャン結果の device.name と localName のどちらかが BLE_DEVICE_NAME と完全一致する広告のみを採用し、名前の正規化は行わない。BLE_DEVICE_ID='D8:3A:DD:6A:A2:15' は既定値として存在するが識別には使わない。サービス UUID は numberToUUID(0x2310)、通知キャラクタリスティックは numberToUUID(0x2311)。スキャン窓長は 3000ms で、窓内 0 件なら SCAN_RETRY_INTERVAL_MS=2000ms 待機して再スキャンし、初回を含め SCAN_MAX_ATTEMPTS=3 回（総計最大 13,000ms、タイマ誤差を含まない）まで試行する。3 回とも 0 件で初めて showConnectFailedDialog() を表示し、1・2 回目の 0 件では表示しない。ダイアログの『リトライ』は試行回数を初期化して 1 回目から再開する。待機中に bluetoothFunc === null となればリトライせず打ち切る。発見時の分岐は現行維持で、1 件なら即 connect、複数件ならユーザー選択後に connect（先頭の無条件選択は禁止）。proposal #77 由来の scanStart/scanStop/requestLEScan ヒットログは維持する。調査用 scanResult ログは恒久化せず、件数だけの恒久ログも今回は追加しない。connect は事前に disconnect したうえで timeout 10000 で実行し、成功後に BleClient.discoverServices を await してから startNotifications を行う。connect 失敗時は showConnectFailedDialog、discoverServices 失敗時はダイアログ表示の前に disconnect する。この discoverServices の変更は、エミュレータ作業から切り離した独立バグ修正として ble.ts への変更が許可されている。接続対象の広告アドレスタイプは public であることを前提とし、random static では GATT が status 0x3E で失敗し得る。通知の valueCb は 12 バイトの value.buffer を加工せず呼び出し元の bluetoothFunc に素通しし、CAN デコードは middleware.sensor.service の責務とする。12 バイト符号化と列挙値は fact として記載するが、符号化仕様自体は変更しない。notify_interval_ms は確定定数にしない（エミュレータの --rate-ms 100 は暫定値）。物理値域は accelPedalPosition 上限 100（120→100）、brakePressure 上限 126（200→126）、steeringAngle 上限 1080、frontDistance 上限 127 であり、設計書 #12 §7 の量子化と #13 §4 の状態別規則をこの物理値域内へ改訂する。列挙値も fact 化し、gen-mock-sensorlog.mjs と正準 6 ファイルを再生成する。この改訂では 12 バイト符号化・ble.ts・エミュレータ B・スコアロジックを変更しない。センサーモードが smartphoneOnly のとき、呼び出し元は BLEDevice.start をスキップする。bluetoothFunc のライフサイクル管理は呼び出し元の責務である。discoverServices の追加とスキャンリトライ制御を除き、ble.ts の受信パス、マッチ条件、SCAN_MAX_ATTEMPTS/SCAN_RETRY_INTERVAL_MS、connect/discoverServices/startNotifications/showConnectFailedDialog、BLE_DEVICE_ID/BLE_DEVICE_NAME、#77 由来ログ、ble-can-emulator.py、エミュレータ B（実装 B）、スコアロジック、プラグインバージョンは変更しない。BLE エミュレータ A への接続不能の調査のため、commit 484a486 で scanOnce() のマッチ判定前に調査用一時ログ（debugLoggedScanIds と scanResult 出力、JSON.stringify による空白・\\u0000・短縮名の判別）を追加した。原因はアプリ外（nRF Connect の接続保持）と判明したため、revert-all を採用し、484a486 の ble.ts 変更をすべて削除する。削除対象は (a) debugLoggedScanIds フィールド、(b) scanOnce 冒頭の clear()、(c) requestLEScan コールバック内の scanResult ログブロック（key/debugKey、has/add、logService.debug）、(d) TEMP(investigation) コメント。手順は git revert 484a486 を第一とし、以降の ble.ts コミット（discoverServices の await / catch での disconnect の修正など）と競合する場合は 484a486 の hunk のみ手で逆適用して他の変更を残す。削除だけの単独コミットとし、メッセージに proposal #261 §2-2 の後始末であることと原因がアプリ外だったことを書く。README には触れない。受入確認は (a) grep -n 'debugLoggedScanIds\\|scanResult id=\\|TEMP(investigation)' が 0 件、(b) ng build と gradlew assembleDebug の成功、(c) nRF Connect を終了した状態で実機からエミュレータ A に接続して診断を開始できること、とし、結果を PR #16 の evidence に残す。運用知見として、(1) BLE エミュレータを使う実機検証の前には nRF Connect 等の他 BLE クライアントを必ず終了させる（接続を放置すると BlueZ の広告が止まり、切断してもエミュレータを再起動するまで復帰しない）、(2) bluetoothctl show の ActiveInstances は広告の登録状態を示すだけで電波送出の確認にならない、を fact として記録し、コードやコメントには書かない。先行決定として、10-10 は BLE 接続の回復まで blocked とされていた。4-2 実機確認結果（videoStartOffset=20ms、movie.webm 非生成、[●REC] 表示、設定画面確認）は観測事実として E2E 記録に残してよいが、『補正は不要』の結論は proposal #243 の保留判断を確定させるため本決定では確定させず、別途 propose する。恒久対処（プラグイン変更・名前正規化等）は別 proposal で判断する。2026 年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17）により、本ノードには (1) CAN データへの標識認識・先行車検知・ウインカーの 3 項目追加、(2) BLE 通信の安定化、が加わる。ウインカーは現行 turnSignal（offset 11）相当の可能性があるが推測にとどまる。現行ペイロードは PAYLOAD_LEN=12 固定長（offset 5-6 のみ u16 BE）で、長さ・割り当ての変更は未確定のため、確定まで 12 バイト前提を維持する。変更された場合は qa.mockdata.ble.emulator の 12 バイト前提（short11/long13 を含む）と正準モックが影響を受ける。BLE 不具合の観測現象は (1) 起動時に車両データを取得できないことがある、(2) 演算負荷が高いと受信できないことがある（例：駐車時）、で、これを再現・検証対象とする。パラレル処理化は仮説であり設計確定させない。エミュレータ接続不能のアプリ外原因を先方報告の現象と混同しない。テスト用ナビ端末は先方提供だが時期未定。開発は 2026 年 11 月末完了目標（12 月から高齢者実験開始）。CAN データの確認用保存可否は未確定で、本ノードでは保存機構を規定しない。B 案 GPS 追加投入と実機 GPS 受信の競合可否は本ノードの対象外。",
  "fact_candidates": [
    {"type": "external_integration_rule", "title": "BLE 実装は Capacitor BLE プラグインに依存する", "statement": "BLEDevice は @capacitor-community/bluetooth-le の BleClient を用いて初期化・スキャン・接続・サービス発見・通知購読を行わなければならない", "status": "approved"},
    {"type": "constraint", "title": "マッチ条件は device.name または localName の完全一致", "statement": "スキャン結果は device.name と localName のどちらかが BLE_DEVICE_NAME（DrivingCanData）と完全一致する広告のみ採用しなければならない", "status": "approved"},
    {"type": "constraint", "title": "BLE_DEVICE_ID は識別に使わない", "statement": "BLE_DEVICE_ID='D8:3A:DD:6A:A2:15' は既定値として存在するが、実装上の識別には使ってはならない", "status": "approved"},
    {"type": "constraint", "title": "スキャンリトライは最大 3 回・総計最大 13,000ms", "statement": "スキャン窓 3000ms、0 件時は SCAN_RETRY_INTERVAL_MS=2000ms 待機、初回を含め SCAN_MAX_ATTEMPTS=3 回まで試行し、3 回とも 0 件で初めて showConnectFailedDialog を表示する", "status": "approved"},
    {"type": "constraint", "title": "接続後に discoverServices を await し失敗時はダイアログ前に disconnect", "statement": "connect（timeout 10000）成功後に BleClient.discoverServices を await し、失敗時は showConnectFailedDialog の前に disconnect しなければならない。これは独立バグ修正として ble.ts への変更が許可されている", "status": "approved"},
    {"type": "external_integration_rule", "title": "相手広告のアドレスタイプは public", "statement": "接続対象デバイスの広告アドレスタイプは public でなければならず、random static では GATT 接続が status 0x3E で失敗し得る", "status": "approved"},
    {"type": "api_contract", "title": "通知ペイロード 12 バイトは素通し", "statement": "startNotifications の valueCb は value.buffer（12 バイト）を加工せず呼び出し元の bluetoothFunc へ渡さなければならない", "status": "approved"},
    {"type": "constraint", "title": "物理値域は 100/126/1080/127", "statement": "accelPedalPosition 上限 100、brakePressure 上限 126、steeringAngle 上限 1080、frontDistance 上限 127 であり、量子化と状態別規則はこの範囲内で定義しなければならない", "status": "approved"},
    {"type": "constraint", "title": "物理値域改訂時はモックを再生成する", "statement": "物理値域の改訂にともない gen-mock-sensorlog.mjs と正準 6 ファイルを再生成し、12 バイト符号化・ble.ts・エミュレータ B・スコアロジックは変更しない", "status": "approved"},
    {"type": "constraint", "title": "notify_interval_ms は確定定数にしない", "statement": "infra.ble.device に notify_interval_ms を確定定数として追加してはならず、エミュレータの --rate-ms 既定 100 は暫定値である", "status": "approved"},
    {"type": "constraint", "title": "smartphoneOnly では BLE を起動しない", "statement": "センサーモードが smartphoneOnly のとき、呼び出し元は BLEDevice.start をスキップしなければならない", "status": "approved"},
    {"type": "constraint", "title": "proposal #77 由来のスキャンログは維持する", "statement": "scanStart / scanStop / requestLEScan ヒットログは変更・削除してはならない", "status": "approved"},
    {"type": "constraint", "title": "調査用 scanResult ログは ble.ts に残さない", "statement": "commit 484a486 で追加した debugLoggedScanIds、clear()、scanResult ログブロック、TEMP(investigation) コメントはすべて削除しなければならず、件数だけの恒久ログも今回は追加しない", "status": "approved"},
    {"type": "constraint", "title": "調査ログ削除は git revert 優先・単独コミット", "statement": "削除は git revert 484a486 を第一とし、競合時は 484a486 の hunk のみ手で逆適用して他の変更を残す。コミットは削除単独とし、メッセージに proposal #261 §2-2 の後始末と原因がアプリ外だったことを記載しなければならない", "status": "approved"},
    {"type": "qa_expectation", "title": "調査ログ削除の受入確認", "statement": "grep -n 'debugLoggedScanIds\\|scanResult id=\\|TEMP(investigation)' が 0 件、ng build と gradlew assembleDebug が成功、nRF Connect 終了状態で実機からエミュレータ A に接続し診断を開始できることを確認し、PR #16 の evidence に残す", "status": "approved"},
    {"type": "constraint", "title": "エミュレータ検証前に他 BLE クライアントを終了する", "statement": "BLE エミュレータを使う実機検証の前に、nRF Connect などの他 BLE クライアントを必ず終了させなければならない", "status": "approved"},
    {"type": "constraint", "title": "BLE クライアント接続放置で BlueZ 広告が停止する", "statement": "他クライアントが接続を張ったまま放置すると BlueZ の広告が止まり、切断してもエミュレータを再起動するまで復帰しない", "status": "approved"},
    {"type": "constraint", "title": "ActiveInstances は電波送出の証拠にならない", "statement": "bluetoothctl show の ActiveInstances は広告の登録状態を示すだけで、電波が出ていることの確認にはならない", "status": "approved"},
    {"type": "constraint", "title": "運用知見はコードやコメントに書かない", "statement": "エミュレータ運用知見 2 点は fact として記録し、ble.ts のコードやコメントには記載してはならない", "status": "approved"},
    {"type": "constraint", "title": "4-2 の『補正不要』結論は本ノードで確定させない", "statement": "4-2 実機確認結果は観測事実として E2E 記録に残してよいが、『補正は不要』の結論は proposal #243 の保留判断にかかわるため別途 propose しなければならない", "status": "approved"},
    {"type": "api_contract", "title": "CAN データに 3 項目が追加される", "statement": "2026 年度改修要求により、CAN データへ標識認識・先行車検知・ウインカーの 3 項目が追加される", "status": "approved"},
    {"type": "assumption", "title": "ウインカーは現行 turnSignal 相当の可能性", "statement": "CAN 追加項目のウインカーは現行 turnSignal（offset 11）に相当する可能性があるが、先方資料に対応関係の明記はない", "status": "assumption"},
    {"type": "qa_expectation", "title": "BLE 受信不具合の観測現象 2 点", "statement": "(1) 起動時に車両データを取得できないことがある、(2) 演算負荷が高いと受信できないことがある（例：駐車時）、の 2 点を再現・検証対象とする", "status": "approved"},
    {"type": "assumption", "title": "パラレル処理化は仮説", "statement": "『パラレル処理にすれば改善する』という先方指摘は確定した原因・対策ではなく、設計判断として確定させてはならない", "status": "assumption"},
    {"type": "constraint", "title": "開発完了期限は 2026 年 11 月末", "statement": "アプリ開発は 2026 年 11 月末完了を目標とし、2026 年 12 月から高齢者を招いた実験が開始される", "status": "approved"}
  ],
  "open_questions": [
    "CAN データに追加される 3 項目（標識認識・先行車検知・ウインカー）により、notify ペイロードのバイト長（現行 PAYLOAD_LEN=12）と割り当てがどう変わるかが未確定。車載機ファーム仕様の提示が必要（車載機／Middleware 判断）。決まらないと、ble.ts の素通し前提、sensor.service のデコード、qa.mockdata.ble.emulator の 12 バイト前提（short11/long13）、正準モック 6 ファイルを確定できない。",
    "追加項目『ウインカー』が現行 turnSignal（offset 11）と同一か新規項目かが未確定。先方資料に対応の明記がないためで、Middleware／車載機の確認が必要。決まらないとフィールド追加数とペイロード長を見積もれない。",
    "10-10 は『BLE 接続が回復するまで blocked』とされていたが、revert 後の受入確認（エミュレータ A への接続と診断開始）をもって blocked を解除してよいかが未確定。QA 判断が必要で、決まらないと E2E 進捗の扱いが定まらない。",
    "4-2 について『補正は不要』とする結論は proposal #243 の保留判断を確定させるものであり、本ノードでは確定していない。録画／Middleware 側での別途 propose が必要で、決まらないと videoStartOffset 補正の要否が保留のまま残る。",
    "『起動時に車両データを取得できない』現象の原因層（スキャン 0 件／discoverServices 失敗／通知購読失敗）が未切り分け。エミュレータ接続不能の原因はアプリ外と判明したが、先方報告の実車現象とは別物であり、テスト用ナビ端末が未提供のため実機で切り分けられない。QA／インフラ判断が必要で、決まらないと追加対策の要否が決まらない。",
    "『演算負荷が高いと受信できない』現象について、負荷源（スコア算出・録画・GPS 等）の特定と BLE 受信の優先度確保の方式が未確定。Middleware 判断が必要で、決まらないと安定化施策を確定できない。",
    "パラレル処理化は仮説段階であり、採否が未確定。実機確認後の判断が必要で、決まらないと §9 の受信パス変更禁止を解除すべきか判断できない。",
    "テスト用ナビ端末の提供時期が未定であり、2026 年 11 月末完了目標に対して実機検証期間を確保できるか不明。先方との調整が必要で、決まらないとスケジュールリスクを評価できない。",
    "CAN データの確認用保存が確定した場合、保存対象（生 12 バイトかデコード後か）、保存先、保持期間が未定。DB／インフラ判断が必要で、決まらないとストレージ容量と受け渡し契約への影響を評価できない。",
    "列挙値は fact 化対象だが、具体的な値の一覧が本ノードへの入力に含まれていない。設計書または正準 6 ファイルでの確認（Middleware 判断）が必要で、決まらないとモック期待値を固定できない。",
    "名前の不一致（前後空白・\\u0000・短縮名など）に対して恒久対処（名前の正規化やプラグイン変更）を行うかが未確定。今回の原因はアプリ外であったため別 proposal で判断することになっており、決まらないと車載機ファームの広告名揺れに対する耐性が未定のまま残る。",
    "スキャンリトライ中（最大 13 秒）の UI 表示が未確定。UI／QA 判断が必要で、決まらないと『応答なし』と誤認されるリスクが残る。",
    "待機中の打ち切り条件が bluetoothFunc === null だけで十分か（画面遷移・診断キャンセルなど他の中断経路の有無）が未確定。Middleware 判断が必要で、決まらないと打ち切り漏れでリソースが残留し得る。",
    "車載機ファーム側で広告アドレスタイプが public に固定されることが保証されるか未確定。車載機／インフラの確認が必要で、保証されない場合は status 0x3E 時の追加リカバリ仕様が必要になる。"
  ],
  "rationale_notes": [
    "既存 md は device.name のみでマッチ判定すると記述していたが、revert 決定の fact に『device.name / localName のどちらかが BLE_DEVICE_NAME と完全一致』と明記されているため、fact を真として §3 を改訂した。",
    "調査用一時ログは『追加許可』と『全削除（revert-all）』の 2 つの decision があるが、後者が最終状態である。仕様書では最終状態（ble.ts に残さない）を規範とし、追加の経緯は §12.1 に履歴として残した。",
    "運用知見 2 点は『コードやコメントには書かない』とされているが、fact として記録する対象であり、検証環境の運用前提として仕様書に載せることはこの制約と矛盾しないと判断して §11 に置いた。",
    "エミュレータ A の接続不能はアプリ外要因だったが、これを先方報告の実車不具合 2 現象の原因と誤って結び付けないよう、§10.2 に混同禁止の注記を加えた。",
    "物理値域の改訂値（120→100、200→126）は、旧値に基づくモックや量子化の残存を検出できるよう、改訂前後の対応として表に残した。",
    "10-10 の blocked 扱いと 4-2 の『補正不要』結論は他ノード（QA／録画）の判断にかかわるため、本文では『本ノードで確定させない』範囲にとどめ、解除判断は open_questions に回した。",
    "ダイアログ文言と CAN バイト割当の詳細表は、既存どおり本ノードには記載しない。CAN デコードの責務は middleware.sensor.service のままとした。"
  ]
}
```