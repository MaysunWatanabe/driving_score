# infra.ble.device — BLE 車載機 DrivingCanData 通信クラス

## 概要
`BLEDevice` は `@capacitor-community/bluetooth-le` を用い、車載機 `DrivingCanData` の広告を 3 秒スキャンし、接続後 12 バイトの CAN パケットを通知購読でデコードして呼び出し元へ渡す。

## 真実源
- `src/data/src/app/data/ble.ts`

## 定数
```
BLE_SERVICE               = numberToUUID(0x2310)
BLE_CHARACTERISTIC_NOTIFY = numberToUUID(0x2311)
BLE_DEVICE_ID             = 'D8:3A:DD:6A:A2:15'   // 既定端末（実装上は使っておらず名前で識別）
BLE_DEVICE_NAME           = 'DrivingCanData'
```

## コンストラクタ
- 引数: `LogService`（[[middleware.log.service]]）、`AlertController`（Ionic）
- インスタンス生成のみ。`start()` を呼ぶまで通信は開始しない。

## API
| メソッド | 挙動 |
|---|---|
| `start(bluetoothFunc)` | `BleClient.initialize()` → `BleClient.isEnabled()`（念のため有効化）→ `scanStart()`。失敗時は `showStartErrorDialog()` を表示し `false` を返す |
| `stop()` | `bluetoothFunc=null`、`clearInterval(timer)`、`BleClient.stopLEScan()`、接続中の全デバイスへ `stopNotifications` → `disconnect` を実行 |
| `connect(deviceId)` (private) | 念のため `disconnect` してから `BleClient.connect(deviceId, disconnectCb, { timeout: 10000 })`。接続情報を `connectDevices` に push し `startNotification` |
| `scanStart()` (private) | `scanDeviceIds` をクリアし、`BleClient.requestLEScan({ services: [] }, cb)` で広告を集める。`cb` は `result.device.name === 'DrivingCanData'` のみ push。**3 秒後**に `stopLEScan()` を呼び、件数で分岐: 0→`showConnectFailedDialog`、1→`connect(scanDeviceIds[0])`、複数→`showConnectDialog()` でラジオ選択 |
| `startNotification(device)` (private) | `BleClient.startNotifications(deviceId, service, characteristic, valueCb)`。`valueCb` は `value.buffer`（12 バイト）をそのまま呼び出し元 `bluetoothFunc` に渡す |

## ダイアログ
- `showStartErrorDialog`: 「Bluetoothが無効になっています。端末の設定でBluetoothを有効にしてください。」／閉じる
- `showConnectDialog`: 複数デバイス選択（ラジオボタン、先頭が checked=true）／キャンセル・OK。OK 時に `connect(選択 deviceId)`
- `showConnectFailedDialog`: 「Bluetooth接続に失敗しました。」／閉じる・リトライ（リトライで `scanStart()` を再実行）

## 呼び出し元での CAN パケット解釈
[[middleware.sensor.service]]（`initializeBluetooth`）が `bluetoothFunc` として渡されたコールバック内で以下のバイト割当を復号する。

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

デコードそのものは [[middleware.sensor.service]] に実装されているため、`BLEDevice` はデバイス選定・接続・通知購読・エラーダイアログのみを担う。

## 業務ルール
- BLE デバイス名は `DrivingCanData` に固定。他のデバイス名は無視する。
- 複数マッチした場合は必ずユーザーに選択させる（無条件に先頭を選ばない）。
- センサーモード `smartphoneOnly` のときは呼び出し元でスキップされる（[[middleware.sensor.service]] を参照）。

## 関連ノード
- 依存先: [[infra.bluetooth.le]]、[[middleware.log.service]]
- 呼び出し元: [[middleware.sensor.service]]
