<!-- 作成: 2026-08-31 16:23:04 JST | 更新: 2026-09-10 17:35:35 JST -->

```json
{
  "required_changes": [
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "addressType=public 前提の接続条件（相手側広告 public / Privacy=off 既定 / bluetoothctl show が (public)）を接続前提として追記し、切断後の自動再接続ポリシーと canDataOnly/combination の購読差は未決として明記する"},
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "approved のスキャン再試行仕様（最大3回・3000ms/2000ms・上限13,000ms・3回0件で失敗ダイアログ・リトライで試行回数リセット・待機中 bluetoothFunc===null で打ち切り・エミュレータ非変更）は現行記述を維持する"},
    {"node": "infra.bluetooth.le", "entrypoint": "spec/infra/bluetooth-le.md", "description": "関連ユースケースとして UC06（運転診断の実行）/ UC11（センサーモード切替）を明記する"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "接続シーケンス・スキャン再試行・切断後の再接続判断は [[middleware.sensor.service]] の状態管理に直結し、UC11 のモード切替時に購読対象が変わる可能性がある"},
    {"domain": "ui", "severity": "must", "reason": "3回0件後の showConnectFailedDialog() と「リトライ」での試行回数リセットは [[ui.opening.page]] のダイアログ契約と権限要求フローに影響する"},
    {"domain": "qa", "severity": "must", "reason": "addressType=public 前提の検証手順（bluetoothctl show で (public)）と最大13,000msの再試行、実機/エミュレータ分岐の期待値が必要"},
    {"domain": "infra", "severity": "should", "reason": "エミュレータ（相手側 BlueZ 設定 Privacy=off）は本件で変更しない前提を [[env.config.capacitor]] / 検証環境手順に反映する必要がある"}
  ],
  "requirements_context": "# infra.bluetooth.le — Bluetooth LE Capacitor プラグイン\n\n## 概要\nBLE 通信の一次実装は Capacitor コミュニティプラグイン `@capacitor-community/bluetooth-le`。実装ラッパは [[infra.ble.device]]。\n\n関連ユースケース: UC06（運転診断の実行）／UC11（センサーモード切替）。\n\n## 真実源\n- `src/data/package.json` — `\"@capacitor-community/bluetooth-le\": \"^2.3.0\"`\n- `src/data/src/app/data/ble.ts` — 利用箇所\n\n## 使用 API\n- `BleClient.initialize()`\n- `BleClient.isEnabled()`\n- `BleClient.requestLEScan({ services: [] }, cb)`\n- `BleClient.stopLEScan()`\n- `BleClient.connect(deviceId, disconnectCb, { timeout: 10000 })`\n- `BleClient.disconnect(deviceId)`\n- `BleClient.startNotifications(deviceId, service, characteristic, valueCb)`\n- `BleClient.stopNotifications(deviceId, service, characteristic)`\n- `numberToUUID(uint16)` — 16bit UUID → 128bit UUID 展開\n\n## 接続前提（アドレスタイプ）\n- プラグインは `addressType=public` 前提で接続する。\n- したがって相手側（`DrivingCanData` を模す検証機・エミュレータを含む）の広告アドレスも public でなければならない。\n- 相手側 BlueZ は `/etc/bluetooth/main.conf` の `Privacy=off`（既定）であること。\n- 確認手段は `bluetoothctl show` でコントローラアドレスが `(public)` と表示されること。\n- 上記は「接続の前提条件」として扱い、アプリ側で random address を扱う実装追加は本件の範囲外とする。\n- エミュレータ側（相手側設定）は本件では変更しない。\n\n## スキャン再試行（実機）\n識別修正（A）に加え、実機の LE スキャンは次を満たさなければならない。\n- 初回を含む最大 3 回スキャンする。\n- 1 回のスキャンは 3000ms。結果が 0 件なら 2000ms 待機して再スキャンする。\n- 一連の上限は 13,000ms（3000 + 2000 + 3000 + 2000 + 3000）。\n- 3 回とも 0 件のとき初めて `showConnectFailedDialog()` を出す。\n- ダイアログの「リトライ」は試行回数をリセットする。\n- 待機中に `bluetoothFunc === null` なら打ち切る。\n- 窓長、および発見時 0 / 1 / 複数台の分岐は現行どおり維持する。\n- エミュレータ経路は変更しない。\n\n## Android パーミッション\n- `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` を [[env.config.capacitor]] の `AndroidManifest.xml` で宣言。\n- [[ui.opening.page]] の `checkPermission()` が起動時にランタイム許可要求する。\n\n## 想定通信相手\n- デバイス名: `DrivingCanData`（社内車載機、既定 MAC: `D8:3A:DD:6A:A2:15`）\n- サービス UUID: `0x2310` → `00002310-0000-1000-8000-00805f9b34fb`（128bit 展開）\n- 通知 Characteristic UUID: `0x2311` → `00002311-0000-1000-8000-00805f9b34fb`\n- 通知パケット: 12 バイト固定長（バイト割当は [[infra.ble.device]] を参照）\n\n## 未決事項（独断で確定しない）\n- 切断後の自動再接続ポリシー（再接続するか／回数・間隔・打ち切り条件・ユーザ通知の有無）は未決。本仕様では確定させない。\n- センサーモード `canDataOnly` と `combination` における購読差（`startNotifications` 対象や購読の維持／停止の違い）は未決。UC11 の切替時挙動として別途確定が必要。\n\n## 関連ノード\n- 実装ラッパ: [[infra.ble.device]]\n- 呼び出し元: [[middleware.sensor.service]]\n- 権限宣言: [[env.config.capacitor]]／要求実行: [[ui.opening.page]]",
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
      "title": "通知パケットは12バイト固定",
      "statement": "通知パケットは12バイト固定長である",
      "status": "candidate"
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
    "切断後の自動再接続ポリシーが未確定。理由は context で明示的に未決とされ、再接続の要否・回数・間隔・打ち切り条件・UI通知の担当が定義されていないため。middleware.sensor.service（接続状態管理）と ui.opening.page（通知/ダイアログ）の判断が必要。決まらないと UC06 の診断中断時の挙動と受入条件が書けない。",
    "センサーモード canDataOnly と combination の購読差（startNotifications 対象、モード切替時に購読を維持するか停止・再購読するか）が未確定。理由は context で未決と明示されているため。middleware（モード管理）と QA の確認が必要。決まらないと UC11 の切替シーケンスと BLE 購読ライフサイクルが確定できない。",
    "「A の識別修正」の具体内容（照合キーが名前/MAC/UUIDのどれか、スキャンフィルタ services: [] との関係）が本ノード資料だけでは未確定。理由は approved 文面が定義を含まず参照のみであるため。infra.ble.device と middleware.sensor.service の判断が必要。決まらないと接続対象の一意性とスキャン成功条件が仕様化できない。",
    "発見時0/1/複数台の「現行」分岐（複数台時の選択規則、1台時の自動接続可否、0件以外のダイアログ）の詳細が既存mdに無く、現行コード確認が必要。理由は「現行維持」とだけ記載されているため。middleware と QA の確認が必要。決まらないと再試行仕様の受け入れ条件が書けない。",
    "スキャン再試行・打ち切り・ダイアログ起動の実装責務が ble.ts / infra.ble.device / middleware.sensor.service / ui.opening.page のどこかが未確定。理由は真実源が ble.ts 利用に留まり制御フローの所在が記載されていないため。決まらないとノード境界とテスト観点が割れる。",
    "addressType=public 前提が満たされない相手（random/RPA 広告）に遭遇した場合の扱い（接続失敗として扱うか、環境側で是正するか）が未確定。理由は context が「接続前提として扱う」までを承認し例外処理を規定していないため。QA と middleware の判断が必要。"
  ],
  "rationale_notes": [
    "facts と既存mdが矛盾する場合は facts を真とする方針に従い、承認済みの addressType=public 前提を新規節として追加し、既存のプラグイン・API・権限・通信相手・スキャン再試行の記述は削除せず維持した。",
    "public アドレス前提はアプリ側の実装追加ではなく「相手側環境の必要条件」として記述した。エミュレータを変更しないという承認事実と整合させるため、是正はアプリ側でなく環境側の確認手順（bluetoothctl show）に寄せている。",
    "切断後の自動再接続ポリシーと canDataOnly/combination の購読差は context で明確に未決とされたため、仕様本文には『未決事項』節として存在のみを記録し、挙動を invent していない。",
    "UUID は context に完全形が示されたため 128bit 表記を明記し、既存の 0x2310/0x2311 表記と併記して可読性を保った。",
    "「A の識別修正」の中身は資料に無いため、approved 文面どおり参照だけを残している。"
  ]
}
```