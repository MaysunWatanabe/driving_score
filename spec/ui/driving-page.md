<!-- 作成: 2026-09-18 18:00:31 JST | 更新: 2026-09-18 18:35:02 JST -->

# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面。センサーサービスから 10ms 周期でセンサー統合値を受け、ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行し、診断結果を画面に表示する。Google Map 上に自車位置/開始・終了マーカー/ヒヤリ地点/走行軌跡を描画し、MediaRecorder で 60 秒チャンクの video/webm を書き出しルート配下の走行ディレクトリへ追記保存する。

走行を終了すると結果が SQLite（`scoreDbService.insertScore`）に保存され、終了ダイアログから「アドバイス表示」（[[ui.comment.page]]）へ、地図上のヒヤリマーカーからヒヤリ地点詳細（[[ui.badspot.page]]）へ導線が開く。

走行中にヒヤリポイントが検出された時点で、本画面は**音を鳴らして利用者に通知する**（2026 年度改修要求に基づく承認済みルール）。

> **2026 年度改修に関する注記**
> 本ノードは 2026 年度改修（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 ／ メイサンソフト『要求仕様確認』2026-09-17）の影響を受ける。改修要求は 5 本（①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE 通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善）で、本画面は主に ③ ⑤ の影響を受ける。
> **スコア表示の方針（☆表示の廃止とレーダーチャートへの置換）は承認済みの設計決定である。** 一方、採点データ形式・アドバイス画面への導線・ヒヤリ個別録画の再生方式などは未確定であり、「未確定論点（2026 年度改修）」節に集約する。
> 本文中、`## 現行実装のスコア表示（移行前）` 以下は**移行前の実装実態**を記述したものであり、改修完了後は `## スコア表示（改修後の確定方針）` に置き換わる。
> 開発は **2026 年 11 月末完了**を目標とし、**2026 年 12 月から高齢者を招いた実験**が開始される（スケジュール制約）。

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
scoreAllText, score{i}Text: string  // 星または順位 (101-score)  ※移行前の表示用
scoreShowStarArea1 / area2: boolean                              // ※移行前の表示用
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

## 画面状態と表示要素
本画面は 1 ルート（`/driving`）上で 3 つの状態を持ち、状態に応じて表示・操作可否が変わる。

| 状態 | 画面番号 | 主な表示 | 有効な操作 |
|---|---|---|---|
| `init` (0) | 4-1 走行前 | 地図（自車位置）、スコア表示領域 | 診断開始、履歴 |
| `running` (1) | 4-2 走行中 | 地図（自車位置・開始マーカー・軌跡・ヒヤリマーカー）、スコア表示領域 | 診断終了、追従復帰 |
| `finish` (2) | 4-3 走行終了 | 地図（開始/終了マーカー・軌跡・ヒヤリマーカー、`fitBounds`）、スコア表示領域 | アドバイス表示、ヒヤリマーカータップ、履歴 |

- 「アドバイス表示」への遷移は `status === finish` のときのみ受け付ける。
- ヒヤリマーカーのタップは `status === finish` のときのみ受け付ける。
- スコア値は画面上で直接入力・編集できない（表示専用）。

## スコア表示（改修後の確定方針）
承認済みの設計決定として、走行前（4-1）/ 走行中（4-2）/ 走行終了（4-3）の各状態で、
**従来の☆5 段階によるスコア表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合スコア）を削除し、
6 項目のレーダーチャートと評価コメントを表示する。**

- 項目は **筋力・柔軟性・空間把握・危険予測・視力・視野** の 6 項目。
- 各項目の尺度は **1〜5 の 5 段階**（5 に近いほど良好、3 が年齢の平均）。
- 各項目に「**n 点（5 点満点）**」と **2 行程度の評価コメント**を併記する。
- チャートは「**今回**」と「**過去の平均**」の **2 系列**を図示する。
- 各項目に添えるアイコンは**いらすとや**の素材を使用する。
- 過去の記録が存在しない場合の「過去の平均」系列の扱いは、[[ui.previousResult.page]]（1-2 前回結果表示）の
  「記録が無ければ線を描画しない」ルールと整合させる想定（本画面での適用可否は未確定）。

> 採点データ形式（スコア値および評価メッセージの受け取り方）は先方検討中であり未確定。
> 現行の `scoreA / scoreB / scoreC`（0〜100 の 3 値）と項目数も尺度も一致しないため、
> Middleware / DB 側の供給契約が確定するまで本画面の描画実装は着手できない。
> また、スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は
> 打ち合わせ後まで**変更しない**凍結状態にあり、本画面はその出力をそのまま表示する責務に留まる。

## 現行実装のスコア表示（移行前）
改修完了までの現行挙動として、総合＋4 指標を星または順位（`101-score`）で表示する。

- `scoreLogic` の走行内平均を `Math.round` し、`scoreShowStarArea1/2` に応じて `getRank(=101 - Math.round(score); 100 上限)` で順位表記に切替。
- `label1..4` は `scoreLogicJson.settings.label` から取得して指標名として描画する。

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
- 走行中（`status === running`）にヒヤリポイントを検出した時点で音を鳴らし、運転者に知らせる。
- 発音契機はヒヤリ判定が成立したタイミング（`score.hiyari === true`、`pushBadPoint()` の起点）と一致する。
- 音の種類・音量・端末のサイレント/メディア音量との関係、連続ヒヤリ時の再発音抑制（デバウンス）は未確定（「未確定論点」参照）。

## 地図表示
- 描画要素: 自車位置マーカー、開始マーカー、終了マーカー、ヒヤリ地点マーカー、走行軌跡。
- 利用者が地図をドラッグすると自車位置追従が解除される（`autoScrollLock=true`）。追従ボタン（`onPointer()`）で復帰する。
- **自車マーカーの向き（優先度 want / 承認済み）**: 地図上の自車マーカーの矢印を**進行方向に合わせて回転**させる。現行は上向き固定であり、改修対象である。
  - `driving.page.ts` は `mapService.drawCarMarker(lastLatLng, heading)` として heading を渡しているが、
    表示上は上向き固定のままであるため、回転の適用は [[middleware.map.service]] 側のマーカー描画で対応する必要がある（責務の所在は要確認）。

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
- `scoreLogic` の走行内平均を Math.round し、`scoreShowStarArea1/2` に応じて `getRank(=101 - Math.round(score); 100 上限)` で順位表記に切替（移行前の表示方式）。
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
- 動画は 1 走行 = `data.YYYYMMDD-HHMMSS/movie.webm` の 1 ファイル追記（60 秒毎のチャンク append）。改修後はヒヤリ前後 15 秒の個別録画へ移行する可能性がある。
- 連続ヒヤリ（30 秒以内）の録画は 1 本継続でも個別生成でもよいが、「ヒヤリ時の動画が見られる」「個別にヒヤリポイントの動画を確認できる」の 2 条件を満たすこと。
- センサログは診断中のみ保存する。
- ヒヤリポイント検出時に音を鳴らす。
- ヒヤリマーカーのタップは診断終了後のみ有効。タップで動画パス（`@` エスケープ）付き `/bad-spot/:path` に遷移。
- 「アドバイス表示」は診断終了後（`status === finish`）のみ有効。
- ヒヤリ判定はスコア値を減点しない（マーカー・メッセージ・音のみ）。
- スコア表示は☆／順位表示を廃し、6 項目・5 段階のレーダーチャートと評価コメント（今回／過去の平均の 2 系列）に置き換える。
- 自車マーカーの矢印は進行方向に向ける（優先度 want）。
- スコア値は画面上で直接入力・編集できない。
- センサーデータ異常（null）時は診断を自動終了する。

## 未確定論点（2026 年度改修）
本画面に関係する未確定事項。確定するまで現行実装の挙動を維持する。

| 論点 | 内容 | 判断主体 |
|---|---|---|
| 採点データ形式 | レーダーチャート 6 項目・5 段階のスコアおよび評価コメントの受け取り方が先方検討中（試作中に提示）。現行 `scoreA/scoreB/scoreC`（0-100・3 列）と項目数・尺度が不一致。 | 先方 + Middleware + DB |
| レーダーチャート表示の担当画面 | 6 項目チャートを本画面（4-1/4-2/4-3）で表示するのか、アドバイス画面・診断開始前画面のみに置くのか。走行中のリアルタイム更新可否も未定。 | UI + 先方 |
| アドバイス画面への導線 | ☆スコア表示削除後、[[ui.comment.page]] への導線が失われる。先方資料は「レーダーチャートを押すと 5-1 に遷移」とも記載しており、置き換え方の確定が必要。 | UI + 先方 |
| 過去平均の集計期間 | 「過去の平均」系列の集計範囲が未定。現行の `capability_score_target_days`（既定 30 日）を流用するかが不明。 | 先方 + DB |
| ヒヤリ録画の個別化 | 前後 15 秒の個別録画に変更した場合の保存単位・ファイル命名・[[ui.badspot.page]] 側の再生方式（現行は通し動画の `currentTime` 追尾）が未定。前後秒数の可変化も未確定。 | UI + Middleware + Infra |
| ヒヤリ検出音の詳細 | 音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未定。 | UI |
| 未算出スコアの提示 | `smartphoneOnly` で全指標 100（未算出）となる状態を「未算出」と明示するか。現行は満点と区別なく表示する。 | UI + Middleware |
| 空ラベル指標欄 | `label3/label4` が空の指標欄を表示し続けるか非表示にするか。現行は空欄のまま描画。 | UI |
| 自車マーカー回転の実装責務 | heading は渡っているが上向き固定で描画されている。回転適用を map.service 側で行うかの確認が必要。 | UI + Middleware |
| タブ切り替えの構成 | 追加される「タブ切り替え」に本画面が含まれるか、到達経路がどう変わるかが未定。 | UI + 先方 |
| CAN データ保存 | CAN データを確認用に保存できるかが先方の宿題。 | 先方 + Infra |
| BLE 安定化 | 受信の不安定さに対し「パラレル処理化」が先方より示唆されているが**仮説**であり確定した対策ではない。実機で確認しながら調整する領域。テスト用ナビ端末の提供時期も未定。 | Middleware |
| スコアロジック凍結 | スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は打ち合わせ後まで**変更しない**。本画面はその出力をそのまま表示する。 | Middleware |
| 画面縦横 | 「縦横変更できるようにしてください」要求は縦固定を掛けている履歴・アドバイス等の他画面が対象。本画面は既に `unlock` で要求を満たす。 | UI（他ノード） |

## 関連ノード
- 依存: [[middleware.sensor.service]] / [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.score.logicCan]] / [[middleware.sensor.demoData]] / [[db.score.repository]] / [[infra.file.storage]] / [[infra.assets.scoreLogicJson]] / [[infra.cordova.sensors]]
- 遷移先: [[ui.badspot.page]] / [[ui.comment.page]] / [[ui.history.page]]
- 2026 年度改修で関連: [[ui.previousResult.page]]（1-2 前回結果表示。レーダーチャート仕様・過去平均の定義を共有）
- 8-1「サービス案表示」（`ui.servicePlan.page`）のノード新設は**取り下げ済み**であり、本改修の対象外（後続検証）とする。

```json
{
  "required_changes": [
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "☆スコア表示の廃止と6項目5段階レーダーチャート＋評価コメント（今回／過去平均の2系列）への置換を承認済み方針として本文に昇格"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "レーダーチャートの表示仕様（筋力・柔軟性・空間把握・危険予測・視力・視野／1-5段階／3が年齢平均／n点(5点満点)＋2行コメント／いらすとやアイコン）を明記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "現行の星・順位表示を『移行前の実装実態』節に切り分けて維持"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "自車マーカーを進行方向に回転させる要求（優先度 want）を地図表示節と業務ルールに追記し、現行が上向き固定である旨を明記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "画面状態と表示要素の対応表（4-1/4-2/4-3 と有効操作）を追加"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "地図表示（描画要素・ドラッグによる追従解除）を独立節として整理"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "2026年度改修要求の出所（日産『一次仕様』2026-08-04／メイサンソフト『要求仕様確認』2026-09-17）と5本の要求、および11月末完了・12月実験開始のスケジュール制約を注記に追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "未確定論点表を更新（採点データ形式・表示担当画面・過去平均集計期間・未算出提示・空ラベル欄・自車マーカー回転責務・タブ構成を追加、レーダーチャート化自体は確定済みとして除外）"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "関連ノードから ui.service.page（8-1 サービス案表示）参照を削除し取り下げ済み・本改修対象外と明記、ui.previousResult.page を追加"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目・1-5段階のスコアと評価コメントを供給する算出責務が未定義で、現行 scoreA/scoreB/scoreC（0-100・3値）と項目数も尺度も一致しない"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "自車マーカーを進行方向へ回転させる要求は map.service のマーカー描画側で heading を適用する必要があり、現行は heading が渡っても上向き固定である"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "ヒヤリ前後15秒の個別録画に変更する場合、録画トリガ・区間切り出し・連続ヒヤリの結合判定をどのレイヤが持つか score-logic / sensor.service 側で規定が必要"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が scoreA/scoreB/scoreC の3列REAL（0-100）であり6項目5段階と不一致のため拡張または新設の判断が必要、かつ『過去の平均』系列のための集計期間定義が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "☆スコア表示削除により ui.comment.page への唯一の導線が失われるため、遷移元の再定義を ui.comment.page 側と整合させる必要がある"},
    {"domain": "UI-agent", "severity": "must", "reason": "レーダーチャート仕様と過去平均の定義は ui.previousResult.page（1-2）と共通化すべきで、記録なし時の未描画ルールも整合が必要"},
    {"domain": "UI-agent", "severity": "should", "reason": "ヒヤリ動画が前後15秒の個別動画になると ui.badspot.page の currentTime 追尾方式・前後ボタン挙動が成立しなくなる"},
    {"domain": "Infra-agent", "severity": "should", "reason": "ヒヤリ検出音の音源アセット追加、いらすとやアイコン素材の配置、および個別録画化に伴う保存レイアウト変更が書き出しルート仕様に影響する"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "BLE安定化のパラレル処理化は仮説段階であり、現時点では sensor.service 仕様を確定変更してはならない旨の注記が必要"}
  ],
  "requirements_context": "運転診断画面（/driving、画面4-1 走行前 / 4-2 走行中 / 4-3 走行終了）は UC06（運転診断の実行）と UC08（ヒヤリ地点確認導線）を担う。『診断開始』操作でセンサーサービス（sensorService.start / startScoreLogic）、スコアロジックランナー（scoreLogic.start、既定 settings.scoreLogicInterval=300ms）、録画（MediaRecorder、60秒チャンク）を同時起動する。走行中は 10ms 周期のセンサー統合値を scoreLogic.pushSensorData に流し、Google Map に自車位置・開始/終了マーカー・ヒヤリ地点・走行軌跡を描画する。地図ドラッグで自車位置追従が解除され、追従ボタンで復帰する。走行終了（onStop）で scoreLogic/sensor/録画を停止し drawEndMarker と fitBounds を実行、scoreDbService.insertScore で結果を SQLite に保存（await しないファイア＆フォーゲット）、loginService.scoreId に startTimestamp を設定し終了ダイアログを表示する。終了ダイアログからは『アドバイス表示』で ui.comment.page へ遷移でき、地図上のヒヤリマーカータップ（status===finish のみ有効）で videoRecordedPath を '/'→'@' 置換した /bad-spot/:path へ遷移する。センサーデータが null になった場合は診断を自動終了する。スコア値は画面上で直接編集できない。\n\n【スコア表示の改修（承認済み方針）】走行前(4-1)/走行中(4-2)/走行終了(4-3)の各状態で、従来の☆5段階スコア表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合スコア）を削除し、6項目のレーダーチャートと評価コメントを表示する。項目は筋力・柔軟性・空間把握・危険予測・視力・視野の6項目、尺度は1〜5の5段階（5に近いほど良好、3が年齢の平均）。各項目に『n点（5点満点）』と2行程度の評価コメントを併記し、チャートは『今回』と『過去の平均』の2系列を図示する。各項目のアイコンはいらすとやの素材を使用する。過去の記録が存在しない場合の扱いは ui.previousResult.page の『記録が無ければ線を描画しない』ルールと整合させる想定（本画面での適用可否は未確定）。ただし採点データ形式（スコア値・評価メッセージの受け取り方）は先方検討中で未確定であり、現行の scoreA/scoreB/scoreC（0-100の3値）と項目数・尺度が一致しない。スコアロジックは打ち合わせ後まで凍結状態にあり、UI は受け取った値をそのまま描画する責務に留まる。\n\n【自車マーカー】地図上の自車マーカーの矢印を進行方向に合わせて回転させる（優先度 want、承認済み）。現行は上向き固定。driving.page.ts は mapService.drawCarMarker(lastLatLng, heading) として heading を渡しているが表示上は反映されていないため、回転適用は map.service 側の対応が必要（責務の所在は要確認）。\n\n【ヒヤリ通知】走行中にヒヤリポイントを検出した時点で音を鳴らし運転者に知らせる（承認済み業務ルール）。発音契機は score.hiyari===true（pushBadPoint の起点）と一致する。音源・音量・サイレント時の扱い・連続ヒヤリ時のデバウンスは未確定。\n\n【ファイル書き出し】ログ・センサログ・webm の書き出しルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ であり、#79 の externalDataDirectory 案は撤回済み。センサログ保存は診断中のみ。動画は現行 1走行 = data.YYYYMMDD-HHMMSS/movie.webm への初回 writeFile＋以降 append。saveScoreLogic は recording/logStorage/sensorLogStorage のいずれか有効時に logService.setLogDir('data.<日時>') を呼び、logStorage||sensorLogStorage 時に scoreLogicJson.txt / scoreLogic.txt をスナップショット保存する。onStop 後は logService.resetLogDir() で debug-log に戻す。CAN データを確認用に保存できるかは先方の宿題として未確定。\n\n【録画の改修】ヒヤリ発生時の録画を前後15秒の個別動画に変更する要求がある。30秒以内の連続ヒヤリは1本継続でも個別生成でもよく、『ヒヤリ時の動画が見られる』『個別にヒヤリポイントの動画を確認できる』の2条件を満たせば実装しやすい方式を選んでよい（承認済み）。前後秒数の可変化は未確定。個別化した場合 ui.badspot.page の currentTime 追尾方式・遷移パラメータ契約の見直しが必要。\n\n【移行前スコア表示の実装実態】(1) センサーモードによるスコアロジック差し替えは未実装で、opening.page.ts は常に assets/data/scoreLogicFunction.txt を取得し scoreLogicFunction_simple.txt はどこからも参照されない。(2) smartphoneOnly では BLE スキャンをスキップするため CAN アダプタ接続待ちの UI 表示は発生せず、lastCanData ゼロ埋めにより CAN 版全指標が発火せず scoreList が空となり総合・4指標すべてが 100（未算出）として表示される。(3) CAN 版ロジックが実際に設定するのは score1/score2/overAll/scoreA/scoreB のみで score3/score4/scoreC は未設定であり、settings.label の label3/label4/labelC が空であることと対応する。本画面は空ラベル欄をそのまま描画する。(4) ヒヤリ判定は result.hiyari=true とメッセージ設定のみを行いスコア値を減点しない。(5) 開始直後に Score(null)（各指標100）が1件平均に混入するため走行序盤の表示は (評価窓合計+100)/(窓数+1) となり実測より高めに出る。これらは実装実態として記録するのみで、是正の是非は本仕様で規定しない。\n\n【画面挙動】本画面は screenOrientation.unlock により縦横自由で、回転時に CSS クラス名を差し替える。診断中は Insomnia でスリープ抑止。2026年度の『縦横変更できるようにしてください』要求は縦固定を掛けている他画面（履歴・アドバイス等）が対象で、本画面は既に要求を満たす。\n\n【2026年度改修の全体文脈】要求は日産自動車『運転機能チェックアプリの一次仕様』2026-08-04（業務委託相談 2026-07-17 分を合本、全14枚）およびメイサンソフト『要求仕様確認』2026-09-17（全8枚）に基づく5本（①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善）。本画面は主に③⑤の影響を受ける。8-1『サービス案表示』（ui.servicePlan.page）のノード新設は取り下げ済みで本改修の対象外（後続検証）。BLE 受信の不安定さに対する『パラレル処理化』は先方の想定にとどまる仮説であり確定した対策ではない。テスト用ナビ端末の提供時期も未定。開発は2026年11月末完了、12月から高齢者実験開始のスケジュール制約下にある。",
  "fact_candidates": [
    {
      "type": "display_rule",
      "title": "運転診断画面の☆スコア表示を廃しレーダーチャートに置き換える",
      "statement": "走行前(4-1)/走行中(4-2)/走行終了(4-3)の各状態で従来の☆5段階スコア表示を削除し、6項目のレーダーチャートと評価コメントを表示する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "レーダーチャートは今回と過去の平均の2系列を描画する",
      "statement": "運転診断画面のレーダーチャートには『今回』と『過去の平均』の2系列を描画する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "レーダーチャートは6項目・1〜5の5段階である",
      "statement": "レーダーチャートの項目は筋力・柔軟性・空間把握・危険予測・視力・視野の6項目で、尺度は1〜5の5段階（5に近いほど良好、3が年齢の平均）である",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "各項目に点数表記と評価コメントを併記する",
      "statement": "レーダーチャートの各項目には『n 点（5 点満点）』の表記と2行程度の評価コメントを併記し、項目アイコンにはいらすとやの素材を使用する",
      "status": "approved"
    },
    {
      "type": "display_rule",
      "title": "自車マーカーの矢印を進行方向に向ける",
      "statement": "地図上の自車マーカーの矢印を進行方向に合わせて回転させる（現行は上向き固定、優先度 want）",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "ヒヤリポイント検出時に音を鳴らす",
      "statement": "走行中にヒヤリポイントを検出した時点で音を鳴らして運転者に知らせる",
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
      "title": "score3/score4 の指標ラベルは空文字で描画される（移行前）",
      "statement": "CAN 版ロジックが score3/score4/scoreC を設定しないため settings.label の label3/label4/labelC は空であり、移行前の画面は空ラベルの指標欄をそのまま描画する",
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
      "statement": "運転診断画面の status は 0(init)/1(running)/2(finish) の3値をとり、画面4-1/4-2/4-3 に対応して表示と操作可否が決まる",
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
      "title": "1走行の動画は単一ファイルへの追記で保存される（移行前）",
      "statement": "移行前の実装では録画は 1 走行あたり data.YYYYMMDD-HHMMSS/movie.webm の1ファイルに対し、初回書き込みと2回目以降の追記で保存される",
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
      "title": "レーダーチャートを走行中にリアルタイム更新するかが未確定",
      "statement": "6項目レーダーチャートを走行中（4-2）にリアルタイム更新するのか、走行終了後（4-3）のみ描画するのかが未確定",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "6項目5段階の採点データ形式（スコア値および評価コメントの受け取り方）が先方検討中で未確定。現行の scoreA/scoreB/scoreC（0-100の3値）と項目数・尺度が一致せず、Middleware/DB の供給契約判断が必要。決まらないとレーダーチャートの描画実装に着手できない。",
    "レーダーチャートを走行前(4-1)・走行中(4-2)・走行終了(4-3)のどの状態で表示するか、および走行中にリアルタイム更新するかが未確定。UI＋先方判断が必要で、決まらないと画面4-1/4-2 の表示要素を確定できない。",
    "☆スコア表示を削除した場合のアドバイス画面（ui.comment.page）への導線が未確定。現行はスコア欄タップが唯一の導線で、先方資料は『レーダーチャートを押すと 5-1 に遷移』とも記載している。UI判断＋先方確認が必要で、決まらないと UC07（アドバイス表示）が到達不能になる。",
    "レーダーチャートの『過去の平均』系列の集計期間が未確定。現行は capability_score_target_days（既定30日）で能力指標を平均しているが、これを流用するか別定義を置くかが不明。DB＋先方判断が必要。",
    "過去の記録が存在しない場合の『過去の平均』系列の扱い（ui.previousResult.page と同じく線を描画しない、等）を本画面に適用するかが未確定。UI判断が必要。",
    "自車マーカーの進行方向回転を driving.page 側（heading の渡し方）と map.service 側（マーカー描画）のどちらで対応するかが未確定。現行は heading が渡っているにもかかわらず上向き固定で描画されており、原因箇所の特定が必要。Middleware判断が必要。",
    "ヒヤリ検出音の音源・音量・端末サイレント時の扱いが未確定。承認済みルールは『音を鳴らす』のみで具体を規定していない。UI/UX判断（およびアセット追加で Infra 判断）が必要で、決まらないと走行中に通知が聞こえない／過大音量になるリスクが残る。",
    "ヒヤリが短時間に連続した場合の検出音の再発音抑制（デバウンス）が未確定。連続ヒヤリ時の動画は1本継続が許容されているが、音を毎回鳴らすかは規定がない。UI判断が必要で、決まらないと走行中に音が連続して運転妨害となる恐れがある。",
    "ヒヤリ前後15秒の個別録画に変更した場合、本画面の保存単位・ファイル命名・ui.badspot.page への遷移パラメータ（現行は通し動画パスの @ エスケープ）が未確定。UI+Middleware+Infra判断が必要で、決まらないと UC08 の遷移契約が壊れる。",
    "ヒヤリ前後の録画秒数（既定15秒）を設定で可変にするかが未確定。先方から問われている。UI（設定画面）+Middleware判断が必要。",
    "smartphoneOnly 実行時に全指標が100（未算出）となる状態を利用者に『未算出』と明示する表示（注記・グレーアウト等）を設けるべきか未確定。現行実装は満点と区別なく表示する。UX判断＋Middleware（算出可否の通知手段）が必要で、決まらないと利用者がスコアを満点と誤解する。",
    "移行前表示において label3/label4 が空である指標欄を表示し続けるか非表示にするかが未確定。現行は空ラベルのまま描画する。UI判断が必要。",
    "走行序盤に初期値100が混入して高めのスコアが表示される挙動を UI 側で抑制（一定件数までは表示保留等）すべきかが未確定。スコアロジックは打ち合わせ後まで凍結されているため、UI側での回避可否の判断が必要。",
    "終了ダイアログの具体的な構成（表示項目、ボタン種別、閉じる操作の挙動、アドバイス表示以外の導線有無）が未確定。UI設計判断が必要で、決まらないと UC06/UC08 の受入条件を確定できない。",
    "insertScore が await されないため、終了ダイアログから即座にアドバイス表示へ遷移した場合に保存未完了となる可能性があるかが未確定。DB/Middleware の保存完了保証の確認が必要。",
    "書き出しルートへのアクセス権限がない、または書き出しに失敗した場合のユーザー提示（エラーUX）が対象外とされており未確定。Infra/UX判断が必要で、決まらないとログ・動画が無音で欠落する。",
    "smartphoneOnly モードであることを診断画面上で利用者に示す表示（モード表示バッジ等）が存在するか未確定。UI設計判断が必要。",
    "2026年度改修で追加される『タブ切り替え』が本画面を含むタブ構成になるのか（1-2 前回結果表示との関係）が未確定。8-1 サービス案表示はノード新設が取り下げられ本改修対象外となったため、タブ構成の対象画面が再定義を要する。UI（ナビゲーション）判断が必要。",
    "CAN データを確認用に保存できるかが先方の宿題として未確定。保存する場合の書き出し先・形式が本画面の保存責務に追加される可能性がある。"
  ],
  "rationale_notes": [
    "本改訂では approved fact のうち『☆スコア表示の廃止とレーダーチャート化』『レーダーチャート表示仕様（6項目5段階・2系列・n点表記・いらすとや）』『自車マーカーの進行方向回転（want）』を未確定論点から本文へ昇格させた。設計決定として承認済みであるため、未確定なのは実装に必要なデータ形式と導線であり、方針自体は確定扱いとする。",
    "現行の☆／順位表示は改修完了までの挙動として『現行実装のスコア表示（移行前）』節に切り分けた。approved の設計決定と現行実装実態が並存するため、どちらが移行前後かを明示して読み手の混乱を避ける意図。",
    "自車マーカーについて、driving.page.ts は drawCarMarker(lastLatLng, heading) として heading を渡しているのに fact では『現行は上向き固定』とされている。fact を真とし、回転が適用されていない箇所は map.service 側である可能性が高いと記述したうえで、責務の所在は open_question に残した。",
    "8-1 サービス案表示（ui.servicePlan.page）はノード新設が取り下げられたため、関連ノード欄から ui.service.page 参照を削除し『本改修の対象外（後続検証）』と明記した。取り下げの事実を残さないと後続で再度参照が復活する恐れがある。",
    "レーダーチャートの表示仕様と『過去の平均』の定義は ui.previousResult.page（1-2）と共通であるため、関連ノードとして明示し重複定義を避ける方針とした。",
    "2026年度改修要求はいずれも実装確定に必要な情報（採点データ形式・導線・録画方式）を欠くため、方針が approved であっても未確定論点表を維持し、確定するまで現行実装の挙動を維持する旨を明記した。",
    "縦横変更要求について、本画面は既に unlock で縦横自由であるため要求と衝突しない。衝突するのは縦固定を掛けている履歴・アドバイス等の他画面であり、本ノードの責務外であることを明記した。",
    "スコアロジック（CAN版／_simple／未算出時100／scoreA三重代入）は打ち合わせ後まで変更しない凍結状態にあるため、UI 側は受け取った値をそのまま描画する責務に留める。レーダーチャート化が承認されても凍結は解除されていない。",
    "書き出しルートは #79 で externalDataDirectory 案が検討されたが撤回され Documents 配下に戻された経緯があるため、撤回済みである旨を明記して再逆行を防ぐ。",
    "UI は表示責務のみを持ち、スコア算出・指標発火の可否判断は Middleware（score-logic / sensor.service）側に置く。ヒヤリ判定自体も Middleware 側の責務で、UI は判定結果を受けてマーカー描画と発音を行う。",
    "センサログを診断中のみに限定するのはストレージ消費と個人情報の観点による既存方針であり、UI からは診断開始/終了操作がその境界を決める。",
    "動画パスの '@' エスケープはルーティングパラメータ中のスラッシュ衝突回避を目的とした既存実装上の措置。個別録画化するとこの契約の見直しが必要になる。",
    "画面状態と表示要素の対応表を新設したのは、4-1/4-2/4-3 の画面番号と status 値の対応が本文中に散在していたため。UI仕様として状態別の有効操作を一覧化しておく必要がある。",
    "開発期限（2026年11月末完了／12月高齢者実験開始）はスケジュール制約として認識しており、未確定論点の解消順序に影響する。採点データ形式の確定が最もクリティカルパスに乗る。"
  ]
}
```