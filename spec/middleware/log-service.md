# middleware.log.service — デバッグ/エラーログ・センサログサービス

## 概要
`LogService` は `console.log` / `console.error` と平行してログをバッファし、Android 実機かつ設定 ON のときに `Documents/driving-score/` 配下へ gzip 圧縮テキストとして書き出す。センサログは診断中のみ有効なパスに切り替えて保存する。

## 真実源
- `src/data/src/app/services/log.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `Storage`（Ionic）
- `initialize(file: File)` で `File` プラグインインスタンスを受け取ってから書き込みが有効になる（各 Page が Page 側の `File` 注入インスタンスを渡す）。

## 内部状態
```
hasLogStorage: boolean          // settingLogStorage の反映
hasSensorLogStorage: boolean    // settingSensorLogStorage の反映
stockLog: string, stockLogLength: number
stockSensorLog: string, stockSensorLogLength: number
saveDefaultLogPath: string      // Documents/driving-score/debug-log/
saveLogPath: string             // 診断中は Documents/driving-score/data.<日時>/
```

## `initialize(file)`
- 非 Android は完全 no-op で即 return。
- Storage の `settingLogStorage` / `settingSensorLogStorage` を読み、無効なら対応バッファをクリア。
- 未初期化なら `Documents/driving-score/debug-log/` を作成（3 段の `createDir`）し、`saveDefaultLogPath` に設定。以降 `saveLogPath` の既定値になる。

## パス切替
- `setLogDir(dirName)`: 現在バッファを force フラッシュ (`saveFile(true)` / `saveSensorFile(true)`) して `Documents/driving-score/<dirName>/` に切替。
- `resetLogDir()`: 同じく force フラッシュして `saveLogPath = saveDefaultLogPath` に戻す。
- `getLogDir()`: 現在のパスを返す。

## ロギング API
| メソッド | 挙動 |
|---|---|
| `debug(msg, subMsg?)` | 常に `console.log`。`hasLogStorage && Android` ならバッファに `<日時> [D] msg. subMsg\n` を追記して `saveFile()` |
| `error(msg, error?)` | 常に `console.error`。`error.stack && error.message` を優先し、`. error => …` を付加。上と同様に `[E] …` を追記 |
| `sensor(sensorData)` | `saveLogPath === saveDefaultLogPath` のときは早期 return（=既定パスではセンサログを書かない）。`hasSensorLogStorage && Android` なら `{date, sensor}` を JSON.stringify して追記 |

## ファイル書き出し閾値
- 通常ログ: `stockLogLength >= 3,000,000`（3 MB）または force=true でフラッシュ。ファイル名 `log.YYYYMMDD-HHMMSS.txt.gz`
- センサログ: `stockSensorLogLength >= 5,000,000`（5 MB）または force=true でフラッシュ。ファイル名 `sensor-log.YYYYMMDD-HHMMSS.txt.gz`
- gzip 圧縮は `pako.gzip(text).buffer`。書き込みは `file.writeFile(saveLogPath, name, arrayBuffer, { replace: true })`。

## 日付文字列
- `getDateString(simple=false)` / `getDateString2(date, simple)`:
  - `simple=false`: `YYYY-MM-DD HH:mm:ss.SSS`
  - `simple=true`: `YYYYMMDD-HHmmss`

## 業務ルール
- 非 Android では書き出し不要のため完全 no-op（バッファも `console` にのみ流れる）。
- ログは PII を含む可能性があるため、[[infra.file.storage]] の保持期間ポリシーは `spec/unknowns.md` を参照。

## 関連ノード
- 依存: [[infra.file.storage]]
- 呼び出し元: ほぼ全モジュール
