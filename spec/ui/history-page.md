<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:30:04 JST -->

# ui.history.page — 過去の診断結果 履歴・能力指標画面 (画面7-1 / 7-2)

## 概要
過去の運転診断結果を Chart.js で可視化する画面。ヒストリータブ (総合 + 4 指標) と能力指標タブ (scoreA/B/C) を持ち、直近 `GRAPH_MAX=30` 件を古い順に表示。`settings.scoreShowStarArea1/2/3` で生スコアと順位表示を切り替え、`orderOfMessage` で positive/negative の表示順を制御する。能力指標タブは `capabilityScoreTargetDays`（既定 30 日）以内のスコアを平均し、Tooltip ホバーで該当日のサブグラフを表示する。

グラフ凡例・指標名はすべて `settings.label`（`assets/data/scoreLogic.json`）由来であり、画面側にラベル文言をハードコードしない。現行設定では `labelA=歩行機能` / `labelB=注意機能` / `labelC=空文字` である。

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

## 実装実態メモ（記録のみ・本ノードでの変更は行わない）
- **未算出値が 100 として表示され得る**: Score の各スコア初期値は 100 であり、`pushCapabilityGraphData` のスキップ条件は `score <= -1` のみである。したがってスコアロジックが値を設定しなかった指標（例: `scoreC`、smartphoneOnly 時の全指標）は「未算出」ではなく 100 点として履歴・能力指標グラフに描画される。画面側に未算出を判別する情報は渡ってこない。
- **labelB とコード内コメントの食い違い**: `settings.label.labelB` は「注意機能」だが、実装コード内コメントは「認知機能」と記述されている。画面表示は `settings.label` 側に従うため表示文言は「注意機能」。食い違いは記録のみとし、コードは変更しない。
- **旧記述の訂正**: 本仕様の過去版に記載されていた `graph3=筋力 / graph4=柔軟性 / graph5=視野` は誤りであり、指標名は `settings.label` の `labelA/labelB/labelC` に従う。
- **`score.ts:70-72` の scoreA 三重代入**: モデル側で scoreA に同一値が三重代入されている実装バグが記録されている。能力指標タブの A/B/C 表示値に影響し得るが、修正は打ち合わせ後とし本画面では対処しない。

## 関連ノード
- 依存: [[db.score.repository]] / [[middleware.login.service]] / [[middleware.log.service]]
- 参照: [[infra.assets.scoreLogicJson]]（`settings.label` の供給元）/ [[middleware.score.logicCan]]（scoreC・score3/4 未設定の根拠）

```json
{
  "required_changes": [
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "能力指標ラベルを settings.label 由来（labelA=歩行機能/labelB=注意機能/labelC=空）に訂正し、旧記述の筋力・柔軟性・視野を削除"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "labelC 空・label3/label4 空により C 系凡例なし・ヒストリータブは label1/label2 の2系列のみ描画される点を明記"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "スコア初期値100とスキップ条件 score<=-1 により未算出指標が100点として表示され得る実装実態を記録"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "labelB『注意機能』とコード内コメント『認知機能』の食い違いを記録のみとして追記"},
    {"node": "ui.history.page", "entrypoint": "spec/ui/history-page.md", "description": "画面は表示専用（スコア再計算・編集不可）であり表示対象はログイン中ユーザーの Score である旨を明記"}
  ],
  "suggested_impacts": [
    {"domain": "db", "severity": "should", "reason": "score.ts:70-72 の scoreA 三重代入バグは能力指標タブの表示値に直結するため、修正時に表示仕様の再確認が必要"},
    {"domain": "middleware", "severity": "should", "reason": "CAN版が scoreC/score3/score4 を設定しないため、UIでは未算出が100点表示になる。未算出を -1 等で区別する場合はロジック側の出力契約変更が必要"},
    {"domain": "infra", "severity": "could", "reason": "凡例文言は assets/data/scoreLogic.json の settings.label に完全依存するため、ラベル変更時にUI表示が直接変わる"}
  ],
  "requirements_context": "UC09（過去の診断結果閲覧）に対応する /history 画面の仕様。ヒストリータブ（総合 overAll + score1..4）と能力指標タブ（scoreA/B/C）の2タブ構成で、直近 GRAPH_MAX=30 件を古い順に Chart.js の line チャートで表示する。データ取得は db.score.repository の selectAllScore()、対象ユーザーは middleware.login.service のログイン中ユーザー、ログ出力は middleware.log.service。settings.scoreShowStarArea1/2/3 により生スコア表示（0-100・高いほど良い）と順位表示（101-score・1が最高で軸 reverse）を切り替える。orderOfMessage により positive/negative メッセージの表示順（comment11/12, comment21/22）を制御し、履歴表示では %INTERSECTION を空文字置換する。能力指標タブは capabilityScoreTargetDays（既定30日）以内の Score のみを平均して totalScore を算出・表示し、Tooltip ホバー時に該当日の走行内サブグラフ（lineCanvas3_2/4_2/5_2、2件以上のとき）を表示する。pushCapabilityGraphData は score<=-1 または30件到達でスキップ。30件未満は dummyData により空ラベルで左詰め。Chart インスタンスは element.id で chart1..5/chart3_2/4_2/5_2 に振り分け、chartRender は sleep(100) 後に render（初期表示の空白バウンス対策）。指標名・凡例はすべて settings.label 由来で画面側にハードコードしない。現行設定では labelA=歩行機能、labelB=注意機能、labelC=空文字であり、labelC 空は CAN 版が scoreC を設定しないことと対応する。label3/label4 も空のため lineChart2 は label1/label2 の2系列のみ描画する。Score の各スコア初期値が100であり除外条件が score<=-1 のみであるため、未算出指標（scoreC や smartphoneOnly 時の全指標）は100点として描画される実装実態がある。labelB『注意機能』とコード内コメント『認知機能』の食い違い、および score.ts:70-72 の scoreA 三重代入は記録のみでコード変更は行わない。画面はスコアを表示するのみで算出・編集の責務を持たない読み取り専用画面である。",
  "fact_candidates": [
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
      "type": "open_question",
      "title": "labelB とコード内コメントの表記が食い違う",
      "statement": "settings.label の labelB は『注意機能』だがコード内コメントは『認知機能』であり、正式な指標名称が未確定である（表示は settings.label に従う）",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "未算出指標が100点として表示される現行挙動をユーザー向け表示としてそのまま許容するのか、未算出を明示（非表示/グレー表示/ハイフン）すべきかが未確定。UIだけでは未算出を判別できないため、Middleware側で -1 等の未算出値を返す契約変更が必要かの判断待ち。決まらないと能力指標タブの表示品質とユーザーの誤解リスクに影響する。",
    "labelB の正式名称が『注意機能』か『認知機能』か未確定。settings.label（infra）とコード内コメント（middleware）で食い違っており、企画・QA判断が必要。決まらないと画面表示文言とテスト期待値が確定しない。",
    "labelC が空のまま C 系グラフ（lineCanvas5 / lineCanvas5_2）を描画し続けるべきか、CAN 版で scoreC 未設定である限り C 系タブ領域自体を非表示にすべきかが未確定。Middleware（scoreC 設定有無）と企画判断が必要。",
    "score.ts:70-72 の scoreA 三重代入バグにより能力指標 A/B/C の表示値がどこまで実値と乖離しているかが未確定。db/model 側の修正方針が決まるまで UI 表示値の正しさを保証できない。",
    "smartphoneOnly モードで全指標が未算出（=100表示）となる場合、履歴画面にモード起因の注記や区別表示を出す必要があるかが未確定。Middleware（sensor.service のゼロ埋め挙動）と企画判断が必要。"
  ],
  "rationale_notes": [
    "本ノードは表示責務のみを持ち、スコア算出・未算出判定のロジックは Middleware 側に置く方針。したがって『100 が表示され得る』はUI仕様の不備ではなく上流の出力契約に起因する実装実態として記録する。",
    "指標ラベルを settings.label 由来と明記したのは、UI 仕様書にラベル文言を二重管理すると infra 側 scoreLogic.json との乖離（旧記述の筋力/柔軟性/視野）が再発するため。",
    "labelB とコード内コメントの食い違いは承認済みファクトの方針に従い記録のみとし、表示は settings.label を正とする（画面が参照する実際の値であるため）。",
    "labelC 空・label3/label4 空の扱いは、CAN 版が scoreC/score3/score4 を設定しないという上流事実と整合させるため『対応関係』として記述し、切替実装や仕様変更の是非には踏み込まない。",
    "既存仕様の関数レベル記述（getMessage の first フラグ挙動、chartRender の sleep(100)、makeCapabilityGraphData の unshift による並び替えなど）は実装上の注意点として意図的に維持した。"
  ]
}
```