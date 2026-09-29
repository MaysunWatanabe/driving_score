<!-- 作成: 2026-09-25 11:05:26 JST | 更新: 2026-09-29 15:22:15 JST -->

# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面である。センサーサービスから 10ms 周期でセンサー統合値を受け取る。ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行し、診断結果を画面に表示する。Google Map 上には、自車位置、開始・終了マーカー、ヒヤリ地点、走行軌跡を描画する。

録画は MediaRecorder で行う。

- **移行前（現行実装）**: 60 秒チャンクの video/webm を、走行ディレクトリの `movie.webm` に追記保存する（通し動画）。
- **改修後（承認済み）**: 1 秒タイムスライスで録画し、リングバッファに保持する。
  - ヒヤリを検出するたびに、前後 n 秒の区間を**ヒヤリごとに別の** `hiyari.NN.webm` として書き出す。
  - 通し動画は作らない（「動画」節参照）。

走行を終了すると、結果が SQLite（`scoreDbService.insertScore`）に保存される。終了後に開く導線は次のとおり。

- 終了ダイアログの「アドバイス表示」→ [[ui.comment.page]]
- 地図上のヒヤリマーカー → ヒヤリ地点詳細（[[ui.badspot.page]]）

走行中にヒヤリポイントが検出された時点で、本画面は**音を鳴らして利用者に通知する**（2026 年度改修要求に基づく承認済みルール）。

> **2026 年度改修に関する注記**
> - **改修要求の出所**: 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 と、メイサンソフト『要求仕様確認』2026-09-17 に基づく。
> - **改修要求（5 本）**: ①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE 通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善。本画面は主に ③ と ⑤ の影響を受ける。
> - **確定済みの方針**:
>   - スコア表示: ☆表示を廃止し、レーダーチャートへ置き換える。承認済みの設計決定である。
>   - ヒヤリ区間録画: 以下はいずれも承認済みの設計決定である。
>     - リングバッファ＋append-while-open
>     - 録画時計への一本化
>     - ヒヤリごとの個別ファイル化
>     - Cluster Timecode の t0 基準振り直し
>     - 書き込みキューによる直列化
> - **未確定の事項**: 採点データ形式、アドバイス画面への導線、ヒヤリ区間ファイルへの遷移契約などは未確定である。これらは「未確定論点（2026 年度改修）」節に集約する。
> - **移行前後の記述の区別**: `## 現行実装のスコア表示（移行前）` と `### 現行実装の録画（移行前）` は、**移行前の実装実態**を記述したものである。改修完了後は、それぞれ `## スコア表示（改修後の確定方針）` と `### 改修後の確定方針（ヒヤリ区間録画）` に置き換わる。
> - **スケジュール制約**: 開発は **2026 年 11 月末完了**を目標とする。**2026 年 12 月から高齢者を招いた実験**が開始される。

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
videoRecordedPath: string          // 動画ファイルの Blob URL（移行前：通し動画）
videoChunks: Blob[]                // 移行前: 60 秒毎の webm チャンク / 改修後: 1 秒タイムスライスのリングバッファ（chunk[0] 常時保持＋直近 n+5 秒、各チャンクに録画時計の受信時刻を付与）
mediaRecorder: MediaRecorder
scoreLogic: ScoreLogic
cssHeader / cssMap / cssScore / cssStart / cssPointer: string  // 縦横 CSS 名
hasAndroid: boolean

// 改修後（ヒヤリ区間録画）
videoStartTimestamp: number        // 録画時計の原点。tVideo = Date.now() - videoStartTimestamp
hiyariSegments: 区間状態の配列     // 開いている区間ごとに ファイル名 / from / end / t0 / 末尾 32B の繰り越し を保持（同時に複数オープン可）
hiyariWriteQueue: Promise<void>    // 区間ファイルへの書き込みを 1 本に直列化するキュー（診断開始時に Promise.resolve() へ初期化）
```

- `hiyariSegments` は区間ごとの配列である。承認済み決定により、単一の `hiyariFileName` を置き換える。
- 配列を実装上どう命名するかは実装裁量とする。

## 画面状態と表示要素
本画面は 1 ルート（`/driving`）上で 3 つの状態を持つ。状態に応じて、表示と操作可否が変わる。

| 状態 | 画面番号 | 主な表示 | 有効な操作 |
|---|---|---|---|
| `init` (0) | 4-1 走行前 | 地図（自車位置）、スコア表示領域 | 診断開始、履歴 |
| `running` (1) | 4-2 走行中 | 地図（自車位置・開始マーカー・軌跡・ヒヤリマーカー）、スコア表示領域 | 診断終了、追従復帰 |
| `finish` (2) | 4-3 走行終了 | 地図（開始/終了マーカー・軌跡・ヒヤリマーカー、`fitBounds`）、スコア表示領域 | アドバイス表示、ヒヤリマーカータップ、履歴 |

- 「アドバイス表示」への遷移は、`status === finish` のときのみ受け付ける。
- ヒヤリマーカーのタップは、`status === finish` のときのみ受け付ける。
- スコア値は画面上で直接入力・編集できない（表示専用）。
- ヒヤリ区間録画の書き出しは、画面上に表示要素を持たない。進捗表示や保存完了通知は、現行仕様に存在しない。書き込み失敗は debug/error ログにのみ残り、利用者には提示されない。

## スコア表示（改修後の確定方針）
承認済みの設計決定である。走行前（4-1）/ 走行中（4-2）/ 走行終了（4-3）の各状態で、次のとおり置き換える。

- **削除するもの**: 従来の☆5 段階によるスコア表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合スコア）。
- **表示するもの**: 6 項目のレーダーチャートと評価コメント。

レーダーチャートの仕様は次のとおり。

- 項目は **筋力・柔軟性・空間把握・危険予測・視力・視野** の 6 項目。
- 各項目の尺度は **1〜5 の 5 段階**（5 に近いほど良好、3 が年齢の平均）。
- 各項目に「**n 点（5 点満点）**」と **2 行程度の評価コメント**を併記する。
- チャートは「**今回**」と「**過去の平均**」の **2 系列**を図示する。
- 各項目に添えるアイコンは**いらすとや**の素材を使用する。
- 過去の記録が存在しない場合の「過去の平均」系列の扱いは、[[ui.previousResult.page]]（1-2 前回結果表示）の「記録が無ければ線を描画しない」ルールと整合させる想定である。本画面への適用可否は未確定である。

> **描画実装の着手条件**
> - 採点データ形式（スコア値および評価メッセージの受け取り方）は先方検討中であり、未確定である。
> - 現行の `scoreA / scoreB / scoreC`（0〜100 の 3 値）とは、項目数も尺度も一致しない。
> - そのため、Middleware / DB 側の供給契約が確定するまで、本画面の描画実装には着手できない。
> - スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は、打ち合わせ後まで**変更しない**凍結状態にある。本画面は、その出力をそのまま表示する責務に留まる。

## 現行実装のスコア表示（移行前）
改修完了までの現行挙動として、総合と 4 指標を星または順位（`101-score`）で表示する。

- `scoreLogic` の走行内平均を `Math.round` する。
- `scoreShowStarArea1/2` に応じて、`getRank(=101 - Math.round(score); 100 上限)` による順位表記に切り替える。
- `label1..4` は `scoreLogicJson.settings.label` から取得し、指標名として描画する。

### センサーモードによる差異（UI 表示上の注意点／実装実態）
- **CAN アダプタ接続待ちは発生しない**: `smartphoneOnly` モードでは BLE スキャンを行わない（[[middleware.sensor.service]] がスキップする）。したがって、診断開始時に CAN アダプタ接続待ちの表示・待機は発生しない。
- **全指標が「未算出」の 100 で表示される**: `smartphoneOnly` 実行時の挙動は、次の順に連鎖する。
  1. `sensor.service.ts` が `lastCanData` をゼロ埋めする（`shiftIndication=0` 等）。
  2. その結果、CAN 版スコアロジック（`scoreLogicFunction.txt`）の全指標が発火せず、`scoreList` が空になる。
  3. **総合および 4 指標がいずれも「未算出」として 100 で表示される**（星表示なら満点、順位表示なら 1 位相当）。

  これは現行実装の実態であり、本画面のスコア表示はこの値をそのまま描画する。是正の是非や切替実装の有無については、本仕様では規定しない。
- **スコアロジックの差し替えは未実装**: `opening.page.ts` は、常に `assets/data/scoreLogicFunction.txt` を取得する。`scoreLogicFunction_simple.txt` はどこからも参照されない。したがって本画面が表示するスコアは、モードに関わらず常に CAN 版ロジックの算出結果である。

### CAN 版ロジックが設定する指標の範囲（実装実態）
- **値が設定される指標**: CAN 版ロジックが実際に値を設定するのは `score1` / `score2` / `overAll` / `scoreA` / `scoreB` のみである。`score3` / `score4` / `scoreC` は未設定である。
  - このため `label3` / `label4` が空文字となる（[[infra.assets.scoreLogicJson]] の `settings.label` と対応）。本画面は、空ラベルの指標欄をそのまま描画する。
- **ヒヤリ判定はスコアを減点しない**: ヒヤリ判定が行うのは、`result.hiyari=true` とメッセージの設定のみである。
  - このため、本画面のスコア表示はヒヤリ発生によって変化しない。変化するのは、ヒヤリマーカー、メッセージ、検出音、ヒヤリ区間録画である。
- **序盤の表示が高めに出る**: `scoreLogic` の平均には、開始直後に積まれる初期値 `Score(null)`（各指標 100）が 1 件混入する。
  - このため、走行序盤の表示は実測値より高めに出る（`(評価窓合計 + 100) / (窓数 + 1)`）。
  - これも実装実態であり、本画面は受け取った平均値をそのまま表示する。

## 書き出しルート（保存先）
ログ・センサログ・動画（webm）の書き出しルートは、次のとおりとする。

`{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/`

- `debug-log/`: デバッグログの出力先（既定のログディレクトリ）。
- `data.YYYYMMDD-HHMMSS/`: 1 走行分の成果物（`scoreLogicJson.txt` / `scoreLogic.txt` / センサログ / 動画）。
  - 移行前の動画は `movie.webm`（通し動画）。
  - 改修後の動画は `hiyari.NN.webm`（ヒヤリ 1 件につき 1 ファイル）。
  - 改修後の格納先ディレクトリは、本資料で明記されていない。走行ディレクトリ配下を想定している（「未確定論点」参照）。

保存に関する規定は次のとおり。

- **撤回済みの案**: `#79` で検討された `{externalDataDirectory}/driving-score/...` 案は撤回済みである。本画面の保存先は、上記 `Documents` 配下とする。
- **採取手段**: ファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` を正とする。
- **センサログの保存期間**: 診断中（`status === running`）のみ保存する。診断開始前・終了後に、センサログは書き出されない。
- **パーミッション**: 追加パーミッションは要求しない。
- **対象外**: 書き出し失敗時のユーザー提示と保持期間管理は、本仕様の対象外とする。
- **CAN データの保存**: 確認用に保存するか否かは、先方の宿題として未確定である（「未確定論点」参照）。

## ライフサイクル
- **constructor**: `initialize()` を await せずに起動する。処理内容は `loginService.initialize()`、label 反映、`logService.initialize`、`new ScoreLogic`、`DemoData.initialize`。
- **`ngOnInit()`**: `changeOrientation()` を実行し、`scoreShowStar` を settings から反映する。
- **`ionViewWillEnter()`**: `screenOrientation.unlock()` で縦横自由にする。`onChange().subscribe` により、回転時に `changeOrientation()` を再実行する。
- **`ionViewDidEnter()`**: `loadVideo()`、`sensorService.start()`、`mapService.loadGoogleInstance(loadMap)`、`insomnia.keepAwake()` を実行する。
- **`ionViewWillLeave()`**: `sensorService.stop()`、`scoreLogic.stop()`、`mapService.stop()`、`stopVideo()`、`insomnia.allowSleepAgain()` を実行する。

## `changeOrientation()`
- **縦横の判定**: `screenOrientation.type` に `'landscape'` が含まれるかどうかで判定する。非 Android では `platform.width() > platform.height()` で代替判定する。
- **CSS の切り替え**: CSS クラス名を `header_portrait/landscape` などの組でスワップする。
- **縦横変更要求との関係**: 本画面は現行実装で既に縦横自由（`unlock`）であり、2026 年度の「縦横変更できるようにしてください」要求とは衝突しない。衝突するのは縦固定を掛けている他画面（履歴・アドバイス等）であり、本ノードの対象外である。

## `loadMap()`
- **初期中心**: 未取得なら `sensorService.getLastLatLng()` で確定する。取得できない場合は横浜にフォールバックする。
- **地図と自車マーカーの生成**: `mapService.createMap(mapElement, lastLatLng, 16)` と `drawCarMarker(lastLatLng, 0)` を実行する。
- **終了状態の表示範囲**: `status === finish` なら `fitBounds()` を実行する。
- **`drag` リスナ**: `autoScrollLock=true`（自車位置追従 OFF）にする。
- **`mark` リスナ**: `status === finish` のときのみ、次を行う。
  1. `mapService.setSelectMarkerPos(pos)` を実行する。
  2. `videoRecordedPath` の `/` を `@` に置換し、`/bad-spot/<encoded>` に `navCtrl.navigateForward` する。これは移行前の遷移契約である。改修後は、マーカーごとに対応する `hiyari.NN.webm` を渡す必要があるが、遷移パラメータは未確定である。

## 診断開始 `onStart()`（UC06）
1. `saveScoreLogic()` を実行する。ログ・センサログ・録画のいずれかが ON なら、`data.YYYYMMDD-HHMMSS` ディレクトリを作成し、scoreLogicJson / scoreLogic をスナップショット保存する。
2. `sensorService.startScoreLogic()` を実行する（`SensorManager.initializeCalibration()`、`DemoData.reset()`）。
3. `status=running`、`autoScrollLock=false` とする。`mapService.clearMarker()`、`setZoom(16)`、`setCenter(lastLatLng)` を実行する。
4. `lastLatLng = await sensorService.getLastLatLng()` で実センサーの最新座標を取得し、`drawStartMarker(lastLatLng)` を実行する。
5. `scoreLogic.clearAll()` の後、`scoreLogic.start(interval, cb)`（既定 300ms）を実行する。cb は `checkScoreLogic(score)`。
6. `startVideo()` を実行する。改修後は、冒頭で `hiyariWriteQueue = Promise.resolve()` に戻す。

- この操作で、センサーサービス・スコアロジックランナー・録画の 3 系統が同時に起動する。
- スコアロジックの時刻原点（`startScoreLogic()`、センサー時計）と録画の時刻原点（`videoStartTimestamp`、録画時計）は別である。
- 改修後のヒヤリ区間録画は、録画時計のみで完結させる（「動画」節参照）。

## 診断終了 `onStop()`
1. `status=finish` とし、`scoreLogic.stop()`、`sensorService.stopScoreLogic()`、`stopVideo()` を実行する。
   - 改修後は、この時点で開いているヒヤリ区間（複数の場合はすべて）を確定させ、区間を閉じる（「動画」節参照）。
2. `mapService.drawEndMarker(lastLatLng)` と `fitBounds()` を実行する。
3. `scoreDbService.insertScore(scoreLogic)` を呼び出す。await せずファイア＆フォーゲットで実行し、走行結果が SQLite に保存される。
4. `loginService.scoreId = scoreLogic.startTimestamp` を設定する（後続のアドバイス表示・履歴が参照する走行 ID）。
5. 終了ダイアログを表示する。ダイアログからの導線は次のとおり。
   - 「アドバイス表示」→ [[ui.comment.page]]（`onScore()` と同等の遷移）
   - ダイアログを閉じた後、地図上のヒヤリマーカーをタップ → [[ui.badspot.page]]（UC08）
6. `logService.resetLogDir()` を実行し、ログパスを既定の `debug-log` に戻す。
7. センサログの書き出しは、本操作で停止する（診断中のみ保存）。

## その他のイベント
- `onHistory()`: `/history` に遷移する。
- `onScore()`: `status=finish` のときのみ `/comment` に遷移する。
- `onPointer()`: `autoScrollLock=false` にする。`finish` なら `fitBounds` を、実行中なら `setZoom(16) + setCenter(lastLatLng)` を実行する。

## ヒヤリ検出時の通知（音）
- **発音のタイミング**: 走行中（`status === running`）にヒヤリポイントを検出した時点で音を鳴らし、運転者に知らせる。
- **発音契機**: ヒヤリ判定が成立したタイミングと一致する（`score.hiyari === true`、`pushBadPoint()` の起点）。
- **未確定の事項**（「未確定論点」参照）:
  - 音の種類・音量
  - 端末のサイレント/メディア音量との関係
  - 連続ヒヤリ時の再発音抑制（デバウンス）
- **録画側ルールとの関係**: 連続ヒヤリで録画区間が重なっても、ヒヤリごとに区間ファイルとマーカーが作られる。ただし、音を 1 件ずつ鳴らすかどうかは録画側のルールからは導かれない。

## 地図表示
- **描画要素**: 自車位置マーカー、開始マーカー、終了マーカー、ヒヤリ地点マーカー、走行軌跡である。
- **追従の解除と復帰**: 利用者が地図をドラッグすると、自車位置追従が解除される（`autoScrollLock=true`）。追従ボタン（`onPointer()`）で復帰する。
- **ヒヤリ地点マーカー**: ヒヤリ 1 件につき 1 つ描画する。連続ヒヤリで録画区間が重なる場合も、マーカーはまとめない。改修後は、各マーカーにそのヒヤリの区間ファイルが対応する。
- **自車マーカーの向き（優先度 want / 承認済み）**: 地図上の自車マーカーの矢印を、**進行方向に合わせて回転**させる。現行は上向き固定であり、改修対象である。
  - `driving.page.ts` は `mapService.drawCarMarker(lastLatLng, heading)` として heading を渡している。しかし表示上は上向き固定のままである。
  - したがって、回転の適用は [[middleware.map.service]] 側のマーカー描画で対応する必要がある（責務の所在は要確認）。

## 動画

### 改修後の確定方針（ヒヤリ区間録画・ヒヤリごと個別ファイル・append-while-open）
proposal #227 §4-1 のリングバッファ＋append-while-open 方式を、**第 1 期から実装する**。**通し動画は作らない。**

#### 決定の上書き関係（改訂履歴）
先行する承認済み決定のうち、次の点は後続の承認済み決定で置き換えられている。本仕様は後続決定を正とする。

| 先行の記述 | 置き換え後（正） |
|---|---|
| 連続ヒヤリは区間を連結し、終端を t2+n へ延長して 1 ファイルにする（proposal #242 / extend-concat） | **ヒヤリごとに必ず新しい `hiyari.NN.webm` を開く**。区間が重なる場合は、複数区間を同時に開く |
| ヒヤリ時刻は `startScoreLogic()` 原点で扱い、原点ギャップは実測後に判断する | ヒヤリ時刻 t も**録画時計**（`tVideo = Date.now() - videoStartTimestamp`）で測る。チャンク選択と区間判定を、この 1 つの時計で完結させる |
| `markersVideoTime` は `startScoreLogic()` 原点（センサー時計）のまま | `markersVideoTime` は **`floor((tVideo - segmentFrom) / 1000)`（区間ファイル先頭基準）**（#262） |
| #262: SegmentInfo に Duration を書き込む／open 時 Duration=0 のプレースホルダを置き、クローズ時に位置 0 へヘッダを上書き | **撤回**。Duration はファイルに書かない。書き込みは**追記のみ**とする |
| `finalizeHiyariFile()` でファイルを読み戻し、Timecode 振り直しと Duration 書き戻しを行う | Timecode の振り直しは**チャンク単位で書き込み前に**行う。読み戻し・書き戻しは行わない |
| 単一の `hiyariFileName` | 区間状態・t0・末尾 32B の繰り越しを**区間ごとの配列**で持つ。書き込みキューは 1 本のまま |

#### 録画条件
- `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` と `new MediaRecorder(stream, { mimeType: 'video/webm' })`（ビットレート指定なし）は、現行と同一とする。
- `mediaRecorder.start(1000)`（1 秒タイムスライス）で録画する。

#### 時計の一本化（録画時計）
- **チャンクの時刻**: 各チャンクには、受信時刻 `Date.now() - videoStartTimestamp` を付与して管理する。
- **ヒヤリの時刻**: ヒヤリ検知時刻 t も、同じ録画時計で `tVideo = Date.now() - videoStartTimestamp` として測る。
- **判定に使う時計**: リングバッファの切り詰め、区間に含めるチャンクの選択、区間の開閉判定は、**チャンク個数ではなくこの録画時計のみ**で行う。
  - 根拠: `start(1000)` でも `dataavailable` の間隔は非固定であり、チャンク番号は秒数と一致しない（下記「実測値」参照）。
  - proposal #227 §2 の「chunk[i] はおおむね [i, i+1) 秒を担う」は誤りである。
- **原点間ギャップの影響**: スコアロジック原点と録画原点のギャップ（`videoStartTimestamp - startTimestamp`）は、区間判定に影響しない。区間判定がすべて録画時計で閉じるためである。
  - ギャップは `logService.debug` で実測する。ただし、区間判定のための補正は不要である。

#### リングバッファ
- **chunk[0] の保持**: chunk[0]（WebM ヘッダを含む先頭チャンク）は、メモリ上で常時保持する。
- **切り詰め**: リングバッファは、区間が開いているかどうかに関わらず、常に**直近 n+5 秒分（＋chunk[0]）**に切り詰める。
- **保持量の上限**: リングバッファ保持量は、n=15 で約 6.36 MB、n=60 で約 20.2 MB である。区間ファイルへは append で逐次書き出すため、区間が重なって複数開いていても、この上限を超えない。
- **push のタイミング**: リングバッファへの push は書き込みキューを通さず、`dataavailable` 受信時に即時に行う。

#### ヒヤリ区間の定義
- **区間**: ヒヤリ検知時刻 t（録画時計）と設定値 n に対し、切り出し区間は **[t-n, t+n]** とする。
  - 先方要求の例示は前後 15 秒である。n の既定値と設定 UI は「未確定論点」を参照する。
- **ヒヤリごとの個別ファイル**: ヒヤリを検知するたびに、**必ず新しい `hiyari.NN.webm` を開く**。
- **区間の重なり**: 前のヒヤリの区間が開いている間に次のヒヤリが発生した場合は、**複数の区間を同時に開く**。受信したチャンクは、開いているすべての区間へ append する。
  - 重なり部分は、各ファイルに重複して書き込まれる。
- **マーカー**: ヒヤリ地点は、1 件ずつ別マーカーとして記録する。各マーカーには、そのヒヤリの区間ファイルが対応する。
- **尺不足**: 走行開始直後・終了直前で前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
- **診断終了時**: 開いている区間があれば、すべてその時点で確定させて閉じる。
- **ヒヤリ 0 件**: 動画ファイルは生成しない。
- **先方要求との関係**: 先方は「30 秒以内に連続したヒヤリは 1 本継続でも個別生成でもよい（実装しやすい方式を選んでよい）」としている。本方式は、その範囲内で**個別生成方式**を選択したものである。先方要求の 2 条件は、次のように満たす。
  - 「ヒヤリ時の動画が見られる」: ヒヤリごとに区間ファイルが存在する。
  - 「個別にヒヤリポイントの動画を確認できる」: ヒヤリ 1 件＝1 マーカー＝1 ファイルの対応で満たす。

#### 書き出し（append-while-open・追記のみ）
1. **区間オープン時**: 区間が開いた時点で `hiyari.NN.webm` を作成し、次の 2 つを書き出す。
   - chunk[0] を先頭から**最初の Cluster ID（`0x1F43B675`）の手前まで**（実測 189 B）に切り詰めたヘッダ
   - リングバッファ上の区間先頭からのクラスタ（オープン時点でスナップショットしたもの）
2. **区間クローズまで**: 以降は区間が閉じるまで、新しいチャンクを受信するごとに、そのチャンクを同じファイルへ append する。開いている区間が複数ある場合は、全区間へ append する。
3. **Cluster Timecode の振り直し**:
   - 区間の先頭 Cluster の Timecode を t0 とする。
   - 書き込む全 Cluster の Timecode を、**同じバイト長のまま**（元値 − t0）に振り直す。
   - 振り直しは、チャンク単位で**書き込み前に**行う。
   - 各チャンクの**末尾 32 B は次のチャンクへ繰り越す**。
4. **区間ごとの状態保持**: 区間状態・t0・末尾 32 B の繰り越しは、**区間ごとの配列**で保持する。
5. **Duration**: SegmentInfo の Duration は**ファイルに書かない**。
   - open 時のプレースホルダ、クローズ時のヘッダ上書き、ファイルの読み戻し・書き戻しのいずれも行わない。
   - 書き込みは追記のみとする。
   - 再生時の実長の確定は、[[ui.badspot.page]] の `applyVideoForSpot()` で `currentTime=1e101` のシークにより行う。
6. **chunk[0] 切り詰めの範囲**: 書き出し時の chunk[0] 切り詰めは、ファイル出力にのみ適用する。リングバッファ上の chunk[0] の常時保持は変えない。

#### ヒヤリマーカーの動画時刻（`markersVideoTime`）
- 改修後、ヒヤリマーカーの `markersVideoTime` は **`floor((tVideo - segmentFrom) / 1000)`**（秒）とする。
  - これは、そのヒヤリの区間ファイル先頭を基準とする値である。
  - `segmentFrom` は、当該区間の開始時刻（録画時計上）である。
- 区間ファイルの Cluster Timecode は t0 基準に振り直されている。そのため、[[ui.badspot.page]] はこの値を区間ファイルの `currentTime` にそのまま使える想定である。
- 前後 n 秒が確保できた区間では、ヒヤリ時刻はファイル先頭からおおむね n 秒の位置になる。
- 移行前の `startScoreLogic()` 原点（センサー時計）の値からは変わる。

#### 書き込みの直列化（`hiyariWriteQueue`）
区間ファイルへの書き込み（open 初回の writeFile / saveVideo の append）は、`driving.page.ts` の `hiyariWriteQueue` に連結して、1 本のキューで直列化する。区間が複数同時に開いていても、キューは 1 本である。

1. **キューの定義**
   - DrivingPage に `private hiyariWriteQueue: Promise<void> = Promise.resolve();` を置く。
   - あわせて `private enqueueHiyariWrite(label: string, task: () => Promise<void>): Promise<void>` を置く。
   - 中身は `this.hiyariWriteQueue = this.hiyariWriteQueue.then(task).catch(e => this.logService.error('[DrivingScore]hiyari write failed. op=' + label + ' err=' + e)); return this.hiyariWriteQueue;` とする。
   - catch でチェーンを回復させ、1 件の失敗で後続の書き込みを止めない。
2. **区間オープン（`openOrExtendHiyariSegment()` 相当）**
   - 新規区間を区間配列に登録した直後、await を挟まずに、同期的に区間先頭チャンクの配列をローカル変数へスナップショットする。
   - そのうえで、`enqueueHiyariWrite('open', async () => { const head = await this.extractWebmHeader(); await writeFile(dir, name, <head + スナップショットしたチャンク>); })` を呼ぶ。
   - `extractWebmHeader()` は、必ずタスクの内側で await する。外側で await すると、その間に saveVideo が append を先に積み、順序が逆転するためである。
   - スナップショット以降に届いたチャンクは append 経由でのみ書き、open 側に重複して含めない。
   - 呼び出し側は、戻り値の Promise を await してよい。
3. **追記（`saveVideo()`）**
   - `dataavailable` ごとに、開いている全区間のファイル名と区間状態を同期的に取得する。
   - 各区間について `enqueueHiyariWrite('append', () => writeFile(dir, name, <t0 基準に振り直したチャンク>, {append: true}))` を呼ぶ。
   - タスク内で区間配列を再参照しない。区間の開閉後に別ファイルへ書き込まれるのを防ぐためである。
4. **区間クローズ**
   - 区間の終了（t+n 到達または診断終了）時は、その区間を区間配列から同期的に取り除く。
   - これにより、クローズ後に同じファイルへの append が積まれないようにする。
   - Duration を書かないため、クローズ時にファイルの読み戻し・書き戻しは行わない。
5. **初期化**: `startVideo()` の冒頭（診断開始時）で、`this.hiyariWriteQueue = Promise.resolve();` に戻す。
6. **ログ**
   - 各タスクの開始時と完了時に、`[DrivingScore]hiyari write start|done op=<open|append|finalize> file=<name> seq=<連番>` を debug ログに出す。
   - 既存の `hiyari open. file=... chunks=5` ログは残す。
7. **この直列化で入れないもの**: 既に壊れたファイルの救済処理と、WebView のログ途絶対策は入れない。
8. **検証**
   - 実機で hiyari_recording シナリオを 2 周以上流す。
   - 生成された全 `hiyari.NN.webm` の先頭 4 バイトが `1A 45 DF A3` であることを確認する。
   - 同一 file について、open の done より前に append の start が無いことをログで確認し、evidence に残す。

#### ストレージ消費の見積もり
- 1 ヒヤリあたり約 315 KB/s × 2n 秒である（n=15 で約 9.4 MB、n=60 で約 37.7 MB）。
- 区間が重なる場合、重なり部分は各ファイルに重複して保存される。そのため、合計消費は「ヒヤリ件数 × 1 ヒヤリあたり」に近づく。

#### 実測値と注意点
- **計測条件**: SH-M29 / Android 15 / Chrome 153.0.8010.52 で計測した。条件はアプリと同一である（1280x720+audio、video/webm、ビットレート指定なし、`start(1000)`）。
- **実効ビットレート**:
  - 景色撮影時は約 315 KB/s（約 2.6 Mbps）である。実走行では、これを下限側の値として扱う。
  - 暗所の 60〜108 KB/s は代表値ではない。
- **チャンク間隔**:
  - `dataavailable` の間隔は、平均 1017〜1038 ms（最小 873 / 最大 1159 ms）である。
  - chunk[0] の実尺は 1023〜1104 ms と可変である。
- **チャンク番号と実時間の乖離**:
  - Cluster Timecode の実測では、chunk[25] が 25515〜26475 ms、chunk[30] が 30600〜31566 ms であった。
  - チャンク番号 × 1000 ms から約 2〜6% 乖離し、n=60 の区間端では 1.5 秒以上の誤差になる。
- **先頭フレーム**: 切り出しファイルの先頭フレームは、必ずしも黒くない。
  - 暗い被写体では、0.1 秒地点が完全な黒（輝度平均 0.0 / 分散 0.0）だった。
  - 景色撮影時は輝度平均 37.3〜74.6 / 分散 2144.4〜3460.1 で、正常に描画された。
  - 黒くなるのは、暗所かつ録画開始直後のセンサー立ち上がりが重なった場合のみである。
- **計測環境の位置づけ**:
  - 上記は、端末 Chrome での standalone-probe 計測（proposal #239）である。
  - SH-M29 の WebView（153.0.8010.36）と Chrome（153.0.8010.52）は、同一ビルド系列のパッチ違いである。そのため、Capacitor WebView の代理とした。
  - ただし同一プロセスではないため、アプリ内 WebView での確認は別途必要である。

### 現行実装の録画（移行前）
- **`loadVideo()`**:
  - 非 Android: `DemoData.movieFile` があれば、`URL.createObjectURL()` の結果を videoRecordedPath に設定する。
  - Android: `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` の後、`new MediaRecorder(stream, { mimeType: 'video/webm' })` を生成する。`dataavailable` イベントで `saveVideo()` を呼ぶ。
- **`startVideo()`**:
  - 非 Android、または `settings.recording=false` の場合は no-op。
  - `mediaRecorder.state=='inactive'` のとき、`recording=true`、`videoChunks.splice(0)`、`mediaRecorder.start(60000)`（60 秒で dataavailable 発火）を実行する。
- **`stopVideo()`**: `mediaRecorder.stop()` を実行する。
- **`saveVideo(event)`**:
  - 非 Android は no-op。
  - `videoChunks.push(event.data)` を実行する。
  - **初回は `file.writeFile(saveDirectoryPath, 'movie.webm', event.data)`、2 回目以降は `{append:true}` で書き込む**。
  - `state==='inactive'` なら `new Blob(videoChunks, {type:'video/webm'})` を作り、`videoRecordedPath` に設定する。
- **保存先**: `{externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/movie.webm`。
- **ヒヤリ地点詳細との連携**: [[ui.badspot.page]] は、この通し動画を `markersVideoTime`（センサー時計）による `currentTime` 追尾で再生する。

## `updateSensor(sensorData, updateMap)`
- `sensorData === null` の場合: センサー異常が発生したものとして、`onStop()` を実行する。
- `updateMap === false` の場合: `scoreLogic.pushSensorData(sensorData)` を実行する（診断ロジックへ流す）。
- `updateMap === true` の場合:
  - `lastLatLng = new google.maps.LatLng(lat, lng)` を設定する。
  - `status==running` なら、`drawCircleMarker(lastLatLng)` を実行する。
  - `autoScrollLock` が false かつ `status != finish` なら、`setCenter(lastLatLng)` を実行する。
  - `drawCarMarker(lastLatLng, heading)` を実行する。

## `checkScoreLogic(score)`
- `scoreLogic` の走行内平均を `Math.round` する。`scoreShowStarArea1/2` に応じて、`getRank(=101 - Math.round(score); 100 上限)` による順位表記に切り替える（移行前の表示方式）。
- `score.hiyari` が真なら、次を行う。
  - `pushBadPoint(score)` を実行する。
  - 検出音を鳴らす。
  - 改修後は、録画時計でヒヤリ時刻 `tVideo` を取得し、**新しいヒヤリ区間を開く**。既存区間の延長は行わない。既に開いている区間があっても、それとは別に開く。
- 指標が未算出の場合、平均値は 100 として扱われ、満点表示になる（前掲「センサーモードによる差異」「CAN 版ロジックが設定する指標の範囲」参照）。

## `pushBadPoint(score)`（UC08 の起点）
- **移行前の動画時刻**: `videoTime = Math.floor(sensorService.getLastSensorTime() / 1000)`（秒）を求める。これは `startScoreLogic()` 原点（センサー時計）の値である。
- **改修後の動画時刻**: マーカーに渡す動画時刻（`markersVideoTime`）は、区間ファイル先頭基準の `floor((tVideo - segmentFrom) / 1000)` とする（「動画」節参照）。
  - これを pushBadPoint 内の計算式の変更で実現するか、区間オープン後に値を与える形で実現するかは未確定である（「未確定論点」参照）。
- **メッセージの振り分け**: 各 message を、`type != 'positive'` かつ `key === 'score1..4'` の 4 種に振り分ける。`%COUNT` を `'1'` に、`%INTERSECTION` を `message.intersection` に置換する。この部分は変更しない。
- **マーカー描画**: `mapService.drawMarker(latLng, time文字列, videoTime, { msg1, msg2, msg3, msg4 })` を実行する。

## `saveScoreLogic()`
- 非 Android は no-op。
- `recording || logStorage || sensorLogStorage` のいずれかが有効なら、`logService.setLogDir('data.YYYYMMDD-HHMMSS')` を呼ぶ。あわせて、`{externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/` を `saveDirectoryPath` に反映する。
- `logStorage || sensorLogStorage` のときは、Storage の `scoreLogicJsonKey` と `scoreLogicKey` を、`scoreLogicJson.txt` / `scoreLogic.txt` としてスナップショット保存する。

## `getRank(score)`
- `rank = 101 - Math.round(score)` を求める。100 を超えたら 100 に丸め、文字列化する。

## `dateFormat(date)`
- 書式は `YYYY/MM/DD HH:mm:ss`。

## 業務ルール
- **画面・電源**
  - 診断中は Insomnia でスリープを抑止する。
  - 画面向きは自由とする。
- **録画（移行前）**: 動画は、1 走行 = `data.YYYYMMDD-HHMMSS/movie.webm` の 1 ファイルに追記する（60 秒毎のチャンクを append）。
- **録画（改修後・承認済み）**
  - `start(1000)` で録画する。
  - リングバッファには chunk[0] を常時保持し、常に直近 n+5 秒に切り詰める。
  - チャンク選択・区間判定・ヒヤリ時刻は、すべて録画時計（`Date.now() - videoStartTimestamp`）で扱う。
  - ヒヤリ区間 [t-n, t+n] を、**ヒヤリごとに別の** `hiyari.NN.webm` として append-while-open（追記のみ）で書き出す。
  - Cluster Timecode は t0 基準に同じバイト長で振り直す。Duration は書かない。
  - 書き込みは 1 本のキューで直列化する。
  - 通し動画は作らない。
- **連続ヒヤリ**
  - 区間が重なる場合は、複数区間を同時に開く。チャンクは開いている全区間へ append する（1 ファイルに連結しない）。
  - ヒヤリ地点は 1 件ずつ別マーカーとする。
- **区間の端の扱い**
  - 前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
  - 診断終了時に開いている区間は、すべて確定させる。
  - ヒヤリ 0 件なら、動画ファイルを生成しない。
- **センサログ**: 診断中のみ保存する。
- **ヒヤリ通知**: ヒヤリポイント検出時に音を鳴らす。
- **ヒヤリ判定とスコア**: ヒヤリ判定はスコア値を減点しない。発生するのは、マーカー・メッセージ・音・区間録画のみである。
- **操作可否**
  - ヒヤリマーカーのタップは、診断終了後のみ有効とする。移行前は、タップで動画パス（`@` エスケープ）付きの `/bad-spot/:path` に遷移する。
  - 「アドバイス表示」は、診断終了後（`status === finish`）のみ有効とする。
- **スコア表示**
  - ☆／順位表示を廃し、6 項目・5 段階のレーダーチャートと評価コメント（今回／過去の平均の 2 系列）に置き換える。
  - スコア値は画面上で直接入力・編集できない。
- **自車マーカー**: 矢印を進行方向に向ける（優先度 want）。
- **センサー異常**: センサーデータが異常（null）の場合は、診断を自動終了する。

## 未確定論点（2026 年度改修）
本画面に関係する未確定事項である。確定するまで、現行実装の挙動を維持する。

| 論点 | 内容 | 判断主体 |
|---|---|---|
| 採点データ形式 | レーダーチャート 6 項目・5 段階のスコアと評価コメントの受け取り方が、先方で検討中である（試作中に提示される）。現行 `scoreA/scoreB/scoreC`（0-100・3 列）とは、項目数・尺度が一致しない。 | 先方 + Middleware + DB |
| レーダーチャート表示の担当画面 | 6 項目チャートを本画面（4-1/4-2/4-3）で表示するのか、アドバイス画面・診断開始前画面のみに置くのかが未定である。走行中のリアルタイム更新の可否も未定である。 | UI + 先方 |
| アドバイス画面への導線 | ☆スコア表示を削除すると、[[ui.comment.page]] への導線が失われる。先方資料は「レーダーチャートを押すと 5-1 に遷移」とも記載しており、置き換え方の確定が必要である。 | UI + 先方 |
| 過去平均の集計期間 | 「過去の平均」系列の集計範囲が未定である。現行の `capability_score_target_days`（既定 30 日）を流用するかどうかが不明である。 | 先方 + DB |
| ヒヤリ区間ファイルの遷移契約 | 次の点が資料上で明記されていない。<br>・`hiyari.NN.webm` の命名詳細（NN の桁数・起点・重なり時の採番順）<br>・格納先ディレクトリ<br>・マーカーに対応する区間ファイルを [[ui.badspot.page]] へ渡す遷移パラメータ（現行は通し動画パスの `@` エスケープ）<br>なお、区間内シークは `markersVideoTime`（ファイル先頭基準）、実長確定は `currentTime=1e101` で行う方針である。 | UI + Middleware + Infra |
| `segmentFrom` の厳密な定義 | `segmentFrom` を t-n とするのか、区間先頭として採用したチャンクの時刻とするのかが未確定である。チャンク受信時刻とチャンクが担う映像範囲の関係も未確定である。区間先頭 Cluster（t0）との関係によって、`markersVideoTime` に最大約 1 秒の差が出うる。 | UI + QA |
| `markersVideoTime` 変更の実装箇所 | ファイル先頭基準への変更を、`pushBadPoint()` の計算式の変更で行うか、区間オープン後に値を与える形で行うかが未確定である。先行決定の「pushBadPoint の計算式は変えない」と #262 の値の変更との整合が必要である。 | UI |
| 旧 extend-concat 事実の撤回 | 事実台帳には、連続ヒヤリの 1 ファイル連結（proposal #242）、`markersVideoTime` のセンサー時計据え置き、finalize での読み戻し・Duration 書き戻しを記した承認済み事実が残っている。これらは後続の承認済み決定と矛盾するため、撤回または更新が必要である。 | Orchestrator |
| `finalize` タスクの存続 | Duration を書かなくなったため、クローズ時の `finalize` 書き込みタスクは実質不要である。ログ上の `op=finalize` を残すか、クローズ処理から除くかが未確定である。 | UI + QA |
| 設定値 n の既定値と設定 UI | 区間幅 n は設定値である。実測は n=15 / n=60 で行った。既定値、設定画面での入力可否・範囲は未定である。 | UI（設定画面）+ 先方 |
| 区間重複時のストレージ | 個別ファイル方式では、重なり部分が各ファイルに重複保存される。短時間に多数のヒヤリが発生した場合の合計容量について、上限や警告を設けるかが未定である。 | UI + Infra + 先方 |
| アプリ内 WebView での実測確認 | 実測値は端末 Chrome で得たものである。Capacitor WebView での同等性確認が別途必要である。 | UI + QA |
| ヒヤリ検出音の詳細 | 音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未定である。 | UI |
| 未算出スコアの提示 | `smartphoneOnly` で全指標 100（未算出）となる状態を、「未算出」と明示するかどうか。現行は満点と区別なく表示する。 | UI + Middleware |
| 空ラベル指標欄 | `label3/label4` が空の指標欄を表示し続けるか、非表示にするか。現行は空欄のまま描画する。 | UI |
| 自車マーカー回転の実装責務 | heading は渡っているが、上向き固定で描画されている。回転の適用を map.service 側で行うかの確認が必要である。 | UI + Middleware |
| タブ切り替えの構成 | 追加される「タブ切り替え」に本画面が含まれるか、到達経路がどう変わるかが未定である。 | UI + 先方 |
| CAN データ保存 | CAN データを確認用に保存できるかは、先方の宿題である。 | 先方 + Infra |
| BLE 安定化 | 受信の不安定さに対し、先方から「パラレル処理化」が示唆されている。ただしこれは**仮説**であり、確定した対策ではない。実機で確認しながら調整する領域である。テスト用ナビ端末の提供時期も未定である。 | Middleware |
| スコアロジック凍結 | スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は、打ち合わせ後まで**変更しない**。本画面はその出力をそのまま表示する。 | Middleware |
| 画面縦横 | 「縦横変更できるようにしてください」要求の対象は、縦固定を掛けている履歴・アドバイス等の他画面である。本画面は既に `unlock` で要求を満たす。 | UI（他ノード） |

## 関連ノード
- **依存**: [[middleware.sensor.service]] / [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.score.logicCan]] / [[middleware.sensor.demoData]] / [[db.score.repository]] / [[infra.file.storage]] / [[infra.assets.scoreLogicJson]] / [[infra.cordova.sensors]]
- **遷移先**: [[ui.badspot.page]] / [[ui.comment.page]] / [[ui.history.page]]
  - [[ui.badspot.page]] は、改修後に次を担う。
    - 区間ファイルの `applyVideoForSpot()` における `currentTime=1e101` シークでの実長確定
    - `markersVideoTime`（ファイル先頭基準）でのシーク
- **2026 年度改修で関連**: [[ui.previousResult.page]]（1-2 前回結果表示）。レーダーチャート仕様と過去平均の定義を共有する。
- **対象外**: 8-1「サービス案表示」（`ui.servicePlan.page`）のノード新設は**取り下げ済み**であり、本改修の対象外（後続検証）とする。

```json
{
  "required_changes": [
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "連続ヒヤリの extend-concat（1ファイル連結・終端 t2+n 延長）を廃し、ヒヤリごとに必ず新しい hiyari.NN.webm を開き区間重なり時は複数区間を同時オープンして全区間へ append する方式に改訂"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "ヒヤリ時刻 t も録画時計 tVideo=Date.now()-videoStartTimestamp で測り、チャンク選択・区間判定を単一時計で完結させる旨に改訂し、原点ギャップは区間判定に影響しない扱いへ変更"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "区間先頭 Cluster を t0 とし全 Cluster Timecode を同バイト長のまま(元値-t0)へチャンク単位で書き込み前に振り直し、末尾32Bを区間ごとに繰り越す書き出し規則を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "SegmentInfo Duration の書き込み・open時プレースホルダ・クローズ時ヘッダ上書き・finalize 読み戻しを撤回し、追記のみ・実長は bad-spot の currentTime=1e101 シークで確定と明記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "markersVideoTime を floor((tVideo-segmentFrom)/1000) の区間ファイル先頭基準に変更し、pushBadPoint 節と改訂履歴表に反映"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "hiyariWriteQueue による open/append の直列化（enqueueHiyariWrite、同期スナップショット、タスク内で区間状態を再参照しない、startVideo で初期化、start/done ログ、先頭4バイト 1A45DFA3 と順序の検証）を区間配列前提で追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "状態定義に videoStartTimestamp・hiyariSegments（区間ごとの配列）・hiyariWriteQueue を追加し、onStart/onStop/checkScoreLogic/業務ルール/ストレージ見積もり（重なり部分の重複保存）を更新"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "未確定論点表から原点ギャップ行を外し、segmentFrom 定義・markersVideoTime 変更の実装箇所・旧 extend-concat 事実の撤回・finalize タスク存続・区間重複時ストレージを追加"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "must", "reason": "ui.badspot.page はヒヤリ1件=1ファイルの hiyari.NN.webm を受け取り、ファイル先頭基準の markersVideoTime でシークし、Duration 非記録のため applyVideoForSpot() で currentTime=1e101 シークにより実長を確定する必要がある"},
    {"domain": "Orchestrator", "severity": "must", "reason": "ui.driving.page の承認済み事実に extend-concat（proposal #242）・markersVideoTime のセンサー時計据え置き・finalize での Duration 書き戻しが残っており、後続の承認済み決定（個別ファイル・ファイル先頭基準・Duration 撤回）と矛盾するため撤回/更新が必要"},
    {"domain": "Infra-agent", "severity": "should", "reason": "個別ファイル方式では区間の重なり部分が各ファイルに重複保存され、hiyari.NN.webm の命名（NN 桁数・起点・重なり時の採番）と格納先の定義およびストレージ見積もりの見直しが必要"},
    {"domain": "QA-agent", "severity": "must", "reason": "全 hiyari.NN.webm の先頭4バイト 1A45DFA3、同一 file で open done 前に append start が無いこと、区間重なり時の複数同時オープン、Timecode 振り直し後の再生・シーク位置、アプリ内 WebView での実測同等性の検証が必要"},
    {"domain": "UI-agent", "severity": "should", "reason": "区間幅 n が設定値のため設定画面での入力可否・既定値・範囲の定義が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目・1-5段階のスコアと評価コメントを供給する算出責務が未定義で、現行 scoreA/scoreB/scoreC（0-100・3値）と一致しない"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "自車マーカーの進行方向回転は map.service のマーカー描画側で heading を適用する必要があり、現行は heading が渡っても上向き固定"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が3列REAL（0-100）で6項目5段階と不一致、かつ『過去の平均』系列の集計期間定義が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "☆スコア表示削除により ui.comment.page への唯一の導線が失われるため遷移元の再定義が必要"}
  ],
  "requirements_context": "運転診断画面（/driving、画面4-1 走行前 / 4-2 走行中 / 4-3 走行終了、status 0 init / 1 running / 2 finish）は UC06（運転診断の実行）と UC08（ヒヤリ地点確認導線）を担う。『診断開始』でセンサーサービス（sensorService.start/startScoreLogic）、スコアロジックランナー（既定 settings.scoreLogicInterval=300ms）、録画を同時起動する。走行中は10ms周期のセンサー統合値を scoreLogic.pushSensorData に流し、Google Map に自車位置・開始/終了マーカー・ヒヤリ地点（1件1マーカー）・走行軌跡を描画。地図ドラッグで追従解除、追従ボタンで復帰。onStop で scoreLogic/sensor/録画を停止（改修後は開いている全ヒヤリ区間を確定）、drawEndMarker と fitBounds、scoreDbService.insertScore をファイア＆フォーゲットで実行、loginService.scoreId に startTimestamp を設定して終了ダイアログを表示し、logService.resetLogDir で debug-log に戻す。アドバイス表示（ui.comment.page）とヒヤリマーカータップ（ui.badspot.page、移行前は videoRecordedPath の '/'→'@' 置換で /bad-spot/:path、改修後は対応区間ファイルを渡すが遷移パラメータ未確定）は status===finish のみ有効。センサーデータ null で自動終了。スコア値は直接編集不可。ヒヤリ区間録画の書き出しは画面表示要素を持たず、進捗・完了通知なし、書き込み失敗はログのみ。\n\n【スコア表示の改修（承認済み）】4-1/4-2/4-3 で☆5段階表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合）を削除し、筋力・柔軟性・空間把握・危険予測・視力・視野の6項目・1〜5の5段階（5が良好、3が年齢平均）のレーダーチャートと評価コメントを表示。各項目に『n点（5点満点）』と2行程度のコメント、いらすとやアイコン、『今回』と『過去の平均』の2系列。記録なし時は ui.previousResult.page の未描画ルールと整合させる想定（適用可否未確定）。採点データ形式は先方検討中で未確定、scoreA/B/C（0-100の3値）と不一致で描画実装は供給契約確定まで着手不可。スコアロジックは打ち合わせ後まで凍結。\n\n【移行前スコア表示の実装実態】星/順位（101-score、100上限）。スコアロジック差し替え未実装で常に CAN 版（scoreLogicFunction_simple.txt は未参照）。smartphoneOnly は BLE スキャンなしで接続待ち表示なし、lastCanData ゼロ埋めで全指標100（未算出）表示。CAN 版は score1/score2/overAll/scoreA/scoreB のみ設定し label3/label4 は空で描画。ヒヤリはスコア減点しない。初期 Score(null) 混入で序盤は (評価窓合計+100)/(窓数+1) と高め。\n\n【自車マーカー】進行方向に回転（want、承認済み）。現行は上向き固定で heading は drawCarMarker に渡っているため map.service 側対応が必要（責務要確認）。\n\n【ヒヤリ通知】走行中ヒヤリ検出時に音を鳴らす（承認済み）。契機は score.hiyari===true。音源・音量・サイレント時・デバウンスは未確定。\n\n【ヒヤリ区間録画（承認済み、proposal #227 §4-1 を第1期から実装、後続決定で改訂）】getUserMedia 1280x720+audio、video/webm、ビットレート指定なしで MediaRecorder.start(1000)。通し動画は作らない。チャンクに受信時刻 tVideo=Date.now()-videoStartTimestamp を付与し、ヒヤリ時刻 t も同じ録画時計で測り、リングバッファ切り詰め・チャンク選択・区間判定を単一時計で完結（チャンク個数判定は廃止、proposal #227 §2 の chunk[i]≒[i,i+1)秒は誤り）。原点ギャップ（videoStartTimestamp-startTimestamp）は logService.debug で実測するが区間判定の補正は不要。chunk[0] はメモリ上で常時保持し、リングバッファは区間の開閉に関わらず常に直近 n+5秒（＋chunk[0]）に切り詰め、push はキューを通さず即時。区間は [t-n,t+n]、ヒヤリごとに必ず新しい hiyari.NN.webm を開き、区間が重なる場合は複数区間を同時に開いて届いたチャンクを全区間へ append（旧 extend-concat・t2+n 延長は撤回、重なり部分は各ファイルに重複保存）。ヒヤリ地点は1件ずつ別マーカーで各マーカーに区間ファイルが対応。n 秒を確保できなければ取得範囲をそのまま保存、診断終了時に開いている区間はすべて確定、ヒヤリ0件なら動画を生成しない。区間オープン時に chunk[0] を最初の Cluster ID(0x1F43B675) の手前（実測189B）に切り詰めたヘッダとスナップショットした区間先頭からのクラスタを書き出し、以降区間終了まで新チャンクを append。区間先頭 Cluster を t0 とし全 Cluster Timecode を同バイト長のまま(元値-t0)にチャンク単位で書き込み前に振り直し、末尾32Bを次チャンクへ繰り越す。区間状態・t0・32B 繰り越しは区間ごとの配列で保持。SegmentInfo Duration はファイルに書かず（#262 の Duration 書き込み、open 時 Duration=0 プレースホルダ、クローズ時位置0上書き、finalize 読み戻し・書き戻しは撤回）、書き込みは追記のみ、実長は ui.badspot.page の applyVideoForSpot() で currentTime=1e101 シークにより確定。markersVideoTime は floor((tVideo-segmentFrom)/1000) の区間ファイル先頭基準（旧：startScoreLogic 原点のセンサー時計、pushBadPoint のメッセージ振り分けは不変、計算式変更の実装箇所は未確定）。リングバッファ上の chunk[0] 常時保持は変えない。書き込みは hiyariWriteQueue 1本で直列化：enqueueHiyariWrite(label, task) は then(task).catch(logService.error '[DrivingScore]hiyari write failed. op=… err=…') でチェーンを回復、open は区間登録直後に await を挟まず同期でチャンクをスナップショットし extractWebmHeader() はタスク内で await、スナップショット以降のチャンクは append のみで重複させない、saveVideo は dataavailable ごとに開いている全区間を同期取得し各区間へ append を enqueue しタスク内で区間状態を再参照しない、区間クローズ時は区間配列から同期的に除去、startVideo 冒頭で Promise.resolve() に初期化、各タスク開始/完了で '[DrivingScore]hiyari write start|done op=<open|append|finalize> file=<name> seq=<連番>' を debug 出力し既存 'hiyari open. file=... chunks=5' ログは残す、壊れたファイルの救済と WebView ログ途絶対策は入れない、検証は hiyari_recording シナリオ2周以上で全ファイル先頭4バイト 1A45DFA3 と同一 file で open done 前に append start が無いことをログで確認し evidence に残す。先方の『30秒以内の連続ヒヤリは1本継続でも個別でもよい、ヒヤリ時の動画が見られることと個別に確認できることを満たせばよい』の範囲で個別生成方式を選択。\n\n【実測（SH-M29/Android15/Chrome 153.0.8010.52、アプリ同一条件）】景色撮影時の実効約315KB/s（約2.6Mbps）で下限側の値、暗所60〜108KB/s は代表値でない。リングバッファ保持量 n=15 約6.36MB、n=60 約20.2MB で区間が複数開いても超えない。ストレージは1ヒヤリ約315KB/s×2n（n=15 約9.4MB、n=60 約37.7MB）。dataavailable 間隔平均1017〜1038ms（最小873/最大1159ms）、chunk[0] 実尺1023〜1104ms。chunk[25] は25515〜26475ms、chunk[30] は30600〜31566ms で番号×1000ms から約2〜6%乖離し n=60 区間端で1.5秒以上の誤差。切り出し先頭0.1秒は暗所で完全な黒（輝度0.0/分散0.0）、景色撮影時は輝度37.3〜74.6/分散2144.4〜3460.1 で正常、黒は暗所かつ録画開始直後が重なる場合のみ。WebView 153.0.8010.36 と Chrome は同一ビルド系列で standalone-probe（proposal #239）を代理としたがアプリ内 WebView 確認は別途必要。\n\n【移行前の録画】start(60000)、movie.webm に初回 writeFile・以降 append、inactive 時に Blob 化して videoRecordedPath 設定、ui.badspot.page は markersVideoTime（センサー時計）で currentTime 追尾。\n\n【ファイル書き出し】ルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/、#79 の externalDataDirectory 案は撤回済み。採取はファイルアプリまたは adb pull。センサログは診断中のみ。追加パーミッションなし、失敗時提示・保持期間は対象外。saveScoreLogic は recording/logStorage/sensorLogStorage のいずれか有効で setLogDir、logStorage||sensorLogStorage で scoreLogicJson.txt/scoreLogic.txt を保存。hiyari.NN.webm の格納先・命名詳細は未明記。CAN データ保存可否は先方宿題。\n\n【画面挙動・全体文脈】unlock で縦横自由、回転時 CSS 切替、Insomnia でスリープ抑止。縦横要求は他画面が対象。2026年度改修は日産『一次仕様』2026-08-04 とメイサンソフト『要求仕様確認』2026-09-17 に基づく5本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE安定化 ⑤録画データサイズ改善）で本画面は③⑤。8-1 サービス案表示ノード新設は取り下げ済み。BLE パラレル処理化は仮説、テスト用ナビ端末の提供時期未定。2026年11月末完了、12月高齢者実験開始。",
  "fact_candidates": [
    {"type": "business_rule", "title": "ヒヤリごとに新しい区間ファイルを開く", "statement": "改修後の運転診断画面はヒヤリを検知するたびに必ず新しい hiyari.NN.webm を開き、連続ヒヤリでも1ファイルに連結しない", "status": "approved"},
    {"type": "business_rule", "title": "重なる区間は同時に開き全区間へ append する", "statement": "ヒヤリ区間が重なる場合は複数区間を同時に開き、受信したチャンクを開いている全区間へ append する", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ時刻とチャンク選択は録画時計で判定する", "statement": "ヒヤリ時刻 t は tVideo=Date.now()-videoStartTimestamp で測り、チャンク選択と区間判定をこの録画時計のみで行う", "status": "approved"},
    {"type": "business_rule", "title": "Cluster Timecode を区間先頭基準に振り直す", "statement": "区間先頭 Cluster の Timecode を t0 とし、書き込む全 Cluster Timecode を同じバイト長のまま(元値-t0)にチャンク単位で書き込み前に振り直し、末尾32Bを次チャンクへ繰り越す", "status": "approved"},
    {"type": "constraint", "title": "区間ファイルに Duration を書かず追記のみとする", "statement": "hiyari.NN.webm には SegmentInfo Duration を書かず、ヘッダ上書きや読み戻しを行わない追記のみの書き込みとする", "status": "approved"},
    {"type": "data_semantics", "title": "markersVideoTime は区間ファイル先頭基準の秒数", "statement": "改修後のヒヤリマーカーの markersVideoTime は floor((tVideo-segmentFrom)/1000) で、区間ファイル先頭を基準とする", "status": "approved"},
    {"type": "constraint", "title": "区間ファイルへの書き込みは1本のキューで直列化する", "statement": "区間ファイルへの open と append は hiyariWriteQueue 1本に連結して直列化し、区間が複数開いていてもキューは1本とする", "status": "approved"},
    {"type": "qa_expectation", "title": "全区間ファイルの先頭4バイトは 1A 45 DF A3", "statement": "hiyari_recording シナリオを2周以上流し、生成された全 hiyari.NN.webm の先頭4バイトが 1A 45 DF A3 であることを確認する", "status": "approved"},
    {"type": "qa_expectation", "title": "同一ファイルで open 完了前に append が始まらない", "statement": "同一 file について open の done より前に append の start が無いことを debug ログで確認し evidence に残す", "status": "approved"},
    {"type": "data_semantics", "title": "区間が重なると重なり部分は各ファイルに重複保存される", "statement": "個別ファイル方式では区間の重なり部分が各 hiyari.NN.webm に重複して保存される", "status": "candidate"},
    {"type": "display_rule", "title": "ヒヤリマーカーと区間ファイルは1対1で対応する", "statement": "ヒヤリ1件につき1マーカーと1区間ファイルが作られ、各マーカーにそのヒヤリの区間ファイルが対応する", "status": "candidate"},
    {"type": "business_rule", "title": "リングバッファは常に直近 n+5 秒と chunk[0] を保持する", "statement": "リングバッファは区間の開閉に関わらず常に直近 n+5 秒分に chunk[0] を加えた範囲へ録画時計で判定して切り詰める", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ0件なら動画ファイルは生成されない", "statement": "走行中にヒヤリが1件も検出されなかった場合、動画ファイルは生成されない", "status": "approved"},
    {"type": "business_rule", "title": "診断終了時に開いている区間はすべて確定される", "statement": "診断終了操作の時点で開いているヒヤリ区間はすべてその時点で確定させて閉じる", "status": "approved"},
    {"type": "display_rule", "title": "運転診断画面の☆スコア表示をレーダーチャートに置き換える", "statement": "4-1/4-2/4-3 で☆5段階表示を削除し、6項目1〜5段階のレーダーチャートと評価コメント（今回・過去の平均の2系列）を表示する", "status": "approved"},
    {"type": "display_rule", "title": "自車マーカーの矢印を進行方向に向ける", "statement": "地図上の自車マーカーの矢印を進行方向に合わせて回転させる（現行は上向き固定、優先度 want）", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリポイント検出時に音を鳴らす", "statement": "走行中にヒヤリポイントを検出した時点で音を鳴らして運転者に知らせる", "status": "approved"},
    {"type": "state_rule", "title": "ヒヤリマーカーのタップとアドバイス表示は診断終了後のみ有効", "statement": "ヒヤリマーカーのタップと『アドバイス表示』への遷移は status が finish のときのみ受け付けられる", "status": "candidate"},
    {"type": "input_rule", "title": "スコア値は画面上で直接編集できない", "statement": "利用者は運転診断画面上でスコア値を直接入力・編集できない", "status": "candidate"},
    {"type": "open_question", "title": "旧 extend-concat 関連の承認済み事実が後続決定と矛盾している", "statement": "ui.driving.page の事実台帳に連続ヒヤリの1ファイル連結・markersVideoTime のセンサー時計据え置き・finalize での Duration 書き戻しが approved のまま残っており撤回/更新が必要", "status": "open_question"}
  ],
  "open_questions": [
    "ui.driving.page の承認済み事実に extend-concat（proposal #242、終端 t2+n 延長の1ファイル連結）、markersVideoTime の startScoreLogic 原点据え置き、finalize での読み戻し・Duration 書き戻しが残っており、後続の承認済み決定（ヒヤリごと個別ファイル・ファイル先頭基準・Duration 撤回）と矛盾する。本仕様は提案番号と撤回記述の前後関係から後続決定を正としたが、Orchestrator による事実台帳の撤回/更新確認が必要で、放置すると QA 観点や ui.badspot.page 仕様が旧方式で書かれるおそれがある。",
    "segmentFrom を t-n とするか区間先頭として採用したチャンクの時刻とするか、またチャンク受信時刻とそのチャンクが担う映像範囲の関係が未確定。t0（区間先頭 Cluster）との関係により markersVideoTime に最大約1秒の差が出うる。UI+QA 判断が必要で、決まらないと ui.badspot.page のシーク位置精度を保証できない。",
    "markersVideoTime をファイル先頭基準へ変える実装を pushBadPoint() の計算式変更で行うか区間オープン後に値を与える形で行うかが未確定。先行決定『pushBadPoint の計算式は変えない』と #262 の値変更の整合をとる必要がある。UI 判断が必要。",
    "Duration を書かなくなったためクローズ時の finalize 書き込みタスクが実質不要となったが、ログ上の op=finalize を残すかクローズ処理から除くかが未確定。UI+QA 判断が必要で、ログによる順序検証の期待値に影響する。",
    "hiyari.NN.webm の格納先ディレクトリと命名詳細（NNの桁数・起点・区間重なり時の採番順）が資料上で明記されていない。Infra/UI判断が必要で、決まらないと ui.badspot.page からの参照と採取手順を確定できない。",
    "マーカーに対応する区間ファイルを ui.badspot.page へ渡す遷移パラメータ（現行は通し動画パスの @ エスケープ）が未確定。UI+Middleware判断が必要で、決まらないと UC08 が成立しない。",
    "個別ファイル方式では区間の重なり部分が重複保存されるため、短時間に多数のヒヤリが発生した場合の合計ストレージについて上限・警告を設けるかが未確定。UI+Infra+先方判断が必要。",
    "設定値 n の既定値と設定画面での入力可否・範囲が未確定（実測は n=15/n=60、先方例示は15秒）。UI（設定画面）+先方判断が必要。",
    "実測はアプリ外の端末 Chrome で行われ、アプリ内 Capacitor WebView での同等性確認が未実施。QA判断が必要で、決まらないとビットレート・ストレージ見積もりの妥当性が確定しない。",
    "6項目5段階の採点データ形式が先方検討中で未確定、scoreA/scoreB/scoreC と不一致。Middleware/DB判断が必要でレーダーチャート描画実装に着手できない。",
    "レーダーチャートを 4-1/4-2/4-3 のどこで表示し走行中にリアルタイム更新するかが未確定。UI+先方判断が必要。",
    "☆スコア表示削除後の ui.comment.page への導線が未確定（先方は『レーダーチャートを押すと5-1に遷移』とも記載）。UI+先方判断が必要で、決まらないとアドバイス表示が到達不能になる。",
    "『過去の平均』系列の集計期間（capability_score_target_days 既定30日の流用可否）と、記録なし時の未描画ルールの本画面への適用可否が未確定。DB+UI判断が必要。",
    "自車マーカー回転を map.service 側で適用するかの責務所在が未確定。Middleware判断が必要。",
    "ヒヤリ検出音の音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未確定。UI判断（アセットは Infra）が必要で、決まらないと運転妨害または聞こえないリスクが残る。",
    "smartphoneOnly で全指標100（未算出）となる状態を『未算出』と明示するか、空ラベル指標欄を非表示にするかが未確定。UI判断が必要。",
    "insertScore が await されないため終了直後のアドバイス表示遷移で保存未完了となりうるかが未確定。DB/Middleware確認が必要。",
    "タブ切り替えに本画面が含まれるかが未確定。UI+先方判断が必要。",
    "CAN データを確認用に保存できるかが先方の宿題として未確定。"
  ],
  "rationale_notes": [
    "背景の共通事実（録画時計一本化、#262 の Timecode 振り直し、Duration=0 プレースホルダ、Duration 撤回、ヒヤリごと個別ファイル）とノード事実（extend-concat、markersVideoTime 据え置き、finalize 書き戻しを含む書き込みキュー）が矛盾していた。提案番号の順序（#242 → #262 → 書き込みキュー → Duration 撤回 → 個別ファイル）と、後続事実が先行事実を明示的に撤回・参照している関係（『#262 の Duration 書き込みは撤回する』『書き込みキューは1本のまま』）から、後続決定を正として統合した。その経緯は仕様本文の『決定の上書き関係』表に残した。",
    "書き込みキュー決定は単一の hiyariFileName を前提に書かれていたが、個別ファイル決定で区間ごとの配列に変わった。そのため『同期スナップショット・タスク内で再参照しない・クローズ時は同期的に除去』という順序保証の原則を維持したまま、区間配列前提に読み替えて記載した。",
    "書き込みキュー決定の『変更してはいけないもの（区間の from/end/連結条件、#262 の Duration 内容など）』は、その変更単位のスコープ制約である。恒久的な禁止ではないと解釈し、後続決定による変更と矛盾しないものとして扱った。",
    "録画時計への一本化により、区間判定は原点ギャップの影響を受けなくなった。そのため従来の『ギャップ実測後に補正要否を判断』は区間判定については不要とした。debug 実測自体は残して差し支えない。",
    "個別ファイル方式は、先方の2条件のうち『個別にヒヤリポイントの動画を確認できる』を、1マーカー=1ファイルの対応で直接満たす。連結方式で必要だった区間内オフセット換算の複雑さは解消するが、重なり部分の重複保存によりストレージ消費は増える。",
    "Duration をファイルに書かず再生側の currentTime=1e101 シークで実長を確定する方針により、書き込みは追記のみとなる。クローズ時の読み戻し・書き戻しによる競合や途中失敗のリスクがなくなる。",
    "スコア表示・自車マーカー・検出音・書き出しルート・スコアロジック凍結・縦横・実測値に関する既存記述と判断理由は変更の必要がないため維持した。"
  ]
}
```