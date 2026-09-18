<!-- 作成: 2026-09-10 17:30:05 JST | 更新: 2026-09-18 18:37:23 JST -->

# ui.history.page — 過去の診断結果 履歴・能力指標画面 (画面7-1 / 7-2)

## 概要
過去の運転診断結果を Chart.js で可視化する画面。ヒストリータブ (総合 + 4 指標) と能力指標タブ (scoreA/B/C) を持ち、直近 `GRAPH_MAX=30` 件を古い順に表示。`settings.scoreShowStarArea1/2/3` で生スコアと順位表示を切り替え、`orderOfMessage` で positive/negative の表示順を制御する。能力指標タブは `capabilityScoreTargetDays`（既定 30 日）以内のスコアを平均し、Tooltip ホバーで該当日のサブグラフを表示する。

グラフ凡例・指標名はすべて `settings.label`（`assets/data/scoreLogic.json`）由来であり、画面側にラベル文言をハードコードしない。現行設定では `labelA=歩行機能` / `labelB=注意機能` / `labelC=空文字` である。

2026 年度改修では、本画面 (7-1) に**認知機能・身体機能・視機能の機能別履歴表示**を追加する方針が承認されている（「2026 年度改修要求」節を参照）。本節以降の記述は、特記がない限り現行実装の仕様である。

## 真実源
- `src/data/src/app/history/history.page.ts`
- `src/data/src/app/history/history.page.html`

## ルーティング
- パス: `/history`

## 定数
```
static GRAPH_MAX = 30
```

## 状態
```
selectCapabilityTab: boolean
capabilityScoreTargetDays: number
scoreShowStarArea1/2/3: boolean
scoreA/B/C: number
scoreAMessage/BMessage/CMessage: string
rankScoreA/B/C: string
label1..4, labelA/B/C: string      // settings.label から反映（画面側の固定文言なし）
comment11 / comment12: string      // 総合スコアのメッセージ (2 行)
comment21 / comment22: string      // score1..4 のメッセージ (2 行)
selectLineCanvasId: string         // ホバー中の Canvas ID
subGraphDateText / subGraphDateFullText: string
chart1..chart5, chart3_2/4_2/5_2: Chart | null
```

## ライフサイクル
- **`ionViewWillEnter()`**:
  1. Android なら `screenOrientation.lock(PORTRAIT)`。
  2. `selectCapabilityTab=false`（ヒストリータブから開始）。
  3. `scoreDbService.selectAllScore()` を await。
  4. `initialize()` → `loginService.initialize()`（ログイン中ユーザーを参照）+ `logService.initialize(file)` + label/scoreShowStar/target 反映。
  5. 空リストなら return。それ以外は `initializeHistoryCanvas(scoreList)` と `initializeCapabilityScoreCanvas(scoreList)` を実行。

## `initializeHistoryCanvas(scoreList)`
- 最新 GRAPH_MAX 件までを対象に、Score.timestamp を `dateFormat(date, false, false)` (`MM/DD hh:mm`) でラベル化。
- `scoreShowStarArea1`=true なら生 `overAll`、false なら `getRank(overAll) = 101 - Math.round(overAll)`。
- `scoreShowStarArea2` も同様に score1..4 に適用。
- 各 message を `(key, type, id)` で仕分けし、`over_all` は `count1[type][id]++`、`score1..4` は `count2[type][id]++`、`message[id] = text.replace(/%INTERSECTION/g, '')`（履歴では交差点名を空文字化）、`keys[id] = key`。
- `orderOfMessage=0` なら positive → negative の順、`=1` なら逆順で `comment11/12` (over_all) と `comment21/22` (score1..4) を構築。
- `getMessage(data, message, keys, first)`: `first=true` のとき最初に出現した max キーを、false なら真の最大数を返す。
- `lineChart1` (総合)、`lineChart2` (score1..4) を描画。

## `initializeCapabilityScoreCanvas(scoreList)`
- 各 Score の `graphCapabilityScoreList` から `scoreA/B/C` と `scoreAMessage/BMessage/CMessage` を吸い上げる。
- 3 つのグラフオブジェクトを構築（`{ [scoreTimestamp]: { date, label, score, message, subGraph } }`）。
  - `graph3` → 指標 A（凡例は `labelA`。現行設定では「歩行機能」）
  - `graph4` → 指標 B（凡例は `labelB`。現行設定では「注意機能」）
  - `graph5` → 指標 C（凡例は `labelC`。現行設定では空文字）
- `pushCapabilityGraphData` は `score <= -1` または既に GRAPH_MAX に達したらスキップ。sub グラフも GRAPH_MAX で上限。
- `lineChartCapability(labelA, borderColor, graph3, true, lineCanvas3.nativeElement)` を A/B/C ごとに呼ぶ。
- `labelC` が空文字のため、C 系グラフは凡例文言を持たない状態で描画される。これは CAN 版スコアロジックが `scoreC` を設定しないことと対応する（実装実態）。

## `makeCapabilityGraphData(graph, targetDate, dummyData)`
- key を降順ソートしラベル/値/messages を新しい順から詰め、`labels.unshift` で最終的に古い順に並べる。
- `targetDate <= graph[key].date` の要素だけを `totalScore` の平均に含める（`capabilityScoreTargetDays` の範囲）。
- 30 件未満なら `dummyData=true` のとき残枠を空ラベルで埋める。

## `lineChart1` / `lineChart2`
- Chart.js の line チャート。`intersect: false`, `mode: 'index'`、Y 軸は `scoreShowStarArea*` に応じて `reverse` を反転（順位表示時は下方向が良い）。
- ラベルは 8pt、tooltip callback で「N 点」「N 位」「ポジティブ K 回、ネガティブ K 回」を組み立てる。
- `lineChart2` は `label1..4` が空文字でないもののみ dataset に追加（色は既定パレット）。現行 `settings.label` では `label3`/`label4` が空文字であるため、ヒストリータブに表示されるのは `label1`/`label2` の 2 系列のみとなる（CAN 版が score3/score4 を設定しないことと対応）。

## `lineChartCapability(label, borderColor, graph, dummyData, element)`
- 描画対象の Canvas 要素 (`lineCanvas3/4/5`) に応じて `scoreA/B/C` と `rankScoreA/B/C` に `totalScore` を反映。
- Tooltip callback で選択中の Canvas の `messages[index]` を対応する `scoreAMessage/BMessage/CMessage` に代入。
- サブグラフが 2 件以上あるときはメインの下に `lineCanvas3_2/4_2/5_2` に日別サブグラフを描画。
- 1 件なら `subGraphDateFullText=''`、`selectLineCanvasId=''`。

## タブ切替
- `onHistoryClick()`: `selectCapabilityTab=false`、`selectLineCanvasId=''`
- `onCapabilityClick()`: `selectCapabilityTab=true`、`selectLineCanvasId=''`
- `onMouseOver()`: `selectLineCanvasId=''`
- 7-1 のタブは既存の 2 タブ（ヒストリー / 能力指標、`selectCapabilityTab` で切替）のみ。評価コメント切り替えタブは 5-1（ui.comment.page）にのみ設け、7-1 には設けない。

## Chart インスタンス管理
- `setChartInstance(chart, element)`: `element.id` で `chart1..5, chart3_2/4_2/5_2` に振り分け、`chartRender(element)` を実行。
- `chartDestroy(element)`: destroy 後に null 化。
- `chartRender(element)`: `await sleep(100)` してから `render()`（初期表示の空白バウンス対策）。

## 表示・入力ルール
- 画面はスコア値を**表示するのみ**で、スコアの算出・再計算は行わない。値は `db.score.repository` が返す保存済み Score をそのまま用いる。
- 履歴画面上でスコア値・メッセージ・ラベルをユーザーが編集する手段は存在しない（読み取り専用）。
- 履歴は最新 30 件を古い順に並べる。30 件未満は空ラベルで左詰め表示。
- 星表示 (`scoreShowStar*=true`) は 0-100 の高い方が良い、順位表示 (`false`) は `101-score` (1 が最高、100 が最低) で下向きに良い。
- 能力指標の平均対象は「今日から `capabilityScoreTargetDays` 日前」までの Score。ホバーでその Score の走行内サブグラフを表示する。
- 表示対象データはログイン中ユーザー（`middleware.login.service`）に紐づく Score である。

## 2026 年度改修要求（承認済み方針・未実装）
出所: 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、およびメイサンソフト『要求仕様確認』2026-09-17。開発完了目標は 2026 年 11 月末（12 月から高齢者を招いた実験が開始されるため）。

### 機能別履歴表示の追加（7-1 拡張）
- 7-1『過去の診断結果』に **認知機能・身体機能・視機能** の履歴表示を加える。
- モックでは 3 系列を『1 年前 / 半年前 / 現在』の軸で **1〜5 の折れ線**として描画し、縦軸を **Low〜High** で示している。
- 集計単位として **月間・3 か月・半年・年間** が挙げられている。
- 本拡張は表示の追加であり、7-1 にコメント切り替えタブは設けない（評価コメント切り替えタブは 5-1 のみ）。

### 現行実装との差分（未確定を含む）
- 現行の能力指標タブは `scoreA/B/C` の 3 指標・0〜100 の連続値であり、新仕様の「機能別 3 系列・1〜5 の 5 段階」とは**尺度も指標定義も一致しない**。対応づけは未確定（`db.capability_score` の保持構造に関する open_question と連動）。
- 現行の集計期間は `capabilityScoreTargetDays`（既定 30 日）の単一設定であり、新仕様が挙げる「月間・3 か月・半年・年間」の切り替えに対応する UI・設定は存在しない。
- 新仕様の採点は筋力・柔軟性・空間把握・危険予測・視力・視野の 6 項目 5 段階（レーダーチャート、5-1 / 1-2 側）であり、7-1 の機能別 3 系列（認知/身体/視）と 6 項目の集約関係は資料に明記されていない。
- 先方から『縦横変更できるようにしてください』の要求があるが、現行 7-1 は `ionViewWillEnter()` で Android を PORTRAIT に固定している。7-1 を回転対応にするかは未確定（横向きレイアウト未定義）。

## 実装実態メモ（記録のみ・本ノードでの変更は行わない）
- **未算出値が 100 として表示され得る**: Score の各スコア初期値は 100 であり、`pushCapabilityGraphData` のスキップ条件は `score <= -1` のみである。したがってスコアロジックが値を設定しなかった指標（例: `scoreC`、smartphoneOnly 時の全指標）は「未算出」ではなく 100 点として履歴・能力指標グラフに描画される。画面側に未算出を判別する情報は渡ってこない。
- **labelB とコード内コメントの食い違い**: `settings.label.labelB` は「注意機能」だが、実装コード内コメントは「認知機能」と記述されている。画面表示は `settings.label` 側に従うため表示文言は「注意機能」。食い違いは記録のみとし、コードは変更しない。
- **旧記述の訂正**: 本仕様の過去版に記載されていた `graph3=筋力 / graph4=柔軟性 / graph5=視野` は誤りであり、指標名は `settings.label` の `labelA/labelB/labelC` に従う。なお 2026 年度新仕様のレーダーチャート 6 項目には「筋力・柔軟性・視野」が含まれるが、これは 5-1 / 1-2 側の新規項目であり、現行 7-1 の `labelA/B/C` とは別物である。
- **`score.ts:70-72` の scoreA 三重代入**: モデル側で scoreA に同一値が三重代入されている実装バグが記録されている。能力指標タブの A/B/C 表示値に影響し得るが、修正は打ち合わせ後とし本画面では対処しない。
- **スコアロジックの凍結**: 6 項目の採点データ形式が先方で検討中（『試作中に提示します』）であるため、スコアロジックの変更凍結（打ち合わせ後まで変更しない）は解除されていない。7-1 の機能別履歴表示の実装着手も、データ形式確定を待つ。

## 関連ノード
- 依存: [[db.score.repository]] / [[middleware.login.service]] / [[middleware.log.service]]
- 参照: [[infra.assets.scoreLogicJson]]（`settings.label` / `capability_score_target_days` の供給元）/ [[middleware.score.logicCan]]（scoreC・score3/4 未設定の根拠）/ [[ui.comment.page]]（評価コメント切り替えタブは 5-1 のみ）/ [[ui.previousResult.page]]（レーダーチャート 6 項目 5 段階・過去平均系列）

```json
{
  "required_changes": [
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "タブ切替節に『7-1 のタブは既存2タブのみ・評価コメント切り替えタブは5-1にのみ設ける』の1行を追記"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "2026年度改修要求として7-1への機能別履歴表示（認知/身体/視の3系列・1〜5折れ線・縦軸Low〜High・集計単位 月間/3か月/半年/年間）を承認済み未実装方針として追記"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "新仕様(3系列・1〜5)と現行(scoreA/B/C・0〜100)の尺度不一致、集計単位切替UIの不存在、縦固定と縦横変更要求の衝突を現行差分として明記"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "旧記述の筋力/柔軟性/視野が新仕様レーダーチャート6項目とは別物である点を注記し混同を防止"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "6項目採点データ形式が未確定でスコアロジック凍結が継続しているため機能別履歴の実装着手を保留する旨を追記"}
  ],
  "suggested_impacts": [
    {"domain": "db", "severity": "must", "reason": "capability_score は scoreA/B/C の3列・0〜100 REAL であり、新仕様の機能別3系列・1〜5尺度を保持できないため列構成または新テーブルの判断が必要"},
    {"domain": "middleware", "severity": "must", "reason": "機能別履歴（認知/身体/視）の系列値と集計単位（月間/3か月/半年/年間）の算出責務はロジック側に置く必要があり、6項目採点データ形式の確定が前提となる"},
    {"domain": "infra", "severity": "should", "reason": "集計単位の切替や機能別ラベルを scoreLogic.json の settings 側で供給する場合、settings.label / capability_score_target_days の構造拡張が必要"},
    {"domain": "ui", "severity": "should", "reason": "レーダーチャート6項目と7-1の機能別3系列の集約関係が未定義のため ui.previousResult.page / ui.comment.page と表示項目の整合確認が必要"},
    {"domain": "qa", "severity": "should", "reason": "未算出指標が100点表示となる現行挙動と、新仕様1〜5尺度の期待値が併存するため履歴画面のテスト期待値を再定義する必要がある"}
  ],
  "requirements_context": "UC09（過去の診断結果閲覧）に対応する /history 画面の仕様。現行はヒストリータブ（総合 overAll + score1..4）と能力指標タブ（scoreA/B/C）の2タブ構成で、直近 GRAPH_MAX=30 件を古い順に Chart.js の line チャートで表示する。データ取得は db.score.repository の selectAllScore()、対象ユーザーは middleware.login.service のログイン中ユーザー、ログ出力は middleware.log.service。settings.scoreShowStarArea1/2/3 により生スコア表示（0-100・高いほど良い）と順位表示（101-score・1が最高で軸 reverse）を切り替える。orderOfMessage により positive/negative メッセージの表示順（comment11/12, comment21/22）を制御し、履歴表示では %INTERSECTION を空文字置換する。能力指標タブは capabilityScoreTargetDays（既定30日）以内の Score のみを平均して totalScore を算出・表示し、Tooltip ホバー時に該当日の走行内サブグラフ（lineCanvas3_2/4_2/5_2、2件以上のとき）を表示する。pushCapabilityGraphData は score<=-1 または30件到達でスキップ。30件未満は dummyData により空ラベルで左詰め。Chart インスタンスは element.id で chart1..5/chart3_2/4_2/5_2 に振り分け、chartRender は sleep(100) 後に render（初期表示の空白バウンス対策）。指標名・凡例はすべて settings.label 由来で画面側にハードコードしない。現行設定では labelA=歩行機能、labelB=注意機能、labelC=空文字であり、labelC 空は CAN 版が scoreC を設定しないことと対応する。label3/label4 も空のため lineChart2 は label1/label2 の2系列のみ描画する。Score の各スコア初期値が100であり除外条件が score<=-1 のみであるため、未算出指標（scoreC や smartphoneOnly 時の全指標）は100点として描画される実装実態がある。labelB『注意機能』とコード内コメント『認知機能』の食い違い、および score.ts:70-72 の scoreA 三重代入は記録のみでコード変更は行わない。画面はスコアを表示するのみで算出・編集の責務を持たない読み取り専用画面である。／2026年度改修（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04 および『要求仕様確認』2026-09-17、完了目標 2026年11月末）では、7-1 に認知機能・身体機能・視機能の機能別履歴表示を追加する方針が承認されている。モックは3系列を『1年前/半年前/現在』軸で1〜5の折れ線として描画し縦軸を Low〜High とし、集計単位として月間・3か月・半年・年間が挙げられている。7-1 にはコメント切り替えタブを設けず、評価コメント切り替えタブは 5-1（ui.comment.page）のみとする。7-1 のタブは既存2タブ（ヒストリー/能力指標、selectCapabilityTab 切替）のみを維持し、既存タブの削除・変更およびコード変更は行わない。現行の scoreA/B/C（3列・0〜100連続値）は新仕様の機能別3系列・1〜5の5段階と尺度も指標定義も一致せず、集計単位切替のUI・設定も存在しないため、対応づけは未確定である。新仕様のレーダーチャート6項目（筋力・柔軟性・空間把握・危険予測・視力・視野、1〜5の5段階、今回と過去平均の2系列）は 5-1 / 1-2 側の項目であり、7-1 の labelA/B/C とは別物として扱う。6項目の採点データ形式は先方で検討中でスコアロジックの変更凍結は継続しているため、機能別履歴表示の実装着手はデータ形式確定待ちである。また先方から画面の縦横変更要求があるが現行 7-1 は Android を PORTRAIT 固定しており、7-1 を回転対応とするかは未確定である。",
  "fact_candidates": [
    {
      "type": "display_rule",
      "title": "7-1 のタブは既存2タブのみでコメント切り替えタブを持たない",
      "statement": "7-1 過去の診断結果のタブはヒストリーと能力指標の2タブ（selectCapabilityTab で切替）のみであり、評価コメント切り替えタブは 5-1 にのみ設け 7-1 には設けない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "7-1 に機能別履歴表示を追加する",
      "statement": "7-1 に認知機能・身体機能・視機能の履歴を3系列で表示し、モックでは『1年前/半年前/現在』軸で1〜5の折れ線として縦軸 Low〜High で描画する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "機能別履歴の集計単位候補は4種である",
      "statement": "機能別履歴表示の集計単位として月間・3か月・半年・年間が候補として挙げられている",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "現行能力指標の尺度は新仕様の5段階と一致しない",
      "statement": "現行の履歴画面が表示する scoreA/B/C は 0〜100 の連続値であり、新仕様の機能別3系列 1〜5 の5段階とは尺度が一致しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "現行の集計期間設定は単一で切替UIを持たない",
      "statement": "現行の能力指標の集計期間は capabilityScoreTargetDays（既定30日）の単一設定であり、集計単位を画面上で切り替える手段は存在しない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "能力指標タブの凡例は settings.label に従う",
      "statement": "履歴画面の能力指標タブの指標名は settings.label の labelA/labelB/labelC を表示し、画面側に固定文言を持たない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "labelA は歩行機能、labelB は注意機能として表示される",
      "statement": "現行 settings.label により能力指標 A は『歩行機能』、B は『注意機能』として表示される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "labelC が空のため C 系グラフの凡例文言は表示されない",
      "statement": "settings.label の labelC が空文字であるため、能力指標 C のグラフは凡例文言なしで描画される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "ヒストリータブは label が空でない指標のみ描画する",
      "statement": "lineChart2 は label1..4 のうち空文字でないものだけを dataset に追加するため、現行設定では label1/label2 の2系列のみ表示される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "未算出スコアが100点として表示され得る",
      "statement": "Score のスコア初期値が100であり pushCapabilityGraphData の除外条件が score<=-1 のみであるため、スコアロジックが値を設定しなかった指標は100点としてグラフに描画される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "履歴は最新30件を古い順に表示する",
      "statement": "履歴グラフは GRAPH_MAX=30 件を上限に古い順で並べ、30件未満のときは空ラベルで残枠を埋める",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "星表示と順位表示で軸方向が反転する",
      "statement": "scoreShowStarArea が true のとき生スコア（高い方が良い）、false のとき 101-score の順位（軸 reverse で下方向が良い）で表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "能力指標の平均対象は指定日数以内のスコアのみ",
      "statement": "能力指標タブの totalScore は capabilityScoreTargetDays（既定30日）以内の Score のみを平均して表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "履歴表示ではメッセージ内の交差点名を空文字化する",
      "statement": "履歴画面ではメッセージ文中の %INTERSECTION を空文字に置換して表示する",
      "status": "candidate"
    },
    {
      "type": "input_rule",
      "title": "履歴画面のスコアは読み取り専用である",
      "statement": "利用者は履歴画面上でスコア値・メッセージ・ラベルを編集してはならず、編集手段も提供されない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "履歴画面は計算せず保存値を表示する",
      "statement": "履歴画面は db.score.repository から取得した Score をそのまま表示し、スコアの算出・再計算は行わない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "表示対象はログイン中ユーザーの Score である",
      "statement": "履歴画面は middleware.login.service のログイン中ユーザーに紐づく Score を表示対象とする",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "サブグラフはホバー時かつ2件以上のときのみ表示される",
      "statement": "能力指標のサブグラフは Tooltip ホバー中の Canvas に対して要素が2件以上あるときのみ描画され、1件のときは日付テキストと選択状態をクリアする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "履歴画面は Android で縦固定されている",
      "statement": "履歴画面は ionViewWillEnter で Android の画面向きを PORTRAIT に固定している",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "labelB とコード内コメントの表記が食い違う",
      "statement": "settings.label の labelB は『注意機能』だがコード内コメントは『認知機能』であり、正式な指標名称が未確定である（表示は settings.label に従う）",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "7-1 の機能別履歴表示（認知機能・身体機能・視機能）の3系列が、新仕様レーダーチャート6項目（筋力・柔軟性・空間把握・危険予測・視力・視野）をどう集約した値なのかが未確定。6項目の採点データ形式自体が先方検討中（試作中に提示）であるため、Middleware（スコアロジック）と企画の判断が必要。決まらないと系列値の算出も画面描画も実装着手できない。",
    "機能別履歴の集計単位（月間・3か月・半年・年間）を画面で切り替えるのか固定運用なのかが未確定。現行は capabilityScoreTargetDays の単一設定のみで切替UIが存在せず、UI（タブ/セグメント追加）と infra（設定構造）の双方に判断が必要。決まらないと 7-1 のレイアウトと操作仕様が固まらない。",
    "新仕様の1〜5尺度を現行 scoreA/B/C（0〜100）とどう対応づけるか未確定。db の capability_score が3列・0〜100 REAL であり列数・尺度が一致しないため、db/middleware の保持構造判断が必要。決まらないと履歴の過去データを新表示に移行できるかが判断できない。",
    "既存の能力指標タブ（scoreA/B/C の 0〜100 表示）を機能別履歴表示に置き換えるのか、両方を併存させるのかが未確定。企画判断が必要で、決まらないとタブ構成と既存グラフの去就が定まらない。",
    "先方の『縦横変更できるようにしてください』要求に対し、7-1 を回転対応にするかが未確定。現行は PORTRAIT 固定で横向きレイアウトも未定義。企画とUI設計の判断が必要で、決まらないと screenOrientation.lock の扱いを決められない。",
    "未算出指標が100点として表示される現行挙動をそのまま許容するのか、未算出を明示（非表示/グレー/ハイフン）すべきかが未確定。UIだけでは未算出を判別できず、Middleware側で -1 等の未算出値を返す契約変更が必要かの判断待ち。決まらないと表示品質とユーザー誤解リスクに影響する。",
    "labelB の正式名称が『注意機能』か『認知機能』か未確定。settings.label（infra）とコード内コメント（middleware）で食い違い、企画・QA判断が必要。新仕様が『認知機能』の履歴表示を求めていることと関連するため、名称整理が必要。",
    "labelC が空のまま C 系グラフ（lineCanvas5 / lineCanvas5_2）を描画し続けるべきか、CAN版で scoreC 未設定である限り C 系領域自体を非表示にすべきかが未確定。Middleware と企画判断が必要。",
    "score.ts:70-72 の scoreA 三重代入バグにより能力指標 A/B/C の表示値がどこまで実値と乖離しているかが未確定。db/model 側の修正方針が決まるまで UI 表示値の正しさを保証できない。",
    "smartphoneOnly モードで全指標が未算出（=100表示）となる場合、履歴画面にモード起因の注記や区別表示を出す必要があるかが未確定。Middleware（sensor.service のゼロ埋め挙動）と企画判断が必要。"
  ],
  "rationale_notes": [
    "承認済み design_decision の指示どおり、タブ切替節への追記は1行のみとし、既存タブ（onHistoryClick / onCapabilityClick / selectCapabilityTab）の記述は削除・変更していない。コード変更も行わない前提を維持している。",
    "機能別履歴表示は承認済みの方針だが採点データ形式が未確定でスコアロジックが凍結中のため、現行実装の記述と混ざらないよう『2026年度改修要求（承認済み方針・未実装）』として独立節に切り出した。",
    "旧仕様の誤記（graph3=筋力/graph4=柔軟性/graph5=視野）と新仕様レーダーチャート6項目に同名項目が含まれるため、両者が別物である旨を明示して再混同を防いだ。",
    "本ノードは表示責務のみを持ち、スコア算出・未算出判定・機能別系列の集計は Middleware 側に置く方針。したがって『100 が表示され得る』はUI仕様の不備ではなく上流の出力契約に起因する実装実態として記録する。",
    "指標ラベルを settings.label 由来と明記したのは、UI 仕様書にラベル文言を二重管理すると infra 側 scoreLogic.json との乖離が再発するため。",
    "既存仕様の関数レベル記述（getMessage の first フラグ挙動、chartRender の sleep(100)、makeCapabilityGraphData の unshift による並び替えなど）は実装上の注意点として意図的に維持した。"
  ]
}
```