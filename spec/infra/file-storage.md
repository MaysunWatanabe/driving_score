<!-- 作成: 2026-09-10 17:35:49 JST | 更新: 2026-09-18 17:47:15 JST -->

# infra.file.storage — 外部ストレージ（Documents/driving-score）

## 概要
`@awesome-cordova-plugins/file` を用い、Android 外部ストレージ `Documents/driving-score/` 配下にログ・センサログ・動画・scoreLogic のスナップショットを書き出す。ブラウザ実行時はダウンロード（Blob → `<a download>`）で保存する。

動画については 2026 年度改修により **通し録画を廃止**し、ヒヤリ判定区間の前後 15 秒（合計 30 秒）のみを保存する方式に変更する。

## 真実源
- `src/data/package.json` — `"@awesome-cordova-plugins/file": "^6.13.0"`, `"cordova-plugin-file": "^7.0.0"`
- `src/data/src/app/services/log.service.ts`
- `src/data/src/app/settings/settings.page.ts`
- `src/data/src/app/driving/driving.page.ts`
- `src/data/src/app/data/demo-data.ts`
- `src/data/mock/` — リポジトリ同梱のモックデータ置き場
- 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04（録画データサイズ改善の要求）
- メイサンソフト『要求仕様確認』2026-09-17（先方回答併記）

## 書き出しルート
書き出しルートは以下とする。

```
{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/
```

- `debug-log/` … 常設のデバッグログ置き場
- `data.YYYYMMDD-HHMMSS/` … 診断 1 回ごとに生成される採取セット

> 注: `externalDataDirectory` 配下へ移設する案は撤回済みであり、本書は `externalRootDirectory/Documents` を正とする。

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
            ├── hiyari.YYYYMMDD-HHMMSS.webm   （ヒヤリ区間ごとの 30 秒動画）
            ├── log.YYYYMMDD-HHMMSS.txt.gz
            ├── sensor-log.YYYYMMDD-HHMMSS.txt.gz
            ├── scoreLogicJson.txt
            └── scoreLogic.txt
```

- 診断全体の通し動画 `movie.webm` は生成しない。
- ヒヤリ動画は 1 ヒヤリ区間ごとに個別ファイルとして保存する。ただし 30 秒以内にヒヤリが連続した場合は、1 本に継続録画しても区間ごとに個別生成してもよい（後述）。
- ファイル名の具体形式は実装時に確定する（open_questions 参照）。

## 使用 API
- `file.externalRootDirectory` — Android の外部ストレージルート
- `file.checkDir(path, name)` — 存在確認
- `file.createDir(path, name, replace)` — ディレクトリ作成
- `file.writeFile(path, name, arrayBuffer/blob, { replace? , append? })` — 上書き / 追記
- 読み出しは `demo-data.ts` の Base64 gzip 経由（Blob URL でのアップロード → pako で ungzip）

### ディレクトリ作成手順
- 階層作成は `checkDir` → 未存在なら `createDir` を **直接呼び出す**実装とする（ラッパ経由の間接呼び出しに戻さない）。
- `driving-score/` と `debug-log/` / `data.YYYYMMDD-HHMMSS/` は書き込み前に上記手順で確保する。
- `settings.page.ts` は本件の対象外であり変更しない。

## ファイル形式
- ログ・センサログ: JSON Lines を pako.gzip 圧縮した `.txt.gz`（3 MB / 5 MB のしきい値で自動フラッシュ、`force=true` で残バッファをフラッシュ）
- 動画: `video/webm`（MediaRecorder 出力）
- scoreLogic 系: プレーンテキスト（JS 本体 / JSON 辞書）

ログ・センサログのファイル名規約・フラッシュ閾値は現行仕様を維持する。

## 動画保存ルール（2026 年度改修）
- 診断開始〜終了の通し動画は作成しない。
- 保存対象はヒヤリ判定区間の前後 15 秒（合計 30 秒）のみとする。ドラレコ相当の挙動。
- 録画機能の ON/OFF 設定は既存のものを継続利用する（設定 OFF 時は動画を保存しない）。
- 運転時間が 30 秒未満でその間にヒヤリが発生した場合も、取得できた範囲の動画をそのまま保存する（尺不足は許容する）。
- ヒヤリが 30 秒以内に連続した場合、
  - 継続して 1 本に録画する、
  - ヒヤリポイントごとに個別ファイルを生成する、
  のどちらでもよい。**ヒヤリ時の動画が再生できること**と**個別のヒヤリポイントごとに動画を確認できること**が満たされれば、実装しやすい方式を選択してよい。
- 本改修の目的は録画データサイズの削減であり、通し録画に伴う長時間ファイルを外部ストレージ上に残さないことを要件とする。

## パーミッション
- 本書の書き出しに対して**追加のランタイム／マニフェストパーミッションは要求しない**。既存の権限構成のままで書き出せることを前提とする。

## ログ採取手順（正）
以下のいずれかを正式手順とする。

1. 端末のファイルアプリで `Documents/driving-score/` を開き、対象ディレクトリ／ファイルを取り出す
2. 開発 PC から `adb pull /sdcard/Documents/driving-score/...`

## 業務ルール
- 保存はすべて Android 実機かつ設定 ON のときのみ。設定 OFF 時は完全 no-op（メモリバッファも都度リセット）。
- センサログは `saveLogPath == saveDefaultLogPath` のとき（既定パス）では書き込まない。**センサログは診断中のみ**、`setLogDir('data.<日時>')` に切り替えて有効化する。
- ファイルサイズや世代管理は行わない。手動削除は端末側ファイラで行う運用（`spec/unknowns.md` の保持期間に関する項目を参照）。
- 動画はヒヤリ発生時にのみ書き出されるため、ヒヤリが 0 件の診断では `data.YYYYMMDD-HHMMSS/` に動画ファイルが存在しない。

## 対象外
- 書き込み失敗時のユーザ向け提示
- ログ／動画の保持期間・自動削除
- MediaStore / SAF（Storage Access Framework）経由の書き出し
- ヒヤリ前後時間（既定 15 秒）を設定で可変にする機能（未確定事項として保留）

## 関連ノード
- 呼び出し元: [[middleware.log.service]] / [[ui.driving.page]] / [[ui.settings.page]] / [[middleware.sensor.demoData]]
- 参照: [[ui.hiyari.page]]（ヒヤリシーン表示は個別動画を対象とする方式へ変更予定）

```json
{
  "required_changes": [
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "通し録画 movie.webm（60秒append）の記述を削除し、ヒヤリ前後15秒・計30秒の個別動画保存に改訂"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "ディレクトリ構造の data.YYYYMMDD-HHMMSS/ 配下をヒヤリ区間ごとの webm へ差し替え、ヒヤリ0件時は動画なしを明記"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "連続ヒヤリ（30秒以内）時は1本継続録画／個別生成のいずれでもよい旨と受入条件を明記"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "externalDataDirectory 移設案は撤回済みであることを注記し externalRootDirectory/Documents を正と明示"},
    {"node": "infra.file.storage", "entrypoint": "spec/infra/file-storage.md", "description": "ヒヤリ前後時間の可変化は対象外（保留）として追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "MediaRecorder の運用が通し録画から前後15秒リングバッファ方式に変わるため、録画制御とファイル書き出し責務の仕様改訂が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "6-1 ヒヤリシーン表示が通し動画の currentTime 追尾方式から個別動画再生方式へ変わるため画面仕様の改訂が必要"},
    {"domain": "DB-agent", "severity": "should", "reason": "ヒヤリポイントと個別動画ファイルの対応づけ（ファイル名／パスの保持）が必要になる可能性がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "ヒヤリ0件時に動画が生成されない、30秒未満運転時の尺不足許容、連続ヒヤリ時の2方式許容という受入条件の検証観点が追加される"}
  ],
  "requirements_context": "運転診断アプリのログ・センサログ・動画・scoreLogic スナップショットの外部ストレージ書き出し要件。書き出しルートは {externalRootDirectory}/Documents/driving-score/ 配下で、常設の debug-log/ と診断ごとの data.YYYYMMDD-HHMMSS/ の2系統を持つ。externalDataDirectory 配下へ移す提案（#79）は撤回済みで、本書は externalRootDirectory/Documents を正とする。ディレクトリ作成は checkDir で存在確認し未存在なら createDir を直接呼び出す実装とし、settings.page.ts は変更しない。追加パーミッションは不要。ログ採取の正式手順は端末のファイルアプリから Documents/driving-score/ を参照する方法、または adb pull /sdcard/Documents/driving-score/... の2通り。ログ・センサログは JSON Lines を pako.gzip 圧縮した .txt.gz 形式で、ファイル名規約と 3MB/5MB のフラッシュ閾値、force=true による残バッファフラッシュを維持する。センサログは診断中のみ（setLogDir('data.<日時>') に切替時のみ）書き込み、既定パスでは書き込まない。保存は Android 実機かつ設定 ON のときのみで、OFF 時は完全 no-op。動画は 2026 年度改修（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17、要求⑤録画データサイズ改善）により通し録画を廃止し、ヒヤリ判定区間の前後15秒（合計30秒）のみを video/webm で保存する。録画 ON/OFF 設定は既存のものを継続利用する。運転時間が30秒未満でその間にヒヤリが発生した場合も取得できた範囲をそのまま保存する。30秒以内に連続したヒヤリは1本に継続録画しても個別生成してもよく、ヒヤリ動画が再生できることと個別ヒヤリポイントごとに確認できることが満たされれば実装都合で選択してよい。ヒヤリ0件の診断では動画ファイルが生成されない。ブラウザ実行時は Blob ダウンロードで代替。リポジトリ同梱のモックデータは src/data/mock/ に置く。世代管理・ファイルサイズ管理は行わず削除は手動運用。書き込み失敗のユーザ提示、保持期間、MediaStore/SAF 対応、ヒヤリ前後時間の可変化は本件の対象外。開発は 2026 年 11 月末完了目標、2026 年 12 月から高齢者実験開始。",
  "fact_candidates": [
    {"type": "constraint", "title": "書き出しルートは Documents/driving-score 配下", "statement": "ログ・センサログ・動画・scoreLogic スナップショットは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ 配下に書き出す", "status": "approved"},
    {"type": "constraint", "title": "追加パーミッションは要求しない", "statement": "本書の外部ストレージ書き出しに対して追加のランタイム/マニフェストパーミッションを要求しない", "status": "approved"},
    {"type": "constraint", "title": "ディレクトリ作成は checkDir→createDir を直接呼び出す", "statement": "書き込み前の階層作成は file.checkDir による存在確認と file.createDir の直接呼び出しで行う", "status": "approved"},
    {"type": "constraint", "title": "settings.page.ts は変更しない", "statement": "本件のストレージ変更に伴い src/data/src/app/settings/settings.page.ts は変更しない", "status": "approved"},
    {"type": "external_integration_rule", "title": "ログ採取手順は端末ファイルアプリまたは adb pull", "statement": "ログ採取の正式手順は端末のファイルアプリで Documents/driving-score/ を開く方法、または `adb pull /sdcard/Documents/driving-score/...` である", "status": "approved"},
    {"type": "constraint", "title": "通し動画は生成しない", "statement": "診断開始から診断終了までの通し動画は外部ストレージに生成しない", "status": "approved"},
    {"type": "business_rule", "title": "動画はヒヤリ前後15秒・計30秒のみ保存", "statement": "動画はヒヤリ判定区間の前後15秒（合計30秒）のみを保存する", "status": "approved"},
    {"type": "business_rule", "title": "30秒未満運転でのヒヤリ動画も保存する", "statement": "運転時間が30秒未満でその間にヒヤリが発生した場合も、取得できた範囲の動画をそのまま保存する", "status": "approved"},
    {"type": "business_rule", "title": "連続ヒヤリの動画生成方式は実装都合で選べる", "statement": "30秒以内に連続したヒヤリは1本に継続録画しても、ヒヤリポイントごとに個別生成してもよく、ヒヤリ動画が再生でき個別にヒヤリポイントの動画を確認できれば実装しやすい方式を選択してよい", "status": "approved"},
    {"type": "state_rule", "title": "ヒヤリ0件の診断では動画ファイルが存在しない", "statement": "ヒヤリが発生しなかった診断では data.YYYYMMDD-HHMMSS/ 配下に動画ファイルが生成されない", "status": "candidate"},
    {"type": "constraint", "title": "録画ON/OFF設定は既存のものを継続利用する", "statement": "録画機能の ON/OFF 設定は既に搭載済みのものを継続利用し、OFF 時は動画を保存しない", "status": "approved"},
    {"type": "data_semantics", "title": "センサログは JSON Lines + gzip の .txt.gz", "statement": "ログ・センサログは JSON Lines を pako.gzip で圧縮した .txt.gz 形式で保存する", "status": "approved"},
    {"type": "business_rule", "title": "フラッシュ閾値は 3MB/5MB を維持", "statement": "ログ・センサログのバッファは 3MB / 5MB の閾値で自動フラッシュし、force=true で残バッファをフラッシュする", "status": "approved"},
    {"type": "business_rule", "title": "センサログは診断中のみ書き込む", "statement": "センサログは saveLogPath が既定パスの間は書き込まず、診断中に setLogDir('data.<日時>') へ切り替えたときのみ書き込む", "status": "approved"},
    {"type": "constraint", "title": "保存は Android 実機かつ設定ON時のみ", "statement": "ファイル保存は Android 実機かつ保存設定 ON のときのみ実行し、OFF 時は完全に no-op としメモリバッファも都度リセットする", "status": "candidate"},
    {"type": "data_semantics", "title": "モックデータは src/data/mock/ に同梱", "statement": "リポジトリ同梱のモックデータは src/data/mock/ に置かれる", "status": "approved"},
    {"type": "constraint", "title": "保持期間・世代管理は行わない", "statement": "書き出したファイルのサイズ管理・世代管理は行わず、削除は端末側ファイラでの手動運用とする", "status": "candidate"},
    {"type": "constraint", "title": "失敗提示・保持期間・MediaStore/SAF は対象外", "statement": "書き込み失敗のユーザ提示、保持期間の設計、MediaStore/SAF 経由の書き出しは本件の対象外である", "status": "approved"},
    {"type": "constraint", "title": "ヒヤリ前後時間の可変化は対象外", "statement": "ヒヤリ前後の録画時間（既定15秒）を設定で変更可能にする機能は本書の対象外とし、未確定事項として保留する", "status": "candidate"}
  ],
  "open_questions": [
    "ヒヤリ動画のファイル名規約が未確定。通し録画 movie.webm を廃止したため命名規則（ヒヤリ発生時刻ベースか連番か）が定義されていない。UI（6-1 ヒヤリシーン表示）とDB（ヒヤリポイントと動画の対応づけ）の双方が参照するため、Infra/UI/DB 合議で確定する必要がある。決まらないとヒヤリポイントから動画を引き当てられない。",
    "ヒヤリ前後15秒の『前15秒』を実現するためのバッファ保持方式（MediaRecorder のリングバッファ相当をメモリに持つか、短いチャンクを一時ファイルに書いて連結するか）が未確定。Middleware/Infra の責務分担とメモリ・一時ファイル領域の要件に影響する。決まらないと端末メモリ制約と一時ファイル削除運用が定義できない。",
    "ヒヤリ前後時間（既定15秒）を設定で可変にするかが未確定（先方から可変化可否の問い合わせあり）。可変化するとファイルサイズ上限の見積りと設定画面の仕様に影響する。",
    "一時的に保持した前15秒バッファや連結途中の中間ファイルの削除タイミングが未定義。ストレージ枯渇リスクと診断異常終了時の残骸処理に影響する。",
    "対象 Android バージョン / targetSdkVersion における {externalRootDirectory}/Documents への書き込み可否が未確定。Scoped Storage 環境では cordova-plugin-file 経由の書き込みが制限され得るため、Infra/QA で実機の OS バージョンレンジを確定する必要がある。確定しないと採取手順（adb pull / ファイルアプリ）そのものが成立しない端末が出る。",
    "書き込み失敗（容量不足・権限拒否）時の挙動が未確定。今回は対象外と決めたため UI 提示もリトライも定義されていない。UI/Middleware の責務分担が決まらないと診断中のログ欠落・動画欠落がユーザに検知されない。",
    "ログ・動画の保持期間および自動削除の要否が未確定（手動削除運用のまま）。長期利用時のストレージ枯渇リスクの扱いを運用/QA と確認する必要がある。",
    "debug-log/ と data.YYYYMMDD-HHMMSS/ の両方に同名のログが出る条件（どちらが正の採取対象か）が運用手順として未明記。QA の採取指示に影響する。",
    "CAN データを確認用に保存するかが先方の宿題として未確定。保存する場合、本ノードに新たな書き出し対象（ファイル形式・サイズ・置き場）が追加される。"
  ],
  "rationale_notes": [
    "#79（externalDataDirectory への移設）は撤回されたため、経緯そのものは詳述せず『撤回済み』の一行注記のみを残した。読者が誤って移設済みと解釈するのを避ける意図。",
    "externalRootDirectory/Documents を維持する利点は、端末のファイルアプリから直接採取でき debug ビルドや run-as を必要としない点にある。採取容易性を優先した判断。",
    "checkDir→createDir の直接呼び出し修正のみを残したのは、パス変更を伴わずディレクトリ生成の失敗要因を除去できる最小差分だという判断。",
    "settings.page.ts を触らないことで、保存先設定 UI の回帰リスクをゼロに抑える。",
    "モック（src/data/mock/）は実機書き出しの代替ではなく、ブラウザ実行時のデモ再生用データソースとして位置付ける。",
    "録画方式の変更は要求⑤『ヒヤリ発生時の録画データサイズ改善』への対応であり、インフラ側の関心はストレージ上に長時間ファイルを残さないことに限定する。録画制御ロジック自体は Middleware の責務。",
    "連続ヒヤリ時に2方式を許容するのは先方が受入条件（動画が見られる／個別に確認できる）のみを指定し方式を委ねたため。仕様書では受入条件を先に書き、方式は選択可と明記する構成にした。",
    "ディレクトリ構造のヒヤリ動画ファイル名は暫定表記とし、確定は open_question に委ねた。暫定名を断定すると DB/UI 側が誤った規約を実装するリスクがあるため。",
    "開発期限（2026年11月末）と12月の高齢者実験開始は本ノードの実装優先度判断の前提として保持する。"
  ]
}
```