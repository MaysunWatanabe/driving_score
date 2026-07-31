# ui.comment.page — アドバイス表示画面 (画面5-1)

## 概要
直近 1 回の運転診断結果 (`loginService.scoreId = startTimestamp`) の詳細コメント画面。over_all/score1..4 × positive/negative の 5×2 マトリクスで、positive は最高スコア・negative は最低スコアの代表 message を選出し、同一 id の出現回数を `%COUNT`、交差点名を `%INTERSECTION` に置換する。`scoreShowStarArea1/2` と `orderOfMessage` 設定でスコアと表示順を制御する。

## 真実源
- `src/data/src/app/comment/comment.page.ts`
- `src/data/src/app/comment/comment.page.html`

## ルーティング
- パス: `/comment`

## 状態
```
label1..4: string
scoreShowStarArea1 / area2: boolean
scoreOverAll, score1..4: number
rankScoreOverAll, rankScore1..4: number    // 順位表示用 (101 - Math.round)
msgOverAll, msg1..4: String
```

## ライフサイクル
- **constructor**: `logService.initialize(file)`。
- **`ngOnInit()`**: label / scoreShowStar を settings から反映。
- **`ionViewWillEnter()`**:
  1. Android のみ `screenOrientation.lock(PORTRAIT)`。
  2. `scoreDbService.selectScore(loginService.scoreId)` を await。
  3. 結果配列末尾 (=最新) の Score を選び、スコアと順位に反映。
  4. 5 × 2 マトリクスでメッセージ選定 → `msgOverAll / msg1..4` を組み立て。

## メッセージ選定アルゴリズム
- 対象キー: `['over_all', 'score1', 'score2', 'score3', 'score4']`
- 対象タイプ: `['positive', 'negative']`
- 各 (key, type) について:
  - `msgScore` の初期値は positive=`-1`、negative=`9999`。
  - `score.messages` を走査し、`score !== -1` かつ (key, type) 一致のうち、
    - positive は **より高い score** を持つメッセージを、
    - negative は **より低い score** を持つメッセージを採用（`msgId, msgText, msgScore` を更新）。
    - 同点で後から出現したメッセージが採用される（`<`/`>` を厳密不等号で書いており、同点は「先勝ち」の可能性あり。ソース確認要）。
  - `msgText` に対し `%INTERSECTION` を `intersection` で置換。
  - `msgCount` を「同一 id を持つメッセージ数」でカウントし、`%COUNT` を数値文字列で置換。
- `orderOfMessage=0` のとき **positive→negative**、`=1` のとき **negative→positive** で表示する。

## `joinMessage(msg1, msg2)`
- 両方非空 → `msg1 + "\n" + msg2`
- 片方のみ → 非空の方
- 両方空 → `""`

## `getRank(score)`
- `rank = 101 - Math.round(score)`、100 超は 100 に丸める。

## 業務ルール
- 表示対象は直近 1 走行のみ。他の走行を選ぶ導線は本画面には無い（履歴からは [[ui.history.page]] を参照）。
- ヒヤリ地点への遷移は本画面から発生しない。
- `%COUNT` は選定された代表 message の id と同じ id の出現数（＝そのメッセージが何回発火したか）で置換される。

## 関連ノード
- 依存: [[db.score.repository]] / [[middleware.login.service]] / [[middleware.log.service]]
