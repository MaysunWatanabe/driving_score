# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面。センサーサービスから 10ms 周期でセンサー統合値を受け、ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行し、総合＋4 指標のスコアを星または順位（101-score）で表示する。Google Map 上に自車位置/開始・終了マーカー/ヒヤリ地点/走行軌跡を描画し、MediaRecorder で 60 秒チャンクの video/webm を Documents/driving-score 配下に追記保存する。

## 真実源
- `src/data/src/app/driving/driving.page.ts`
- `src/data/src/app/driving/driving.page.html`
- `src/data/src/app/driving/driving.module.ts`

## ルーティング
- パス: `/driving`

## 状態
```
status: 0(init) | 1(running) | 2(finish)
statusValues = { init:0, running:1, finish:2 }
landscape: boolean
scoreAll, score1..4: number       // 0-100 の平均スコア（Math.round 済み）
scoreAllText, score{i}Text: string  // 星または順位 (101-score)
scoreShowStarArea1 / area2: boolean
label1..4: string                  // scoreLogicJson.settings.label から
recording: boolean
autoScrollLock: boolean            // ユーザーが地図をドラッグしたら自車位置追従 OFF
lastLatLng: google.maps.LatLng     // 最後の GPS 位置
saveDirectoryPath: string          // Documents/driving-score/data.<日時>/
videoRecordedPath: string          // 動画ファイルの Blob URL
videoChunks: Blob[]                // 60 秒毎の webm チャンク
mediaRecorder: MediaRecorder
scoreLogic: ScoreLogic
cssHeader / cssMap / cssScore / cssStart / cssPointer: string  // 縦横 CSS 名
hasAndroid: boolean
```

## ライフサイクル
- **constructor**: `initialize()` を await せず起動（`loginService.initialize()`、label 反映、`logService.initialize`、`new ScoreLogic`、`DemoData.initialize`）。
- **`ngOnInit()`**: `changeOrientation()`、`scoreShowStar` を settings から反映。
- **`ionViewWillEnter()`**: `screenOrientation.unlock()`（縦横自由）。`onChange().subscribe` で回転時に `changeOrientation()` を再実行。
- **`ionViewDidEnter()`**: `loadVideo()`、`sensorService.start()`、`mapService.loadGoogleInstance(loadMap)`、`insomnia.keepAwake()`。
- **`ionViewWillLeave()`**: `sensorService.stop()`、`scoreLogic.stop()`、`mapService.stop()`、`stopVideo()`、`insomnia.allowSleepAgain()`。

## `changeOrientation()`
- `screenOrientation.type` に `'landscape'` が含まれるかで縦横判定。非 Android は `platform.width() > platform.height()` の代替判定。
- CSS クラス名を `header_portrait/landscape` などの組にスワップ。

## `loadMap()`
- 未取得なら `sensorService.getLastLatLng()` で初期中心を確定（未取得時は横浜のフォールバック）。
- `mapService.createMap(mapElement, lastLatLng, 16)` + `drawCarMarker(lastLatLng, 0)`。
- `status === finish` なら `fitBounds()`。
- `drag` リスナで `autoScrollLock=true`（自車位置追従 OFF）。
- `mark` リスナで `status === finish` のときのみ:
  1. `mapService.setSelectMarkerPos(pos)`。
  2. `videoRecordedPath` を `/` → `@` に置換し `/bad-spot/<encoded>` に `navCtrl.navigateForward`。

## 診断開始 `onStart()`
1. `saveScoreLogic()`（ログ・センサログのいずれか ON なら `data.<日時>` ディレクトリを作成し、scoreLogicJson/scoreLogic をスナップショット保存）。
2. `sensorService.startScoreLogic()`（`SensorManager.initializeCalibration()`、`DemoData.reset()`）。
3. `status=running`、`autoScrollLock=false`、`mapService.clearMarker()`、`setZoom(16)`、`setCenter(lastLatLng)`。
4. `lastLatLng = await sensorService.getLastLatLng()`（実センサー最新座標）、`drawStartMarker(lastLatLng)`。
5. `scoreLogic.clearAll()` → `scoreLogic.start(interval, cb)`（既定 300ms）。cb は `checkScoreLogic(score)`。
6. `startVideo()` を実行。

## 診断終了 `onStop()`
1. `status=finish`、`scoreLogic.stop()`、`sensorService.stopScoreLogic()`、`stopVideo()`。
2. `mapService.drawEndMarker(lastLatLng)`、`fitBounds()`。
3. `scoreDbService.insertScore(scoreLogic)` を投げる（await せずファイア＆フォーゲット）。
4. `loginService.scoreId = scoreLogic.startTimestamp`。
5. 終了ダイアログを表示。
6. `logService.resetLogDir()`（ログパスを既定に戻す）。

## その他のイベント
- `onHistory()`: `/history` に遷移。
- `onScore()`: `status=finish` のときのみ `/comment` に遷移。
- `onPointer()`: `autoScrollLock=false`。`finish` なら `fitBounds`、実行中なら `setZoom(16) + setCenter(lastLatLng)`。

## 動画
- `loadVideo()`: 非 Android は `DemoData.movieFile` があれば `URL.createObjectURL()` を videoRecordedPath に設定。Android は `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` → `new MediaRecorder(stream, { mimeType: 'video/webm' })`、`dataavailable` イベントで `saveVideo()`。
- `startVideo()`: 非 Android or `settings.recording=false` は no-op。`mediaRecorder.state=='inactive'` のとき `recording=true`、`videoChunks.splice(0)`、`mediaRecorder.start(60000)`（60 秒で dataavailable 発火）。
- `stopVideo()`: `mediaRecorder.stop()`。
- `saveVideo(event)`: 非 Android は no-op。`videoChunks.push(event.data)`。**初回は `file.writeFile(saveDirectoryPath, 'movie.webm', event.data)`、2 回目以降は `{append:true}`**。`state==='inactive'` なら `new Blob(videoChunks, {type:'video/webm'})` を作り `videoRecordedPath` に設定。

## `updateSensor(sensorData, updateMap)`
- `sensorData === null`: センサー異常発生 → `onStop()`。
- `updateMap === false`: `scoreLogic.pushSensorData(sensorData)`（診断ロジックへ流す）。
- `updateMap === true`: `lastLatLng = new google.maps.LatLng(lat, lng)`。`status==running` なら `drawCircleMarker(lastLatLng)`。`autoScrollLock` が false かつ `status != finish` なら `setCenter(lastLatLng)`。`drawCarMarker(lastLatLng, heading)`。

## `checkScoreLogic(score)`
- `scoreLogic` の走行内平均を Math.round し、`scoreShowStarArea1/2` に応じて `getRank(=101 - Math.round(score); 100 上限)` で順位表記に切替。
- `score.hiyari` が真なら `pushBadPoint(score)`。

## `pushBadPoint(score)`
- `videoTime = Math.floor(sensorService.getLastSensorTime() / 1000)`（秒）。
- 各 message を `type != 'positive'` かつ `key === 'score1..4'` の 4 種に振り分け、`%COUNT` を `'1'`、`%INTERSECTION` を `message.intersection` で置換。
- `mapService.drawMarker(latLng, time文字列, videoTime, { msg1, msg2, msg3, msg4 })`。

## `saveScoreLogic()`
- 非 Android は no-op。
- `recording || logStorage || sensorLogStorage` のいずれかが有効なら `logService.setLogDir('data.<日時>')` を呼び `saveDirectoryPath` に反映。
- `logStorage || sensorLogStorage` のとき、Storage の `scoreLogicJsonKey` と `scoreLogicKey` を `scoreLogicJson.txt` / `scoreLogic.txt` としてスナップショット保存する。

## `getRank(score)`
- `rank = 101 - Math.round(score)`、100 を超えたら 100 に丸めて文字列化。

## `dateFormat(date)`
- `YYYY/MM/DD HH:mm:ss`。

## 業務ルール
- 診断中は Insomnia でスリープ抑止。画面向きは自由。
- 動画は 1 走行 = `data.<日時>/movie.webm` の 1 ファイル追記（60 秒毎のチャンク append）。
- ヒヤリマーカーのタップは診断終了後のみ有効。タップで動画パス（`@` エスケープ）付き `/bad-spot/:path` に遷移。

## 関連ノード
- 依存: [[middleware.sensor.service]] / [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.sensor.demoData]] / [[db.score.repository]] / [[infra.file.storage]] / [[infra.cordova.sensors]]
- 遷移先: [[ui.badspot.page]] / [[ui.comment.page]] / [[ui.history.page]]
