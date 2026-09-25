<!-- 作成: 2026-09-18 17:47:15 JST | 更新: 2026-09-25 10:56:15 JST -->

# infra.file.storage — 外部ストレージ（Documents/driving-score）

## 概要
`@awesome-cordova-plugins/file` を用いて、Android 外部ストレージ `Documents/driving-score/` 配下に次のファイルを書き出す。

- ログ
- センサログ
- ヒヤリ動画
- scoreLogic のスナップショット

ブラウザ実行時は、ダウンロード（Blob → `<a download>`）で保存する。

動画については、2026 年度改修（要求⑤「ヒヤリ発生時の録画データサイズ改善」）により **通し録画を廃止**する。改修後は、ヒヤリ判定区間の前後 n 秒のみを保存する。n は設定値 `settingRecordingMargin` で、既定は 15 秒とする。

## 真実源
- `src/data/package.json` — `"@awesome-cordova-plugins/file": "^6.13.0"`, `"cordova-plugin-file": "^7.0.0"`
- `src/data/src/app/services/log.service.ts`
- `src/data/src/app/settings/settings.page.ts`
- `src/data/src/app/driving/driving.page.ts`
- `src/data/src/app/bad-spot/bad-spot.page.ts`（ヒヤリ動画の再生・シーク。本件では変更しない）
- `src/data/src/app/data/demo-data.ts`
- `src/data/mock/` — リポジトリ同梱のモックデータ置き場
- `src/tools/mediarecorder-probe/` — MediaRecorder 出力の計測用ツール。単体の HTML + JS で、アプリ本体とは独立している
- 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04（録画データサイズ改善の要求）
- メイサンソフト『要求仕様確認』2026-09-17（先方回答併記）

## 書き出しルート
書き出しルートは以下とする。

```
{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/
```

- `debug-log/` … 常設のデバッグログ置き場
- `data.YYYYMMDD-HHMMSS/` … 診断 1 回ごとに生成される採取セット

> 注: `externalDataDirectory` 配下へ移設する案（#79）は撤回済みである。本書は `externalRootDirectory/Documents` を正とする。

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
            ├── hiyari.01.webm   （ヒヤリ動画。診断ごとに 01 起点の連番）
            ├── hiyari.02.webm
            ├── ...
            ├── log.YYYYMMDD-HHMMSS.txt.gz
            ├── sensor-log.YYYYMMDD-HHMMSS.txt.gz
            ├── scoreLogicJson.txt
            └── scoreLogic.txt
```

- 診断全体の通し動画 `movie.webm` は生成しない。
- ヒヤリ動画は `hiyari.NN.webm` とする（後述「ヒヤリ動画のファイル名」）。
- ヒヤリが 0 件の診断では、`data.YYYYMMDD-HHMMSS/` 配下に動画ファイルは 1 つも存在しない。

## 使用 API
- `file.externalRootDirectory` — Android の外部ストレージルート
- `file.checkDir(path, name)` — 存在確認
- `file.createDir(path, name, replace)` — ディレクトリ作成
- `file.writeFile(path, name, arrayBuffer/blob, { replace? , append? })` — 上書き / 追記
- 読み出しは `demo-data.ts` の Base64 gzip 経由で行う（Blob URL でアップロード → pako で ungzip）

### ディレクトリ作成手順
- 階層作成は `checkDir` で存在を確認し、未存在なら `createDir` を **直接呼び出す**実装とする。ラッパ経由の間接呼び出しには戻さない。
- `driving-score/`、`debug-log/`、`data.YYYYMMDD-HHMMSS/` は、書き込み前に上記手順で確保する。
- `settings.page.ts` は本件（ストレージ書き出し）の対象外であり、変更しない。

## ファイル形式
- **ログ・センサログ**: JSON Lines を pako.gzip で圧縮した `.txt.gz`
  - 3 MB / 5 MB のしきい値で自動フラッシュする。
  - `force=true` で残バッファをフラッシュする。
- **動画**: `video/webm`（MediaRecorder 出力）
- **scoreLogic 系**: プレーンテキスト（JS 本体 / JSON 辞書）

ログ・センサログのファイル名規約とフラッシュ閾値は、現行仕様を維持する。

## 動画保存ルール（2026 年度改修）

### 基本方針
- 診断開始〜終了の通し動画は作成しない（ドラレコ相当の挙動）。
- 保存対象は、ヒヤリ判定区間の前後 n 秒のみとする。
  - 1 ヒヤリあたり、最大 2n 秒の区間になる。
  - n は `settingRecordingMargin` とする。

| 項目 | 値 |
|---|---|
| 設定キー | `settingRecordingMargin` |
| 型 / 単位 | 整数 / 秒 |
| 既定値 | 15 |
| 許容範囲 | 閉区間 [5, 60] |

- 録画機能の ON/OFF 設定は、搭載済みのものを継続利用する。設定 OFF 時は動画を保存しない。
- 運転開始直後や終了直前など、前後 n 秒を確保できない場合がある。その場合も、取得できた範囲の動画をそのまま保存する（尺不足は許容する）。
- 本改修の目的は録画データサイズの削減である。通し録画に伴う長時間ファイルを、外部ストレージ上に残さないことを要件とする。

### 録画とリングバッファ
- 録画（MediaRecorder）自体は、診断開始から終了まで回り続ける。
- 外部ストレージへ書き出すのは、ヒヤリ区間に該当するクラスタだけである。
- リングバッファは診断終了時に破棄する。破棄は `stopVideo()` の完了後に行う。
- **ヒヤリ 0 件の診断**:
  - `hiyari.NN.webm` は 1 つも生成しない。
  - `movie.webm` も作成しない。
  - 外部ストレージへの動画書き出しは一切行わない。

### 連続ヒヤリの扱い（連結）
- 受入条件は次の 2 点である。
  - **ヒヤリ時の動画が再生できること**
  - **個別のヒヤリポイントごとに動画を確認できること**
- 先方は、30 秒以内に連続したヒヤリを 1 本に継続録画しても、個別生成してもよいとしている。
- 本実装は連結方式を採る。連結条件と挙動は次のとおり。
  - 現在の区間の終端を `t_end` とする（直近ヒヤリ時刻 + n）。
  - 次のヒヤリ時刻 `t2` が **`t2 < t_end`（厳密不等号）** のとき、同一ファイルに連結する。
  - このため、1 ファイルが複数のヒヤリ時刻を持ちうる。
- **境界での重複の許容**:
  - `t2 >= t_end` のときは、新区間 `[t2-n, t2+n]` を別ファイル（次の NN）として生成する。
  - このとき、前区間の末尾と重複幅 `t_end - t2 + n` だけ映像が重なる。重複幅は `t2 = t_end` のとき最大 n 秒になる。
  - 重なった映像は、2 つの `hiyari.NN.webm` に二重保存される。
  - これは構造的に避けられないため、仕様として許容する。
  - 「連結すれば重複は出ない」「ヒヤリ映像の総量は必ず通し録画以下」という理解は誤りである。

### ヒヤリ動画のファイル名
- ファイル名は `hiyari.NN.webm` とする。
- NN は、診断ごとに 01 から始まる 2 桁ゼロ埋めの連番とし、**ファイル単位**で採番する。
- 走行の区別は、ディレクトリ `data.YYYYMMDD-HHMMSS/` が担う。
- 連結により 1 ファイルが複数のヒヤリ時刻を持つため、発生時刻ベースの命名は採らない。
- 旧暫定表記 `hiyari.YYYYMMDD-HHMMSS.webm` は廃止する。

### ヒヤリ動画ファイルの構成
- ファイルは、ヘッダと区間クラスタを受信順に連結して構成する。書き込みは `writeFile` の append で行う。
  - **ヘッダ**: chunk[0] を、最初の Cluster ID（`0x1F43B675`）の手前で切り詰めたもの
  - **区間クラスタ**: ヒヤリ区間に該当する Cluster 群
- ヘッダの中身は EBML ヘッダ / Segment Info / Tracks である。実測は 189 B。
- chunk[0] 全体のサイズは被写体により 12.2 KB〜254.8 KB と変動する。その 99.2〜99.93% は録画開始直後の映像である。このため chunk[0] を丸ごと付けず、ヘッダ部分のみを使う。
- 次の処理は**実装しない**。
  - クラスタ Timecode の減算（0 起点化）
  - Cluster の再構築
  - Duration 要素の付与
  - Cues の生成

### 既知の挙動（許容）
以下は仕様として許容する既知の挙動である。

| # | 挙動 | 補足 |
|---|---|---|
| 1 | 切り出しファイルは、元の録画開始からの Cluster Timecode を保持する（例: n=15 で先頭 [0, 25515, 26533, ...] ms） | `videoElement.currentTime` も元ストリームの時刻で進む |
| 2 | 先頭から区間開始まで、クラスタを持たない空白区間がある | この空白はバイトを消費しない |
| 3 | `duration=Infinity` / `seekable=[0, Infinity]` となる | 原因は MediaRecorder 出力に Duration 要素が無いこと。空白区間とは無関係で、通し録画や現行 `movie.webm` でも同一。Timecode を 0 起点へ書き換えても有限にはならない |
| 4 | 空白があっても、loadedmetadata・中間 seek（40.394 s / 90.779 s）・描画は正常 | SH-M29 / Android 15 / Chrome 153 で、n=15・n=60 とも確認済み |

- 上記を前提に、次のコードは変更しない。
  - `driving.page.ts` の `pushBadPoint()`（`Math.floor(getLastSensorTime()/1000)`）
  - `bad-spot.page.ts` の `seekVideo()` / `loadVideo()`

### 実機確認項目（6-1 ヒヤリシーン表示）
次の 2 点を実機確認項目に加える。

1. `<video controls>` のシークバーが尺不明表示のとき、badspot 画面の操作に支障が無いこと。
2. `bad-spot.page.ts:102-110` が loadedmetadata を待たずに `seekVideo()` を呼んでも、マーカー位置へ到達すること。
   - proposal #228 §3 の未検証項目である。
   - 空白区間の有無に関係なく必須とする。

いずれかで支障が確認された場合は、コードを変えずに新たな proposal として起票する。

**計測環境の補足**
- 計測は `src/tools/mediarecorder-probe/` を adb reverse 経由で端末 Chrome から実行した。
- 条件はアプリと同一の制約とした: 1280x720 / audio:true / video/webm / ビットレート指定なし / start(1000)。
- SH-M29 の WebView（153.0.8010.36）と Chrome（153.0.8010.52）は、同一ビルド系列のパッチ違いである。
- ただし同一プロセスではないため、アプリ内 WebView での確認が別途必要である。

## パーミッション
- 本書の書き出しに対して、**追加のランタイム／マニフェストパーミッションは要求しない**。
- 既存の権限構成のままで書き出せることを前提とする。

## ログ採取手順（正）
以下のいずれかを正式手順とする。

1. 端末のファイルアプリで `Documents/driving-score/` を開き、対象のディレクトリ／ファイルを取り出す
2. 開発 PC から `adb pull /sdcard/Documents/driving-score/...` を実行する

## 業務ルール
- 保存は、Android 実機かつ設定 ON のときのみ行う。
- 設定 OFF 時は完全に no-op とし、メモリバッファも都度リセットする。
- センサログの書き込み条件:
  - `saveLogPath == saveDefaultLogPath`（既定パス）のときは書き込まない。
  - **センサログは診断中のみ**書き込む。診断中は `setLogDir('data.<日時>')` に切り替えて有効化する。
- ファイルサイズ管理や世代管理は行わない。
  - 削除は、端末側ファイラによる手動運用とする。
  - 保持期間については `spec/unknowns.md` の該当項目を参照する。
- 動画はヒヤリ発生時にのみ書き出される。このため、ヒヤリ 0 件の診断では `data.YYYYMMDD-HHMMSS/` に動画ファイルが存在しない。

## 対象外
- 書き込み失敗時のユーザ向け提示
- ログ／動画の保持期間・自動削除
- MediaStore / SAF（Storage Access Framework）経由の書き出し
- ヒヤリ動画の Timecode 0 起点化・Duration 付与・Cues 生成

## 関連ノード
- 呼び出し元: [[middleware.log.service]] / [[ui.driving.page]] / [[ui.settings.page]] / [[middleware.sensor.demoData]]
- 参照: [[ui.hiyari.page]]（6-1 ヒヤリシーン表示。個別動画 `hiyari.NN.webm` を対象とする）

```json
{
  "required_changes": [
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "前後15秒固定の記述を settingRecordingMargin（整数秒/既定15/閉区間[5,60]）による前後n秒に改訂し、対象外節の『ヒヤリ前後時間の可変化』を削除"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "ヒヤリ動画ファイル名を hiyari.NN.webm（診断ごと01起点2桁連番・ファイル単位採番）に確定し暫定表記 hiyari.YYYYMMDD-HHMMSS.webm を廃止"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "ヒヤリ動画の構成（chunk[0]を最初のCluster ID 0x1F43B675手前で切り詰めたヘッダ189B＋区間クラスタを受信順にappend）とTimecode書換・Duration・Cues非実装を明記"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "連結条件 t2 < t_end（厳密不等号）と境界時に最大n秒の映像重複を許容する旨を明記"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "ヒヤリ0件時は動画を一切書き出さずリングバッファを stopVideo() 完了後に破棄する旨を明記"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "既知の挙動（元Timecode保持・空白区間・duration=Infinity）と6-1実機確認項目2点、計測ツール mediarecorder-probe と計測環境を追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "リングバッファ保持・chunk[0]ヘッダ切り詰め・t2<t_end 連結判定・NN採番・0件時のバッファ破棄（stopVideo完了後）を録画制御側で実装する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "n=60 時のリングバッファ保持量（前60秒分＋ヘッダ）が端末メモリに与える影響の見積りが必要で可用性に関わる"},
    {"domain": "UI-agent", "severity": "must", "reason": "6-1 で hiyari.NN.webm を再生し、元Timecode保持・duration=Infinity・シークバー尺不明表示を前提とした操作確認項目2点を仕様化する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "settingRecordingMargin（整数秒/既定15/[5,60]）の設定UIの有無・配置が本書からは確定できない"},
    {"domain": "DB-agent", "severity": "should", "reason": "1ファイルが複数ヒヤリ時刻を持つため、ヒヤリポイントと hiyari.NN.webm の対応づけ（NNの保持方法）を定義する必要がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "ヒヤリ0件時の無出力、境界 t2=t_end での最大n秒重複、n=5/15/60 の境界値、6-1実機確認2点、アプリ内WebViewでの再確認が検証観点に加わる"}
  ],
  "requirements_context": "運転診断アプリのログ・センサログ・動画・scoreLogic スナップショットを外部ストレージへ書き出す要件。書き出しルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ とし、常設の debug-log/ と診断ごとの data.YYYYMMDD-HHMMSS/ の2系統を持つ。externalDataDirectory 配下へ移す案（#79、run-as 採取）は撤回済みで、Documents 配下を正とする。ディレクトリ作成は checkDir で存在を確認し、未存在なら createDir を直接呼び出す。settings.page.ts は変更しない。追加パーミッションは不要。ログ採取の正式手順は、端末のファイルアプリで Documents/driving-score/ を開く方法、または adb pull /sdcard/Documents/driving-score/... の2通り。ログ・センサログは JSON Lines を pako.gzip で圧縮した .txt.gz とし、ファイル名規約、3MB/5MB の自動フラッシュ閾値、force=true による残バッファフラッシュを維持する。センサログは既定パスでは書かず、診断中に setLogDir('data.<日時>') へ切り替えたときのみ書く。保存は Android 実機かつ設定 ON のときのみで、OFF 時は完全 no-op とし、メモリバッファも都度リセットする。ブラウザ実行時は Blob ダウンロードで保存する。モックデータは src/data/mock/ に置く。動画は2026年度改修（日産自動車 一次仕様 2026-08-04、メイサンソフト 要求仕様確認 2026-09-17、要求⑤録画データサイズ改善）により通し録画 movie.webm を廃止する。改修後はヒヤリ判定区間の前後 n 秒のみを video/webm で保存する。n は settingRecordingMargin（整数秒、既定15、閉区間[5,60]）で、ドラレコ相当の挙動とする。録画 ON/OFF 設定は搭載済みのものを継続利用する。前後 n 秒を確保できない場合も、取得範囲をそのまま保存する。録画は診断開始から終了まで回り続けるが、書き出すのはヒヤリ区間のみとする。ヒヤリ0件の診断では hiyari.NN.webm も movie.webm も生成せず、動画の書き出しは一切行わない。リングバッファは stopVideo() 完了後に破棄する。連続ヒヤリの受入条件は、ヒヤリ動画が再生できることと、個別ヒヤリポイントを確認できること。実装は連結方式とし、t2 < t_end（厳密不等号）なら同一ファイルに連結するため、1ファイルが複数のヒヤリ時刻を持ちうる。t2 >= t_end の場合は新区間 [t2-n, t2+n] を別ファイルとし、重複幅 t_end - t2 + n（最大 n 秒）の映像二重保存を許容する。ファイル名は hiyari.NN.webm とし、NN は診断ごとに01起点の2桁ゼロ埋め連番をファイル単位で採番する。走行の区別はディレクトリが担い、暫定表記 hiyari.YYYYMMDD-HHMMSS.webm は廃止する。ファイル構成は、chunk[0] を最初の Cluster ID 0x1F43B675 の手前で切り詰めたヘッダ（EBML/Segment Info/Tracks、実測189B）に、区間クラスタを受信順に append で連結する。chunk[0] 全体は12.2KB〜254.8KBで、その99.2〜99.93%は録画開始直後の映像である。Timecode 減算・Cluster 再構築・Duration 付与・Cues 生成は実装しない。既知の挙動として次を許容する: 切り出しファイルは元の Timecode を保持し、currentTime も元時刻で進む。先頭に空白区間を持つが、この空白はバイトを消費しない。duration=Infinity/seekable=[0,Infinity] は Duration 要素の欠如が原因で、空白とは無関係であり、通し録画でも同一。loadedmetadata・中間 seek・描画は正常（SH-M29/Android15/Chrome153、n=15・60で確認）。driving.page.ts の pushBadPoint() と bad-spot.page.ts の seekVideo()/loadVideo() は変更しない。6-1 実機確認として次の2点を加える: シークバー尺不明表示で操作に支障が無いこと、bad-spot.page.ts:102-110 が loadedmetadata 前に seekVideo() を呼んでもマーカー位置へ到達すること。支障があればコードを変えずに proposal を起票する。計測は src/tools/mediarecorder-probe/ を adb reverse 経由で端末 Chrome から、アプリと同一制約（1280x720/audio:true/video/webm/ビットレート指定なし/start(1000)）で行った。WebView 153.0.8010.36 と Chrome 153.0.8010.52 は同一ビルド系列だが、アプリ内 WebView での確認は別途必要。世代管理・サイズ管理は行わず、削除は手動運用とする。書き込み失敗のユーザ提示、保持期間、MediaStore/SAF は対象外。開発は2026年11月末完了目標で、12月から高齢者実験を開始する。",
  "fact_candidates": [
    {"type": "constraint", "title": "書き出しルートは Documents/driving-score 配下", "statement": "ログ・センサログ・動画・scoreLogic スナップショットは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ 配下に書き出す", "status": "approved"},
    {"type": "constraint", "title": "追加パーミッションは要求しない", "statement": "外部ストレージ書き出しに対して追加のランタイム/マニフェストパーミッションを要求しない", "status": "approved"},
    {"type": "constraint", "title": "ディレクトリ作成は checkDir→createDir を直接呼び出す", "statement": "書き込み前の階層作成は file.checkDir による存在確認と file.createDir の直接呼び出しで行う", "status": "approved"},
    {"type": "external_integration_rule", "title": "ログ採取はファイルアプリまたは adb pull", "statement": "ログ採取の正式手順は端末ファイルアプリで Documents/driving-score/ を開く方法、または adb pull /sdcard/Documents/driving-score/... である", "status": "approved"},
    {"type": "business_rule", "title": "動画はヒヤリ前後 n 秒のみ保存", "statement": "通し動画は作成せず、ヒヤリ判定区間の前後 n 秒（n=settingRecordingMargin、整数秒、既定15、閉区間[5,60]）のみを保存する", "status": "approved"},
    {"type": "data_semantics", "title": "ヒヤリ動画のファイル名は hiyari.NN.webm", "statement": "ヒヤリ動画は hiyari.NN.webm とし、NN は診断ごとに01起点の2桁ゼロ埋め連番をファイル単位で採番する", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ0件では動画を書き出さない", "statement": "ヒヤリ0件の診断では hiyari.NN.webm も movie.webm も生成せず、リングバッファは stopVideo() 完了後に破棄する", "status": "approved"},
    {"type": "business_rule", "title": "境界での最大 n 秒重複を許容", "statement": "連結条件は t2 < t_end であり、t2 >= t_end のとき最大 n 秒の映像が2つの hiyari.NN.webm に二重保存されることを許容する", "status": "approved"},
    {"type": "data_semantics", "title": "ヒヤリ動画はヘッダ189B＋区間クラスタで構成", "statement": "ヒヤリ動画は chunk[0] を最初の Cluster ID 0x1F43B675 手前で切り詰めたヘッダ（実測189B）と区間クラスタを受信順に連結して構成する", "status": "approved"},
    {"type": "constraint", "title": "Timecode 書換・Duration・Cues は実装しない", "statement": "ヒヤリ動画に対し Cluster Timecode の減算、Cluster 再構築、Duration 要素付与、Cues 生成を行わない", "status": "approved"},
    {"type": "data_semantics", "title": "duration=Infinity は Duration 要素欠如が原因", "statement": "ヒヤリ動画は duration=Infinity / seekable=[0, Infinity] となり、原因は MediaRecorder 出力に Duration 要素が無いことである", "status": "approved"},
    {"type": "qa_expectation", "title": "6-1 実機確認項目2点の追加", "statement": "シークバー尺不明表示時に badspot 画面操作に支障が無いこと、loadedmetadata 前の seekVideo() 呼び出しでマーカー位置に到達することを実機で確認する", "status": "candidate"},
    {"type": "qa_expectation", "title": "アプリ内 WebView での確認が別途必要", "statement": "端末 Chrome での計測結果とは別に、Capacitor WebView 内での動画挙動確認が必要である", "status": "approved"},
    {"type": "business_rule", "title": "センサログは診断中のみ書き込む", "statement": "センサログは既定パスの間は書き込まず、診断中に setLogDir('data.<日時>') へ切り替えたときのみ書き込む", "status": "approved"},
    {"type": "business_rule", "title": "ログのフラッシュ閾値は 3MB/5MB を維持", "statement": "ログ・センサログは 3MB/5MB の閾値で自動フラッシュし、force=true で残バッファをフラッシュする", "status": "approved"},
    {"type": "constraint", "title": "保存は Android 実機かつ設定ON時のみ", "statement": "ファイル保存は Android 実機かつ保存設定 ON のときのみ実行し、OFF 時は no-op としメモリバッファを都度リセットする", "status": "candidate"},
    {"type": "constraint", "title": "失敗提示・保持期間・MediaStore/SAF は対象外", "statement": "書き込み失敗のユーザ提示、保持期間、MediaStore/SAF 経由の書き出しは本件の対象外である", "status": "approved"}
  ],
  "open_questions": [
    "書き出しルートに関する approved fact が2件並存している。『externalDataDirectory へ移す（#79）』と『#79 を撤回し Documents に戻す』である。本書は撤回側を正として記述したが、台帳上で #79 側を rejected/superseded に更新する必要がある。Orchestrator 判断が必要。未整理のままでは採取手順（run-as か adb pull か）の解釈が割れる。",
    "settingRecordingMargin の設定 UI が既に存在するのか、新設が必要なのかが本ノードの資料からは不明。設定画面の担当は UI、既定値の保持は Middleware/DB の判断となる。一方、ストレージ観点では settings.page.ts を変更しない方針がある。新設が必要な場合は、この方針との整合確認が必要。",
    "n=60 時のリングバッファ保持量（前60秒分の映像クラスタ＋ヘッダ）の見積りが無い。端末メモリ上限と可用性に関わるため、Middleware と実機（SH-M29）で確認が必要。確認できないと長時間診断での安定性が保証できない。",
    "ヒヤリポイントと hiyari.NN.webm の対応づけ方法が未定義。1ファイルに複数ヒヤリ時刻が入るため、NN を DB に保持するのか、時刻から推定するのかを DB/UI と合議する必要がある。決まらないと 6-1 で該当動画を引き当てられない。",
    "6-1 実機確認2点（シークバー尺不明表示、loadedmetadata 前 seek）は未実施。アプリ内 WebView での確認も未実施。支障が出た場合は別 proposal となり、11月末スケジュールに影響しうる。QA/UI の確認が必要。",
    "対象 Android バージョン / targetSdkVersion の範囲で、{externalRootDirectory}/Documents へ書き込めるかは SH-M29 以外で未確認。Scoped Storage の制約を受ける端末では採取手順が成立しない可能性がある。Infra/QA で端末レンジの確定が必要。",
    "書き込み失敗（容量不足・権限拒否）時の挙動は対象外として未定義。動画・ログ欠落がユーザや実験担当に検知されない。UI/Middleware/運用での扱いの確認が必要。",
    "保持期間・自動削除は無く、手動運用のまま。12月の高齢者実験で多数の診断を行った場合のストレージ枯渇リスクを、運用/QA と確認する必要がある。",
    "debug-log/ と data.YYYYMMDD-HHMMSS/ に同種のログが出る場合、どちらを正の採取対象とするかが運用手順として未明記。QA の採取指示に影響する。",
    "CAN データを確認用に保存するかは先方の宿題として未確定。保存する場合、本ノードに書き出し対象（形式・サイズ・置き場）が追加される。"
  ],
  "rationale_notes": [
    "書き出しルートについては、撤回を明示した後発の fact を優先した。本文には『#79 撤回済み』の注記のみを残し、読者が移設済みと誤解しないようにした。",
    "Documents 配下を維持する利点は、端末ファイルアプリや adb pull で採取でき、debug ビルドや run-as を要しない点にある。実験現場での採取容易性を優先した。",
    "ヘッダを chunk[0] 全体でなく最初の Cluster 手前までに切り詰める理由は、chunk[0] の大半が録画開始直後の映像であり、そのまま付けると無関係な映像とサイズを抱え込むためである。",
    "Timecode を書き換えないのは、書き換えても duration=Infinity は解消せず、再生・シークも実測で正常だったためである。加えて、pushBadPoint/seekVideo を元ストリーム時刻のまま無変更で使える利点がある。",
    "境界重複の許容を明記したのは、『連結すれば総量は通し録画以下』という誤解によるサイズ見積り誤りを防ぐためである。",
    "連続ヒヤリについて、先方は方式を委ね受入条件のみを指定している。そのため本文では受入条件を先に置き、そのうえで採用した連結方式を記述する構成にした。",
    "録画制御ロジック（リングバッファ、連結判定、採番）の実装責務は Middleware にある。本ノードはストレージ上の成果物の形と書き出し条件に関心を限定している。",
    "2026年11月末の完了目標と12月の高齢者実験開始は、実機確認や未解決事項の優先度判断の前提として保持する。"
  ]
}
```