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

## Chart.js 描画 `drawScoreLogicGraph(keyName, data, type)`
- `graphData[keyName].data` に data を push、GRAPH_SIZE を超えたら shift。
- 表示中の series のみを Chart に反映（`chart.update()`）。

## 業務ルール
- Web ブラウザ専用機能（Android では表示のみ）。デモ再生と `testScoreLogic` の検証結果を確認できる。
- 動画とセンサログは 1 走行分をアップロードする想定。ファイル名の昇順が時系列に対応。
- ロジック保存時は必ず先頭に `//<UnixTime>` と `//<日付>` の 2 行を差し込む（[[ui.opening.page]] の巻き戻し防止と協調）。

## 関連ノード
- 依存: [[middleware.score.logic]] / [[middleware.sensor.demoData]] / [[middleware.sensor.manager]] / [[middleware.log.service]] / [[middleware.login.service]] / [[db.score.model]]
- 遷移元: [[ui.settings.page]]
