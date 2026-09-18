<!-- 作成: 2026-09-10 17:35:43 JST | 更新: 2026-09-18 17:45:40 JST -->

# BLE デバイス接続仕様（infra.ble.device）

## 1. 目的と責務

本ノードは、車載 CAN データ送信機（BLE ペリフェラル）との接続および通知購読を担うインフラ層の仕様を定義する。

責務範囲：

- BLE スタックの初期化
- 対象デバイスのスキャンおよび選択
- GATT 接続、サービス発見、通知購読
- 受信した通知ペイロードを呼び出し元へ引き渡すこと

責務外：

- 12 バイト CAN ペイロードのデコード（`middleware.sensor.service` の責務）
- スコア算出（`middleware.score-logic` の責務）
- センサーモード判定およびライフサイクル制御（呼び出し元の責務）

### 1.1 実装真実源

本ノードの実装真実源は `src/data/src/app/data/ble.ts` である。仕様と実装が乖離した場合、本仕様書を真として `ble.ts` を改訂する。

## 2. 依存プラグイン

BLE 実装は `@capacitor-community/bluetooth-le` の `BleClient` に依存する。初期化・スキャン・接続・サービス発見・通知購読のすべてを `BleClient` 経由で行う。

## 3. 対象デバイスの識別

| 項目 | 値 | 備考 |
| --- | --- | --- |
| デバイス名 | `DrivingCanData` | 固定。完全一致で判定 |
| `BLE_DEVICE_ID` | `D8:3A:DD:6A:A2:15` | 既定値として存在するが**識別には使用しない** |

- スキャン結果は `device.name === 'DrivingCanData'` の広告のみを採用し、それ以外のデバイス名は無視する。
- `BLE_DEVICE_ID` は設定上の既定値にとどまり、実装上の識別キーとして参照してはならない。

## 4. GATT プロファイル

| 項目 | UUID |
| --- | --- |
| サービス | `numberToUUID(0x2310)` |
| 通知キャラクタリスティック | `numberToUUID(0x2311)` |

## 5. スキャン仕様

### 5.1 タイミング定数

| 定数 | 値 | 意味 |
| --- | --- | --- |
| スキャン窓長 | 3,000 ms | `requestLEScan` 開始から `stopLEScan` まで |
| 再スキャン待機 | 2,000 ms | 0 件だった場合の待機時間 |
| 最大試行回数 | 3 回 | 初回を含む |
| スキャン総計（上限） | 13,000 ms | 3,000 × 3 + 2,000 × 2 |

スキャン総計 13,000 ms は上記内訳から導かれる設計上の上限値であり、実装上のタイマ誤差は含まない。

### 5.2 スキャンリトライ制御

1. `requestLEScan` を開始し、3,000 ms 後に `stopLEScan` する。
2. 窓内で `DrivingCanData` が 1 件以上発見された場合は §5.3 の分岐へ進む。
3. 窓内が 0 件だった場合は 2,000 ms 待機し、再スキャンする。
4. 上記を初回を含め**最大 3 回**まで試行する。
5. 3 回すべて 0 件だった場合に**初めて** `showConnectFailedDialog()` を表示する。1 回目・2 回目の 0 件では表示してはならない。

#### リトライ操作

接続失敗ダイアログの「リトライ」が選択された場合、スキャン試行回数を初期化し、1 回目から再開する。

#### 待機中の打ち切り

再スキャン待機中に `bluetoothFunc === null` となった場合、リトライを継続せずスキャン処理を打ち切る。

### 5.3 発見時の分岐（現行維持）

| 発見件数 | 挙動 |
| --- | --- |
| 0 件 | §5.2 に従い待機→再スキャン（最大 3 回）。3 回 0 件で失敗ダイアログ |
| 1 件 | 即 `connect` |
| 複数件 | ユーザー選択後に `connect`（無条件に先頭を選んではならない） |

## 6. 接続シーケンス

### 6.1 前提条件

接続対象デバイスの広告アドレスタイプは **public** でなければならない。random static アドレスで広告された場合、GATT 接続が status `0x3E` で失敗し得る。

### 6.2 手順

1. 事前に `disconnect` を実行する。
2. `BleClient.connect` を `timeout: 10000`（10,000 ms）で実行する。
3. 接続成功後、`BleClient.discoverServices` を **await** する。
4. `startNotifications` により通知を購読する。

### 6.3 異常系

| 事象 | 挙動 |
| --- | --- |
| `connect` 失敗 | `showConnectFailedDialog()` |
| `discoverServices` 失敗 | `showConnectFailedDialog()` を出す**前に** 当該デバイスを `disconnect` する |

`discoverServices` の await 追加および失敗時 disconnect は、エミュレータ作業から切り離した**独立バグ修正**として `src/data/src/app/data/ble.ts` への変更が承認されている。

## 7. 通知ペイロードの引き渡し

- `startNotifications` の `valueCb` は `value.buffer`（12 バイト）を**加工せず**、呼び出し元 `bluetoothFunc` へ素通しする。
- CAN デコードは `middleware.sensor.service` の責務であり、本ノードは内容を解釈しない。
- 12 バイトの CAN 符号化仕様および列挙値定義は fact として記載するが、**符号化仕様自体を変更してはならない**。

### 7.1 通知周期

`notify_interval_ms` は本ノードの確定定数として定義しない。エミュレータの `--rate-ms` 既定値 100 は暫定値であり、実機の必須周期が確定するまで仕様固定を避ける。

### 7.2 物理値域

以下の物理値域は確定値である。量子化および状態別規則は、この物理値域内で定義されなければならない。

| フィールド | 物理値域上限 |
| --- | --- |
| `accelPedalPosition` | 100 |
| `brakePressure` | 126 |
| `steeringAngle` | 1080 |
| `frontDistance` | 127 |

## 8. 呼び出し元との契約

- センサーモードが `smartphoneOnly` のとき、呼び出し元は BLE 開始（`BLEDevice.start`）を**スキップ**しなければならない。
- 打ち切り判定に用いる `bluetoothFunc` のライフサイクル管理は呼び出し元の責務である。

## 9. 変更禁止範囲

`discoverServices` 追加およびスキャンリトライ制御を除き、以下を変更してはならない。

- `ble.ts` の受信パス
- エミュレータ B
- スコアロジック

## 10. 2026 年度改修要求に伴う未確定事項

2026 年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17）のうち、本ノードに関係する要求は以下の 2 本である。

### 10.1 CAN データ項目の追加

CAN データに**標識認識・先行車検知・ウインカー**の 3 項目が追加される。

- ウインカーは現行ペイロードの `turnSignal`（offset 11）に相当する可能性があるが、先方資料に対応関係の明記はなく、推測にとどまる（assumption）。
- 現行の notify ペイロードは 12 バイト固定長（`PAYLOAD_LEN=12`、offset 5–6 のみ u16 BE）である。項目追加に伴うバイト長・割り当ての変更は**未確定**であり、確定するまで §7 の 12 バイト前提を維持する。
- 長さ・割り当てが変更された場合、`qa.mockdata.ble.emulator` の 12 バイト前提（`--inject-invalid` の short11 / long13 を含む）および正準モックの符号化規則がすべて影響を受ける。

### 10.2 BLE 通信の安定化

先方から報告されている不具合の現象は次の 2 点であり、再現・検証対象として扱う。

1. 起動時に車両データを取得できないことがある。
2. 演算負荷が高いと不安定になり車両データを受信できないことがある（具体例：駐車時にデータが取得できないことがあった）。

改善方針について、先方から「シーケンス処理ではなくパラレル処理にすれば改善するのではないか」との指摘があるが、これは**想定であって確定した原因・対策ではない**。実機で確認しながら調整する領域であり、設計判断として確定させてはならない（assumption）。

再現・調整に必要なテスト用ナビ端末は先方に用意いただけるが、**提供時期は未定**である。

### 10.3 スケジュール制約

アプリ開発は 2026 年 11 月末までの完了を目標とする（2026 年 12 月から高齢者を招いた実験が開始されるため）。本ノードの BLE 安定化作業もこの期限内に収める必要がある。

## 11. 本ノードの対象外事項

- B 案の GPS 追加投入および実機 GPS 受信との競合可否は、エミュレータ／センサー経路の判断であり、BLEDevice の接続・通知仕様の必要条件ではない。
- CAN データを確認用に保存できるかは先方の宿題として未確定であり、本ノードでは保存機構を規定しない。

---

```json
{
  "required_changes": [
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "2026年度改修要求に伴う節を新設し、CANデータへの標識認識・先行車検知・ウインカー3項目追加（ウインカー=turnSignal相当はassumption）とペイロード長・割り当て未確定を明記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "BLE受信不具合の観測現象2点（起動時に取得できない／演算負荷が高いと不安定）を再現・検証対象として記載し、パラレル処理化は仮説であり設計確定しない旨を明記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "テスト用ナビ端末の提供時期未定、および2026年11月末完了・12月実験開始のスケジュール制約を追記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "CANデータの確認用保存可否は未確定であり本ノードで保存機構を規定しないことを対象外事項に追記する"},
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "既存のスキャン最大3回／総計13,000ms／discoverServices await＋失敗時disconnect／物理値域（100/126/1080/127）／notify_interval_ms非確定／smartphoneOnly時スキップの記述は既存ファクトと整合するため維持する"}
  ],
  "suggested_impacts": [
    {"domain": "qa", "severity": "must", "reason": "CANペイロードのバイト長・割り当てが変更された場合、qa.mockdata.ble.emulator の12バイト前提（short11/long13の--inject-invalid含む）と正準モック6ファイルが全面的に影響を受ける"},
    {"domain": "middleware", "severity": "must", "reason": "標識認識・先行車検知・ウインカーの3項目追加により middleware.sensor.service のデコード仕様と CanData 構造が変更される可能性がある"},
    {"domain": "qa", "severity": "must", "reason": "BLE不具合2現象（起動時取得不能／高負荷時受信不能）の再現手順と合否基準が必要で、テスト用ナビ端末提供時期未定のため代替検証手段の設計も要る"},
    {"domain": "middleware", "severity": "should", "reason": "パラレル処理化を検討する場合、受信コールバックとスコア算出の実行順序・キューイング前提が sensor.service 側の負荷設計に依存する"},
    {"domain": "ui", "severity": "should", "reason": "スキャンリトライ最大13秒間の待ち時間中の表示（ローディング／進捗）が未定義で、無表示だと応答なしと誤認される"},
    {"domain": "db", "severity": "could", "reason": "CANデータを確認用に保存する要求が確定した場合、保存先テーブル・保持期間の定義が必要になる"}
  ],
  "requirements_context": "BLEDeviceは@capacitor-community/bluetooth-le の BleClient を用い、名前 DrivingCanData 固定でスキャンする。真実源は src/data/src/app/data/ble.ts。スキャン窓長は3000msで、窓内0件なら2000ms待機して再スキャンし、初回を含め最大3回（総計最大13,000ms）試行する。3回とも0件で初めて showConnectFailedDialog() を表示し、ダイアログの『リトライ』は試行回数を1回目からリセットして再開する。待機中に bluetoothFunc === null であれば打ち切る。発見時の分岐（0件/1件は即connect/複数件はユーザー選択）は現行維持。connect は事前 disconnect のうえ timeout 10000 で実行し、成功後に BleClient.discoverServices を await してから startNotifications を行う。discoverServices が失敗した場合は showConnectFailedDialog の前に disconnect する。この discoverServices 追加はエミュレータ作業から切り離した独立バグ修正として ble.ts への変更を許可する。相手広告のアドレスタイプは public であることを前提とし、random static では GATT が status 0x3E で失敗し得る。サービスUUIDは numberToUUID(0x2310)、通知キャラクタリスティックは numberToUUID(0x2311)。通知の valueCb は12バイトの value.buffer を加工せず呼び出し元 bluetoothFunc に素通しする。CANデコードは middleware.sensor.service の責務。notify_interval_ms は本ノードの確定定数として追加しない（エミュレータの --rate-ms 100 は暫定値）。センサーモードが smartphoneOnly のときは呼び出し元が BLE 開始をスキップする。物理値域は accelPedalPosition 上限100、brakePressure 上限126、steeringAngle 上限1080、frontDistance 上限127 であり、量子化と状態別規則はこの物理値域内で定義される。12バイト符号化と列挙値は fact として記載するが符号化仕様自体は変更しない。BLE_DEVICE_ID='D8:3A:DD:6A:A2:15' は既定値として存在するが識別には使わない。2026年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17）により、本ノードには(1)CANデータへの標識認識・先行車検知・ウインカー3項目追加、(2)BLE通信の安定化、の2要求が加わる。ウインカーは現行 turnSignal（offset 11）相当の可能性があるが対応関係は未明記の推測。現行ペイロードは PAYLOAD_LEN=12 固定長（offset 5-6 のみ u16 BE）で、項目追加に伴う長さ・割り当て変更は未確定であり、確定するまで12バイト前提を維持する。変更された場合は qa.mockdata.ble.emulator の12バイト前提（--inject-invalid の short11/long13 含む）と正準モックの符号化規則が影響を受ける。BLE不具合の観測現象は(1)起動時に車両データを取得できないことがある、(2)演算負荷が高いと不安定になり受信できないことがある（例：駐車時）の2点で、これを再現・検証対象とする。先方指摘の『パラレル処理化で改善するのではないか』は仮説であり確定した原因・対策ではなく、実機で確認しながら調整する領域として設計確定させない。再現・調整用のテスト用ナビ端末は先方提供だが提供時期未定。開発は2026年11月末完了目標（12月から高齢者実験開始）。CANデータの確認用保存可否は先方の宿題として未確定であり、本ノードでは保存機構を規定しない。B案GPS追加投入と実機GPS受信の競合可否は本ノード対象外。",
  "fact_candidates": [
    {
      "type": "external_integration_rule",
      "title": "BLE実装はCapacitor BLEプラグインに依存する",
      "statement": "BLEDeviceは@capacitor-community/bluetooth-leのBleClientを用いて初期化・スキャン・接続・サービス発見・通知購読を行わなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "真実源はble.ts",
      "statement": "本ノードの実装真実源はsrc/data/src/app/data/ble.tsである",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "対象デバイス名はDrivingCanData固定",
      "statement": "スキャン結果はdevice.nameがDrivingCanDataの広告のみ採用し、他デバイス名は無視しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE_DEVICE_IDは識別に使わない",
      "statement": "BLE_DEVICE_ID='D8:3A:DD:6A:A2:15'は既定値として存在するが実装上の識別には使わず、デバイス名で識別する",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "GATTサービスと通知キャラクタリスティック",
      "statement": "BLEサービスUUIDはnumberToUUID(0x2310)、通知キャラクタリスティックUUIDはnumberToUUID(0x2311)でなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "スキャン窓長は3000ms",
      "statement": "1回のスキャンはrequestLEScan開始後3000msでstopLEScanしなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "スキャンは初回を含め最大3回",
      "statement": "スキャン窓で0件だった場合は2000ms待機して再スキャンし、初回を含め最大3回まで試行しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "スキャン総計時間は最大13,000ms",
      "statement": "3000msスキャン×3回と2000ms待機×2回により、スキャン全体の所要は最大13,000msである",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "失敗ダイアログは3回とも0件のときのみ表示する",
      "statement": "showConnectFailedDialog()は3回のスキャンがすべて0件だった場合に初めて表示しなければならず、1回目・2回目の0件では表示してはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "リトライ操作は試行回数をリセットする",
      "statement": "接続失敗ダイアログの『リトライ』を選択した場合、スキャン試行回数を初期化して1回目から再開しなければならない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "待機中にbluetoothFuncがnullなら打ち切る",
      "statement": "再スキャン待機中にbluetoothFunc === nullとなった場合、リトライを継続せずスキャン処理を打ち切らなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "発見時の0/1/複数分岐は現行維持",
      "statement": "スキャン窓内で発見された場合の分岐（1件なら即connect、複数件ならユーザー選択後にconnect）は現行仕様のまま変更してはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "複数デバイスはユーザー選択必須",
      "statement": "DrivingCanDataが複数マッチした場合は無条件に先頭を選ばず、ユーザー選択後にconnectしなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "接続タイムアウトは10000ms",
      "statement": "BleClient.connectはtimeout 10000で実行しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "接続後にdiscoverServicesをawaitする",
      "statement": "connect成功後、startNotificationsの前にBleClient.discoverServicesをawaitしなければならない。本変更はエミュレータ作業から切り離した独立バグ修正としてsrc/data/src/app/data/ble.tsに許可する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "サービス発見失敗時はダイアログ前にdisconnectする",
      "statement": "discoverServicesが失敗した場合はshowConnectFailedDialogを出す前に当該デバイスをdisconnectしなければならない",
      "status": "approved"
    },
    {
      "type": "external_integration_rule",
      "title": "相手広告のアドレスタイプはpublicであること",
      "statement": "接続対象デバイスの広告アドレスタイプはpublicでなければならない。random staticの場合、GATT接続がstatus 0x3Eで失敗し得る",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "通知ペイロードは12バイトを素通しする",
      "statement": "startNotificationsのvalueCbはvalue.buffer（12バイト）を加工せず呼び出し元bluetoothFuncへ渡さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "12バイト符号化仕様は変更しない",
      "statement": "12バイトのCAN符号化仕様および列挙値定義はfactとして記載するが、符号化仕様自体を変更してはならない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "accelPedalPositionの物理値域上限は100",
      "statement": "accelPedalPositionの物理値域上限は100であり、量子化および状態別規則はこの値域内で定義されなければならない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "brakePressureの物理値域上限は126",
      "statement": "brakePressureの物理値域上限は126であり、量子化および状態別規則はこの値域内で定義されなければならない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "steeringAngleの物理値域上限は1080",
      "statement": "steeringAngleの物理値域上限は1080であり、量子化および状態別規則はこの値域内で定義されなければならない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "frontDistanceの物理値域上限は127",
      "statement": "frontDistanceの物理値域上限は127であり、量子化および状態別規則はこの値域内で定義されなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "notify_interval_msは本ノードの確定定数にしない",
      "statement": "infra.ble.deviceにnotify_interval_msを確定定数として追加してはならない。エミュレータの--rate-ms既定100は暫定値である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "smartphoneOnlyではBLEを起動しない",
      "statement": "センサーモードがsmartphoneOnlyのとき、呼び出し元はBLE開始（BLEDevice.start）をスキップしなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ble.ts受信パス・エミュレータB・スコアロジックは変更しない",
      "statement": "discoverServices追加およびスキャンリトライ制御を除き、ble.tsの受信パス、エミュレータB、スコアロジックは変更してはならない",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "CANデータに標識認識・先行車検知・ウインカーの3項目が追加される",
      "statement": "2026年度改修要求により、CANデータへ標識認識・先行車検知・ウインカーの3項目が追加される",
      "status": "approved"
    },
    {
      "type": "assumption",
      "title": "追加項目『ウインカー』は現行turnSignalに相当する可能性",
      "statement": "CAN追加項目のうちウインカーは現行BLEペイロードのturnSignal（offset 11）に相当する可能性があるが、先方資料に対応関係の明記はなく推測にとどまる",
      "status": "assumption"
    },
    {
      "type": "open_question",
      "title": "CANペイロードの長さ・割り当て変更が未確定",
      "statement": "標識認識・先行車検知の追加に伴う12バイト固定長（PAYLOAD_LEN=12、offset 5-6のみu16 BE）の変更有無・割り当てが未確定であり、確定するまで12バイト前提を維持する",
      "status": "open_question"
    },
    {
      "type": "qa_expectation",
      "title": "BLE受信で観測されている不具合の現象",
      "statement": "BLE不具合として(1)起動時に車両データを取得できないことがある、(2)演算負荷が高いと不安定になり車両データを受信できないことがある（例：駐車時に取得できなかった）の2点を再現・検証対象として扱う",
      "status": "approved"
    },
    {
      "type": "assumption",
      "title": "BLEのパラレル処理化は仮説であり確定ではない",
      "statement": "『シーケンス処理ではなくパラレル処理にすれば改善するのではないか』という先方指摘は想定であり確定した原因・対策ではないため、設計判断として確定させてはならない",
      "status": "assumption"
    },
    {
      "type": "open_question",
      "title": "テスト用ナビ端末の提供時期が未定",
      "statement": "BLE不具合の再現・調整に必要なテスト用ナビ端末は先方提供だが、提供時期が未定である",
      "status": "open_question"
    },
    {
      "type": "constraint",
      "title": "開発完了期限は2026年11月末",
      "statement": "アプリ開発は2026年11月末までの完了を目標とし、2026年12月から高齢者を招いた実験が開始される",
      "status": "approved"
    },
    {
      "type": "open_question",
      "title": "CANデータの確認用保存可否が未確定",
      "statement": "CANデータを確認用に保存できるかは先方の宿題として未確定であり、本ノードでは保存機構を規定しない",
      "status": "open_question"
    },
    {
      "type": "assumption",
      "title": "B案GPS投入は本ノード対象外",
      "statement": "B案のGPS追加投入と実機GPS受信の競合可否はエミュレータ/センサー経路の判断であり、BLEDeviceの接続・通知仕様の必要条件ではない",
      "status": "assumption"
    }
  ],
  "open_questions": [
    "CANデータに追加される標識認識・先行車検知・ウインカーの3項目により、notifyペイロードのバイト長（現行PAYLOAD_LEN=12）と割り当てがどう変わるかが未確定。車載機ファーム仕様の提示が必要（車載機／Middleware判断）で、決まらないとble.tsの素通し前提・sensor.serviceのデコード・qa.mockdata.ble.emulatorの12バイト前提（short11/long13）と正準モック6ファイルを確定できない。",
    "追加項目『ウインカー』が現行turnSignal（offset 11）と同一項目か新規項目かが未確定。先方資料に対応関係の明記がないため推測にとどまり、Middleware/車載機確認が必要。決まらないとフィールド追加数とペイロード長の見積りが固定できない。",
    "『起動時に車両データを取得できない』現象の原因層（スキャン0件かdiscoverServices失敗か通知購読失敗か）が未切り分け。テスト用ナビ端末が未提供のため実機切り分けができず、既存のスキャン3回リトライ／discoverServices await追加で解消するかも未検証。QA/インフラ判断が必要で、追加対策の要否が定まらない。",
    "『演算負荷が高いと受信できない』現象について、負荷源（スコア算出・録画・GPS等）の特定とBLE受信の優先度確保方式が未確定。Middleware（処理負荷設計）判断が必要で、決まらないと安定化施策を確定できない。",
    "パラレル処理化を採用するかは仮説段階のため未確定。実機確認後の判断が必要で、決まらないとble.tsの受信パス変更禁止範囲（変更禁止範囲§9）を解除すべきか判断できない。",
    "テスト用ナビ端末の提供時期が未定で、2026年11月末完了目標に対する実機検証期間が確保できるか不明。先方調整が必要で、決まらないとBLE安定化の検証計画とスケジュールリスクが評価できない。",
    "CANデータを確認用に保存する要求が確定した場合の保存対象（生12バイトかデコード後か）・保存先・保持期間が未定。DB/インフラ判断が必要で、決まらないとストレージ容量と本ノードのペイロード受け渡し契約への影響が評価できない。",
    "brakeSwitch / shiftIndication / turnSignal の列挙値集合はfact化対象だが、具体値一覧が本ノード入力に無い。設計書または正準6ファイル側の確認（Middleware判断）が必要で、決まらないと列挙値をノード仕様に確定できずモック期待値も固定できない。",
    "スキャンリトライ中のUI表示（最大13秒の待ち時間にローディング/進捗を出すか）が未確定。UI/QA判断が必要で、決まらないと『応答なし』と誤認されるユーザ体験リスクとテスト期待値が定まらない。",
    "discoverServicesの引数（deviceIdのみかサービスUUID指定か）と、失敗時ダイアログがスキャン0件時と同一のshowConnectFailedDialogでよいかが未確定。実装/QA確認が必要で、エラーメッセージ文言と異常系テストに影響する。",
    "待機中の打ち切り条件がbluetoothFunc === nullのみで十分か（画面遷移・診断キャンセル等の他の中断経路があるか）が未確定。Middleware（呼び出し元ライフサイクル）判断が必要で、決まらないと打ち切り漏れでリソースが残留し得る。",
    "接続対象がrandom staticアドレスで広告する可能性が実機で残るか（車載機ファーム側でpublic固定が保証されるか）が未確定。車載機/インフラ確認が必要で、保証されない場合はstatus 0x3E時の追加リカバリ仕様が必要になる。",
    "車載機本体のnotify周期は本ノードで確定しない暫定100ms扱いだが、実機の必須周期が存在するかは車載機/QA確認が未了。実機試験の期待間隔と欠落判定に影響する。"
  ],
  "rationale_notes": [
    "今回の統合の主眼は2026年度改修要求の取り込みであり、既存の接続・スキャン仕様（3回リトライ・13,000ms・discoverServices await・物理値域・notify_interval_ms非確定）は承認済みファクトと矛盾しないため全面的に維持した。",
    "CAN項目追加（標識認識・先行車検知・ウインカー）は api_contract として確定事実だが、ペイロード長・割り当ての変更有無は未確定のため、§7の12バイト前提は『確定するまで維持』という形で条件付き記述に留めた。これによりqa.mockdata.ble.emulatorの現行12バイト前提を今の時点で崩さない。",
    "ウインカー=turnSignal相当はassumptionのままとし、本文でも『推測にとどまる』と明示して確定記述と区別した。",
    "BLE安定化要求については、観測現象2点をqa_expectationとして確定記載する一方、パラレル処理化はassumptionとして分離した。§9の変更禁止範囲（受信パス変更禁止）と衝突するため、方針確定前に実装変更が走らないよう仮説であることを本文で明記している。",
    "テスト用ナビ端末の提供時期未定は、2026年11月末完了目標に直接干渉するスケジュールリスクであるため、要求節と並べて記載した。",
    "CANデータ保存可否は本ノードのペイロード受け渡し契約に影響し得るが現時点では未確定のため、対象外事項として『保存機構を規定しない』と明示した。",
    "B案GPSのdesign_decisionはnode_idがinfra.ble.deviceに紐づかないため本文の対象外事項に短く置き、assumptionとして分離した。",
    "スコアロジック関連の承認済みfact（#81系・_simple未配線・scoreA三重代入等）はmiddleware/infra.assets側のノード責務であり、本ノードには持ち込まない。",
    "ダイアログ文言・CANバイト割当の詳細表は既存どおり記載せず、CANデコード責務はmiddleware.sensor.serviceのままとする方針を維持した。"
  ]
}
```