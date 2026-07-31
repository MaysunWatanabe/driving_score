# middleware.sensor.demoData — センサログ再生シングルトン

## 概要
`DemoData` は実センサーの代替として、過去のセンサログ (gzip+Base64) と動画 (webm) を再生する **シングルトン**。ブラウザ（[[ui.edit.page]]）でのアップロード、または実機非対応環境での確認に用いる。

## 真実源
- `src/data/src/app/data/demo-data.ts`

## 静的 API
- `DemoData.initialize(file, logService)` — `File` と `LogService` をシングルトンに注入
- `DemoData.instance(): DemoData` — シングルトン取得（未生成なら `new DemoData()`）

## 内部状態
```
sensorLogDataSize: number                 // 全ファイル合計サンプル数
sensorLogFiles: Array<string>             // Base64 gzip 文字列の一覧
sensorLogFilesInfo: Array<{ length, minVideoTime, maxVideoTime, index }>
sensorLogFilesIndex: number               // 現在再生中のファイル
sensorLogData: Array<any>                 // 現在ファイルの展開済みサンプル
sensorLogDataIndex: number
drivingVideFile: string
_minVideoTime, _maxVideoTime: number      // 全ファイル通しての min/max
_movieFile: any                           // 動画 Blob（アップロード時に保持）
```

## API
| メソッド | 挙動 |
|---|---|
| `clearAll()` | 全内部状態をリセット |
| `reset()` | `sensorLogFilesIndex=0` にして `load()` |
| `load()` (private) | 現ファイルを解凍して `sensorLogData` にセットし `sensorLogDataIndex=0`。ファイル終端なら以降 `getSensorLogData()` は undefined |
| `pushSensorLogFile(base64Encoded)` | 新しいログファイルを追加。`unzipped(base64, true)` で解凍+情報だけ取り、`sensorLogFilesInfo` に push。初回追加時は `reset()` を呼んで即再生開始。`sensorLogDataSize` に加算 |
| `getSensorLogData()` | 現在位置のサンプルを 1 件返す。末尾なら次ファイルを `load()` し再帰呼び出し。`sensor.timestamp` は取り出し時点の `Date.now()` に置換 |
| `seekSensorLogData(videoTime)` | `reset()` 後、`fileInfo.minVideoTime <= videoTime <= fileInfo.maxVideoTime` を満たすファイルまで移動し、そこから 1 件ずつ進めて `currentVideoTime >= videoTime` に達したら return |
| `getSensorLogDataSize()` | 全体件数 |
| `minVideoTime` / `maxVideoTime` | プロパティ getter |
| `movieFile` | プロパティ get/set（webm Blob 用） |

## `unzipped(base64Encoded, notPush=false)` (private)
- `atob` で Base64 デコード → `Uint8Array.from` → `pako.ungzip(u8, { to:'string' })` で JSON Lines 文字列を復元。
- 各行を `JSON.parse(line).sensor` で取り出し、**旧ログスキーマの互換変換** を適用:
  - `msec` → `videoTime`
  - `gyroscope.{x,y,z}` → `gyroscope.{beta, gamma, alpha}`
- 必要フィールド（`videoTime / geolocation / acceleration / gyroscope / magnetometer`）が欠けている行はスキップ。
- `_minVideoTime / _maxVideoTime` を更新。
- `notPush=false` のときは自身の `sensorLogData` を差し替え。true のときは差し替えず情報だけ返す（`pushSensorLogFile` から利用）。

## `convertOldData(sensorData)` (private)
過去バージョンでフォーマットが変わったフィールドを取り出し時点で正規化:
- `acceleration.x/y/z` / `lowPass` / `rotate` / `accelerationIncludingGravity.lowPass` / `gyroscope.rotate` などの前処理計算値を削除
- `acceleration.gravity_x/y/z` → `acceleration.accelerationIncludingGravity.{x,y,z}`
- `acceleration.beta/gamma/alpha` → `acceleration.rotationRate.{beta, gamma, alpha}`
- `canData` が無い場合はゼロ値でダミーを補充（旧スマホのみログ用）

## 業務ルール
- ログは 1 走行 = 複数ファイルに分割されている可能性があり、時系列で連結して再生する。
- 動画（webm）は 1 走行 1 ファイルの想定。`URL.createObjectURL(movieFile)` で再生。
- 実センサーとデモの切替は [[middleware.sensor.service]] が `getSensorLogDataSize()` を見て自動判定。

## 関連ノード
- 依存: [[infra.file.storage]]、[[middleware.log.service]]、pako
- 呼び出し元: [[middleware.sensor.service]]、[[ui.edit.page]]、[[ui.driving.page]]（`loadVideo` で `movieFile` を参照）
