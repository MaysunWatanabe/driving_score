<!-- 作成: 2026-09-10 17:30:07 JST | 更新: 2026-09-18 18:00:31 JST -->

# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面。センサーサービスから 10ms 周期でセンサー統合値を受け、ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行し、総合＋4 指標のスコアを星または順位（101-score）で表示する。Google Map 上に自車位置/開始・終了マーカー/ヒヤリ地点/走行軌跡を描画し、MediaRecorder で 60 秒チャンクの video/webm を書き出しルート配下の走行ディレクトリへ追記保存する。

走行を終了すると結果が SQLite（`scoreDbService.insertScore`）に保存され、終了ダイアログから「アドバイス表示」（[[ui.comment.page]]）へ、地図上のヒヤリマーカーからヒヤリ地点詳細（[[ui.badspot.page]]）へ導線が開く。

走行中にヒヤリポイントが検出された時点で、本画面は**音を鳴らして利用者に通知する**（2026 年度改修要求に基づく承認済みルール）。

> **2026 年度改修に関する注記**
> 本ノードは 2026 年度改修（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 ／ メイサンソフト『要求仕様確認』2026-09-17）の影響を受ける。スコア表示のレーダーチャート化（6 項目・5 段階）、ヒヤリ前後 15 秒の個別録画化、画面の縦横変更要求などが検討中であり、確定していない論点は「未確定論点（2026 年度改修）」節に集約する。以下の本文は**現行実装の実態**を記述したものである。

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
saveDirectoryPath: string          // <書き出しルート>/data.YYYYMMDD-HHMMSS/
videoRecordedPath: string          // 動画ファイルの Blob URL
videoChunks: Blob[]                // 60 秒毎の webm チャンク
mediaRecorder: MediaRecorder
scoreLogic: ScoreLogic
cssHeader / cssMap / cssScore / cssStart / cssPointer: string  // 縦横 CSS 名
hasAndroid: boolean
```

## 書き出しルート（保存先）
- ログ・センサログ・動画（webm）の書き出しルートは
  `{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/` とする。
  - `debug-log/`: デバッグログ出力先（既定のログディレクトリ）
  - `data.YYYYMMDD-HHMMSS/`: 1 走行分の成果物（`movie.webm` / `scoreLogicJson.txt` / `scoreLogic.txt` / センサログ）
- `#79` で検討された `{externalDataDirectory}/driving-score/...` 案は**撤回済み**であり、本画面の保存先は上記 `Documents` 配下とする。
- 採取手段はファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` を正とする。
- センサログの保存は**診断中（`status === running`）のみ**行う。診断開始前・終了後にセンサログは書き出されない。
- 追加パーミッションは要求しない。書き出し失敗時のユーザー提示・保持期間管理は本仕様の対象外。
- CAN データを確認用に保存するか否かは先方の宿題として未確定（「未確定論点」参照）。

## ライフサイクル
- **constructor**: `initialize()` を await せず起動（`loginService.initialize()`、label 反映、`logService.initialize`、`new ScoreLogic`、`DemoData.initialize`）。
- **`ngOnInit()`**: `changeOrientation()`、`scoreShowStar` を settings から反映。
- **`ionViewWillEnter()`**: `screenOrientation.unlock()`（縦横自由）。`onChange().subscribe` で回転時に `changeOrientation()` を再実行。
- **`ionViewDidEnter()`**: `loadVideo()`、`sensorService.start()`、`mapService.loadGoogleInstance(loadMap)`、`insomnia.keepAwake()`。
- **`ionViewWillLeave()`**: `sensorService.stop()`、`scoreLogic.stop()`、`mapService.stop()`、`stopVideo()`、`insomnia.allowSleepAgain()`。

## `changeOrientation()`
- `screenOrientation.type` に `'landscape'` が含まれるかで縦横判定。非 Android は `platform.width() > platform.height()` の代替判定。
- CSS クラス名を `header_portrait/landscape` などの組にスワップ。
- 本画面は現行実装で既に縦横自由（`unlock`）であり、2026 年度の「縦横変更できるようにしてください」要求とは衝突しない。衝突するのは縦固定を掛けている他画面（履歴・アドバイス等）であり、本ノードの対象外。

## `loadMap()`
- 未取得なら `sensorService.getLastLatLng()` で初期中心を確定（未取得時は横浜のフォールバック）。
- `mapService.createMap(mapElement, lastLatLng, 16)` + `drawCarMarker(lastLatLng, 0)`。
- `status === finish` なら `fitBounds()`。
- `drag` リスナで `autoScrollLock=true`（自車位置追従 OFF）。
- `mark` リスナで `status === finish` のときのみ:
  1. `mapService.setSelectMarkerPos(pos)`。
  2. `videoRecordedPath` を `/` → `@` に置換し `/bad-spot/<encoded>` に `navCtrl.navigateForward`。

## 診断開始 `onStart()`（UC06）
1. `saveScoreLogic()`（ログ・センサログ・録画のいずれか ON なら `data.YYYYMMDD-HHMMSS` ディレクトリを作成し、scoreLogicJson/scoreLogic をスナップショット保存）。
2. `sensorService.startScoreLogic()`（`SensorManager.initializeCalibration()`、`DemoData.reset()`）。
3. `status=running`、`autoScrollLock=false`、`mapService.clearMarker()`、`setZoom(16)`、`setCenter(lastLatLng)`。
4. `lastLatLng = await sensorService.getLastLatLng()`（実センサー最新座標）、`drawStartMarker(lastLatLng)`。
5. `scoreLogic.clearAll()` → `scoreLogic.start(interval, cb)`（既定 300ms）。cb は `checkScoreLogic(score)`。
6. `startVideo()` を実行。

センサーサービス・スコアロジックランナー・録画の 3 系統がこの操作で同時に起動する。

### センサーモードによる差異（UI 表示上の注意点／実装実態）
- `smartphoneOnly` モードでは BLE スキャンを行わない（[[middleware.sensor.service]] がスキップする）。したがって診断開始時に CAN アダプタ接続待ちの表示・待機は発生しない。
- `smartphoneOnly` 実行時、`sensor.service.ts` の `lastCanData` ゼロ埋め（`shiftIndication=0` 等）により CAN 版スコアロジック（`scoreLogicFunction.txt`）の全指標が発火せず、`scoreList` が空となるため、**総合および 4 指標がいずれも「未算出」として 100（星表示なら満点、順位表示なら 1 位相当）で表示される**。これは現行実装の実態であり、本画面のスコア表示はこの値をそのまま描画する。
  - 本項は実装実態の記載であり、是正の是非・切替実装の有無については本仕様では規定しない。
- センサーモードによる**スコアロジックの差し替えは未実装**である（`opening.page.ts` は常に `assets/data/scoreLogicFunction.txt` を取得し、`scoreLogicFunction_simple.txt` はどこからも参照されない）。したがって本画面が表示するスコアは、モードに関わらず常に CAN 版ロジックの算出結果である。

### CAN 版ロジックが設定する指標の範囲（実装実態）
- CAN 版ロジックが実際に値を設定するのは `score1` / `score2` / `overAll` / `scoreA` / `scoreB` のみで、`score3` / `score4` / `scoreC` は未設定である。
- したがって `label3` / `label4` が空文字となる（[[infra.assets.scoreLogicJson]] の `settings.label` と対応）。本画面は空ラベルの指標欄をそのまま描画する。
- ヒヤリ判定は `result.hiyari=true` とメッセージの設定のみを行い、**スコア値を減点しない**。本画面のスコア表示はヒヤリ発生によって変化しない（表示されるのはヒヤリマーカーとメッセージ、および検出音）。
- `scoreLogic` の平均には開始直後に積まれる初期値 `Score(null)`（各指標 100）が 1 件混入するため、走行序盤の表示は実測値より高めに出る（`(評価窓合計 + 100) / (窓数 + 1)`）。これも実装実態であり、本画面は受け取った平均値をそのまま表示する。

## 診断終了 `onStop()`
1. `status=finish`、`scoreLogic.stop()`、`sensorService.stopScoreLogic()`、`stopVideo()`。
2. `mapService.drawEndMarker(lastLatLng)`、`fitBounds()`。
3. `scoreDbService.insertScore(scoreLogic)` を投げる（await せずファイア＆フォーゲット）→ 走行結果が SQLite に保存される。
4. `loginService.scoreId = scoreLogic.startTimestamp`（後続のアドバイス表示・履歴が参照する走行 ID）。
5. 終了ダイアログを表示。ダイアログからの導線:
   - 「アドバイス表示」→ [[ui.comment.page]]（`onScore()` と同等の遷移）
   - ダイアログを閉じた後、地図上のヒヤリマーカーをタップ → [[ui.badspot.page]]（UC08）
6. `logService.resetLogDir()`（ログパスを既定の `debug-log` に戻す）。
7. センサログ書き出しは本操作で停止する（診断中のみ保存）。

## その他のイベント
- `onHistory()`: `/history` に遷移。
- `onScore()`: `status=finish` のときのみ `/comment` に遷移。
- `onPointer()`: `autoScrollLock=false`。`finish` なら `fitBounds`、実行中なら `setZoom(16) + setCenter(lastLatLng)`。

## ヒヤリ検出時の通知（音）
- 走行中（`status === running`）にヒヤリポイントを検出した時点で音を鳴らす。
- 発音契機はヒヤリ判定が成立したタイミング（`score.hiyari === true`、`pushBadPoint()` の起点）と一致する。
- 音の種類・音量・端末のサイレント/メディア音量との関係、連続ヒヤリ時の再発音抑制（デバウンス）は未確定（「未確定論点」参照）。

## 動画
- `loadVideo()`: 非 Android は `DemoData.movieFile` があれば `URL.createObjectURL()` を videoRecordedPath に設定。Android は `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` → `new MediaRecorder(stream, { mimeType: 'video/webm' })`、`dataavailable` イベントで `saveVideo()`。
- `startVideo()`: 非 Android or `settings.recording=false` は no-op。`mediaRecorder.state=='inactive'` のとき `recording=true`、`videoChunks.splice(0)`、`mediaRecorder.start(60000)`（60 秒で dataavailable 発火）。
- `stopVideo()`: `mediaRecorder.stop()`。
- `saveVideo(event)`: 非 Android は no-op。`videoChunks.push(event.data)`。**初回は `file.writeFile(saveDirectoryPath, 'movie.webm', event.data)`、2 回目以降は `{append:true}`**。`state==='inactive'` なら `new Blob(videoChunks, {type:'video/webm'})` を作り `videoRecordedPath` に設定。
- 保存先は `{externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/movie.webm`。
- **2026 年度改修（検討中）**: 走行全体の通し録画から「ヒヤリ前後 15 秒の個別録画」へ変更する要求がある。ヒヤリが 30 秒以内に連続した場合は 1 本に継続録画してもよく、ヒヤリポイントごとに個別生成してもよい（実装しやすい方式を選んでよい）。ただし「ヒヤリ時の動画が見られること」「個別にヒヤリポイントの動画を確認できること」の 2 条件は必ず満たす。前後秒数を設定で可変にするかは未確定。

## `updateSensor(sensorData, updateMap)`
- `sensorData === null`: センサー異常発生 → `onStop()`。
- `updateMap === false`: `scoreLogic.pushSensorData(sensorData)`（診断ロジックへ流す）。
- `updateMap === true`: `lastLatLng = new google.maps.LatLng(lat, lng)`。`status==running` なら `drawCircleMarker(lastLatLng)`。`autoScrollLock` が false かつ `status != finish` なら `setCenter(lastLatLng)`。`drawCarMarker(lastLatLng, heading)`。

## `checkScoreLogic(score)`
- `scoreLogic` の走行内平均を Math.round し、`scoreShowStarArea1/2` に応じて `getRank(=101 - Math.round(score); 100 上限)` で順位表記に切替。
- `score.hiyari` が真なら `pushBadPoint(score)` を実行し、あわせて検出音を鳴らす。
- 指標が未算出の場合、平均値は 100 として扱われ満点表示になる（前掲「センサーモードによる差異」「CAN 版ロジックが設定する指標の範囲」参照）。

## `pushBadPoint(score)`（UC08 の起点）
- `videoTime = Math.floor(sensorService.getLastSensorTime() / 1000)`（秒）。
- 各 message を `type != 'positive'` かつ `key === 'score1..4'` の 4 種に振り分け、`%COUNT` を `'1'`、`%INTERSECTION` を `message.intersection` で置換。
- `mapService.drawMarker(latLng, time文字列, videoTime, { msg1, msg2, msg3, msg4 })`。

## `saveScoreLogic()`
- 非 Android は no-op。
- `recording || logStorage || sensorLogStorage` のいずれかが有効なら `logService.setLogDir('data.YYYYMMDD-HHMMSS')` を呼び、`{externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/` を `saveDirectoryPath` に反映する。
- `logStorage || sensorLogStorage` のとき、Storage の `scoreLogicJsonKey` と `scoreLogicKey` を `scoreLogicJson.txt` / `scoreLogic.txt` としてスナップショット保存する。

## `getRank(score)`
- `rank = 101 - Math.round(score)`、100 を超えたら 100 に丸めて文字列化。

## `dateFormat(date)`
- `YYYY/MM/DD HH:mm:ss`。

## 業務ルール
- 診断中は Insomnia でスリープ抑止。画面向きは自由。
- 動画は 1 走行 = `data.YYYYMMDD-HHMMSS/movie.webm` の 1 ファイル追記（60 秒毎のチャンク append）。
- センサログは診断中のみ保存する。
- ヒヤリポイント検出時に音を鳴らす。
- ヒヤリマーカーのタップは診断終了後のみ有効。タップで動画パス（`@` エスケープ）付き `/bad-spot/:path` に遷移。
- 「アドバイス表示」は診断終了後（`status === finish`）のみ有効。
- ヒヤリ判定はスコア値を減点しない（マーカー・メッセージ・音のみ）。

## 未確定論点（2026 年度改修）
本画面に関係する未確定事項。確定するまで現行実装の挙動を維持する。

| 論点 | 内容 | 判断主体 |
|---|---|---|
| スコア表示のレーダーチャート化 | 従来の☆／順位表示を削除し、6 項目（筋力・柔軟性・空間把握・危険予測・視力・視野）・1〜5 段階のレーダーチャートと評価コメントに置き換える要求がある。採点データ形式は先方検討中（試作中に提示）。 | 先方 + Middleware |
| アドバイス画面への導線 | 現行はスコア欄タップが [[ui.comment.page]] への唯一の導線。スコア表示削除後の導線（レーダーチャートのタップ等）が未定義。 | UI + 先方 |
| ヒヤリ録画の個別化 | 前後 15 秒の個別録画に変更した場合の保存単位・ファイル命名・[[ui.badspot.page]] 側の再生方式が未定。前後秒数の可変化も未確定。 | UI + Middleware + Infra |
| ヒヤリ検出音の詳細 | 音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未定。 | UI |
| CAN データ保存 | CAN データを確認用に保存できるかが先方の宿題。 | 先方 + Infra |
| BLE 安定化 | 受信の不安定さに対し「パラレル処理化」が先方より示唆されているが**仮説**であり確定した対策ではない。実機で確認しながら調整する領域。テスト用ナビ端末の提供時期も未定。 | Middleware |
| スコアロジック凍結 | スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は打ち合わせ後まで**変更しない**。本画面はその出力をそのまま表示する。 | Middleware |

## 関連ノード
- 依存: [[middleware.sensor.service]] / [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.score.logicCan]] / [[middleware.sensor.demoData]] / [[db.score.repository]] / [[infra.file.storage]] / [[infra.assets.scoreLogicJson]] / [[infra.cordova.sensors]]
- 遷移先: [[ui.badspot.page]] / [[ui.comment.page]] / [[ui.history.page]]
- 2026 年度改修で関連: [[ui.opening.page]]（1-2 前回結果表示）/ [[ui.service.page]]（8-1 サービス案表示）

```json
{
  "required_changes": [
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "ヒヤリポイント検出時に音を鳴らすルールを業務ルールおよび専用節として追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "CAN版ロジックが設定するのは score1/score2/overAll/scoreA/scoreB のみで score3/score4/scoreC は未設定、label3/label4 が空である実装実態を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "ヒヤリ判定はスコアを減点せずマーカー・メッセージ・音のみである旨を明記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "開始直後の初期値 Score(null)=100 が平均に1件混入し走行序盤の表示が高めに出る実装実態を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "センサーモードによるスコアロジック差し替えは未実装（常に scoreLogicFunction.txt）である旨を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "2026年度改修のレーダーチャート化・ヒヤリ前後15秒個別録画・縦横対応・BLE安定化などを未確定論点表として集約"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "連続ヒヤリ（30秒以内）の動画は1本継続でも個別生成でもよいが、動画視聴と個別確認の2条件を満たす必要がある旨を動画節に追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "ヒヤリ前後15秒の個別録画に変更する場合、録画トリガ・分割・ファイル管理の責務をどこが持つか score-logic / sensor.service 側で規定が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目・5段階のスコアを供給する算出責務が未定義であり、現行 scoreA/scoreB/scoreC（0-100・3列）と尺度も項目数も一致しない"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が scoreA/scoreB/scoreC の3列REALであり6項目5段階と不一致のため、テーブル拡張または新設の判断が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "スコア☆表示削除に伴い ui.comment.page への導線が失われるため、遷移元の再定義が ui.comment.page 側と整合する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "ヒヤリ動画が前後15秒の個別動画になると ui.badspot.page の currentTime 追尾方式・前後ボタン挙動が成立しなくなる"},
    {"domain": "Infra-agent", "severity": "should", "reason": "ヒヤリ検出音の音源アセット追加、および個別録画化に伴う保存レイアウト変更が書き出しルート仕様に影響する"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "BLE安定化のパラレル処理化は仮説段階であり、現時点では sensor.service 仕様を確定変更してはならない旨の注記が必要"}
  ],
  "requirements_context": "運転診断画面（/driving、画面4-1〜4-3）は UC06（運転診断の実行）と UC08（ヒヤリ地点確認導線）を担う。『診断開始』操作でセンサーサービス（sensorService.start / startScoreLogic）、スコアロジックランナー（scoreLogic.start、既定 settings.scoreLogicInterval=300ms）、録画（MediaRecorder、60秒チャンク）を同時起動する。走行中は 10ms 周期のセンサー統合値を scoreLogic.pushSensorData に流し、総合＋4指標を星または順位（101-score、上限100）で表示、Google Map に自車位置・開始/終了マーカー・ヒヤリ地点・走行軌跡を描画する。走行終了（onStop）で scoreLogic/sensor/録画を停止し、drawEndMarker と fitBounds を実行、scoreDbService.insertScore で結果を SQLite に保存（await しないファイア＆フォーゲット）、loginService.scoreId に startTimestamp を設定し、終了ダイアログを表示する。終了ダイアログからは『アドバイス表示』で ui.comment.page へ遷移でき、地図上のヒヤリマーカータップ（status===finish のみ有効）で videoRecordedPath を '/'→'@' 置換した /bad-spot/:path へ遷移する。\n\n【ヒヤリ通知】走行中にヒヤリポイントを検出した時点で音を鳴らす（承認済み業務ルール）。発音契機は score.hiyari===true（pushBadPoint の起点）と一致する。音源・音量・サイレント時の扱い・連続ヒヤリ時のデバウンスは未確定。\n\n【ファイル書き出し】ログ・センサログ・webm の書き出しルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ であり、#79 の externalDataDirectory 案は撤回済み。センサログ保存は診断中のみ。動画は 1 走行 = data.YYYYMMDD-HHMMSS/movie.webm への初回 writeFile＋以降 append。saveScoreLogic は recording/logStorage/sensorLogStorage のいずれか有効時に logService.setLogDir('data.<日時>') を呼び、logStorage||sensorLogStorage 時に scoreLogicJson.txt / scoreLogic.txt をスナップショット保存する。onStop 後は logService.resetLogDir() で debug-log に戻す。CAN データを確認用に保存できるかは先方の宿題として未確定。\n\n【スコア表示の実装実態】(1) センサーモードによるスコアロジック差し替えは未実装で、opening.page.ts は常に assets/data/scoreLogicFunction.txt を取得し scoreLogicFunction_simple.txt はどこからも参照されない。(2) smartphoneOnly では BLE スキャンをスキップするため CAN アダプタ接続待ちの UI 表示は発生せず、lastCanData ゼロ埋めにより CAN 版全指標が発火せず scoreList が空となり総合・4指標すべてが 100（未算出）として表示される。(3) CAN 版ロジックが実際に設定するのは score1/score2/overAll/scoreA/scoreB のみで score3/score4/scoreC は未設定であり、settings.label の label3/label4/labelC が空であることと対応する。本画面は空ラベル欄をそのまま描画する。(4) ヒヤリ判定は result.hiyari=true とメッセージ設定のみを行いスコア値を減点しない。(5) 開始直後に Score(null)（各指標100）が1件平均に混入するため走行序盤の表示は (評価窓合計+100)/(窓数+1) となり実測より高めに出る。これらはいずれも実装実態として記録するのみで、是正の是非は本仕様で規定しない。スコアロジック関連コードは打ち合わせ後まで変更しない凍結状態にある。\n\n【画面挙動】本画面は screenOrientation.unlock により縦横自由で、回転時に CSS クラス名を差し替える。診断中は Insomnia でスリープ抑止。センサー異常（sensorData===null）時は自動的に onStop する。2026年度の『縦横変更できるようにしてください』要求は縦固定を掛けている他画面（履歴・アドバイス等）が対象で、本画面は既に要求を満たす。\n\n【2026年度改修の影響（未確定）】日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 および メイサンソフト『要求仕様確認』2026-09-17 に基づく 5 要求（前回結果表示・タブ切替・レーダーチャート表示・BLE安定化・ヒヤリ録画サイズ改善）のうち、本画面は以下の影響を受ける。(a) 採点スコアを 6 項目（筋力・柔軟性・空間把握・危険予測・視力・視野）・1〜5 段階（5 が良好、3 が年齢平均）のレーダーチャートで表示し『今回』と『過去の平均』の 2 系列を図示、各項目に『n 点（5点満点）』と 2 行程度の評価コメントを併記する要求。採点データ形式は先方検討中。(b) 従来の☆スコア表示を削除するとアドバイス画面への唯一の導線が失われるため、レーダーチャートタップ等への置き換えが必要だが未確定。(c) ヒヤリ発生時の録画を前後15秒の個別動画に変更する要求。30秒以内の連続ヒヤリは1本継続でも個別生成でもよく、『ヒヤリ時の動画が見られる』『個別にヒヤリポイントの動画を確認できる』の2条件を満たせば実装しやすい方式を選んでよい。前後秒数の可変化は未確定。(d) BLE 受信の不安定さに対する『パラレル処理化』は先方の想定にとどまる仮説であり確定した対策ではない。テスト用ナビ端末の提供時期も未定。開発は 2026 年 11 月末完了、12 月から高齢者実験開始のスケジュール制約下にある。",
  "fact_candidates": [
    {
      "type": "business_rule",
      "title": "ヒヤリポイント検出時に音を鳴らす",
      "statement": "走行中にヒヤリポイントを検出した時点で音を鳴らして利用者に通知する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "ヒヤリ検出音の発音契機はヒヤリ判定成立時である",
      "statement": "ヒヤリ検出音は score.hiyari が真となりヒヤリ地点が地図に追加されるのと同一契機で鳴る",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "ヒヤリ判定はスコア表示を変化させない",
      "statement": "ヒヤリ判定はスコア値を減点しないため、ヒヤリ発生によって画面のスコア表示は変化せず、ヒヤリマーカー・メッセージ・検出音のみが変化する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "score3/score4 の指標ラベルは空文字で描画される",
      "statement": "CAN 版ロジックが score3/score4/scoreC を設定しないため settings.label の label3/label4/labelC は空であり、画面は空ラベルの指標欄をそのまま描画する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "走行序盤のスコア表示は初期値100の混入により高めに出る",
      "statement": "スコア平均には開始直後の初期値 Score(null)（各指標100）が1件混入するため、走行序盤の表示値は (評価窓合計+100)/(窓数+1) となり実測より高めに表示される",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "センサーモードによるスコアロジック差し替えは未実装である",
      "statement": "アプリは常に CAN 版スコアロジックを読み込むため、本画面が表示するスコアはセンサーモードに関わらず CAN 版ロジックの算出結果である",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "smartphoneOnly 実行時は全スコアが未算出の100として表示される",
      "statement": "smartphoneOnly 実行時は CAN 版ロジックの全指標が発火せず scoreList が空となるため、総合および4指標はすべて 100（未算出）として表示される",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "smartphoneOnly では CAN アダプタ接続待ちの表示が発生しない",
      "statement": "センサーモードが smartphoneOnly の場合、診断開始時に BLE スキャンを行わないため CAN アダプタ接続待ちの表示・待機は発生しない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "運転診断画面は init/running/finish の3状態を持つ",
      "statement": "運転診断画面の status は 0(init)/1(running)/2(finish) の3値をとり、表示と操作可否はこの状態に従う",
      "status": "candidate"
    },
    {
      "type": "input_rule",
      "title": "『診断開始』操作でセンサー・スコアロジック・録画が同時起動する",
      "statement": "利用者が『診断開始』を操作すると、センサーサービス開始・スコアロジックランナー開始・録画開始が同一操作で起動する",
      "status": "candidate"
    },
    {
      "type": "input_rule",
      "title": "スコア値は画面上で直接編集できない",
      "statement": "利用者は運転診断画面上でスコア値を直接入力・編集してはならない",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "ヒヤリマーカーのタップは診断終了後のみ有効",
      "statement": "地図上のヒヤリマーカーのタップは status が finish のときのみ受け付けられ、ヒヤリ地点詳細画面へ遷移する",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "アドバイス表示は診断終了後のみ有効",
      "statement": "『アドバイス表示』への遷移は status が finish のときのみ受け付けられる",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "走行終了時に終了ダイアログが表示される",
      "statement": "走行終了操作の完了後に終了ダイアログが表示され、アドバイス表示への導線が提示される",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "書き出しルートは externalRootDirectory/Documents/driving-score 配下である",
      "statement": "ログ・センサログ・webm の書き出しルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "センサログの保存は診断中のみ行われる",
      "statement": "センサログは診断中（status=running）の間のみ書き出され、診断開始前および終了後は書き出されない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "1走行の動画は単一ファイルへの追記で保存される（現行）",
      "statement": "現行実装では録画は 1 走行あたり data.YYYYMMDD-HHMMSS/movie.webm の1ファイルに対し、初回書き込みと2回目以降の追記で保存される",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "連続ヒヤリ時の動画生成方式は実装都合で選んでよい",
      "statement": "ヒヤリ判定が30秒以内に連続した場合、1本に継続録画してもヒヤリポイントごとに個別生成してもよく、ヒヤリ時の動画が見られることと個別にヒヤリポイントの動画を確認できることを満たせばよい",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "地図には自車位置・開始/終了マーカー・ヒヤリ地点・走行軌跡が描画される",
      "statement": "運転診断画面の地図には自車位置マーカー、開始マーカー、終了マーカー、ヒヤリ地点マーカー、走行軌跡が描画される",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "地図をドラッグすると自車位置追従が解除される",
      "statement": "利用者が地図をドラッグすると自車位置への自動追従が解除され、追従ボタン操作で再度追従が有効になる",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "センサー異常時は診断が自動終了する",
      "statement": "センサーデータが null になった場合、診断は自動的に終了処理へ移行する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "運転診断画面は縦横自由である",
      "statement": "運転診断画面は画面向きをロックせず縦横いずれでも表示でき、回転時にレイアウトを切り替える。診断中はスリープを抑止する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "ヒヤリ地点詳細への遷移パスは動画パスを @ エスケープして渡す",
      "statement": "ヒヤリ地点詳細への遷移では動画パス中の '/' を '@' に置換した文字列を /bad-spot/:path のパラメータとして渡す",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "スコア表示のレーダーチャート置き換え範囲が未確定",
      "statement": "従来の☆／順位表示を6項目5段階のレーダーチャートに置き換える要求があるが、採点データ形式が先方検討中のため本画面の表示仕様は確定していない",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "ヒヤリ検出音の音源・音量・端末サイレント時の扱いが未確定。承認済みルールは『音を鳴らす』のみで具体を規定していない。UI/UX判断（およびアセット追加で Infra 判断）が必要で、決まらないと走行中に通知が聞こえない／過大音量になるリスクが残る。",
    "ヒヤリが短時間に連続した場合の検出音の再発音抑制（デバウンス）が未確定。連続ヒヤリ時の動画は1本継続が許容されているが、音を毎回鳴らすかは規定がない。UI判断が必要で、決まらないと走行中に音が連続して運転妨害となる恐れがある。",
    "従来の☆スコア表示を削除した場合のアドバイス画面（ui.comment.page）への導線が未確定。現行はスコア欄タップが唯一の導線で、先方資料は『レーダーチャートを押すと 5-1 に遷移』とも記載している。UI判断＋先方確認が必要で、決まらないと UC07（アドバイス表示）が到達不能になる。",
    "レーダーチャート6項目（筋力・柔軟性・空間把握・危険予測・視力・視野）・1〜5段階のスコアを本画面（走行直後）で表示するのか、アドバイス画面／開始前画面のみで表示するのかが未確定。UI判断＋先方確認が必要で、決まらないと走行中／走行直後のスコア表示要素を確定できない。",
    "6項目5段階の採点データ形式が先方検討中（試作中に提示）。現行の scoreA/scoreB/scoreC（0-100 の3値）と項目数・尺度が一致せず、Middleware/DB の判断が必要。決まらないとレーダーチャートの描画仕様を確定できない。",
    "ヒヤリ前後15秒の個別録画に変更した場合、本画面の保存単位・ファイル命名・ui.badspot.page への遷移パラメータ（現行は通し動画パスの @ エスケープ）が未確定。UI+Middleware+Infra判断が必要で、決まらないと UC08 の遷移契約が壊れる。",
    "ヒヤリ前後の録画秒数（既定15秒）を設定で可変にするかが未確定。先方から問われている。UI（設定画面）+Middleware判断が必要。",
    "smartphoneOnly 実行時に全指標が100（未算出）となる状態を利用者に『未算出』と明示する表示（注記・グレーアウト等）を設けるべきか未確定。現行実装は満点と区別なく表示する。UX判断＋Middleware（算出可否の通知手段）が必要で、決まらないと利用者がスコアを満点と誤解する。",
    "score3/score4 のラベルが空である指標欄を画面に表示し続けるか、非表示にするかが未確定。現行は空ラベルのまま描画する。UI判断が必要で、決まらないと利用者に意味不明な空欄が見える。",
    "走行序盤に初期値100が混入して高めのスコアが表示される挙動を UI 側で抑制（一定件数までは表示保留等）すべきかが未確定。スコアロジックは打ち合わせ後まで凍結されているため、UI側での回避可否の判断が必要。",
    "終了ダイアログの具体的な構成（表示項目、ボタン種別、閉じる操作の挙動、アドバイス表示以外の導線有無）が未確定。UI設計判断が必要で、決まらないと UC06/UC08 の受入条件を確定できない。",
    "insertScore が await されないため、終了ダイアログから即座にアドバイス表示へ遷移した場合に保存未完了となる可能性があるかが未確定。DB/Middleware の保存完了保証の確認が必要。",
    "書き出しルートへのアクセス権限がない、または書き出しに失敗した場合のユーザー提示（エラーUX）が対象外とされており未確定。Infra/UX判断が必要で、決まらないとログ・動画が無音で欠落する。",
    "smartphoneOnly モードであることを診断画面上で利用者に示す表示（モード表示バッジ等）が存在するか未確定。UI設計判断が必要。",
    "2026年度改修で追加される『タブ切り替え』が本画面を含むタブ構成になるのか（8-1 サービス案表示や 1-2 前回結果表示との関係）が未確定。UI（ナビゲーション）判断が必要で、決まらないと本画面への到達経路を確定できない。"
  ],
  "rationale_notes": [
    "本改訂では approved fact のうち本ノードに影響するもの（ヒヤリ検出音、CAN版の指標設定範囲、ヒヤリ非減点、初期値100混入、ロジック差し替え未実装、連続ヒヤリの録画方式、書き出しルート、センサログ期間）を実装実態として本文に反映した。",
    "2026年度改修要求はいずれも未確定要素を含むため、本文の現行仕様記述は変更せず『未確定論点』表に集約する方針とした。現行挙動を誤って上書きしないためである。",
    "縦横変更要求について、本画面は既に unlock で縦横自由であるため要求と衝突しない。衝突するのは縦固定を掛けている履歴・アドバイス等の他画面であり、本ノードの責務外であることを明記した。",
    "スコアロジック（CAN版／_simple／未算出時100／scoreA三重代入）は打ち合わせ後まで変更しない凍結状態にあるため、UI 側は受け取った値をそのまま描画する責務に留める。",
    "書き出しルートは #79 で externalDataDirectory 案が検討されたが撤回され Documents 配下に戻された経緯があるため、撤回済みである旨を明記して再逆行を防ぐ。",
    "UI は表示責務のみを持ち、スコア算出・指標発火の可否判断は Middleware（score-logic / sensor.service）側に置く。ヒヤリ判定自体も Middleware 側の責務で、UI は判定結果を受けてマーカー描画と発音を行う。",
    "センサログを診断中のみに限定するのはストレージ消費と個人情報の観点による既存方針であり、UI からは診断開始/終了操作がその境界を決める。",
    "insertScore をファイア＆フォーゲットにしているのは終了ダイアログ表示のレスポンスを優先する既存実装の意図と解される（未確認）。",
    "動画パスの '@' エスケープはルーティングパラメータ中のスラッシュ衝突回避を目的とした既存実装上の措置。個別録画化するとこの契約の見直しが必要になる。",
    "開発期限（2026年11月末完了／12月実験開始）はスケジュール制約として認識しており、未確定論点の解消順序に影響する。"
  ]
}
```