<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-08-24 14:16:09 JST -->

# infra.ble.device — BLE 車載機 DrivingCanData 通信クラス

## 概要
`BLEDevice` は `@capacitor-community/bluetooth-le` を用い、車載機 `DrivingCanData` の広告を 3 秒スキャンし、接続後にサービス発見を経て 12 バイトの CAN パケットを通知購読で受け取り、呼び出し元へ渡す。

## 真実源
- `src/data/src/app/data/ble.ts`

## 定数
```
BLE_SERVICE               = numberToUUID(0x2310)
BLE_CHARACTERISTIC_NOTIFY = numberToUUID(0x2311)
BLE_DEVICE_ID             = 'D8:3A:DD:6A:A2:15'   // 既定端末（実装上は使っておらず名前で識別）
BLE_DEVICE_NAME           = 'DrivingCanData'
```

本ノードに `notify_interval_ms` を確定定数として置かない。`--rate-ms` 既定 100 は暫定値のまま据え置く。

## コンストラクタ
- 引数: `LogService`（[[middleware.log.service]]）、`AlertController`（Ionic）
- インスタンス生成のみ。`start()` を呼ぶまで通信は開始しない。

## API
| メソッド | 挙動 |
|---|---|
| `start(bluetoothFunc)` | `BleClient.initialize()` → `BleClient.isEnabled()`（念のため有効化）→ `scanStart()`。失敗時は `showStartErrorDialog()` を表示し `false` を返す |
| `stop()` | `bluetoothFunc=null`、`clearInterval(timer)`、`BleClient.stopLEScan()`、接続中の全デバイスへ `stopNotifications` → `disconnect` を実行 |
| `connect(deviceId)` (private) | 念のため `disconnect` してから `BleClient.connect(deviceId, disconnectCb, { timeout: 10000 })`。接続後に `BleClient.discoverServices` を await する。成功時は接続情報を `connectDevices` に push し `startNotification`。`discoverServices` 失敗時は `showConnectFailedDialog` の前に当該デバイスを `disconnect` する |
| `scanStart()` (private) | `scanDeviceIds` をクリアし、`BleClient.requestLEScan({ services: [] }, cb)` で広告を集める。`cb` は `result.device.name === 'DrivingCanData'` のみ push。**3 秒後**に `stopLEScan()` を呼び、件数で分岐: 0→`showConnectFailedDialog`、1→`connect(scanDeviceIds[0])`、複数→`showConnectDialog()` でラジオ選択 |
| `startNotification(device)` (private) | `BleClient.startNotifications(deviceId, service, characteristic, valueCb)`。`valueCb` は `value.buffer`（12 バイト）をそのまま呼び出し元 `bluetoothFunc` に渡す |

## ダイアログ
- `showStartErrorDialog`: 「Bluetoothが無効になっています。端末の設定でBluetoothを有効にしてください。」／閉じる
- `showConnectDialog`: 複数デバイス選択（ラジオボタン、先頭が checked=true）／キャンセル・OK。OK 時に `connect(選択 deviceId)`
- `showConnectFailedDialog`: 「Bluetooth接続に失敗しました。」／閉じる・リトライ（リトライで `scanStart()` を再実行）

## 呼び出し元での CAN パケット解釈
[[middleware.sensor.service]]（`initializeBluetooth`）が `bluetoothFunc` として渡されたコールバック内で以下のバイト割当を復号する。12 バイト符号化および `ble.ts` の受信パス（バッファの素通し）は変更しない。

| offset (byte) | 型/エンディアン | スケール | 意味 |
|---|---|---|---|
| 0 | u8 | ×1 | vehicleSpeed |
| 1 | u8 | ×0.01 − 1.28 | longAcc |
| 2 | u8 | ×0.01 − 1.28 | latAcc |
| 3 | u8 | ×0.5 | frontDistance |
| 4 | u8 | ×0.5 − 64 | lateralDistance |
| 5–6 | u16 (BE) | ×0.1 − 1080 | steeringAngle |
| 7 | u8 | ×1 | accelPedalPosition |
| 8 | u8 | ×1 | brakePressure |
| 9 | u8 | — | brakeSwitch |
| 10 | u8 | — | shiftIndication |
| 11 | u8 | — | turnSignal |

デコードそのものは [[middleware.sensor.service]] に実装されているため、`BLEDevice` はデバイス選定・接続・サービス発見・通知購読・エラーダイアログのみを担う。

## 物理値域
設計書の物理値域を本ノード配下の事実として扱う。量子化・状態別規則・モック生成側は当該値域に合わせるが、12 バイト符号化・`ble.ts`・エミュレータ B・スコアロジックは変更しない。

- `steeringAngle` 上限: 1080
- `frontDistance` 上限: 127
- 設計書改訂として、従前 120 とされていた上限は 100、従前 200 とされていた上限は 126 とする（対象フィールドの対応は未確定ならモック／設計書側を正とする）
- 列挙値（`brakeSwitch` / `shiftIndication` / `turnSignal`）も本ノード配下の事実対象とする

## 業務ルール
- BLE デバイス名は `DrivingCanData` に固定。他のデバイス名は無視する。
- 複数マッチした場合は必ずユーザーに選択させる（無条件に先頭を選ばない）。
- 接続後、通知購読の前に `BleClient.discoverServices` を await しなければならない。失敗時は失敗ダイアログ表示前に disconnect する。本修正はエミュレータ作業から切り離した `infra.ble.device` の独立バグ修正として `src/data/src/app/data/ble.ts` に許可する。
- センサー起動ゲートはモード別（詳細は [[middleware.sensor.service]]）。全モードで GPS 必須。`canDataOnly` は GPS+canData、`smartphoneOnly` は GPS+加速度+方位+磁力計、`combination` は両方。`smartphoneOnly` のときは呼び出し元で BLE 起動をスキップする。
- 実センサー経路の起動時ゲートは起動時一度きり。起動後の欠損は前回値（lastXxx）据え置き。`canData` は `{repeat:-1}` で任意。

## 関連ノード
- 依存先: [[infra.bluetooth.le]]、[[middleware.log.service]]
- 呼び出し元: [[middleware.sensor.service]]

```json
{
  "required_changes": [
    {"node": "infra.ble.device", "entrypoint": "spec/infra/ble-device.md", "description": "connect後にdiscoverServicesをawaitし失敗時は失敗ダイアログ前にdisconnectする手順をAPI/業務ルールへ反映し、notify_interval_msは確定定数化しない旨と物理値域を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "モード別センサーゲートとCANデコード・起動後欠損時の前回値保持は呼び出し元middleware.sensor.serviceの責務であり仕様整合が必要"},
    {"domain": "qa", "severity": "should", "reason": "discoverServices失敗時のdisconnect→失敗ダイアログとリトライ（scanStart再実行）の接続異常系を検証対象に含める必要がある"},
    {"domain": "middleware", "severity": "could", "reason": "12バイト符号化と受信パスは変更しないためデコード表のバイト割当自体の改訂は不要"}
  ],
  "requirements_context": "BLEDeviceは@capacitor-community/bluetooth-leでDrivingCanDataを名前固定で3秒スキャンし、単一なら接続・複数なら選択・0件なら失敗ダイアログとする。connectは事前disconnectのうえtimeout 10000で接続し、その後discoverServicesをawaitしてから通知購読する。discoverServices失敗時はshowConnectFailedDialogの前にdisconnectする。通知値は12バイトbufferを素通しする。notify_interval_msは本ノードの確定定数にしない（--rate-ms既定100は暫定）。smartphoneOnlyでは呼び出し元がBLE起動をスキップする。全モードGPS必須、canDataOnlyはGPS+canData、combinationは両方。起動時ゲートは一度きり、起動後欠損はlastXxx据え置き、canDataは{repeat:-1}で任意。物理値域としてsteeringAngle上限1080・frontDistance上限127、および120→100・200→126の改訂を本ノード事実とするが12バイト符号化・ble.ts受信・エミュレータB・スコアロジックは変更しない。",
  "fact_candidates": [
    {
      "type": "external_integration_rule",
      "title": "BLE実装はCapacitor BLEプラグインに依存する",
      "statement": "BLEDeviceは@capacitor-community/bluetooth-leのBleClientを用いて初期化・スキャン・接続・通知購読を行う",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "対象デバイス名はDrivingCanData固定",
      "statement": "スキャン結果はdevice.nameがDrivingCanDataの広告のみ採用し、他デバイス名は無視しなければならない",
      "status": "candidate"
    },
    {
      "type": "api_contract",
      "title": "GATTサービスと通知キャラクタリスティック",
      "statement": "BLEサービスUUIDはnumberToUUID(0x2310)、通知キャラクタリスティックUUIDはnumberToUUID(0x2311)でなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLE_DEVICE_IDは識別に使わない",
      "statement": "BLE_DEVICE_ID='D8:3A:DD:6A:A2:15'は既定値として存在するが実装上の識別には使わず、デバイス名で識別する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "スキャン時間は3秒",
      "statement": "requestLEScan開始後3秒でstopLEScanし、0件なら失敗ダイアログ、1件なら即connect、複数なら選択ダイアログに分岐しなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "接続タイムアウトは10000ms",
      "statement": "BleClient.connectはtimeout 10000で実行しなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "接続後にdiscoverServicesをawaitする",
      "statement": "connect成功後、startNotificationsの前にBleClient.discoverServicesをawaitしなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "サービス発見失敗時はダイアログ前にdisconnectする",
      "statement": "discoverServicesが失敗した場合はshowConnectFailedDialogを出す前に当該デバイスをdisconnectしなければならない",
      "status": "candidate"
    },
    {
      "type": "api_contract",
      "title": "通知ペイロードは12バイトを素通しする",
      "statement": "startNotificationsのvalueCbはvalue.buffer（12バイト）を加工せず呼び出し元bluetoothFuncへ渡さなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "notify_interval_msは本ノードの確定定数にしない",
      "statement": "infra.ble.deviceにnotify_interval_ms=100を確定定数として追加してはならない。--rate-ms既定100は暫定値のまま据え置く",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "smartphoneOnlyではBLEを起動しない",
      "statement": "センサーモードがsmartphoneOnlyのとき、呼び出し元はBLEDevice.startをスキップしなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "複数デバイスはユーザー選択必須",
      "statement": "DrivingCanDataが複数マッチした場合は無条件に先頭を選ばず、ユーザー選択後にconnectしなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "ble.tsの受信符号化は変更しない",
      "statement": "discoverServices追加を除き、12バイト符号化とble.tsの受信パスおよびエミュレータB・スコアロジックは変更しない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "steeringAngleの物理上限は1080",
      "statement": "steeringAngleの物理値域上限は1080である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "frontDistanceの物理上限は127",
      "statement": "frontDistanceの物理値域上限は127である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "真実源はble.ts",
      "statement": "本ノードの実装真実源はsrc/data/src/app/data/ble.tsである",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "従前上限120→100および200→126の改訂がどの物理量（vehicleSpeed等）に対応するか、注入factsだけではフィールド名が確定できない。Middleware/モック生成（gen-mock-sensorlog.mjs）側の正準定義確認が必要。決まらないと物理値域セクションのフィールド対応を誤記する。",
    "brakeSwitch / shiftIndication / turnSignal の列挙値集合はfact化対象とされているが、具体値一覧が本ノード入力に無い。設計書または正準6ファイル側の確認が必要。決まらないと本ノードで列挙を確定できない。",
    "discoverServicesの引数（deviceIdのみかサービス指定か）と失敗時に使うダイアログがスキャン0件時と同一のshowConnectFailedDialogでよいか、実装差分をQA/実装と確認する必要がある。接続異常系テストとエラーメッセージに影響する。",
    "車載機本体のnotify周期は本ノードで確定しない暫定100ms扱いだが、実機必須周期があるかは車載機/QA確認が未了。実機試験の期待間隔と欠落判定に影響する。"
  ],
  "rationale_notes": [
    "approved factsを既存mdより優先し、connect後discoverServicesと失敗時disconnectを必須手順として追記した。",
    "notify_interval_ms=100を定数表へ追加しない方針を明示し、誤って確定値化しないようにした。",
    "12バイト符号化とble.ts受信・スコアロジックは変更しない事実に合わせ、呼び出し元デコード表のバイト割当は維持した。",
    "物理値域は明示された上限（steering 1080、frontDistance 127、120→100、200→126）のみ記載し、フィールド対応が不明な改訂は断定しなかった。",
    "10ms周期・runScoreLogic・DemoData経路は本ノードの通信クラス責務ではないため詳細はmiddleware側参照に留め、ゲート条件の前提のみ業務ルールへ要約した。"
  ]
}
```