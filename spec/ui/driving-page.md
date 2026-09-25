<!-- 作成: 2026-09-18 18:35:02 JST | 更新: 2026-09-25 11:05:25 JST -->

# ui.driving.page — 運転診断画面 (画面4-1〜4-3)

## 概要
リアルタイム運転診断画面。センサーサービスから 10ms 周期でセンサー統合値を受け取り、ScoreLogic を `settings.scoreLogicInterval`（既定 300ms）で実行して、診断結果を画面に表示する。Google Map 上には、自車位置、開始・終了マーカー、ヒヤリ地点、走行軌跡を描画する。

録画は MediaRecorder で行う。

- **移行前（現行実装）**: 60 秒チャンクの video/webm を走行ディレクトリの `movie.webm` に追記保存する（通し動画）。
- **改修後（承認済み）**: 1 秒タイムスライスで録画し、リングバッファに保持する。ヒヤリ検出時は前後 n 秒の区間だけを `hiyari.NN.webm` として書き出す。通し動画は作らない（「動画」節参照）。

走行を終了すると結果が SQLite（`scoreDbService.insertScore`）に保存される。終了後は次の導線が開く。

- 終了ダイアログの「アドバイス表示」→ [[ui.comment.page]]
- 地図上のヒヤリマーカー → ヒヤリ地点詳細（[[ui.badspot.page]]）

走行中にヒヤリポイントが検出された時点で、本画面は**音を鳴らして利用者に通知する**（2026 年度改修要求に基づく承認済みルール）。

> **2026 年度改修に関する注記**
> - **改修要求の出所**: 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 と、メイサンソフト『要求仕様確認』2026-09-17 に基づく。
> - **改修要求（5 本）**: ①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE 通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善。本画面は主に ③ と ⑤ の影響を受ける。
> - **確定済みの方針**:
>   - スコア表示の方針（☆表示の廃止とレーダーチャートへの置換）は承認済みの設計決定である。
>   - ヒヤリ区間録画の方式（リングバッファ＋append-while-open、区間定義、連続ヒヤリの連結）も承認済みの設計決定である。
> - **未確定の事項**: 採点データ形式、アドバイス画面への導線、ヒヤリ区間ファイルの再生方式などは未確定であり、「未確定論点（2026 年度改修）」節に集約する。
> - **移行前後の記述の区別**: `## 現行実装のスコア表示（移行前）` と `### 現行実装の録画（移行前）` は**移行前の実装実態**を記述したものである。改修完了後は、それぞれ `## スコア表示（改修後の確定方針）` と `### 改修後の確定方針（ヒヤリ区間録画）` に置き換わる。
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
videoChunks: Blob[]                // 移行前: 60 秒毎の webm チャンク / 改修後: 1 秒タイムスライスのリングバッファ（chunk[0] 常時保持＋直近 n+5 秒）
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
- ヒヤリ区間録画の書き出しは画面上に表示要素を持たない。進捗表示や保存完了通知は現行仕様に存在しない。

## スコア表示（改修後の確定方針）
承認済みの設計決定として、走行前（4-1）/ 走行中（4-2）/ 走行終了（4-3）の各状態で次のとおり置き換える。

- **削除するもの**: 従来の☆5 段階によるスコア表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合スコア）。
- **表示するもの**: 6 項目のレーダーチャートと評価コメント。

レーダーチャートの仕様は次のとおり。

- 項目は **筋力・柔軟性・空間把握・危険予測・視力・視野** の 6 項目。
- 各項目の尺度は **1〜5 の 5 段階**（5 に近いほど良好、3 が年齢の平均）。
- 各項目に「**n 点（5 点満点）**」と **2 行程度の評価コメント**を併記する。
- チャートは「**今回**」と「**過去の平均**」の **2 系列**を図示する。
- 各項目に添えるアイコンは**いらすとや**の素材を使用する。
- 過去の記録が存在しない場合の「過去の平均」系列の扱いは、[[ui.previousResult.page]]（1-2 前回結果表示）の「記録が無ければ線を描画しない」ルールと整合させる想定である（本画面での適用可否は未確定）。

> **描画実装の着手条件**
> - 採点データ形式（スコア値および評価メッセージの受け取り方）は先方検討中であり、未確定である。
> - 現行の `scoreA / scoreB / scoreC`（0〜100 の 3 値）とは、項目数も尺度も一致しない。
> - そのため、Middleware / DB 側の供給契約が確定するまで、本画面の描画実装には着手できない。
> - スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は、打ち合わせ後まで**変更しない**凍結状態にある。本画面はその出力をそのまま表示する責務に留まる。

## 現行実装のスコア表示（移行前）
改修完了までの現行挙動として、総合と 4 指標を星または順位（`101-score`）で表示する。

- `scoreLogic` の走行内平均を `Math.round` する。`scoreShowStarArea1/2` に応じて、`getRank(=101 - Math.round(score); 100 上限)` による順位表記に切り替える。
- `label1..4` は `scoreLogicJson.settings.label` から取得し、指標名として描画する。

### センサーモードによる差異（UI 表示上の注意点／実装実態）
- **CAN アダプタ接続待ちは発生しない**: `smartphoneOnly` モードでは BLE スキャンを行わない（[[middleware.sensor.service]] がスキップする）。したがって、診断開始時に CAN アダプタ接続待ちの表示・待機は発生しない。
- **全指標が「未算出」の 100 で表示される**: `smartphoneOnly` 実行時の挙動は次の順に連鎖する。
  1. `sensor.service.ts` が `lastCanData` をゼロ埋めする（`shiftIndication=0` 等）。
  2. その結果、CAN 版スコアロジック（`scoreLogicFunction.txt`）の全指標が発火せず、`scoreList` が空になる。
  3. **総合および 4 指標がいずれも「未算出」として 100 で表示される**（星表示なら満点、順位表示なら 1 位相当）。

  これは現行実装の実態であり、本画面のスコア表示はこの値をそのまま描画する。本項は実装実態の記載であり、是正の是非・切替実装の有無については本仕様では規定しない。
- **スコアロジックの差し替えは未実装**: `opening.page.ts` は常に `assets/data/scoreLogicFunction.txt` を取得し、`scoreLogicFunction_simple.txt` はどこからも参照されない。したがって本画面が表示するスコアは、モードに関わらず常に CAN 版ロジックの算出結果である。

### CAN 版ロジックが設定する指標の範囲（実装実態）
- CAN 版ロジックが実際に値を設定するのは `score1` / `score2` / `overAll` / `scoreA` / `scoreB` のみである。`score3` / `score4` / `scoreC` は未設定である。
  - このため `label3` / `label4` が空文字となる（[[infra.assets.scoreLogicJson]] の `settings.label` と対応）。本画面は空ラベルの指標欄をそのまま描画する。
- ヒヤリ判定は `result.hiyari=true` とメッセージの設定のみを行い、**スコア値を減点しない**。
  - 本画面のスコア表示はヒヤリ発生によって変化しない。変化するのは、ヒヤリマーカー、メッセージ、検出音、ヒヤリ区間録画である。
- `scoreLogic` の平均には、開始直後に積まれる初期値 `Score(null)`（各指標 100）が 1 件混入する。
  - このため走行序盤の表示は実測値より高めに出る（`(評価窓合計 + 100) / (窓数 + 1)`）。
  - これも実装実態であり、本画面は受け取った平均値をそのまま表示する。

## 書き出しルート（保存先）
ログ・センサログ・動画（webm）の書き出しルートは次のとおりとする。

`{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/`

- `debug-log/`: デバッグログ出力先（既定のログディレクトリ）。
- `data.YYYYMMDD-HHMMSS/`: 1 走行分の成果物（`scoreLogicJson.txt` / `scoreLogic.txt` / センサログ / 動画）。
  - 移行前の動画は `movie.webm`（通し動画）。
  - 改修後の動画は `hiyari.NN.webm`（ヒヤリ区間ごと）。改修後の格納先ディレクトリは本資料で明記されておらず、走行ディレクトリ配下を想定している（「未確定論点」参照）。

保存に関する規定は次のとおり。

- **撤回済みの案**: `#79` で検討された `{externalDataDirectory}/driving-score/...` 案は撤回済みである。本画面の保存先は上記 `Documents` 配下とする。
- **採取手段**: ファイルアプリ、または `adb pull /sdcard/Documents/driving-score/...` を正とする。
- **センサログの保存期間**: 診断中（`status === running`）のみ保存する。診断開始前・終了後にセンサログは書き出されない。
- **パーミッション**: 追加パーミッションは要求しない。
- **対象外**: 書き出し失敗時のユーザー提示と保持期間管理は、本仕様の対象外とする。
- **CAN データの保存**: 確認用に保存するか否かは先方の宿題として未確定である（「未確定論点」参照）。

## ライフサイクル
- **constructor**: `initialize()` を await せずに起動する。処理内容は `loginService.initialize()`、label 反映、`logService.initialize`、`new ScoreLogic`、`DemoData.initialize`。
- **`ngOnInit()`**: `changeOrientation()` を実行し、`scoreShowStar` を settings から反映する。
- **`ionViewWillEnter()`**: `screenOrientation.unlock()` で縦横自由にする。`onChange().subscribe` により、回転時に `changeOrientation()` を再実行する。
- **`ionViewDidEnter()`**: `loadVideo()`、`sensorService.start()`、`mapService.loadGoogleInstance(loadMap)`、`insomnia.keepAwake()` を実行する。
- **`ionViewWillLeave()`**: `sensorService.stop()`、`scoreLogic.stop()`、`mapService.stop()`、`stopVideo()`、`insomnia.allowSleepAgain()` を実行する。

## `changeOrientation()`
- `screenOrientation.type` に `'landscape'` が含まれるかどうかで縦横を判定する。非 Android では `platform.width() > platform.height()` で代替判定する。
- CSS クラス名を `header_portrait/landscape` などの組でスワップする。
- 本画面は現行実装で既に縦横自由（`unlock`）であり、2026 年度の「縦横変更できるようにしてください」要求とは衝突しない。衝突するのは縦固定を掛けている他画面（履歴・アドバイス等）であり、本ノードの対象外である。

## `loadMap()`
- 初期中心が未取得なら、`sensorService.getLastLatLng()` で確定する（取得できない場合は横浜にフォールバックする）。
- `mapService.createMap(mapElement, lastLatLng, 16)` と `drawCarMarker(lastLatLng, 0)` を実行する。
- `status === finish` なら `fitBounds()` を実行する。
- `drag` リスナで `autoScrollLock=true`（自車位置追従 OFF）にする。
- `mark` リスナは、`status === finish` のときのみ次を行う。
  1. `mapService.setSelectMarkerPos(pos)` を実行する。
  2. `videoRecordedPath` の `/` を `@` に置換し、`/bad-spot/<encoded>` に `navCtrl.navigateForward` する（移行前の遷移契約。改修後の遷移パラメータは未確定）。

## 診断開始 `onStart()`（UC06）
1. `saveScoreLogic()` を実行する。ログ・センサログ・録画のいずれかが ON なら `data.YYYYMMDD-HHMMSS` ディレクトリを作成し、scoreLogicJson / scoreLogic をスナップショット保存する。
2. `sensorService.startScoreLogic()` を実行する（`SensorManager.initializeCalibration()`、`DemoData.reset()`）。
3. `status=running`、`autoScrollLock=false` とし、`mapService.clearMarker()`、`setZoom(16)`、`setCenter(lastLatLng)` を実行する。
4. `lastLatLng = await sensorService.getLastLatLng()` で実センサーの最新座標を取得し、`drawStartMarker(lastLatLng)` を実行する。
5. `scoreLogic.clearAll()` の後、`scoreLogic.start(interval, cb)`（既定 300ms）を実行する。cb は `checkScoreLogic(score)`。
6. `startVideo()` を実行する。

センサーサービス・スコアロジックランナー・録画の 3 系統が、この操作で同時に起動する。スコアロジックの時刻原点（`startScoreLogic()`）と録画の時刻原点（`videoStartTimestamp`）は別であり、その扱いは「動画」節を参照する。

## 診断終了 `onStop()`
1. `status=finish` とし、`scoreLogic.stop()`、`sensorService.stopScoreLogic()`、`stopVideo()` を実行する。
   - 改修後は、この時点で未確定のヒヤリ区間があれば確定させて書き出す（「動画」節参照）。
2. `mapService.drawEndMarker(lastLatLng)` と `fitBounds()` を実行する。
3. `scoreDbService.insertScore(scoreLogic)` を呼び出す。await せずファイア＆フォーゲットで、走行結果が SQLite に保存される。
4. `loginService.scoreId = scoreLogic.startTimestamp` を設定する（後続のアドバイス表示・履歴が参照する走行 ID）。
5. 終了ダイアログを表示する。ダイアログからの導線は次のとおり。
   - 「アドバイス表示」→ [[ui.comment.page]]（`onScore()` と同等の遷移）
   - ダイアログを閉じた後、地図上のヒヤリマーカーをタップ → [[ui.badspot.page]]（UC08）
6. `logService.resetLogDir()` を実行し、ログパスを既定の `debug-log` に戻す。
7. センサログの書き出しは本操作で停止する（診断中のみ保存）。

## その他のイベント
- `onHistory()`: `/history` に遷移する。
- `onScore()`: `status=finish` のときのみ `/comment` に遷移する。
- `onPointer()`: `autoScrollLock=false` にする。`finish` なら `fitBounds` を、実行中なら `setZoom(16) + setCenter(lastLatLng)` を実行する。

## ヒヤリ検出時の通知（音）
- 走行中（`status === running`）にヒヤリポイントを検出した時点で音を鳴らし、運転者に知らせる。
- 発音契機は、ヒヤリ判定が成立したタイミングと一致する（`score.hiyari === true`、`pushBadPoint()` の起点）。
- 次の事項は未確定である（「未確定論点」参照）。
  - 音の種類・音量
  - 端末のサイレント/メディア音量との関係
  - 連続ヒヤリ時の再発音抑制（デバウンス）
- 連続ヒヤリで録画区間が 1 ファイルに連結される場合でも、ヒヤリ地点は 1 件ずつ記録される。ただし、音を 1 件ずつ鳴らすかどうかは録画側のルールからは導かれない。

## 地図表示
- 描画要素は、自車位置マーカー、開始マーカー、終了マーカー、ヒヤリ地点マーカー、走行軌跡である。
- 利用者が地図をドラッグすると、自車位置追従が解除される（`autoScrollLock=true`）。追従ボタン（`onPointer()`）で復帰する。
- ヒヤリ地点マーカーは、ヒヤリ 1 件につき 1 つ描画する。連続ヒヤリで録画ファイルが連結される場合も、マーカーはまとめない。
- **自車マーカーの向き（優先度 want / 承認済み）**: 地図上の自車マーカーの矢印を**進行方向に合わせて回転**させる。現行は上向き固定であり、改修対象である。
  - `driving.page.ts` は `mapService.drawCarMarker(lastLatLng, heading)` として heading を渡しているが、表示上は上向き固定のままである。
  - したがって回転の適用は [[middleware.map.service]] 側のマーカー描画で対応する必要がある（責務の所在は要確認）。

## 動画

### 改修後の確定方針（ヒヤリ区間録画・append-while-open）
承認済みの設計決定として、proposal #227 §4-1 を**第 1 期から実装する**。**通し動画は作らない。**

#### 録画条件
- `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` と `new MediaRecorder(stream, { mimeType: 'video/webm' })`（ビットレート指定なし）は現行と同一とする。
- `mediaRecorder.start(1000)`（1 秒タイムスライス）で録画する。

#### チャンクの時刻管理（ずれ 1 の解消）
- **受信時刻の付与**: 各チャンクには受信時刻 `Date.now() - videoStartTimestamp` を付与して管理する。
- **時刻判定への変更**: リングバッファの切り詰めと区間選択は、**チャンク個数ではなくこの受信時刻で判定する。**
  - 根拠: `start(1000)` でも `dataavailable` 間隔は非固定であり、チャンク番号は秒数と一致しない（下記「実測値」参照）。
  - proposal #227 §2 の「chunk[i] はおおむね [i, i+1) 秒を担う」は誤りである。
- **変更しないもの**: `pushBadPoint()` は変更しない。ヒヤリマーカーの動画時刻（`markersVideoTime`）は、従来どおり `startScoreLogic()` を原点とする。
- **原点間ギャップの扱い**: スコアロジック原点と録画原点のギャップ（`videoStartTimestamp - startTimestamp`）は、`logService.debug` で実測する。補正の要否は実測後に改めて判断する。

#### リングバッファ
- **chunk[0] の常時保持**: chunk[0]（WebM ヘッダを含む先頭チャンク）はメモリ上で常時保持する。
- **切り詰め**: リングバッファは、区間が開いているかどうかに関わらず、常に**直近 n+5 秒分（＋chunk[0]）**に切り詰める。
- **保持量の上限**: リングバッファ保持量は n=15 で約 6.36 MB、n=60 で約 20.2 MB である。append-while-open により連結が続いても、この上限を超えない。

#### ヒヤリ区間の定義
- **区間**: ヒヤリ検知時刻 t、設定値 n に対し、切り出し区間は **[t-n, t+n]** とする。
  - 先方要求の例示は前後 15 秒である。n の既定値と設定 UI は「未確定論点」参照。
- **連続ヒヤリの連結**: 次のヒヤリ t2 が現区間の終端より前に発生した場合は、終端を **t2+n へ延長**して 1 ファイルに連結する。重なりが続く限り延長を繰り返す。
- **マーカー**: ヒヤリ地点は 1 件ずつ別マーカーとして記録する。
- **尺不足**: 走行開始直後・終了直前で前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
- **診断終了時**: 未確定の区間があれば、その時点で確定させて書き出す。
- **ヒヤリ 0 件**: 動画ファイルは生成しない。
- **先方要求との関係**: 本方式は、先方の「連続ヒヤリ時は 1 本継続でも個別生成でもよい（実装しやすい方式を選んでよい）」の範囲内で、**連結方式**を選択したものである。先方要求の 2 条件のうち、「ヒヤリ時の動画が見られる」はヒヤリごとに区間ファイルが存在することで満たす。「個別にヒヤリポイントの動画を確認できる」は、ヒヤリごとの別マーカーと区間ファイル内の位置で満たす想定である。後者の再生側の実現方式は [[ui.badspot.page]] 側で未確定である。

#### 書き出し（append-while-open）
1. **区間オープン時の書き出し**: 区間が開いた時点で `hiyari.NN.webm` を作成し、次の 2 つを書き出す。
   - chunk[0] を先頭から**最初の Cluster ID（`0x1F43B675`）の手前まで**（実測 189 B）に切り詰めたヘッダ
   - リングバッファ上の区間先頭からのクラスタ
2. **区間クローズまでの追記**: 以降は区間が閉じるまで、新しいチャンクを受信するごとに同じファイルへ append する。
3. **切り詰めの適用範囲**: 書き出し時の chunk[0] 切り詰めはファイル出力にのみ適用する。リングバッファ上の chunk[0] の常時保持は変えない。

#### ストレージ消費の見積もり
- 1 ヒヤリあたり約 315 KB/s × 2n 秒である（n=15 で約 9.4 MB、n=60 で約 37.7 MB）。
- 連結で区間が延長された場合は、延長分だけ増える。

#### 実測値と注意点
- **計測条件**: SH-M29 / Android 15 / Chrome 153.0.8010.52 で、アプリと同一条件（1280x720+audio、video/webm、ビットレート指定なし、`start(1000)`）により計測した。
- **実効ビットレート**:
  - 景色撮影時は約 315 KB/s（約 2.6 Mbps）である。実走行ではこれを下限側の値として扱う。
  - 暗所の 60〜108 KB/s は代表値ではない。
- **チャンク間隔**:
  - `dataavailable` の間隔は平均 1017〜1038 ms（最小 873 / 最大 1159 ms）である。
  - chunk[0] の実尺は 1023〜1104 ms と可変である。
- **チャンク番号と実時間の乖離**:
  - Cluster Timecode の実測では、chunk[25] が 25515〜26475 ms、chunk[30] が 30600〜31566 ms であった。
  - チャンク番号 × 1000 ms から約 2〜6% 乖離し、n=60 の区間端では 1.5 秒以上の誤差になる。
- **先頭フレーム**: 切り出しファイルの先頭フレームは必ずしも黒くない。
  - 暗い被写体では、0.1 秒地点が完全な黒（輝度平均 0.0 / 分散 0.0）だった。
  - 景色撮影時は輝度平均 37.3〜74.6 / 分散 2144.4〜3460.1 で、正常に描画された。
  - 黒くなるのは、暗所かつ録画開始直後のセンサー立ち上がりが重なった場合のみである。
- **計測環境の位置づけ**:
  - 上記は端末 Chrome での standalone-probe 計測（proposal #239）である。
  - SH-M29 の WebView（153.0.8010.36）と Chrome（153.0.8010.52）は同一ビルド系列のパッチ違いであるため、Capacitor WebView の代理とした。
  - ただし同一プロセスではないため、アプリ内 WebView での確認は別途必要である。

### 現行実装の録画（移行前）
- **`loadVideo()`**:
  - 非 Android は、`DemoData.movieFile` があれば `URL.createObjectURL()` の結果を videoRecordedPath に設定する。
  - Android は `getUserMedia({ video: {facingMode:'environment', width:1280, height:720}, audio:true })` の後、`new MediaRecorder(stream, { mimeType: 'video/webm' })` を生成し、`dataavailable` イベントで `saveVideo()` を呼ぶ。
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
- **ヒヤリ地点詳細との連携**: [[ui.badspot.page]] は、この通し動画を `markersVideoTime` による `currentTime` 追尾で再生する。

## `updateSensor(sensorData, updateMap)`
- `sensorData === null` の場合: センサー異常が発生したものとして `onStop()` を実行する。
- `updateMap === false` の場合: `scoreLogic.pushSensorData(sensorData)` を実行する（診断ロジックへ流す）。
- `updateMap === true` の場合:
  - `lastLatLng = new google.maps.LatLng(lat, lng)` を設定する。
  - `status==running` なら `drawCircleMarker(lastLatLng)` を実行する。
  - `autoScrollLock` が false かつ `status != finish` なら `setCenter(lastLatLng)` を実行する。
  - `drawCarMarker(lastLatLng, heading)` を実行する。

## `checkScoreLogic(score)`
- `scoreLogic` の走行内平均を `Math.round` する。`scoreShowStarArea1/2` に応じて、`getRank(=101 - Math.round(score); 100 上限)` による順位表記に切り替える（移行前の表示方式）。
- `score.hiyari` が真なら、次を行う。
  - `pushBadPoint(score)` を実行する。
  - 検出音を鳴らす。
  - 改修後は、ヒヤリ区間の開始または終端延長を行う（`pushBadPoint()` 自体は変更しない）。
- 指標が未算出の場合、平均値は 100 として扱われ、満点表示になる（前掲「センサーモードによる差異」「CAN 版ロジックが設定する指標の範囲」参照）。

## `pushBadPoint(score)`（UC08 の起点）
- 本関数は改修後も変更しない。
- `videoTime = Math.floor(sensorService.getLastSensorTime() / 1000)`（秒）を求める。これは `startScoreLogic()` 原点の `markersVideoTime` である。
- 各 message を、`type != 'positive'` かつ `key === 'score1..4'` の 4 種に振り分ける。`%COUNT` を `'1'` に、`%INTERSECTION` を `message.intersection` に置換する。
- `mapService.drawMarker(latLng, time文字列, videoTime, { msg1, msg2, msg3, msg4 })` を実行する。

## `saveScoreLogic()`
- 非 Android は no-op。
- `recording || logStorage || sensorLogStorage` のいずれかが有効なら、`logService.setLogDir('data.YYYYMMDD-HHMMSS')` を呼ぶ。あわせて `{externalRootDirectory}/Documents/driving-score/data.YYYYMMDD-HHMMSS/` を `saveDirectoryPath` に反映する。
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
  - リングバッファには chunk[0] を常時保持し、常に直近 n+5 秒に切り詰める（切り詰めはチャンク受信時刻で判定する）。
  - ヒヤリ区間 [t-n, t+n] を `hiyari.NN.webm` として append-while-open で書き出す。
  - 通し動画は作らない。
- **連続ヒヤリ**
  - 区間が重なる場合は、終端を t2+n へ延長して 1 ファイルに連結する。
  - ヒヤリ地点は 1 件ずつ別マーカーとする。
- **区間の端の扱い**
  - 前後 n 秒を確保できない場合は、取得できた範囲をそのまま保存する。
  - 診断終了時に未確定の区間は確定させて書き出す。
  - ヒヤリ 0 件なら動画ファイルを生成しない。
- **センサログ**: 診断中のみ保存する。
- **ヒヤリ通知**: ヒヤリポイント検出時に音を鳴らす。
- **ヒヤリ判定とスコア**: ヒヤリ判定はスコア値を減点しない。発生するのは、マーカー・メッセージ・音・区間録画のみである。
- **操作可否**
  - ヒヤリマーカーのタップは診断終了後のみ有効とする。移行前は、タップで動画パス（`@` エスケープ）付きの `/bad-spot/:path` に遷移する。
  - 「アドバイス表示」は診断終了後（`status === finish`）のみ有効とする。
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
| ヒヤリ区間ファイルの再生・遷移契約 | `hiyari.NN.webm` の命名詳細（NN の桁数・起点）と格納先ディレクトリが、資料上で明記されていない。[[ui.badspot.page]] への遷移パラメータ（現行は通し動画パスの `@` エスケープ）と、区間ファイル内のシーク方式も未定である。現行はマーカーの `markersVideoTime` による通し動画の `currentTime` 追尾であり、区間ファイルでは区間先頭からのオフセット換算が必要になる。 | UI + Middleware + Infra |
| 設定値 n の既定値と設定 UI | 区間幅 n は設定値である。実測は n=15 / n=60 で行った。既定値、設定画面での入力可否・範囲は未定である。 | UI（設定画面）+ 先方 |
| 録画原点とスコアロジック原点のギャップ | チャンクは `videoStartTimestamp` 原点、ヒヤリ時刻は `startScoreLogic()` 原点で管理される。ギャップは `logService.debug` で実測し、補正の要否は実測後に判断する。 | UI + Middleware |
| アプリ内 WebView での実測確認 | 実測値は端末 Chrome で得たものである。Capacitor WebView での同等性確認は別途必要である。 | UI + QA |
| ヒヤリ検出音の詳細 | 音源・音量・サイレント時の扱い・連続ヒヤリ時の再発音抑制が未定である。 | UI |
| 未算出スコアの提示 | `smartphoneOnly` で全指標 100（未算出）となる状態を、「未算出」と明示するかどうか。現行は満点と区別なく表示する。 | UI + Middleware |
| 空ラベル指標欄 | `label3/label4` が空の指標欄を表示し続けるか、非表示にするか。現行は空欄のまま描画する。 | UI |
| 自車マーカー回転の実装責務 | heading は渡っているが、上向き固定で描画されている。回転適用を map.service 側で行うかの確認が必要である。 | UI + Middleware |
| タブ切り替えの構成 | 追加される「タブ切り替え」に本画面が含まれるか、到達経路がどう変わるかが未定である。 | UI + 先方 |
| CAN データ保存 | CAN データを確認用に保存できるかは、先方の宿題である。 | 先方 + Infra |
| BLE 安定化 | 受信の不安定さに対し、先方から「パラレル処理化」が示唆されている。ただしこれは**仮説**であり、確定した対策ではない。実機で確認しながら調整する領域である。テスト用ナビ端末の提供時期も未定である。 | Middleware |
| スコアロジック凍結 | スコアロジック（CAN 版／`_simple` 版／未算出時 100／`score.ts` の `scoreA` 三重代入等）は、打ち合わせ後まで**変更しない**。本画面はその出力をそのまま表示する。 | Middleware |
| 画面縦横 | 「縦横変更できるようにしてください」要求の対象は、縦固定を掛けている履歴・アドバイス等の他画面である。本画面は既に `unlock` で要求を満たす。 | UI（他ノード） |

## 関連ノード
- 依存: [[middleware.sensor.service]] / [[middleware.map.service]] / [[middleware.login.service]] / [[middleware.log.service]] / [[middleware.score.logic]] / [[middleware.score.logicCan]] / [[middleware.sensor.demoData]] / [[db.score.repository]] / [[infra.file.storage]] / [[infra.assets.scoreLogicJson]] / [[infra.cordova.sensors]]
- 遷移先: [[ui.badspot.page]] / [[ui.comment.page]] / [[ui.history.page]]
- 2026 年度改修で関連: [[ui.previousResult.page]]（1-2 前回結果表示。レーダーチャート仕様・過去平均の定義を共有する）
- 8-1「サービス案表示」（`ui.servicePlan.page`）のノード新設は**取り下げ済み**であり、本改修の対象外（後続検証）とする。

```json
{
  "required_changes": [
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "動画節を『改修後の確定方針（ヒヤリ区間録画・append-while-open）』と『現行実装の録画（移行前）』に分割し、start(1000)・通し動画なし・hiyari.NN.webm 書き出しを承認済み方針として記載"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "リングバッファを chunk[0] 常時保持＋常に直近 n+5 秒へ切り詰め、切り詰めと区間選択をチャンク受信時刻（Date.now()-videoStartTimestamp）で判定する旨を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "書き出し時に chunk[0] を最初の Cluster ID(0x1F43B675) の手前（実測189B）へ切り詰めたヘッダと区間クラスタを連結し、区間が閉じるまで同一ファイルへ append する旨を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "ヒヤリ区間 [t-n,t+n]・重なり時の終端 t2+n 延長と1ファイル連結・ヒヤリ地点の個別マーカー・尺不足時の取得範囲保存・診断終了時の確定・0件時非生成を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "pushBadPoint 不変・markersVideoTime は startScoreLogic 原点維持・原点ギャップは logService.debug で実測後判断を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "実測値（実効約315KB/s、リングバッファ n=15 約6.36MB/n=60 約20.2MB、1ヒヤリ約315KB/s×2n、チャンク間隔非固定、proposal #227 §2 の誤り、先頭フレームは必ずしも黒くない、WebView 別途確認）を追記"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "『前後15秒の個別録画（検討中）』記述を確定方針に置換し、onStop・checkScoreLogic・業務ルール・状態定義（videoChunks）を改修後方式に合わせて更新"},
    {"node": "ui.driving.page", "entrypoint": "spec/ui/driving-page.md", "description": "未確定論点表のヒヤリ録画行を『区間ファイルの再生・遷移契約』に改め、設定値nの既定値・原点ギャップ・アプリ内WebView確認の各論点を追加"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "must", "reason": "通し動画 movie.webm が廃止され hiyari.NN.webm の区間ファイルになるため ui.badspot.page の遷移パラメータ・currentTime 追尾方式・区間先頭からのオフセット換算の再定義が必要"},
    {"domain": "UI-agent", "severity": "should", "reason": "区間幅 n が設定値となるため設定画面での入力可否・既定値・範囲の定義が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "チャンクは videoStartTimestamp 原点、ヒヤリ時刻は startScoreLogic 原点で管理されるため、ギャップ実測結果に基づく区間選択の補正要否を sensor.service/log.service と合わせて判断する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "hiyari.NN.webm の格納先ディレクトリ・命名規則（NNの桁数/起点）と、1ヒヤリ約315KB/s×2n のストレージ消費を書き出しルート仕様に反映する必要がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "実測は端末 Chrome の standalone-probe によるものでアプリ内 Capacitor WebView での同等性確認、および区間連結・尺不足・診断終了時確定・0件非生成の検証観点が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目・1-5段階のスコアと評価コメントを供給する算出責務が未定義で、現行 scoreA/scoreB/scoreC（0-100・3値）と一致しない"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "自車マーカーの進行方向回転は map.service のマーカー描画側で heading を適用する必要があり、現行は heading が渡っても上向き固定"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が3列REAL（0-100）で6項目5段階と不一致、かつ『過去の平均』系列の集計期間定義が必要"},
    {"domain": "UI-agent", "severity": "must", "reason": "☆スコア表示削除により ui.comment.page への唯一の導線が失われるため遷移元の再定義が必要"}
  ],
  "requirements_context": "運転診断画面（/driving、画面4-1 走行前 / 4-2 走行中 / 4-3 走行終了、status 0 init / 1 running / 2 finish）は UC06（運転診断の実行）と UC08（ヒヤリ地点確認導線）を担う。『診断開始』でセンサーサービス（sensorService.start/startScoreLogic）、スコアロジックランナー（既定 settings.scoreLogicInterval=300ms）、録画を同時起動する。走行中は10ms周期のセンサー統合値を scoreLogic.pushSensorData に流し、Google Map に自車位置・開始/終了マーカー・ヒヤリ地点（1件1マーカー）・走行軌跡を描画する。地図ドラッグで追従解除、追従ボタンで復帰。onStop で scoreLogic/sensor/録画を停止し drawEndMarker と fitBounds、scoreDbService.insertScore をファイア＆フォーゲットで実行、loginService.scoreId に startTimestamp を設定して終了ダイアログを表示し、logService.resetLogDir で debug-log に戻す。アドバイス表示（ui.comment.page）とヒヤリマーカータップ（ui.badspot.page、移行前は videoRecordedPath の '/'→'@' 置換で /bad-spot/:path）は status===finish のみ有効。センサーデータ null で自動終了。スコア値は直接編集不可。\n\n【スコア表示の改修（承認済み）】4-1/4-2/4-3 で☆5段階表示（アクセル/ブレーキ操作の丁寧さ・ハンドル操作の安定性・総合）を削除し、筋力・柔軟性・空間把握・危険予測・視力・視野の6項目・1〜5の5段階（5が良好、3が年齢平均）のレーダーチャートと評価コメントを表示。各項目に『n点（5点満点）』と2行程度のコメント、いらすとやアイコン、『今回』と『過去の平均』の2系列。記録なし時は ui.previousResult.page の未描画ルールと整合させる想定（適用可否未確定）。採点データ形式は先方検討中で未確定、scoreA/B/C（0-100の3値）と不一致。スコアロジックは打ち合わせ後まで凍結。\n\n【移行前スコア表示の実装実態】星/順位（101-score、100上限）。スコアロジック差し替え未実装で常に CAN 版（scoreLogicFunction_simple.txt は未参照）。smartphoneOnly は BLE スキャンなしで接続待ち表示なし、全指標100（未算出）表示。CAN 版は score1/score2/overAll/scoreA/scoreB のみ設定し label3/label4 は空で描画。ヒヤリはスコア減点しない。初期 Score(null) 混入で序盤は (評価窓合計+100)/(窓数+1) と高め。\n\n【自車マーカー】進行方向に回転（want、承認済み）。現行は上向き固定で、heading は drawCarMarker に渡っているため map.service 側対応が必要（責務要確認）。\n\n【ヒヤリ通知】走行中ヒヤリ検出時に音を鳴らす（承認済み）。契機は score.hiyari===true。音源・音量・サイレント時・デバウンスは未確定。\n\n【ヒヤリ区間録画（承認済み、proposal #227 §4-1 を第1期から実装）】getUserMedia 1280x720+audio、video/webm、ビットレート指定なしで MediaRecorder.start(1000)。通し動画は作らない。チャンクは受信時刻 Date.now()-videoStartTimestamp で管理し、リングバッファ切り詰めと区間選択をチャンク個数から時刻判定へ変更（ずれ1の解消）。pushBadPoint は変更せず markersVideoTime は startScoreLogic 原点のまま。ギャップ（videoStartTimestamp-startTimestamp）は logService.debug で実測し実測後に判断。chunk[0] はメモリ上で常時保持し、リングバッファは区間の開閉に関わらず常に直近 n+5秒（＋chunk[0]）に切り詰める。区間はヒヤリ時刻 t・設定値 n に対し [t-n,t+n]、次のヒヤリ t2 が現区間終端より前なら終端を t2+n へ延長して1ファイル連結し重なりが続く限り延長、ヒヤリ地点は1件ずつ別マーカー。走行開始直後・終了直前で n 秒を確保できなければ取得範囲をそのまま保存、診断終了時に未確定区間を確定書き出し、ヒヤリ0件なら動画を生成しない。区間オープン時に hiyari.NN.webm を作成し、chunk[0] を先頭から最初の Cluster ID(0x1F43B675) の手前（実測189B）に切り詰めたヘッダと区間先頭からのクラスタを書き出し、以降区間終了まで新チャンクごとに同ファイルへ append。リングバッファ上の chunk[0] 常時保持は変えない。先方の『30秒以内の連続ヒヤリは1本継続でも個別でもよい、ヒヤリ時の動画が見られることと個別に確認できることを満たせばよい』の範囲で連結方式を選択。\n\n【実測（SH-M29/Android15/Chrome 153.0.8010.52、アプリ同一条件）】景色撮影時の実効約315KB/s（約2.6Mbps）で下限側の値として扱い、暗所60〜108KB/s は代表値でない。リングバッファ保持量 n=15 約6.36MB、n=60 約20.2MB で連結が続いても超えない。ストレージは1ヒヤリ約315KB/s×2n（n=15 約9.4MB、n=60 約37.7MB）。dataavailable 間隔平均1017〜1038ms（最小873/最大1159ms）、chunk[0] 実尺1023〜1104ms。chunk[25] は25515〜26475ms、chunk[30] は30600〜31566ms で番号×1000ms から約2〜6%乖離し n=60 区間端で1.5秒以上の誤差、proposal #227 §2 の『chunk[i]≒[i,i+1)秒』は誤り。切り出し先頭0.1秒は暗所で完全な黒（輝度0.0/分散0.0）、景色撮影時は輝度37.3〜74.6/分散2144.4〜3460.1 で正常、黒は暗所かつ録画開始直後が重なる場合のみ。WebView 153.0.8010.36 と Chrome は同一ビルド系列で standalone-probe を代理としたが同一プロセスではなくアプリ内 WebView 確認は別途必要。\n\n【移行前の録画】start(60000)、movie.webm に初回 writeFile・以降 append、inactive 時に Blob 化して videoRecordedPath 設定、ui.badspot.page は markersVideoTime で currentTime 追尾。\n\n【ファイル書き出し】ルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/、#79 の externalDataDirectory 案は撤回済み。採取はファイルアプリまたは adb pull。センサログは診断中のみ。追加パーミッションなし、失敗時提示・保持期間は対象外。saveScoreLogic は recording/logStorage/sensorLogStorage のいずれか有効で setLogDir、logStorage||sensorLogStorage で scoreLogicJson.txt/scoreLogic.txt を保存。hiyari.NN.webm の格納先・命名詳細は未明記。CAN データ保存可否は先方宿題。\n\n【画面挙動・全体文脈】unlock で縦横自由、回転時 CSS 切替、Insomnia でスリープ抑止。縦横要求は他画面が対象。2026年度改修は日産『一次仕様』2026-08-04 とメイサンソフト『要求仕様確認』2026-09-17 に基づく5本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE安定化 ⑤録画データサイズ改善）で本画面は③⑤。8-1 サービス案表示ノード新設は取り下げ済み。BLE パラレル処理化は仮説、テスト用ナビ端末の提供時期未定。2026年11月末完了、12月高齢者実験開始。",
  "fact_candidates": [
    {"type": "business_rule", "title": "ヒヤリ録画は start(1000) で行い通し動画は作らない", "statement": "改修後の運転診断画面は MediaRecorder.start(1000) で録画し、走行全体の通し動画は生成しない", "status": "approved"},
    {"type": "business_rule", "title": "リングバッファは常に直近 n+5 秒と chunk[0] を保持する", "statement": "リングバッファは区間の開閉に関わらず常に直近 n+5 秒分に chunk[0] を加えた範囲へ、チャンク受信時刻で判定して切り詰める", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ区間は [t-n, t+n] で重なりは連結する", "statement": "ヒヤリ区間はヒヤリ検知時刻 t と設定値 n に対し [t-n,t+n] とし、次のヒヤリ t2 が現区間終端より前なら終端を t2+n に延長して1ファイルに連結する", "status": "approved"},
    {"type": "display_rule", "title": "連結区間でもヒヤリ地点マーカーは1件ずつ描画される", "statement": "連続ヒヤリで録画ファイルが1本に連結されても、地図上のヒヤリ地点マーカーはヒヤリ1件につき1つ描画される", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリ0件なら動画ファイルは生成されない", "statement": "走行中にヒヤリが1件も検出されなかった場合、動画ファイルは生成されない", "status": "approved"},
    {"type": "business_rule", "title": "診断終了時に未確定のヒヤリ区間は確定書き出しされる", "statement": "診断終了操作の時点で未確定のヒヤリ区間があれば、その時点までで確定させて書き出す", "status": "approved"},
    {"type": "business_rule", "title": "区間先頭のヘッダは chunk[0] を Cluster ID 手前まで切り詰めて書き出す", "statement": "区間オープン時に chunk[0] を先頭から最初の Cluster ID(0x1F43B675) の手前まで（実測189B）に切り詰めたヘッダと区間先頭からのクラスタを hiyari.NN.webm に書き出し、区間終了まで新チャンクを append する", "status": "approved"},
    {"type": "constraint", "title": "pushBadPoint と markersVideoTime の原点は変更しない", "statement": "改修後も pushBadPoint() は変更せず、markersVideoTime は startScoreLogic() 原点のままとする", "status": "approved"},
    {"type": "data_semantics", "title": "1ヒヤリあたりのストレージ消費は約315KB/s×2n秒", "statement": "1ヒヤリあたりのストレージ消費は約315KB/s×2n秒（n=15で約9.4MB、n=60で約37.7MB）である", "status": "approved"},
    {"type": "data_semantics", "title": "チャンク番号は録画秒数と一致しない", "statement": "start(1000) でもチャンク間隔は非固定で、チャンク番号×1000ms から約2〜6%乖離する", "status": "approved"},
    {"type": "display_rule", "title": "切り出し動画の先頭フレームは必ずしも黒くない", "statement": "ヒヤリ切り出し動画の冒頭が黒くなるのは暗所かつ録画開始直後が重なった場合のみで、通常は正常に描画される", "status": "approved"},
    {"type": "display_rule", "title": "運転診断画面の☆スコア表示をレーダーチャートに置き換える", "statement": "4-1/4-2/4-3 で☆5段階表示を削除し、6項目1〜5段階のレーダーチャートと評価コメント（今回・過去の平均の2系列）を表示する", "status": "approved"},
    {"type": "display_rule", "title": "自車マーカーの矢印を進行方向に向ける", "statement": "地図上の自車マーカーの矢印を進行方向に合わせて回転させる（現行は上向き固定、優先度 want）", "status": "approved"},
    {"type": "business_rule", "title": "ヒヤリポイント検出時に音を鳴らす", "statement": "走行中にヒヤリポイントを検出した時点で音を鳴らして運転者に知らせる", "status": "approved"},
    {"type": "state_rule", "title": "ヒヤリマーカーのタップとアドバイス表示は診断終了後のみ有効", "statement": "ヒヤリマーカーのタップと『アドバイス表示』への遷移は status が finish のときのみ受け付けられる", "status": "candidate"},
    {"type": "input_rule", "title": "スコア値は画面上で直接編集できない", "statement": "利用者は運転診断画面上でスコア値を直接入力・編集できない", "status": "candidate"},
    {"type": "qa_expectation", "title": "録画実測はアプリ内WebViewでの確認が別途必要", "statement": "ヒヤリ録画の実測値は端末 Chrome での計測であり、アプリ内 Capacitor WebView での確認を別途行う必要がある", "status": "approved"},
    {"type": "open_question", "title": "区間ファイルに対するヒヤリ地点詳細の再生方式が未確定", "statement": "hiyari.NN.webm へ移行した後の ui.badspot.page への遷移パラメータと区間内シーク方式が未確定", "status": "open_question"}
  ],
  "open_questions": [
    "hiyari.NN.webm の格納先ディレクトリと命名詳細（NNの桁数・起点）が資料上で明記されていない。Infra/UI判断が必要で、決まらないと ui.badspot.page からの参照と採取手順を確定できない。",
    "ui.badspot.page への遷移パラメータ（現行は通し動画パスの @ エスケープ）と区間ファイル内のシーク方式が未確定。markersVideoTime は startScoreLogic 原点のままのため区間先頭からのオフセット換算が必要となる。UI+Middleware判断が必要で、決まらないと UC08 と『個別にヒヤリポイントの動画を確認できる』条件の実現が保証できない。",
    "録画原点（videoStartTimestamp）とスコアロジック原点（startTimestamp）のギャップは logService.debug で実測後に補正要否を判断するとされ未確定。Middleware/UI判断が必要で、決まらないと区間端が数百ms〜秒単位でずれる可能性がある。",
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
    "ヒヤリ区間録画に関する approved fact 群（リングバッファ・append-while-open・ヘッダ切り詰め・区間定義・連結・時刻判定）を『検討中』から確定方針へ昇格させ、既存の『前後15秒の個別録画（検討中）』記述と置き換えた。fact を真とし、現行の start(60000)・movie.webm 通し動画は『移行前』節に残した。",
    "連結方式は先方の『1本継続でも個別でもよい』という許容範囲内の選択であり、2条件のうち『個別に確認できる』は別マーカー＋区間内位置で満たす想定だが、再生側の実現は ui.badspot.page の責務として未確定論点に残した。",
    "時刻管理を受信時刻に変えたのはチャンク番号と実時間が2〜6%乖離し n=60 で1.5秒以上ずれる実測に基づく。pushBadPoint を変えない判断は影響範囲を録画側に限定する意図で、原点ギャップの補正は実測待ちとした。",
    "リングバッファを常に n+5 秒へ切り詰める方式により、連結が続いてもメモリ保持量は n=15 で約6.36MB、n=60 で約20.2MB を上限とする。区間ファイル側は append で逐次書き出すためメモリに溜めない。",
    "ヘッダを 189B に切り詰めるのは chunk[0] に含まれる冒頭クラスタ（録画開始直後の映像）を区間ファイルに混入させないため。『冒頭は必ず黒い』は誤りと判明したが、ヘッダのみ先頭とする方針自体は変わらない。",
    "書き出し処理は画面上の表示要素を持たないが、本ノードの driving.page.ts が MediaRecorder を保持しているため本ノード仕様に記載した。",
    "スコア表示・自車マーカー・検出音・書き出しルート・スコアロジック凍結・縦横に関する既存記述と判断理由は変更の必要がないため維持した。"
  ]
}
```