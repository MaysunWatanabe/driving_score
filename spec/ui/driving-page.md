<!-- 作成: 2026-09-29 15:22:15 JST | 更新: 2026-09-30 17:59:17 JST -->

# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面である。センサーサービスから 10ms 周期でセンサー統合値を受け取る。ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行し、診断結果を画面に表示する。Google Map 上には、自車位置、開始・終了マーカー、ヒヤリ地点、走行軌跡を描画する。

録画は MediaRecorder で行う。

- **移行前（現行実装）**: 60 秒チャンクの video/webm を、走行ディレクトリの `movie.webm` に追記保存する（通し動画）。
- **改修後（承認済み）**: 1 秒タイムスライスで録画し、リングバッファに保持する。
  - ヒヤリを検出するたびに、前後 n 秒の区間を `hiyari.NN.webm` として書き出す。
  - 区間が重なる連続ヒヤリは **1 本のファイルに連結**し、終端を延長する（extend-concat）。
  - ヒヤリ地点は、連結後も 1 件ずつ別マーカーとして記録する。
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
>     - リングバッファ＋append-while-open（proposal #227 §4-1 を第 1 期から実装）
>     - チャンク受信時刻とヒヤリ時刻の録画時計での管理（チャンク個数判定の廃止）
>     - 連続ヒヤリの 1 ファイル連結（extend-concat、proposal #242）
>     - 書き出し時の chunk[0] ヘッダ切り詰め（189 B）
>     - 書き込みキューによる直列化（open / append / finalize）
>     - finalize での #262 の読み戻し・Timecode 振り直し・Duration 書き戻し
> - **未確定の事項**: 採点データ形式、アドバイス画面への導線、ヒヤリ区間ファイルへの遷移契約、区間ファイル内のシーク位置などは未確定である。これらは「未確定論点（2026 年度改修）」節に集約する。
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
hiyariFileName: string | null      // 現在開いているヒヤリ区間ファイル名（開いていなければ null）
区間の from / end                  // 開いている区間の開始・終端（録画時計）。連続ヒヤリで end を延長する
hiyariWriteQueue: Promise<void>    // 区間ファイルへの書き込みを 1 本に直列化するキュー（診断開始時に Promise.resolve() へ初期化）
```

- extend-concat 方式では、区間が重なる連続ヒヤリは 1 ファイルに連結される。そのため、同時に開いている区間ファイルは高々 1 つであり、単一の `hiyariFileName` で管理する。
- 区間の from / end を保持する変数の命名は、実装裁量とする。

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
  - 改修後の動画は `hiyari.NN.webm`（ヒヤリ区間 1 つにつき 1 ファイル。区間が重なる連続ヒヤリは 1 ファイルに連結）。
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
  2. `videoRecordedPath` の `/` を `@` に置換し、`/bad-spot/<encoded>` に `navCtrl.navigateForward` する。これは移行前の遷移契約である。
  - 改修後は、マーカーごとに対応する `hiyari.NN.webm`（連結区間の場合は連結後のファイル）と、そのファイル内での再生位置を渡す必要がある。遷移パラメータは未確定である。

## 診断開始 `onStart()`（UC06）
1. `saveScoreLogic()` を実行する。ログ・センサログ・録画のいずれかが ON なら、`data.YYYYMMDD-HHMMSS` ディレクトリを作成し、scoreLogicJson / scoreLogic をスナップショット保存する。
2. `sensorService.startScoreLogic()` を実行する（`SensorManager.initializeCalibration()`、`DemoData.reset()`）。
3. `status=running`、`autoScrollLock=false` とする。`mapService.clearMarker()`、`setZoom(16)`、`setCenter(lastLatLng)` を実行する。
4. `lastLatLng = await sensorService.getLastLatLng()` で実センサーの最新座標を取得し、`drawStartMarker(lastLatLng)` を実行する。
5. `scoreLogic.clearAll()` の後、`scoreLogic.start(interval, cb)`（既定 300ms）を実行する。cb は `checkScoreLogic(score)`。
6. `startVideo()` を実行する。改修後は、冒頭で `hiyariWriteQueue = Promise.resolve()` に戻す。

- この操作で、センサーサービス・スコアロジックランナー・録画の 3 系統が同時に起動する。
- スコアロジックの時刻原点（`startScoreLogic()`、センサー時計）と録画の時刻原点（`videoStartTimestamp`、録画時計）は別である。
  - 改修後の区間判定（チャンク選択・区間の開閉）は、録画時計で行う。
  - `markersVideoTime` は、センサー時計（`startScoreLogic()` 原点）のまま据え置く。
  - 両原点のギャップ（`videoStartTimestamp - startTimestamp`）は `logService.debug` で実測し、実測後に改めて判断する（「動画」節参照）。

## 診断終了 `onStop()`
1. `status=finish` とし、`scoreLogic.stop()`、`sensorService.stopScoreLogic()`、`stopVideo()` を実行する。
   - 改修後は、この時点で未確定のヒヤリ区間があれば、その時点で確定させて書き出す（`closeHiyariSegment()` → finalize。「動画」節参照）。
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
- **録画側ルールとの関係**: 連続ヒヤリで録画区間が 1 ファイルに連結されても、ヒヤリ地点のマーカーは 1 件ずつ作られる。ただし、音を 1 件ずつ鳴らすかどうかは録画側のルールからは導かれない。

## 地図表示
- **描画要素**: 自車位置マーカー、開始マーカー、終了マーカー、ヒヤリ地点マーカー、走行軌跡である。
- **追従の解除と復帰**: 利用者が地図をドラッグすると、自車位置追従が解除される（`autoScrollLock=true`）。追従ボタン（`onPointer()`）で復帰する。
- **ヒヤリ地点マーカー**: ヒヤリ 1 件につき 1 つ描画する。連続ヒヤリで録画区間が 1 ファイルに連結される場合も、マーカーはまとめない。
  - 改修後、連結区間に含まれる複数のマーカーは、同じ `hiyari.NN.webm` に対応する。個々のヒヤリの確認は、ファイル内の再生位置で区別する（位置の算出方法は未確定）。
- **自車マーカーの向き（優先度 want / 承認済み）**: 地図上の自車マーカーの矢印を、**進行方向に合わせて回転**させる。現行は上向き固定であり、改修対象である。
  - `driving.page.ts` は `mapService.drawCarMarker(lastLatLng, heading)` として heading を渡している。しかし表示上は上向き固定のままである。
  - したがって、回転の適用は [[middleware.map.service]] 側のマーカー描画で対応する必要がある（責務の所在は要確認）。

## 動画

### 改修後の確定方針（ヒヤリ区間録画・extend-concat・append-while-open）
proposal #227 §4-1 のリングバッファ＋append-while-open 方式を、**第 1 期から実装する**。**通し動画は作らない。**

#### 改訂履歴（2026-09-30 spec-integrate）
前版（2026-09-29）は、次の方針を採っていた。本版では、承認済み事実台帳を正として、これらを右列の記述に戻した。前版の方針は、現時点の承認済み事実台帳に対応する事実が存在しないためである（「未確定論点」の「前版方針の扱い」参照）。

| 前版（2026-09-29）の記述 | 本版（承認済み事実に基づく） |
|---|---|
| ヒヤリごとに必ず新しい `hiyari.NN.webm` を開き、区間が重なる場合は複数区間を同時に開く | 区間が重なる連続ヒヤリは **1 本のファイルに連結**し、終端を t2+n へ延長し続ける（extend-concat、proposal #242） |
| 区間状態を区間ごとの配列（`hiyariSegments`）で持つ | 単一の `hiyariFileName` と区間 from / end で管理する（同時に開く区間は高々 1） |
| `markersVideoTime` は `floor((tVideo - segmentFrom) / 1000)`（区間ファイル先頭基準） | `markersVideoTime` は **`startScoreLogic()` 原点（センサー時計）のまま据え置く**。`pushBadPoint()` の計算式は変えない |
| Duration はファイルに書かず、書き込みは追記のみ。実長は [[ui.badspot.page]] の `currentTime=1e101` シークで確定 | 区間クローズ時に **finalize** で、ファイルを読み戻し、**#262 の Timecode 振り直しと Duration 書き戻し**を行う |
| Timecode 振り直しはチャンク単位で書き込み前に行い、末尾 32 B を繰り越す | Timecode 振り直しは **finalize の読み戻し後**に行う（#262 の内容は変更しない） |
| 原点間ギャップは区間判定に影響しないため補正不要 | 区間判定は録画時計で完結する。ギャップは `logService.debug` で実測し、**実測後に改めて判断する** |

#### 録画条件
- `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` と `new MediaRecorder(stream, { mimeType: 'video/webm' })`（ビットレート指定なし）は、現行と同一とする。
- `mediaRecorder.start(1000)`（1 秒タイムスライス）で録画する。

#### 時刻管理（録画時計とセンサー時計）
- **チャンクの時刻**: 各チャンクには、受信時刻 `Date.now() - videoStartTimestamp` を付与して管理する。
- **ヒヤリの時刻**: ヒヤリ検知時刻 t も、同じ録画時計で `tVideo = Date.now() - videoStartTimestamp` として測る。
- **判定に使う時計**: リングバッファの切り詰め、区間に含めるチャンクの選択、区間の開閉判定は、**チャンク個数ではなくこの録画時計のみ**で行う（ずれ 1 の解消）。
  - 根拠: `start(1000)` でも `dataavailable` の間隔は非固定であり、チャンク番号は秒数と一致しない（下記「実測値」参照）。
  - proposal #227 §2 の「chunk[i] はおおむね [i, i+1) 秒を担う」は誤りである。
- **マーカーの時刻**: `pushBadPoint()` は変更しない。`markersVideoTime` は `startScoreLogic()` 原点（センサー時計）のままとする。
- **原点間ギャップ**: スコアロジック原点と録画原点のギャップ（`videoStartTimestamp - startTimestamp`）は、`logService.debug` で実測する。扱いは実測後に改めて判断する。
  - 区間判定は録画時計で完結するため、ギャップの影響を受けない。
  - 一方、センサー時計の `markersVideoTime` から区間ファイル内の再生位置を求める場合は、このギャップが関係する（「未確定論点」参照）。

#### リングバッファ
- **chunk[0] の保持**: chunk[0]（WebM ヘッダを含む先頭チャンク）は、メモリ上で常時保持する。
- **切り詰め**: リングバッファは、区間が開いているかどうかに関わらず、常に**直近 n+5 秒分（＋chunk[0]）**に切り詰める。切り詰めはチャンク受信時刻（録画時計）で判定する。
- **保持量の上限**: リングバッファ保持量は、n=15 で約 6.36 MB、n=60 で約 20.2 MB である。append-while-open により、連結が続いてもこの上限を超えない。
- **push のタイミング**: リングバッファへの push は書き込みキューを通さず、`dataavailable` 受信時に従来どおり即時に行う。

#### ヒヤリ区間の定義
- **区間**: ヒヤリ検知時刻 t（録画時計）と設定値 n に対し、切り出し区間は **[t-n, t+n]** とする。
  - 先方要求の例示は前後 15 秒である。n の既定値と設定 UI は「未確定論点」を参照する。
- **連続ヒヤリの連結（extend-concat）**: 次のヒヤリ t2 が現区間の終端より前に発生した場合は、終端を **t2+n** へ延長し、1 ファイルに連結する。重なりが続く限り、延長を繰り返す。
- **マーカー**: ヒヤリ地点は、連結後も 1 件ずつ別マーカーとして記録する。
- **尺不足**: 走行開始直後・終了直前で前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
- **診断終了時**: 未確定の区間があれば、その時点で確定させて書き出す。
- **ヒヤリ 0 件**: 動画ファイルは生成しない。
- **先方要求との関係**: 先方は「ヒヤリと判定された運転が 30 秒以内に連続した場合の動画生成方式は、実装しやすい方式を選んでよい」としている。条件は次の 2 点である。本方式（extend-concat）は、その裁量の範囲内で確定したものである。
  - 「ヒヤリ時の動画が見られる」: ヒヤリを含む区間ファイルが存在する。
  - 「個別にヒヤリポイントの動画を確認できる」: ヒヤリ 1 件＝1 マーカーとし、連結ファイル内の各ヒヤリ位置へ到達できることで満たす（再生位置の算出方法は未確定）。

#### 書き出し（append-while-open）
1. **区間オープン時**: 区間が開いた時点で `hiyari.NN.webm` を作成し、次の 2 つを書き出す。
   - chunk[0] を先頭から**最初の Cluster ID（`0x1F43B675`）の手前まで**（実測 189 B）に切り詰めたヘッダ
   - リングバッファ上の区間先頭からのクラスタ（オープン時点でスナップショットしたもの）
2. **区間クローズまで**: 以降は区間が閉じるまで、新しいチャンクを受信するごとに、そのチャンクを同じファイルへ append する。連続ヒヤリで終端が延長された場合も、同じファイルへの append を続ける。
3. **区間クローズ時（finalize）**: `finalizeHiyariFile()` で、ファイルの読み戻し、#262 の Timecode 振り直し、Duration の書き戻しを行う。
   - #262 の Timecode 振り直しと Duration の内容は、書き込みキュー導入に際して変更しない。
4. **chunk[0] 切り詰めの範囲**: 書き出し時の chunk[0] 切り詰めは、ファイル出力にのみ適用する。リングバッファ上の chunk[0] の常時保持は変えない。

#### ヒヤリマーカーの動画時刻（`markersVideoTime`）
- `pushBadPoint()` の計算式は変えない。`markersVideoTime` は `startScoreLogic()` 原点（センサー時計）の値のままである。
- 区間ファイルは、ヒヤリ区間だけを切り出したものである。そのため、`markersVideoTime` をそのまま区間ファイルの `currentTime` に使えるとは限らない。
- 区間ファイル内の再生位置をどう求め、[[ui.badspot.page]] へどう渡すかは未確定である（「未確定論点」参照）。

#### 書き込みの直列化（`hiyariWriteQueue`）
ヒヤリ区間ファイルへの書き込みは、`driving.page.ts` の `hiyariWriteQueue` に連結して直列化する。対象は次の 3 つである。

- open 初回の writeFile
- saveVideo の append
- finalizeHiyariFile の読み戻しと書き戻し

区間の選択ロジック、チャンク採用条件、リングバッファ保持時間、#262 の Timecode 振り直しと Duration の内容は、この直列化で変更しない。

1. **キューの定義**
   - DrivingPage に `private hiyariWriteQueue: Promise<void> = Promise.resolve();` を追加する。
   - あわせて `private enqueueHiyariWrite(label: string, task: () => Promise<void>): Promise<void>` を追加する。
   - 中身は `this.hiyariWriteQueue = this.hiyariWriteQueue.then(task).catch(e => this.logService.error('[DrivingScore]hiyari write failed. op=' + label + ' err=' + e)); return this.hiyariWriteQueue;` とする。
   - catch でチェーンを回復させ、1 件の失敗で後続の書き込みを止めない。
2. **区間オープン（`openOrExtendHiyariSegment()`）**
   - 新規区間を開く分岐では、`this.hiyariFileName = name` を立てた直後、await を挟まずに同期的に処理する。
   - まず、区間先頭チャンクの配列をローカル変数へスナップショットする。
   - そのうえで、`enqueueHiyariWrite('open', async () => { const head = await this.extractWebmHeader(); await writeFile(dir, name, <head + スナップショットしたチャンク>); })` を呼ぶ。
   - `extractWebmHeader()` は、必ずタスクの内側で await する。外側で await すると、その間に saveVideo が append を先に積み、順序が逆転するためである。
   - スナップショット以降に届いたチャンクは append 経由でのみ書き、open 側に重複して含めない。
   - 呼び出し側は、戻り値の Promise を await してよい。
3. **追記（`saveVideo()`）**
   - `dataavailable` ごとに、`const name = this.hiyariFileName;` を同期的に取得する。
   - name が null でなければ、`enqueueHiyariWrite('append', () => writeFile(dir, name, chunk, {append: true}))` を呼ぶ。
   - タスク内で `this.hiyariFileName` を再参照しない。区間の切り替え後に別ファイルへ書き込まれるのを防ぐためである。
   - リングバッファへの push はキューを通さず、従来どおり即時に行う。
4. **区間クローズ（`closeHiyariSegment()`）**
   - `finalizeHiyariFile()` を、`enqueueHiyariWrite('finalize', () => <#262 の読み戻し + Timecode 振り直し + Duration 書き戻し>)` として積む。
   - `this.hiyariFileName = null` は、enqueue の直前または直後に同期的に行う。これにより、finalize より後に同じファイルへの append が積まれないようにする。
5. **初期化**: `startVideo()` の冒頭（診断開始時）で、`this.hiyariWriteQueue = Promise.resolve();` に戻す。
6. **ログ**
   - 受入条件の順序検証のため、各タスクの開始時と完了時に `[DrivingScore]hiyari write start|done op=<open|append|finalize> file=<name> seq=<連番>` を debug ログに出す。
   - 既存の `hiyari open. file=... chunks=5` ログは残す。
7. **変更してはいけないもの**: 区間の from / end / 連結条件、チャンク採用条件、リングバッファ保持時間（n+5 秒）、#262 の Timecode 振り直しと Duration の内容、ファイル名規則、書き出しディレクトリ。
8. **この直列化で入れないもの**: 既に壊れたファイルの救済処理と、WebView のログ途絶対策は入れない。
9. **検証**
   - 実機で hiyari_recording シナリオを 2 周以上流す。
   - 生成された全 `hiyari.NN.webm` の先頭 4 バイトが `1A 45 DF A3` であることを確認する。
   - 同一 file について、open の done より前に append の start が無いことをログで確認し、evidence に残す。

#### ストレージ消費の見積もり
- 1 ヒヤリあたり約 315 KB/s × 2n 秒である（n=15 で約 9.4 MB、n=60 で約 37.7 MB）。
- 連続ヒヤリで区間が連結される場合、ファイル長は区間開始から延長後の終端までとなる。重なり部分は 1 ファイルにのみ保存される。

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
  - 改修後は、録画時計でヒヤリ時刻 `tVideo` を取得し、`openOrExtendHiyariSegment()` を呼ぶ。
    - 開いている区間があり、`tVideo` がその終端より前なら、終端を `tVideo + n` へ延長する（同じファイルへ連結）。
    - それ以外なら、新しい区間 [tVideo-n, tVideo+n] を開く。
- 指標が未算出の場合、平均値は 100 として扱われ、満点表示になる（前掲「センサーモードによる差異」「CAN 版ロジックが設定する指標の範囲」参照）。

## `pushBadPoint(score)`（UC08 の起点）
- **動画時刻**: `videoTime = Math.floor(sensorService.getLastSensorTime() / 1000)`（秒）を求める。これは `startScoreLogic()` 原点（センサー時計）の値である。
  - 改修後も、この計算式は変更しない（承認済み決定）。
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
  - リングバッファの切り詰め・チャンク選択・区間判定・ヒヤリ時刻は、録画時計（`Date.now() - videoStartTimestamp`）で扱う。
  - ヒヤリ区間 [t-n, t+n] を `hiyari.NN.webm` として append-while-open で書き出す。ファイル先頭のヘッダは chunk[0] を最初の Cluster ID の手前（189 B）まで切り詰めたものとする。
  - 区間クローズ時に finalize で、#262 の Timecode 振り直しと Duration 書き戻しを行う。
  - 書き込み（open / append / finalize）は 1 本のキューで直列化する。
  - 通し動画は作らない。
- **連続ヒヤリ**
  - 次のヒヤリが現区間の終端より前に発生した場合は、終端を t2+n へ延長して 1 ファイルに連結する。重なりが続く限り延長を繰り返す。
  - ヒヤリ地点は 1 件ずつ別マーカーとする。
- **区間の端の扱い**
  - 前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
  - 診断終了時に未確定の区間があれば、その時点で確定させて書き出す。
  - ヒヤリ 0 件なら、動画ファイルを生成しない。
- **マーカーの動画時刻**: `markersVideoTime` はセンサー時計（`startScoreLogic()` 原点）のまま据え置き、`pushBadPoint()` の計算式は変えない。
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
| 前版方針の扱い | 前版（2026-09-29）は、ヒヤリごとの個別ファイル・複数区間同時オープン、`markersVideoTime` のファイル先頭基準化、Duration 撤回（追記のみ・`currentTime=1e101` で実長確定）、チャンク単位の Timecode 振り直し（末尾 32 B 繰り越し）を採っていた。これらは現時点の承認済み事実台帳に存在せず、台帳は extend-concat・センサー時計据え置き・finalize での書き戻しを承認済みとしている。本版は台帳を正とした。前版方針が別途承認されていたのであれば、事実台帳への登録と本仕様の再改訂が必要である。 | Orchestrator |
| #262 の詳細 | finalize で行う「#262 の Timecode 振り直し」と「Duration 書き戻し」の具体的内容（振り直しの基準・バイト長の扱い・Duration の値の求め方）が、本ノードの事実台帳に記載されていない。 | UI + QA |
| 区間ファイル内の再生位置 | `markersVideoTime` はセンサー時計（`startScoreLogic()` 原点）のままである。一方、区間ファイルは区間先頭から始まり、#262 で Timecode が振り直される。そのため、各ヒヤリを連結ファイル内のどの位置で再生するかの換算方法が未確定である。換算には、区間開始時刻（録画時計）と原点間ギャップが関係する。先方条件「個別にヒヤリポイントの動画を確認できる」の成立に影響する。 | UI + QA |
| 原点間ギャップの扱い | `videoStartTimestamp - startTimestamp` は `logService.debug` で実測し、実測後に改めて判断するとされている。判断結果は未確定である。 | UI |
| ヒヤリ区間ファイルの遷移契約 | 次の点が資料上で明記されていない。<br>・`hiyari.NN.webm` の命名詳細（NN の桁数・起点）<br>・格納先ディレクトリ<br>・マーカーに対応する区間ファイルと再生位置を [[ui.badspot.page]] へ渡す遷移パラメータ（現行は通し動画パスの `@` エスケープ） | UI + Middleware + Infra |
| 設定値 n の既定値と設定 UI | 区間幅 n は設定値である。実測は n=15 / n=60 で行った。既定値、設定画面での入力可否・範囲は未定である。 | UI（設定画面）+ 先方 |
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
  - [[ui.badspot.page]] は、改修後にヒヤリ区間ファイル（連続ヒヤリの場合は連結ファイル）を再生する。
  - 各マーカーのヒヤリ位置へシークする方法（センサー時計の `markersVideoTime` からの換算）は未確定である。
- **2026 年度改修で関連**: [[ui.previousResult.page]]（1-2 前回結果表示）。レーダーチャート仕様と過去平均の定義を共有する。
- **対象外**: 8-1「サービス案表示」（`ui.servicePlan.page`）のノード新設は**取り下げ済み**であり、本改修の対象外（後続検証）とする。

```json
{
  "required_changes": [
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "前版のヒヤリごと個別ファイル・複数区間同時オープン方式を、承認済み事実の extend-concat（重なる連続ヒヤリは1ファイルに連結し終端を t2+n へ延長し続ける）に戻す"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "状態定義の hiyariSegments（区間配列）を単一の hiyariFileName と区間 from/end に戻す"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "markersVideoTime を区間ファイル先頭基準から startScoreLogic 原点（センサー時計）据え置きに戻し、pushBadPoint の計算式を変えない旨を明記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "Duration 撤回・追記のみ・currentTime=1e101 実長確定の記述を削除し、区間クローズ時の finalize で #262 の読み戻し・Timecode 振り直し・Duration 書き戻しを行う方式に改訂"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "hiyariWriteQueue の記述を承認済み事実どおり open/append/finalize の3種・単一 hiyariFileName 前提（closeHiyariSegment で finalize を enqueue し hiyariFileName=null を同期実行）に改訂"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "原点間ギャップを logService.debug で実測し実測後に改めて判断する扱いに戻し、区間ファイル内の再生位置換算に関係する旨を記載"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "ストレージ見積もりを連結方式（重なり部分は1ファイルのみに保存）に改訂し、改訂履歴表と未確定論点（前版方針の扱い・#262 詳細・区間ファイル内再生位置・原点ギャップ）を更新"}
  ],
  "suggested_impacts": [
    {"domain": "Orchestrator", "severity": "must", "reason": "前版仕様が採用していた個別ファイル方式・Duration 撤回・markersVideoTime ファイル先頭基準化が承認済み事実台帳に存在せず、台帳の extend-concat・センサー時計据え置き・finalize 書き戻しと食い違っているため、どちらが正かの確認と台帳整理が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "ui.badspot.page は連結された hiyari.NN.webm 内の各ヒヤリ位置へシークする必要があるが、markersVideoTime がセンサー時計のままのため区間開始時刻と原点ギャップを用いた換算方法と遷移パラメータの定義が必要"},
    {"domain": "QA-agent", "severity": "must", "reason": "全 hiyari.NN.webm の先頭4バイト 1A45DFA3、同一 file で open done 前に append start が無いこと、finalize 後の Timecode/Duration の正しさ、連結ファイル内での各ヒヤリ位置の再生、アプリ内 WebView での実測同等性の検証が必要"},
    {"domain": "Infra-agent", "severity": "should", "reason": "hiyari.NN.webm の命名（NN 桁数・起点）と格納先ディレクトリが未明記で、採取手順と ui.badspot.page からの参照に影響する"},
    {"domain": "UI-agent", "severity": "should", "reason": "区間幅 n が設定値のため設定画面での入力可否・既定値・範囲の定義が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目・1-5段階のスコアと評価コメントを供給する算出責務が未定義で、現行 scoreA/scoreB/scoreC（0-100・3値）と一致しない"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "自車マーカーの進行方向回転は map.service のマーカー描画側で heading を適用する必要があり、現行は heading が渡っても上向き固定"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が3列REAL（0-100）で6項目5段階と不一致、かつ『過去の平均』系列の集計期間定義が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "☆スコア表示削除により ui.comment.page への唯一の導線が失われるため遷移元の再定義が必要"}
  ],
  "requirements_context": "運転診断画面（/driving、画面4-1 走行前 / 4-2 走行中 / 4-3 走行終了、status 0 init / 1 running / 2 finish）は UC06（運転診断の実行）と UC08（ヒヤリ地点確認導線）を担う。『診断開始』でセンサーサービス（sensorService.start/startScoreLogic）、スコアロジックランナー（既定 settings.scoreLogicInterval=300ms）、録画を同時起動し、startVideo 冒頭で hiyariWriteQueue を Promise.resolve() に初期化する。走行中は10ms周期のセンサー統合値を scoreLogic.pushSensorData に流し、Google Map に自車位置・開始/終了マーカー・ヒヤリ地点（1件1マーカー）・走行軌跡を描画。地図ドラッグで追従解除、追従ボタンで復帰。onStop で scoreLogic/sensor/録画を停止し、未確定のヒヤリ区間があればその時点で確定させて書き出す（closeHiyariSegment→finalize）。drawEndMarker と fitBounds、scoreDbService.insertScore をファイア＆フォーゲットで実行、loginService.scoreId に startTimestamp を設定して終了ダイアログを表示し、logService.resetLogDir で debug-log に戻す。アドバイス表示（ui.comment.page）とヒヤリマーカータップ（ui.badspot.page、移行前は videoRecordedPath の '/'→'@' 置換で /bad-spot/:path、改修後は対応区間ファイルと再生位置を渡すが遷移パラメータ未確定）は status===finish のみ有効。センサーデータ null で自動終了。スコア値は直接編集不可。ヒヤリ区間録画の書き出しは画面表示要素を持たず、進捗・完了通知なし、書き込み失敗はログのみ。\n\n【スコア表示の改修（承認済み）】4-1/4-2/4-3 で☆5段階表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合）を削除し、筋力・柔軟性・空間把握・危険予測・視力・視野の6項目・1〜5の5段階（5が良好、3が年齢平均）のレーダーチャートと評価コメントを表示。各項目に『n点（5点満点）』と2行程度のコメント、いらすとやアイコン、『今回』と『過去の平均』の2系列。記録なし時は ui.previousResult.page の未描画ルールと整合させる想定（適用可否未確定）。採点データ形式は先方検討中で未確定、scoreA/B/C（0-100の3値）と不一致で描画実装は供給契約確定まで着手不可。スコアロジックは打ち合わせ後まで凍結。\n\n【移行前スコア表示の実装実態】星/順位（101-score、100上限）。スコアロジック差し替え未実装で常に CAN 版（scoreLogicFunction_simple.txt は未参照）。smartphoneOnly は BLE スキャンなしで接続待ち表示なし、lastCanData ゼロ埋めで全指標100（未算出）表示。CAN 版は score1/score2/overAll/scoreA/scoreB のみ設定し label3/label4 は空で描画。ヒヤリはスコア減点しない。初期 Score(null) 混入で序盤は (評価窓合計+100)/(窓数+1) と高め。\n\n【自車マーカー】進行方向に回転（want、承認済み）。現行は上向き固定で heading は drawCarMarker に渡っているため map.service 側対応が必要（責務要確認）。\n\n【ヒヤリ通知】走行中ヒヤリ検出時に音を鳴らす（承認済み）。契機は score.hiyari===true。音源・音量・サイレント時・デバウンスは未確定。\n\n【ヒヤリ区間録画（承認済み、proposal #227 §4-1 を第1期から実装）】getUserMedia 1280x720+audio、video/webm、ビットレート指定なしで MediaRecorder.start(1000)。通し動画は作らない。チャンクに受信時刻 Date.now()-videoStartTimestamp を付与し、リングバッファ切り詰めと区間選択をチャンク個数から時刻判定へ変更（ずれ1の解消、proposal #227 §2 の chunk[i]≒[i,i+1)秒は誤り）。ヒヤリ時刻 t も録画時計 tVideo=Date.now()-videoStartTimestamp で測り、チャンク選択と区間判定をこの1つの時計で完結。pushBadPoint() は変更せず markersVideoTime は startScoreLogic() 原点（センサー時計）のまま据え置く。原点ギャップ（videoStartTimestamp-startTimestamp）は logService.debug で実測し実測後に改めて判断する。chunk[0] はメモリ上で常時保持し、リングバッファは区間の開閉に関わらず常に直近 n+5秒（＋chunk[0]）に切り詰め、push はキューを通さず即時。区間は [t-n,t+n]、次のヒヤリ t2 が現区間終端より前なら終端を t2+n へ延長して1ファイルに連結し重なりが続く限り延長（extend-concat、proposal #242、第1期実装範囲）。ヒヤリ地点は連結後も1件ずつ別マーカー。n 秒を確保できなければ取得範囲をそのまま保存、診断終了時の未確定区間はその時点で確定、ヒヤリ0件なら動画を生成しない。先方は30秒以内の連続ヒヤリの動画生成方式を実装裁量とし、条件はヒヤリ時の動画が見られることと個別にヒヤリポイントの動画を確認できることの2点。区間オープン時に hiyari.NN.webm を作成し chunk[0] を最初の Cluster ID(0x1F43B675) の手前（実測189B）に切り詰めたヘッダとスナップショットした区間先頭からのクラスタを書き出し、以降区間が閉じるまで新チャンクを同じファイルへ append。リングバッファ上の chunk[0] 常時保持は変えない。区間クローズ時に finalizeHiyariFile で #262 の読み戻し・Timecode 振り直し・Duration 書き戻しを行う。書き込みは hiyariWriteQueue で直列化：enqueueHiyariWrite(label, task) は then(task).catch(logService.error '[DrivingScore]hiyari write failed. op=… err=…') でチェーンを回復、openOrExtendHiyariSegment の新規区間分岐では hiyariFileName=name 直後に await を挟まず同期で区間先頭チャンクをスナップショットし enqueue('open') のタスク内で extractWebmHeader() を await して writeFile、スナップショット以降のチャンクは append のみで重複させない、saveVideo は dataavailable ごとに name=hiyariFileName を同期取得し null でなければ enqueue('append') しタスク内で hiyariFileName を再参照しない、closeHiyariSegment は enqueue('finalize') し hiyariFileName=null を enqueue 直前または直後に同期実行、startVideo 冒頭で Promise.resolve() に初期化、各タスク開始/完了で '[DrivingScore]hiyari write start|done op=<open|append|finalize> file=<name> seq=<連番>' を debug 出力し既存 'hiyari open. file=... chunks=5' ログは残す。変更禁止: 区間の from/end/連結条件、チャンク採用条件、リングバッファ保持時間(n+5秒)、#262 の Timecode 振り直しと Duration の内容、ファイル名規則、書き出しディレクトリ。壊れたファイルの救済と WebView ログ途絶対策は入れない。検証は hiyari_recording シナリオ2周以上で全ファイル先頭4バイト 1A45DFA3 と同一 file で open done 前に append start が無いことをログで確認し evidence に残す。\n\n【実測（SH-M29/Android15/Chrome 153.0.8010.52、アプリ同一条件）】景色撮影時の実効約315KB/s（約2.6Mbps）で下限側の値、暗所60〜108KB/s は代表値でない。リングバッファ保持量 n=15 約6.36MB、n=60 約20.2MB で連結が続いても超えない。ストレージは1ヒヤリ約315KB/s×2n（n=15 約9.4MB、n=60 約37.7MB）。dataavailable 間隔平均1017〜1038ms（最小873/最大1159ms）、chunk[0] 実尺1023〜1104ms。chunk[25] は25515〜26475ms、chunk[30] は30600〜31566ms で番号×1000ms から約2〜6%乖離し n=60 区間端で1.5秒以上の誤差。切り出し先頭0.1秒は暗所で完全な黒（輝度0.0/分散0.0）、景色撮影時は輝度37.3〜74.6/分散2144.4〜3460.1 で正常、黒は暗所かつ録画開始直後が重なる場合のみ。WebView 153.0.8010.36 と Chrome は同一ビルド系列で standalone-probe（proposal #239）を代理としたがアプリ内 WebView 確認は別途必要。\n\n【移行前の録画】start(60000)、movie.webm に初回 writeFile・以降 append、inactive 時に Blob 化して videoRecordedPath 設定、ui.badspot.page は markersVideoTime（センサー時計）で currentTime 追尾。\n\n【ファイル書き出し】ルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/、#79 の externalDataDirectory 案は撤回済み。採取はファイルアプリまたは adb pull。センサログは診断中のみ。追加パーミッションなし、失敗時提示・保持期間は対象外。saveScoreLogic は recording/logStorage/sensorLogStorage のいずれか有効で setLogDir、logStorage||sensorLogStorage で scoreLogicJson.txt/scoreLogic.txt を保存。hiyari.NN.webm の格納先・命名詳細は未明記。CAN データ保存可否は先方宿題。\n\n【改訂経緯】前版（2026-09-29）は個別ファイル・複数区間同時オープン・markersVideoTime ファイル先頭基準・Duration 撤回（currentTime=1e101 で実長確定）・チャンク単位 Timecode 振り直しを採っていたが、承認済み事実台帳に対応事実が無く、台帳は extend-concat・センサー時計据え置き・finalize 書き戻しを承認済みとしているため、本版は台帳を正として改訂した。\n\n【画面挙動・全体文脈】unlock で縦横自由、回転時 CSS 切替、Insomnia でスリープ抑止。縦横要求は他画面が対象。2026年度改修は日産『一次仕様』2026-08-04 とメイサンソフト『要求仕様確認』2026-09-17 に基づく5本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE安定化 ⑤録画データサイズ改善）で本画面は③⑤。8-1 サービス案表示ノード新設は取り下げ済み。BLE パラレル処理化は仮説、テスト用ナビ端末の提供時期未定。2026年11月末完了、12月高齢者実験開始。",
  "fact_candidates": [
    {"type": "business_rule", "title": "重なる連続ヒヤリは1ファイルに連結される", "statement": "改修後の運転診断画面では、次のヒヤリが現区間の終端より前に発生した場合、終端を t2+n へ延長して同じ hiyari.NN.webm に連結する", "status": "approved"},
    {"type": "display_rule", "title": "連結区間でもヒヤリマーカーは1件ずつ描画される", "statement": "連続ヒヤリで録画区間が1ファイルに連結されても、地図上のヒヤリ地点マーカーは1件ずつ別に描画される", "status": "approved"},
    {"type": "business_rule", "title": "区間判定とヒヤリ時刻は録画時計で扱う", "statement": "リングバッファの切り詰め・チャンク選択・区間判定・ヒヤリ時刻は tVideo=Date.now()-videoStartTimestamp の録画時計で扱う", "status": "approved"},
    {"type": "data_semantics", "title": "markersVideoTime はセンサー時計のまま据え置く", "statement": "改修後も pushBadPoint() の計算式は変えず、markersVideoTime は startScoreLogic() 原点のセンサー時計の秒数とする", "status": "approved"},
    {"type": "business_rule", "title": "区間クローズ時に finalize で Timecode 振り直しと Duration 書き戻しを行う", "statement": "区間クローズ時に finalizeHiyariFile で区間ファイルを読み戻し、#262 の Timecode 振り直しと Duration 書き戻しを行う", "status": "approved"},
    {"type": "constraint", "title": "区間ファイルへの書き込みは1本のキューで直列化する", "statement": "区間ファイルへの open・append・finalize は hiyariWriteQueue に連結して直列化し、1件の失敗で後続を止めない", "status": "approved"},
    {"type": "constraint", "title": "区間クローズ後に同じファイルへ append を積まない", "statement": "closeHiyariSegment で finalize を enqueue する直前または直後に hiyariFileName=null を同期的に設定する", "status": "approved"},
    {"type": "qa_expectation", "title": "全区間ファイルの先頭4バイトは 1A 45 DF A3", "statement": "hiyari_recording シナリオを2周以上流し、生成された全 hiyari.NN.webm の先頭4バイトが 1A 45 DF A3 であることを確認する", "status": "approved"},
    {"type": "qa_expectation", "title": "同一ファイルで open 完了前に append が始まらない", "statement": "同一 file について open の done より前に append の start が無いことを debug ログで確認し evidence に残す", "status": "approved"},
    {"type": "business_rule", "title": "リングバッファは常に直近 n+5 秒と chunk[0] を保持する", "statement": "リングバッファは区間の開閉に関わらず常に直近 n+5 秒分に chunk[0] を加えた範囲へチャンク受信時刻で判定して切り詰める", "status": "approved"},
    {"type": "business_rule", "title": "区間ファイルのヘッダは chunk[0] を189Bに切り詰めたもの", "statement": "区間ファイル書き出し時に chunk[0] を先頭から最初の Cluster ID(0x1F43B675) の手前まで（実測189B）に切り詰めてヘッダとし、リングバッファ上の chunk[0] 保持は変えない", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ0件なら動画ファイルは生成されない", "statement": "走行中にヒヤリが1件も検出されなかった場合、動画ファイルは生成されない", "status": "approved"},
    {"type": "business_rule", "title": "診断終了時の未確定区間はその時点で確定される", "statement": "診断終了操作の時点で未確定のヒヤリ区間があれば、その時点で確定させて書き出す", "status": "approved"},
    {"type": "data_semantics", "title": "連結区間では重なり部分は1ファイルにのみ保存される", "statement": "extend-concat 方式では区間の重なり部分は連結後の1ファイルにのみ保存され、ファイル長は区間開始から延長後終端までとなる", "status": "candidate"},
    {"type": "display_rule", "title": "運転診断画面の☆スコア表示をレーダーチャートに置き換える", "statement": "4-1/4-2/4-3 で☆5段階表示を削除し、6項目1〜5段階のレーダーチャートと評価コメント（今回・過去の平均の2系列）を表示する", "status": "approved"},
    {"type": "display_rule", "title": "自車マーカーの矢印を進行方向に向ける", "statement": "地図上の自車マーカーの矢印を進行方向に合わせて回転させる（現行は上向き固定、優先度 want）", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリポイント検出時に音を鳴らす", "statement": "走行中にヒヤリポイントを検出した時点で音を鳴らして運転者に知らせる", "status": "approved"},
    {"type": "state_rule", "title": "ヒヤリマーカーのタップとアドバイス表示は診断終了後のみ有効", "statement": "ヒヤリマーカーのタップと『アドバイス表示』への遷移は status が finish のときのみ受け付けられる", "status": "candidate"},
    {"type": "input_rule", "title": "スコア値は画面上で直接編集できない", "statement": "利用者は運転診断画面上でスコア値を直接入力・編集できない", "status": "candidate"},
    {"type": "open_question", "title": "連結ファイル内での各ヒヤリの再生位置の求め方が未確定", "statement": "markersVideoTime がセンサー時計のまま、区間ファイルは区間先頭から始まり #262 で Timecode が振り直されるため、各ヒヤリの再生位置の換算方法が未確定", "status": "open_question"}
  ],
  "open_questions": [
    "前版仕様（2026-09-29）が採用していたヒヤリごと個別ファイル・複数区間同時オープン・markersVideoTime ファイル先頭基準化・Duration 撤回（currentTime=1e101 で実長確定）・チャンク単位 Timecode 振り直しは、現時点の承認済み事実台帳に存在しない。台帳は extend-concat・センサー時計据え置き・finalize 書き戻しを承認済みとしており、本版は台帳を正とした。前版方針が別途承認されていたなら事実登録と再改訂が必要で、Orchestrator 判断が必要。放置すると ui.badspot.page・QA 仕様の前提が割れる。",
    "連結された区間ファイル内で各ヒヤリをどの位置で再生するかの換算方法が未確定。markersVideoTime はセンサー時計のまま、区間ファイルは区間先頭から始まり #262 で Timecode が振り直されるため、区間開始時刻（録画時計）と原点ギャップを用いた換算が必要。UI+QA 判断が必要で、決まらないと先方条件『個別にヒヤリポイントの動画を確認できる』が満たせない。",
    "原点ギャップ（videoStartTimestamp-startTimestamp）は logService.debug で実測後に改めて判断するとされており、判断結果が未確定。UI 判断が必要で、再生位置換算の精度に影響する。",
    "finalize で行う #262 の Timecode 振り直しと Duration 書き戻しの具体的内容（振り直し基準・バイト長の扱い・Duration 値の求め方）が本ノードの事実台帳に記載されていない。UI+QA 確認が必要で、決まらないと再生時の実長・シーク挙動を検証できない。",
    "hiyari.NN.webm の格納先ディレクトリと命名詳細（NN の桁数・起点）が資料上で明記されていない。Infra/UI 判断が必要で、決まらないと ui.badspot.page からの参照と採取手順を確定できない。",
    "マーカーに対応する区間ファイルと再生位置を ui.badspot.page へ渡す遷移パラメータ（現行は通し動画パスの @ エスケープ）が未確定。UI+Middleware 判断が必要で、決まらないと UC08 が成立しない。",
    "設定値 n の既定値と設定画面での入力可否・範囲が未確定（実測は n=15/n=60、先方例示は15秒）。UI（設定画面）+先方判断が必要。",
    "実測はアプリ外の端末 Chrome で行われ、アプリ内 Capacitor WebView での同等性確認が未実施。QA 判断が必要で、決まらないとビットレート・ストレージ見積もりの妥当性が確定しない。",
    "6項目5段階の採点データ形式が先方検討中で未確定、scoreA/scoreB/scoreC と不一致。Middleware/DB 判断が必要でレーダーチャート描画実装に着手できない。",
    "レーダーチャートを 4-1/4-2/4-3 のどこで表示し走行中にリアルタイム更新するかが未確定。UI+先方判断が必要。",
    "☆スコア表示削除後の ui.comment.page への導線が未確定（先方は『レーダーチャートを押すと5-1に遷移』とも記載）。UI+先方判断が必要で、決まらないとアドバイス表示が到達不能になる。",
    "『過去の平均』系列の集計期間（capability_score_target_days 既定30日の流用可否）と、記録なし時の未描画ルールの本画面への適用可否が未確定。DB+UI 判断が必要。",
    "自車マーカー回転を map.service 側で適用するかの責務所在が未確定。Middleware 判断が必要。",
    "ヒヤリ検出音の音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未確定。UI 判断（アセットは Infra）が必要で、決まらないと運転妨害または聞こえないリスクが残る。",
    "smartphoneOnly で全指標100（未算出）となる状態を『未算出』と明示するか、空ラベル指標欄を非表示にするかが未確定。UI 判断が必要。",
    "insertScore が await されないため終了直後のアドバイス表示遷移で保存未完了となりうるかが未確定。DB/Middleware 確認が必要。",
    "タブ切り替えに本画面が含まれるかが未確定。UI+先方判断が必要。",
    "CAN データを確認用に保存できるかが先方の宿題として未確定。"
  ],
  "rationale_notes": [
    "compose 指示は『facts と既存 md が矛盾する場合は facts を真とする』である。今回注入された承認済み事実（ノード事実・共通事実）には、個別ファイル方式・Duration 撤回・markersVideoTime ファイル先頭基準化に相当する事実が存在しない。一方で extend-concat（複数の承認済み事実で重複確認）、markersVideoTime のセンサー時計据え置き、finalize での #262 読み戻し・Timecode 振り直し・Duration 書き戻しを含む書き込みキューは承認済みである。そのため前版の方針を差し戻した。",
    "前版で方針を切り替えた経緯を失わないよう、仕様本文に『改訂履歴』表と未確定論点『前版方針の扱い』を残した。前版方針が別途承認済みだった場合に、Orchestrator が再改訂を判断できるようにするためである。",
    "書き込みキューの承認済み事実は、単一の hiyariFileName と open/append/finalize の3種を前提としており、extend-concat（同時に開く区間は高々1）と整合する。そのため事実の手順をほぼそのまま本文に反映した。",
    "録画時計による区間判定と、センサー時計の markersVideoTime は、承認済み事実上で両立している。ただし区間ファイル内の再生位置を求めるには両時計の対応付けが必要になる。この点を『原点ギャップは実測後に判断』の事実と結び付けて未確定論点に置いた。",
    "#262 の具体的な振り直し内容は今回の事実台帳に記述がない。前版の t0 基準・同バイト長・末尾32B繰り越しの記述は、個別ファイル方式のチャンク単位振り直しと一体だった。そのため断定を避け、finalize で #262 を適用するという粒度に留めた。",
    "スコア表示・自車マーカー・検出音・書き出しルート・スコアロジック凍結・縦横・実測値に関する既存記述と判断理由は、事実と矛盾しないため維持した。"
  ]
}
```