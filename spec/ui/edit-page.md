<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:29:48 JST -->

# ui.edit.page — スコアロジック直接編集・デモ再生画面 (画面3-2)

## 概要
開発者・検証用のスコアロジック編集とデモ再生ページ。gz センサログと webm 動画をブラウザからアップロードし DemoData として再生、テキストエディタで編集した ScoreLogic を `testScoreLogic` で検証してから保存する。Chart.js に GPS/加速度/ジャイロ/磁力/CAN および 4 スコア/能力指標/hiyari を GRAPH_SIZE=1200 の固定長で多変量プロットする。

## 真実源
- `src/data/src/app/edit/edit.page.ts`
- `src/data/src/app/edit/edit.page.html`

## ルーティング
- パス: `/edit`（[[ui.settings.page]] から遷移）

## 主要状態
```
ionicForm: FormGroup { scoreLogicText: [] }
hasAndroid: boolean
sensorLogLoaded: boolean          // アップロード完了フラグ
sensorTimer / sensorTimerPause    // Demo 再生の setInterval id と pause
lastSensorTime: number
sensorLogCounterText: string
sensorData: any
rangeMin/rangeMax/rangeMaxText/rangeValue: number/string  // Demo 再生位置スライダ
loadVideoFinish: boolean
scoreLogic: ScoreLogic            // 内部ランナー
scoreLogicText: string
scoreLogicRunning: boolean
labelScoreAll, label1..4, labelA/B/C: string
resultTitle: string
resultMessages: Array<any>
sensorDataList: Array             // グラフ描画用のセンサ+スコア列
lastDrawTimes: number
static GRAPH_SIZE = 1200
COLORS: { [key]: string }         // 系列色パレット
OTHER_COLORS: Array<string>       // 追加系列色
DRAW_POINT_GRAPH = ['hiyari','muscleStrength','flexibility','wideViews']
graphData: { [key]: { check1, check2, label, data } }
```
`graphData` のキーは総合/score1..4/scoreA/B/C/geolocation.{speed,heading}/acceleration.{gravity.x,y,z, beta, gamma, alpha}/lowPass 系/gyroscope/magnetometer/rotate 系/canData.{vehicleSpeed,longAcc,latAcc,frontDistance,lateralDistance,steeringAngle,accelPedalPosition,brakePressure,brakeSwitch,shiftIndication,turnSignal}/hiyari。`check1` は主 Y 軸、`check2` は副 Y 軸表示切替。

## ライフサイクル
- **constructor**: Android 判定、`logService.initialize(file)`、`DemoData.initialize(file, logService)`、`init()`。
- **`ngOnInit()`**: FormBuilder で `ionicForm` を作成、隠し `<input type='file' id='upload_gz_files'>` に change リスナ登録、`loadSensorDemoData()`、`clearResultData()`、`new ScoreLogic()`。
- **`ionViewWillEnter()`**: Android のみ `screenOrientation.lock(PORTRAIT)`。`loadVideo(DemoData.movieFile)`。
- **`ionViewWillLeave()`**: `onStopScoreLogic()`（診断中なら停止）。

## センサログ・動画のアップロード
- `showSensorFileUploadDialog()` → `<input id='upload_gz_files'>` click。
- `openSensorLogFiles(evt)`:
  1. LoadingController 表示。
  2. `onClearSensorLog()` で内部状態リセット。
  3. ファイルをファイル名で昇順ソート（時系列復元）。
  4. `.webm` は `DemoData.movieFile` にセット → `loadVideo(elem)`。
  5. それ以外は `readAsDataURL(elem)` で Base64 化 → `data:.*;base64,` のプレフィクスを削除 → `DemoData.pushSensorLogFile(base64)`。
  6. `loadSensorDemoData()`（min/max VideoTime を確定してスライダ範囲を設定）。
  7. Loading dismiss。
- この投入経路（FileReader → Base64 → `DemoData.pushSensorLogFile`、webm は `movieFile`）は変更しない。

## 投入する正準モックセンサログ
- 本画面に投入する正準モックデータは [[qa.mockdata.sensorlog.generator]] が生成する `src/data/mock/sensor-log.<scenario>.<sensorMode>.txt.gz`（正準 9 ファイル）である。
- ファイル形式・拡張子（`.txt.gz`）は既存アップロード経路が想定する gz センサログと同一であり、UI 側の読み込み処理に変更は不要。
- `<scenario>` / `<sensorMode>` の組み合わせは生成器側の定義に従う（UI はファイル名を昇順ソートするのみで、命名からモードを解釈しない）。
- webm 動画は任意入力であり、正準モックには含まれない（動画なしでもデモ再生・診断実行は可能）。

## スコアロジック保存 `onSaveScoreLogic()`
1. `ScoreLogic.testScoreLogic(logService, scoreLogicJsonText, editorText)` を実行。
2. 成功時:
   - **1 行目**: `//<UnixTime>` 形式でなければ空行を挿入。値を `//<Date.now()>` に置換。
   - **2 行目**: `//YYYY-MM-DD HH:mm:ss` 形式でなければ空行を挿入。値を `//<dateFormat(now)>` に置換。
   - Storage `scoreLogicKey` に保存、`scoreLogicText` を反映、Form も patchValue。
   - 非 Android なら Blob を生成し `<a id='save'>` で download。
   - `showSaveScoreLogicDialog()`。
3. 失敗時: `showFailedScoreLogicDialog(stackText)`。

## 診断実行 `runScoreLogic()`
- センサログが読み込まれ、`scoreLogicRunning=false` のときのみ実行。
- `onStopScoreLogic()`、`clearResultData()`、`scoreLogic.clearAll()`。
- `scoreLogicRunning=true`、`sensorTimerPause=false`。
- `scoreLogic.start(interval, callback, drawScoreLogicGraph.bind(this))` を実行。callback は Score 受信毎に:
  - error/null なら `onStopScoreLogic('運転診断 異常終了')` + `showFailedScoreLogicDialog(error)`。
  - `score.hiyari` を `sensorDataList` の最後尾要素に注入。
  - `capabilityScore.initialize` なら scoreA/B/C を四捨五入し、`resultMessages` に unshift。
  - `messageData` を組み立て、対象 message を `%COUNT='1'` `%INTERSECTION=intersection` で置換して `resultMessages` に unshift。
- `runSensorTimer()` で `DemoData.getSensorLogData()` を毎周期プッシュ、videoElement を `play()`。

## 再生レートと表示値の位置づけ
- 本画面のデモ再生は 10ms 周期でセンサログ全件を再生する高速再生であり、実機のセンサ取得周期（BLE 100ms 経路）とは異なる。
- ブラウザ 10ms 全件再生で得られた score2 の値は、score2 の合否判定には用いない。合否判定は実機 BLE 100ms 経路での結果によって行う。
- したがって本画面のスコア表示・グラフ表示は「ロジックの挙動確認・デバッグ用の参考値」であり、受入判定のエビデンスとしては扱わない。UI 上でも合否確定値としては提示しない。

## 業務ルール
- Web ブラウザ専用機能（Android では表示のみ）。デモ再生と `testScoreLogic` の検証結果を確認できる。
- 動画とセンサログは 1 走行分をアップロードする想定。ファイル名の昇順が時系列に対応。
- ロジック保存時は必ず先頭に `//<UnixTime>` と `//<日付>` の 2 行を差し込む（[[ui.opening.page]] の巻き戻し防止と協調）。
- 編集対象は単一の ScoreLogic 本文（`scoreLogicFunction`）であり、本画面に sensorMode 別ロジックを切り替える UI は存在しない（[[middleware.score.logic]] の実装実態と対応）。

## 関連ノード
- 依存: [[middleware.score.logic]] / [[middleware.sensor.demoData]] / [[middleware.sensor.manager]] / [[middleware.log.service]] / [[middleware.login.service]] / [[db.score.model]] / [[qa.mockdata.sensorlog.generator]]
- 遷移元: [[ui.settings.page]]

```json
{
  "required_changes": [
    {"node": "ui.edit.page", "entrypoint": "spec/ui/edit-page.md", "description": "正準モック sensor-log.<scenario>.<sensorMode>.txt.gz（9ファイル）の投入前提と、ブラウザ10ms全件再生値をscore2合否判定に用いない旨を追記"}
  ],
  "suggested_impacts": [
    {"domain": "QA-agent", "severity": "must", "reason": "score2の合否判定は実機BLE100ms経路で行うため、テスト手順とエビデンス取得先をブラウザ再生から分離する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "DemoData再生周期(10ms)と実機センサ周期(100ms)の差がスコア値に影響する旨をscore-logic/demoData仕様に明記する必要がある"}
  ],
  "requirements_context": "ui.edit.page はブラウザ用の検証画面（UC12: 編集とデモ再生 / UC10: スコアロジック・辞書の更新）。センサログ(.txt.gz)を FileReader で Base64 化し data:*;base64, プレフィクスを除去して DemoData.pushSensorLogFile へ渡す経路、および .webm を DemoData.movieFile として投入する経路は変更しない。ファイルはファイル名昇順にソートして時系列を復元する。投入する正準モックデータは qa.mockdata.sensorlog.generator が生成する src/data/mock/sensor-log.<scenario>.<sensorMode>.txt.gz の正準9ファイルであり、UI 側の読み込み処理は変更不要。エディタで ScoreLogic を編集し testScoreLogic で試験実行、成功時のみ 1行目に //<UnixTime>、2行目に //<YYYY-MM-DD HH:mm:ss> を差し込んで Storage(scoreLogicKey) 保存＋非Androidではファイルダウンロードを行い、失敗時はスタックをダイアログ表示する。デモ再生は10ms周期で全センサログを再生する高速再生であり、その score2 値は合否判定に用いない（合否は実機BLE100ms経路で判定）ため、本画面の表示値はロジック挙動確認用の参考値として扱う。編集対象は単一の scoreLogicFunction 本文で、sensorMode 別ロジック切替UIは存在しない。Chart.js は GRAPH_SIZE=1200 の固定長で GPS/加速度/ジャイロ/磁力/CAN と 4スコア/能力指標/hiyari を主副2軸で表示切替する。",
  "fact_candidates": [
    {"type": "input_rule", "title": "編集画面に投入する正準モックは sensor-log.<scenario>.<sensorMode>.txt.gz の9ファイル", "statement": "ui.edit.page に投入する正準モックセンサログは qa.mockdata.sensorlog.generator が生成する src/data/mock/sensor-log.<scenario>.<sensorMode>.txt.gz（正準9ファイル）である", "status": "approved"},
    {"type": "input_rule", "title": "gz センサログの投入経路は変更しない", "statement": "ui.edit.page は .txt.gz センサログを FileReader で Base64 化し data:*;base64, プレフィクスを除去して DemoData.pushSensorLogFile に渡す", "status": "candidate"},
    {"type": "input_rule", "title": "webm は movieFile として投入される", "statement": "アップロードされた .webm ファイルは DemoData.movieFile にセットされ loadVideo で再生対象になる", "status": "candidate"},
    {"type": "input_rule", "title": "アップロードファイルはファイル名昇順で時系列復元される", "statement": "openSensorLogFiles は選択されたファイルをファイル名の昇順にソートして時系列順として扱う", "status": "candidate"},
    {"type": "display_rule", "title": "ブラウザ10ms再生の score2 表示値は合否判定値ではない", "statement": "ui.edit.page のデモ再生（10ms全件再生）で表示される score2 の値は score2 の合否判定には用いず、合否は実機BLE100ms経路の結果で判定される", "status": "approved"},
    {"type": "display_rule", "title": "デモ再生のスコア表示は参考値として扱う", "statement": "ui.edit.page のスコア表示およびグラフはロジック挙動確認用の参考値であり、受入判定のエビデンスとして提示しない", "status": "candidate"},
    {"type": "input_rule", "title": "保存は testScoreLogic 成功時のみ", "statement": "onSaveScoreLogic は ScoreLogic.testScoreLogic が成功した場合のみ Storage への保存とファイル出力を行い、失敗時はスタックテキストをダイアログ表示する", "status": "candidate"},
    {"type": "input_rule", "title": "保存時に先頭2行のバージョン行が強制付与される", "statement": "保存時に1行目を //<UnixTime>、2行目を //<YYYY-MM-DD HH:mm:ss> に置換（形式不一致なら空行を挿入して差し込む）する", "status": "candidate"},
    {"type": "state_rule", "title": "診断実行はセンサログ読込済みかつ非実行中のみ", "statement": "runScoreLogic はセンサログ読み込み済み（sensorLogLoaded=true）かつ scoreLogicRunning=false のときのみ実行できる", "status": "candidate"},
    {"type": "display_rule", "title": "グラフは GRAPH_SIZE=1200 の固定長リングで描画される", "statement": "drawScoreLogicGraph は各系列データを push し、GRAPH_SIZE=1200 を超えた分を shift して固定長で表示する", "status": "candidate"},
    {"type": "input_rule", "title": "sensorMode 別ロジック切替UIは存在しない", "statement": "ui.edit.page は単一の ScoreLogic 本文を編集対象とし、sensorMode によるロジック切替の入力手段を持たない", "status": "candidate"},
    {"type": "display_rule", "title": "本画面はブラウザ専用機能である", "statement": "ui.edit.page のデモ再生・ロジック編集は Web ブラウザ向け機能であり、Android では表示のみとなる", "status": "candidate"}
  ],
  "open_questions": [
    "正準9ファイルの <scenario> と <sensorMode> の具体的な値の組み合わせが未確定。UI はファイル名を解釈しないため表示には影響しないが、検証手順書での指定に必要（QA/Middleware 判断）。",
    "編集画面上で『この値は合否判定に使わない』旨を注意文としてUI表示するか、仕様書記載のみに留めるかが未確定。決まらないと画面文言の実装有無が定まらない（UX判断）。",
    "正準モック投入時に webm が存在しない場合の再生UI（動画領域の非表示/プレースホルダ）の期待挙動が未確定。現行実装は loadVideoFinish 依存であり明文化されていない。",
    "実機BLE100ms経路での score2 合否判定結果を本画面で参照・比較する導線が必要か未確定（QA/Middleware 判断）。"
  ],
  "rationale_notes": [
    "本画面はセンサログ投入経路（FileReader→Base64→DemoData.pushSensorLogFile）が既存の検証フローの基盤であるため、正準モック導入でも読み込み処理は変更せず、投入するデータの出自のみを仕様に明記する方針とした。",
    "10ms 全件再生はロジックのデバッグ効率を優先した設計であり、実機のセンサ取得周期と一致しない。よって表示値の位置づけを『参考値』として明文化し、合否判定責務は実機経路（QA/Middleware）に置く。",
    "sensorMode 別ロジック切替が未実装である点は middleware.score.logic の実装実態ファクトと整合させ、UI に切替入力が存在しないことを明記した（実装変更は行わない）。"
  ]
}
```