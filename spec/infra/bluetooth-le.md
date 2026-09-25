<!-- 作成: 2026-09-10 17:35:36 JST | 更新: 2026-09-18 18:56:17 JST -->

# infra.bluetooth.le — Bluetooth LE Capacitor プラグイン

## 概要
BLE 通信の一次実装は Capacitor コミュニティプラグイン `@capacitor-community/bluetooth-le`。実装ラッパは [[infra.ble.device]]。

関連ユースケース: UC06（運転診断の実行）／UC11（センサーモード切替）。

本ノードは 2026 年度改修要求の 5 本のうち **④ BLE 通信の安定化** の主担当である（要求の出所は日産自動車受領の『運転機能チェックアプリの一次仕様』2026-08-04、およびメイサンソフト作成『要求仕様確認』2026-09-17）。

## 真実源
- `src/data/package.json` — `"@capacitor-community/bluetooth-le": "^2.3.0"`
- `src/data/src/app/data/ble.ts` — 利用箇所

## 使用 API
- `BleClient.initialize()`
- `BleClient.isEnabled()`
- `BleClient.requestLEScan({ services: [] }, cb)`
- `BleClient.stopLEScan()`
- `BleClient.connect(deviceId, disconnectCb, { timeout: 10000 })`
- `BleClient.disconnect(deviceId)`
- `BleClient.startNotifications(deviceId, service, characteristic, valueCb)`
- `BleClient.stopNotifications(deviceId, service, characteristic)`
- `numberToUUID(uint16)` — 16bit UUID → 128bit UUID 展開

## 接続前提（アドレスタイプ）
- プラグインは `addressType=public` 前提で接続する。
- したがって相手側（`DrivingCanData` を模す検証機・エミュレータを含む）の広告アドレスも public でなければならない。
- 相手側 BlueZ は `/etc/bluetooth/main.conf` の `Privacy=off`（既定）であること。
- 確認手段は `bluetoothctl show` でコントローラアドレスが `(public)` と表示されること。
- 上記は「接続の前提条件」として扱い、アプリ側で random address を扱う実装追加は本件の範囲外とする。
- エミュレータ側（相手側設定）は本件では変更しない。

## スキャン再試行（実機）
識別修正（A）に加え、実機の LE スキャンは次を満たさなければならない。
- 初回を含む最大 3 回スキャンする。
- 1 回のスキャンは 3000ms。結果が 0 件なら 2000ms 待機して再スキャンする。
- 一連の上限は 13,000ms（3000 + 2000 + 3000 + 2000 + 3000）。
- 3 回とも 0 件のとき初めて `showConnectFailedDialog()` を出す。
- ダイアログの「リトライ」は試行回数をリセットする。
- 待機中に `bluetoothFunc === null` なら打ち切る。
- 窓長、および発見時 0 / 1 / 複数台の分岐は現行どおり維持する。
- エミュレータ経路は変更しない。

## BLE 通信安定化（2026 年度改修要求 ④）
- 本改修の目的は BLE 受信の不安定さの改善であり、上記「スキャン再試行（実機）」は本要求に対する確定済みの対策である。
- 先方から「シーケンス処理ではなくパラレル処理にすれば改善するのではないか」という指摘があるが、**これは想定であり確定した原因・対策ではない**。パラレル化を設計判断として確定させてはならず、実機で確認しながら調整する領域として扱う。
- 不安定さの再現・調整にはテスト用ナビ端末が必要である。端末は先方から提供されるが、**提供時期は未定**（スケジュールリスクとして扱う）。
- アプリ開発全体の完了目標は 2026 年 11 月末（2026 年 12 月から高齢者を招いた実験が開始されるため）。本ノードの改修もこの期限内に収めること。

## Android パーミッション
- `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` を [[env.config.capacitor]] の `AndroidManifest.xml` で宣言。
- [[ui.opening.page]] の `checkPermission()` が起動時にランタイム許可要求する。

## 想定通信相手
- デバイス名: `DrivingCanData`（社内車載機、既定 MAC: `D8:3A:DD:6A:A2:15`）
- サービス UUID: `0x2310` → `00002310-0000-1000-8000-00805f9b34fb`（128bit 展開）
- 通知 Characteristic UUID: `0x2311` → `00002311-0000-1000-8000-00805f9b34fb`
- 通知パケット: 12 バイト固定長（`PAYLOAD_LEN=12`、offset 5-6 のみ u16 BE。バイト割当は [[infra.ble.device]] を参照）

### ペイロード長の変更可能性（現時点は 12 バイト固定を維持）
- 標識認識・先行車検知の追加にともない、CAN ペイロードのバイト長および割り当てが変更される可能性があるが、**現時点では未確定**。
- 変更された場合、[[qa.mockdata.ble.emulator]] の 12 バイト前提（`--inject-invalid` の `short11` / `long13` を含む）および正準モックの符号化規則がすべて影響を受ける。確定するまで 12 バイト固定長の前提を変更しない。
- CAN データを確認用に保存できるかどうかは先方の宿題として未確定であり、本ノードでは保存機構を規定しない。

## 未決事項（独断で確定しない）
- 切断後の自動再接続ポリシー（再接続するか／回数・間隔・打ち切り条件・ユーザ通知の有無）は未決。本仕様では確定させない。
- センサーモード `canDataOnly` と `combination` における購読差（`startNotifications` 対象や購読の維持／停止の違い）は未決。UC11 の切替時挙動として別途確定が必要。
- CAN ペイロードの長さ・バイト割り当ての変更（標識認識・先行車検知の追加にともなうもの）は未決。
- BLE 受信のパラレル処理化は仮説であり、採否は実機確認後に判断する。
- 「A の識別修正」の照合キー（デバイス名／MAC／サービス UUID のいずれか）およびスキャンフィルタ `services: []` との関係は本ノード資料だけでは確定できない。
- テスト用ナビ端末の提供時期。

## 関連ノード
- 実装ラッパ: [[infra.ble.device]]
- 呼び出し元: [[middleware.sensor.service]]
- 権限宣言: [[env.config.capacitor]]／要求実行: [[ui.opening.page]]
- 検証用エミュレータ/モック: [[qa.mockdata.ble.emulator]]

```json
{
  "required_changes": [
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "2026年度改修要求④「BLE通信の安定化」節を追加し、パラレル処理化は仮説であり設計確定してはならない旨・テスト用ナビ端末の提供時期未定・2026年11月末完了目標を明記する"},
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "通知パケット12バイト固定（PAYLOAD_LEN=12 / offset 5-6 は u16 BE）を明示し、標識認識・先行車検知追加によるペイロード長変更が未確定であること、変更時は qa.mockdata.ble.emulator の12バイト前提が影響を受けることを追記する"},
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "CANデータの確認用保存が未確定であるため本ノードでは保存機構を規定しない旨を追記する"},
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "approved のスキャン再試行仕様（最大3回・3000ms/2000ms・上限13,000ms・3回0件で失敗ダイアログ・リトライで試行回数リセット・待機中 bluetoothFunc===null で打ち切り・窓長と0/1/複数分岐は現行維持・エミュレータ非変更）および addressType=public 前提は現行記述を維持する"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "BLE安定化の実装方式（シーケンス/パラレル）と接続・購読ライフサイクルは middleware.sensor.service の状態管理に直結し、UC11 のモード切替時に購読対象が変わる可能性がある"},
    {"domain": "qa", "severity": "must", "reason": "12バイト固定前提のモック（--inject-invalid short11/long13）はペイロード仕様変更で全面影響を受け、最大13,000msの再試行と public アドレス確認手順の期待値も必要"},
    {"domain": "ui", "severity": "must", "reason": "3回0件後の showConnectFailedDialog() と「リトライ」での試行回数リセットは ui.opening.page のダイアログ契約と権限要求フローに影響する"},
    {"domain": "db", "severity": "should", "reason": "CANデータを確認用に保存する場合は保存先スキーマ・保持期間・容量影響の定義が必要になる"},
    {"domain": "infra", "severity": "should", "reason": "エミュレータ（相手側 BlueZ の Privacy=off）は本件で変更しない前提と、テスト用ナビ端末の受領時期を env.config.capacitor / 検証環境手順に反映する必要がある"}
  ],
  "requirements_context": "# infra.bluetooth.le — Bluetooth LE Capacitor プラグイン\n\n## 概要\nBLE 通信の一次実装は Capacitor コミュニティプラグイン `@capacitor-community/bluetooth-le`（package.json 上 ^2.3.0）。実装ラッパは [[infra.ble.device]]、呼び出し元は [[middleware.sensor.service]]。関連ユースケースは UC06（運転診断の実行）／UC11（センサーモード切替）。本ノードは 2026 年度改修要求 5 本のうち ④ BLE 通信の安定化 の主担当。要求の出所は日産自動車受領『運転機能チェックアプリの一次仕様』2026-08-04 と メイサンソフト『要求仕様確認』2026-09-17。開発完了目標は 2026 年 11 月末（12 月から高齢者実験開始）。\n\n## 真実源\n- `src/data/package.json`（依存版）\n- `src/data/src/app/data/ble.ts`（利用箇所）\n\n## 使用 API\ninitialize / isEnabled / requestLEScan({ services: [] }, cb) / stopLEScan / connect(deviceId, disconnectCb, { timeout: 10000 }) / disconnect / startNotifications / stopNotifications / numberToUUID。\n\n## 接続前提（アドレスタイプ）\n- プラグインは addressType=public 前提で接続するため、相手側（検証機・エミュレータ含む）の広告アドレスも public でなければならない。\n- 相手側 BlueZ は /etc/bluetooth/main.conf の Privacy=off（既定）。\n- 確認手段は bluetoothctl show でコントローラアドレスが (public) 表示であること。\n- アプリ側で random address を扱う実装追加は範囲外。エミュレータ側設定は本件で変更しない。\n\n## スキャン再試行（実機・approved）\n- 識別修正（A）に加え、初回を含む最大 3 回スキャン。\n- 1 回 3000ms、0 件なら 2000ms 待機して再スキャン、一連の上限 13,000ms。\n- 3 回とも 0 件のとき初めて showConnectFailedDialog() を出す。\n- ダイアログの「リトライ」は試行回数をリセットする。\n- 待機中に bluetoothFunc === null なら打ち切る。\n- 窓長および発見時 0/1/複数台の分岐は現行維持。エミュレータ経路は変更しない。\n\n## BLE 安定化（要求④）\n- スキャン再試行が確定済み対策。\n- 「シーケンス処理ではなくパラレル処理にすれば改善するのではないか」は先方の想定にとどまり、確定した原因・対策ではない。設計判断として確定させず、実機確認しながら調整する。\n- 再現・調整にはテスト用ナビ端末が必要。先方提供予定だが提供時期未定（スケジュールリスク）。\n\n## Android パーミッション\n- BLUETOOTH_SCAN / BLUETOOTH_CONNECT / BLUETOOTH_ADVERTISE を [[env.config.capacitor]] の AndroidManifest.xml で宣言。\n- 起動時のランタイム許可要求は [[ui.opening.page]] の checkPermission() が行う。\n\n## 想定通信相手\n- デバイス名 DrivingCanData（社内車載機、既定 MAC D8:3A:DD:6A:A2:15）。\n- サービス UUID 0x2310 → 00002310-0000-1000-8000-00805f9b34fb。\n- 通知 Characteristic 0x2311 → 00002311-0000-1000-8000-00805f9b34fb。\n- 通知パケットは 12 バイト固定長（PAYLOAD_LEN=12、offset 5-6 のみ u16 BE）。バイト割当は [[infra.ble.device]]。\n- 標識認識・先行車検知の追加でバイト長・割当が変わる可能性があるが未確定。変更時は [[qa.mockdata.ble.emulator]] の 12 バイト前提（--inject-invalid の short11/long13）と正準モック符号化規則が影響を受けるため、確定まで 12 バイト固定を維持する。\n- CAN データの確認用保存可否は先方宿題で未確定。本ノードでは保存機構を規定しない。\n\n## 未決事項\n- 切断後の自動再接続ポリシー（要否・回数・間隔・打ち切り・通知）。\n- canDataOnly と combination の購読差（購読対象・維持/停止）。\n- CAN ペイロード長・割当の変更内容。\n- パラレル処理化の採否。\n- 「A の識別修正」の照合キーと services: [] フィルタとの関係。\n- 発見時 0/1/複数台の現行分岐詳細。\n- addressType=public を満たさない相手に遭遇した場合の扱い。\n- テスト用ナビ端末の提供時期。\n\n## 関連ノード\n[[infra.ble.device]] / [[middleware.sensor.service]] / [[env.config.capacitor]] / [[ui.opening.page]] / [[qa.mockdata.ble.emulator]]",
  "fact_candidates": [
    {
      "type": "external_integration_rule",
      "title": "BLE一次実装は bluetooth-le プラグイン",
      "statement": "BLE通信の一次実装は Capacitor コミュニティプラグイン @capacitor-community/bluetooth-le であり、package.json 上の版は ^2.3.0 である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLE実装ラッパの所在",
      "statement": "BLEプラグインの実装ラッパは infra.ble.device である",
      "status": "candidate"
    },
    {
      "type": "api_contract",
      "title": "BleClient 必須API",
      "statement": "利用APIは initialize / isEnabled / requestLEScan({ services: [] }) / stopLEScan / connect(timeout 10000) / disconnect / startNotifications / stopNotifications / numberToUUID である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "connect タイムアウトは10000ms",
      "statement": "BleClient.connect は timeout 10000 で呼び出されなければならない",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "接続は addressType=public 前提",
      "statement": "@capacitor-community/bluetooth-le は addressType=public 前提で接続するため、接続相手の広告アドレスも public でなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "相手側 BlueZ は Privacy=off",
      "statement": "接続相手側の /etc/bluetooth/main.conf は Privacy=off（既定）でなければならない",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "public アドレスの確認手段",
      "statement": "接続前提の確認は bluetoothctl show でコントローラアドレスが (public) と表示されることをもって行う",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "エミュレータ側は変更しない",
      "statement": "本件ではエミュレータ（相手側）の設定および経路を変更してはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "実機スキャンは最大3回",
      "statement": "実機LEスキャンは初回を含めて最大3回行わなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "スキャン3000msと0件時2000ms待機",
      "statement": "1回のスキャンは3000msであり、0件なら2000ms待機して再スキャンしなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "スキャン一連の上限13000ms",
      "statement": "実機スキャン再試行の一連の上限時間は13,000msでなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "3回0件まで接続失敗ダイアログを出さない",
      "statement": "3回とも0件のとき初めて showConnectFailedDialog() を出さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "失敗ダイアログのリトライは試行回数リセット",
      "statement": "showConnectFailedDialog の「リトライ」は試行回数をリセットしなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "待機中bluetoothFunc nullで打ち切り",
      "statement": "スキャン間待機中に bluetoothFunc === null ならスキャン再試行を打ち切らなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "発見台数分岐は現行維持",
      "statement": "スキャン窓長および発見時0/1/複数台の分岐は現行どおり維持しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE安定化は2026年度改修要求④",
      "statement": "BLE通信の安定化は2026年度改修要求5本のうちの1本であり、本ノードがその主担当である",
      "status": "candidate"
    },
    {
      "type": "assumption",
      "title": "パラレル処理化は仮説であり設計確定してはならない",
      "statement": "BLE受信のパラレル処理化は先方の想定であって確定した原因・対策ではなく、設計判断として確定させてはならない（実機確認しながら調整する）",
      "status": "assumption"
    },
    {
      "type": "constraint",
      "title": "BLE不具合調整にテスト用ナビ端末が必要",
      "statement": "BLE不具合の再現・調整にはテスト用ナビ端末が必要であり、端末は先方から提供される",
      "status": "approved"
    },
    {
      "type": "open_question",
      "title": "テスト用ナビ端末の提供時期が未定",
      "statement": "テスト用ナビ端末の提供時期は未定であり、BLE安定化作業のスケジュールリスクとなる",
      "status": "open_question"
    },
    {
      "type": "constraint",
      "title": "開発完了目標は2026年11月末",
      "statement": "アプリ開発は2026年11月末までの完了を目標とし、本ノードの改修もこの期限内に収めなければならない",
      "status": "approved"
    },
    {
      "type": "permission_rule",
      "title": "Android BLEパーミッション宣言",
      "statement": "AndroidManifest.xml で BLUETOOTH_SCAN / BLUETOOTH_CONNECT / BLUETOOTH_ADVERTISE を宣言しなければならない",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "起動時ランタイム許可",
      "statement": "起動時のランタイム許可要求は ui.opening.page の checkPermission() が行う",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "想定BLE相手デバイス",
      "statement": "想定通信相手のデバイス名は DrivingCanData であり、既定MACは D8:3A:DD:6A:A2:15 である",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "サービスUUIDは 00002310-0000-1000-8000-00805f9b34fb",
      "statement": "サービスUUIDは 0x2310 を 128bit 展開した 00002310-0000-1000-8000-00805f9b34fb である",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "通知Characteristicは 00002311-0000-1000-8000-00805f9b34fb",
      "statement": "通知 Characteristic UUID は 0x2311 を 128bit 展開した 00002311-0000-1000-8000-00805f9b34fb である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "通知パケットは12バイト固定（PAYLOAD_LEN=12）",
      "statement": "通知パケットは12バイト固定長であり、offset 5-6 のみ u16 BE として扱う",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "CANペイロード長・割当の変更が未確定",
      "statement": "標識認識・先行車検知の追加によるCANペイロードのバイト長および割り当ての変更内容は未確定であり、確定まで12バイト固定前提を維持する",
      "status": "open_question"
    },
    {
      "type": "open_question",
      "title": "CANデータの確認用保存可否が未確定",
      "statement": "CANデータを確認用に保存できるかどうかは先方の宿題として未確定であり、本ノードでは保存機構を規定しない",
      "status": "open_question"
    },
    {
      "type": "open_question",
      "title": "切断後の自動再接続ポリシーは未決",
      "statement": "切断後に自動再接続するか、その回数・間隔・打ち切り条件・ユーザ通知の有無は未決である",
      "status": "open_question"
    },
    {
      "type": "open_question",
      "title": "canDataOnly と combination の購読差は未決",
      "statement": "センサーモード canDataOnly と combination における通知購読対象および購読の維持／停止の差は未決である",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "CANペイロードの長さ・バイト割り当ての変更内容が未確定。理由は標識認識・先行車検知の追加が仕様検討中であるため。infra.ble.device（デコード）と qa.mockdata.ble.emulator（12バイト前提・short11/long13 の異常注入）の判断が必要。決まらないと通知デコード仕様とモック・受入テストが確定できない。",
    "BLE受信のパラレル処理化の採否が未確定。理由は先方指摘が仮説にとどまり、原因が実機未確認であるため。middleware.sensor.service（受信・状態管理の実装方式）と QA（再現手順）の判断が必要。決まらないと安定化対策の実装方針と工数見積りが固まらない。",
    "テスト用ナビ端末の提供時期が未定。理由は先方都合であるため。プロジェクト管理と QA の判断が必要。決まらないと2026年11月末完了目標に対する BLE 安定化検証のスケジュールが引けない。",
    "切断後の自動再接続ポリシーが未確定。理由は再接続の要否・回数・間隔・打ち切り条件・UI通知の担当が定義されていないため。middleware.sensor.service と ui.opening.page の判断が必要。決まらないと UC06 の診断中断時の挙動と受入条件が書けない。",
    "センサーモード canDataOnly と combination の購読差（startNotifications 対象、モード切替時に購読を維持するか停止・再購読するか）が未確定。middleware（モード管理）と QA の確認が必要。決まらないと UC11 の切替シーケンスと BLE 購読ライフサイクルが確定できない。",
    "「A の識別修正」の具体内容（照合キーが名前/MAC/UUIDのどれか、スキャンフィルタ services: [] との関係）が本ノード資料だけでは未確定。infra.ble.device と middleware.sensor.service の判断が必要。決まらないと接続対象の一意性とスキャン成功条件が仕様化できない。",
    "発見時 0/1/複数台の「現行」分岐（複数台時の選択規則、1台時の自動接続可否、0件以外のダイアログ）の詳細が既存mdに無く現行コード確認が必要。middleware と QA の確認が必要。決まらないと再試行仕様の受け入れ条件が書けない。",
    "スキャン再試行・打ち切り・ダイアログ起動の実装責務が ble.ts / infra.ble.device / middleware.sensor.service / ui.opening.page のどこかが未確定。決まらないとノード境界とテスト観点が割れる。",
    "addressType=public 前提が満たされない相手（random/RPA 広告）に遭遇した場合の扱い（接続失敗として扱うか、環境側で是正するか）が未確定。QA と middleware の判断が必要。",
    "CANデータを確認用に保存する場合の保存先（ファイル/DB）、保持期間、端末容量への影響が未確定。db と infra（ストレージ）の判断が必要。"
  ],
  "rationale_notes": [
    "facts を真とする方針に従い、approved のスキャン再試行仕様と addressType=public 前提は表現を変えずに維持し、2026年度改修要求④の文脈（安定化の位置づけ・期限・端末提供）を新規節として追加した。",
    "パラレル処理化は approved ではなく assumption として与えられているため、仕様本文では『確定させてはならない』という制約の形で記述し、実装方式を invent していない。",
    "ペイロード長の変更可能性は open_question だが、未確定期間の振る舞いを曖昧にしないため『確定まで12バイト固定を維持する』という暫定ルールとして明記した。qa.mockdata.ble.emulator の 12 バイト前提が壊れる影響も併記している。",
    "CANデータ保存は先方宿題であり、本ノード（BLE 受信）は保存責務を持たないことを明示して責務境界を保った。",
    "public アドレス前提はアプリ側実装追加ではなく相手側環境の必要条件として記述し、エミュレータ非変更の approved 事実と整合させている。",
    "その他の approved facts（レーダーチャート、サービス案表示、録画、画面回転など）は BLE インフラの責務外のため本仕様には取り込まず、ペイロード影響のあるものだけを参照した。"
  ]
}
```