# infra.file.storage — 外部ストレージ（Documents/driving-score）

## 概要
`@awesome-cordova-plugins/file` を用い、Android 外部ストレージ `Documents/driving-score/` 配下にログ・センサログ・動画・scoreLogic のスナップショットを書き出す。ブラウザ実行時はダウンロード（Blob → `<a download>`）で保存する。

## 真実源
- `src/data/package.json` — `"@awesome-cordova-plugins/file": "^6.13.0"`, `"cordova-plugin-file": "^7.0.0"`
- `src/data/src/app/services/log.service.ts`
- `src/data/src/app/settings/settings.page.ts`
- `src/data/src/app/driving/driving.page.ts`
- `src/data/src/app/data/demo-data.ts`

## ディレクトリ構造
```
{externalRootDirectory}/
└── Documents/
    └── driving-score/
        ├── debug-log/
        │   ├── log.YYYYMMDD-HHMMSS.txt.gz
        │   └── sensor-log.YYYYMMDD-HHMMSS.txt.gz
        ├── scoreLogicJson.YYYYMMDD-HHMMSS.txt
        ├── scoreLogic.YYYYMMDD-HHMMSS.txt
        └── data.YYYYMMDD-HHMMSS/
            ├── movie.webm             （60 秒ごとに append）
            ├── log.YYYYMMDD-HHMMSS.txt.gz
            ├── sensor-log.YYYYMMDD-HHMMSS.txt.gz
            ├── scoreLogicJson.txt
            └── scoreLogic.txt
```

## 使用 API
- `file.externalRootDirectory` — Android の外部ストレージルート
- `file.createDir(path, name, replace)` — ディレクトリ作成（既存の場合は `checkDir` を先行呼び）
- `file.checkDir(path, name)` — 存在確認
- `file.writeFile(path, name, arrayBuffer/blob, { replace? , append? })` — 上書き / 追記
- 読み出しは `demo-data.ts` の Base64 gzip 経由（Blob URL でのアップロード → pako で ungzip）

## ファイル形式
- ログ・センサログ: JSON Lines を pako.gzip 圧縮した `.txt.gz`（3 MB / 5 MB のしきい値で自動フラッシュ、force=true で残バッファをフラッシュ）
- 動画: `video/webm`（MediaRecorder の 60 秒チャンクを追記書き込み）
- scoreLogic 系: プレーンテキスト（JS 本体 / JSON 辞書）

## 業務ルール
- 保存はすべて Android 実機かつ設定 ON のときのみ。設定 OFF 時は完全 no-op（メモリバッファも都度リセット）。
- センサログは `saveLogPath == saveDefaultLogPath` のとき（既定パス）では書き込まない。診断中のみ `setLogDir('data.<日時>')` に切り替えて有効化する。
- ファイルサイズや世代管理は行わない。手動削除は端末側ファイラで行う運用（`spec/unknowns.md` の保持期間に関する項目を参照）。

## 関連ノード
- 呼び出し元: [[middleware.log.service]] / [[ui.driving.page]] / [[ui.settings.page]] / [[middleware.sensor.demoData]]
