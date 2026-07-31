# ui.history.page — 過去の診断結果 履歴・能力指標画面 (画面7-1 / 7-2)

## 概要
過去の運転診断結果を Chart.js で可視化する画面。ヒストリータブ (総合 + 4 指標) と能力指標タブ (scoreA/B/C) を持ち、直近 `GRAPH_MAX=30` 件を古い順に表示。`settings.scoreShowStarArea1/2/3` で生スコアと順位表示を切り替え、`orderOfMessage` で positive/negative の表示順を制御する。能力指標タブは `capabilityScoreTargetDays`（既定 30 日）以内のスコアを平均し、Tooltip ホバーで該当日のサブグラフを表示する。

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
label1..4, labelA/B/C: string
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
  4. `initialize()` → `loginService.initialize()` + `logService.initialize(file)` + label/scoreShowStar/target 反映。
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
- 3 つのグラフオブジェクト `graph3=筋力(A)/graph4=柔軟性(B)/graph5=視野(C)` を構築（`{ [scoreTimestamp]: { date, label, score, message, subGraph } }`）。
- `pushCapabilityGraphData` は `score <= -1` または既に GRAPH_MAX に達したらスキップ。sub グラフも GRAPH_MAX で上限。
- `lineChartCapability(labelA, borderColor, graph3, true, lineCanvas3.nativeElement)` を A/B/C ごとに呼ぶ。

## `makeCapabilityGraphData(graph, targetDate, dummyData)`
- key を降順ソートしラベル/値/messages を新しい順から詰め、`labels.unshift` で最終的に古い順に並べる。
- `targetDate <= graph[key].date` の要素だけを `totalScore` の平均に含める（`capabilityScoreTargetDays` の範囲）。
- 30 件未満なら `dummyData=true` のとき残枠を空ラベルで埋める。

## `lineChart1` / `lineChart2`
- Chart.js の line チャート。`intersect: false`, `mode: 'index'`、Y 軸は `scoreShowStarArea*` に応じて `reverse` を反転（順位表示時は下方向が良い）。
- ラベルは 8pt、tooltip callback で「N 点」「N 位」「ポジティブ K 回、ネガティブ K 回」を組み立てる。
- `lineChart2` は `label1..4` が空文字でないもののみ dataset に追加（色は既定パレット）。

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

## 業務ルール
- 履歴は最新 30 件を古い順に並べる。30 件未満は空ラベルで左詰め表示。
- 星表示 (`scoreShowStar*=true`) は 0-100 の高い方が良い、順位表示 (`false`) は `101-score` (1 が最高、100 が最低) で下向きに良い。
- 能力指標の平均対象は「今日から `capabilityScoreTargetDays` 日前」までの Score。ホバーでその Score の走行内サブグラフを表示する。

## 関連ノード
- 依存: [[db.score.repository]] / [[middleware.login.service]] / [[middleware.log.service]]
