# infra.cordova.sensors — 端末センサープラグイン群

## 概要
GPS・加速度計・ジャイロスコープ・磁力計・画面向き・スリープ抑止・SQLite・ランタイム権限を担う Cordova/Capacitor プラグイン群。DI 登録は [[env.app.bootstrap]]、実利用は [[middleware.sensor.service]] / [[db.user.repository]] / [[db.score.repository]] などにわたる。

## 真実源
- `src/data/package.json`
- `src/data/src/app/app.module.ts`
- `src/data/src/app/services/sensor.service.ts`
- `src/data/src/app/opening/opening.page.ts` — パーミッション要求

## プラグイン一覧
| プラグイン | 用途 | 呼び出し方法 |
|---|---|---|
| `@capacitor/geolocation` | GPS 監視 | `Geolocation.watchPosition({ maximumAge, timeout, enableHighAccuracy: true }, cb)` |
| `@capacitor/motion` | Web の `deviceorientation` イベント補完（実際は `window.addEventListener('devicemotion' / 'deviceorientationabsolute')` を使用） |
| `@awesome-cordova-plugins/device-motion` | DI に登録するが実利用は `window.addEventListener('devicemotion')` |
| `@awesome-cordova-plugins/magnetometer` | 磁力計 | `magnetometer.watchReadings().subscribe(cb)` |
| `@awesome-cordova-plugins/screen-orientation` | 画面向き固定・監視 | `screenOrientation.lock('portrait')` / `.unlock()` / `.onChange().subscribe()` |
| `@awesome-cordova-plugins/insomnia` | スリープ抑止 | `insomnia.keepAwake()` / `.allowSleepAgain()`（[[ui.driving.page]] のみ） |
| `@awesome-cordova-plugins/sqlite` | SQLite | `sqlite.create({ name: 'driving-score.db', location: 'default' })` |
| `@awesome-cordova-plugins/sqlite-porter` | SQLite の import/export（現状は依存追加のみ、コード呼び出しなし） |
| `@awesome-cordova-plugins/android-permissions` | ランタイム権限要求 | `androidPermissions.checkPermission()` / `.requestPermission()` |

## パーミッション要求フロー
[[ui.opening.page]] の `checkPermission()` が起動時に以下を **順次** 要求する（Android のみ実行）。
- `INTERNET`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`

`WRITE_EXTERNAL_STORAGE` は Manifest 未宣言だが `requestPermission()` は呼ばれる（Android 12 以降では自動許可扱い）。

## 業務ルール
- センサー購読は [[ui.driving.page]] 起動中のみ（`sensor.service.start()` → 10ms 周期タイマ）。他ページに戻ると `sensor.service.stop()` で全解除。
- `runScoreLogic` フラグが false のとき、`devicemotion` / `deviceorientationabsolute` / magnetometer の受信ハンドラは早期リターンして、`lastAcceleration/Gyroscope/Magnetometer` を更新しない。GPS の `watchPosition` はフラグに関わらず値を保存する（`lastGeolocation` と Ionic Storage の `geolocation-last-pos-key`）。

## 関連ノード
- 呼び出し元: [[middleware.sensor.service]]、[[ui.opening.page]]、[[ui.driving.page]]、[[db.user.repository]]、[[db.score.repository]]
