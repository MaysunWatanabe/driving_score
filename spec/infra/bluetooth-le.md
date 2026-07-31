# infra.bluetooth.le — Bluetooth LE Capacitor プラグイン

## 概要
BLE 通信の一次実装は Capacitor コミュニティプラグイン `@capacitor-community/bluetooth-le`。実装ラッパは [[infra.ble.device]]。

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

## Android パーミッション
- `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` を [[env.config.capacitor]] の `AndroidManifest.xml` で宣言。
- [[ui.opening.page]] の `checkPermission()` が起動時にランタイム許可要求する。

## 想定通信相手
- デバイス名: `DrivingCanData`（社内車載機、既定 MAC: `D8:3A:DD:6A:A2:15`）
- サービス UUID: `0x2310` → `0000-2310-…`（128bit 展開）
- 通知 Characteristic UUID: `0x2311`
- 通知パケット: 12 バイト固定長（バイト割当は [[infra.ble.device]] を参照）

## 関連ノード
- 実装ラッパ: [[infra.ble.device]]
- 呼び出し元: [[middleware.sensor.service]]
