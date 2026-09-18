<!-- 作成: 2026-09-18 17:57:18 JST | 更新: 2026-09-18 18:30:39 JST -->

# ui.comment.page — アドバイス表示画面 (画面5-1)

## 概要
直近 1 回の運転診断結果 (`loginService.scoreId = startTimestamp`) の詳細コメント画面。
`over_all` / `score1..4` × `positive` / `negative` の 5×2 マトリクスで、positive は最高スコア・negative は最低スコアの代表 message を選出し、同一 id の出現回数を `%COUNT`、交差点名を `%INTERSECTION` に置換する。
`scoreShowStarArea1/2` と `orderOfMessage` 設定でスコアと表示順を制御する。

> **注意（実装実態）**: 5×2 マトリクスは `comment.page.ts` のループ構造であり、「4 指標が算出される」ことを意味しない。
> CAN 版スコアロジックが設定するのは `score1` / `score2` / `overAll` / `scoreA` / `scoreB` のみで、`score3` / `score4` / `scoreC` は未設定である（[[middleware.score-logicCan]]）。

> **注意（改修計画）**: 2026 年度改修要求により、本画面は「☆によるスコア表示の削除」＋「レーダーチャート表示」＋「評価コメント切り替えタブの追加」の対象となる。
> 以降の「現行仕様」節は現在の実装実態、「2026 年度改修要求」節は確定した要求と未確定論点を記述する。両者を混同しないこと。

## 真実源
- `src/data/src/app/comment/comment.page.ts`
- `src/data/src/app/comment/comment.page.html`

改修要求の出所:
- 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04（業務委託相談 2026-07-17 分を合本、全 14 枚）
- メイサンソフト『要求仕様確認』2026-09-17（全 8 枚、確認事項に先方回答併記）— 特に 4 ページ

2026 年度改修要求は全 5 本（①診断開始前画面の前回結果表示／②タブ切り替えの追加／③採点スコアのレーダーチャート表示／④BLE 通信の安定化／⑤ヒヤリ発生時の録画データサイズ改善）であり、本画面は **③** および付随する **評価コメント切り替え** が対象である。

---

# 現行仕様（実装実態）

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
    - 同点時の採用（先勝ち / 後勝ち）は厳密不等号の記述から断定できない（未解決 → open question）。
  - `msgText` に対し `%INTERSECTION` を `intersection` で置換。
  - `msgCount` を「同一 id を持つメッセージ数」でカウントし、`%COUNT` を数値文字列で置換。
- `orderOfMessage=0` のとき **positive→negative**、`=1` のとき **negative→positive** で表示する。

## 未設定スコアの表示扱い（実装実態）
- CAN 版が値を設定するのは `score1` / `score2` / `overAll`（および `scoreA` / `scoreB`）のみ。
- `score3` / `score4` / `scoreC` は設定されないため、本画面の該当スコアは `Score` の初期値である **100** がそのまま表示される（未算出でも 100 として見える）。
- `scoreLogic.json` の `settings.label` において `label3` / `label4` / `labelC` は **空文字** であり、対応するラベル表示も空となる。
- `score3` / `score4` に紐づく message は発火しないため `msg3` / `msg4` は空となり、`joinMessage` の結果として該当メッセージ領域は空表示となる。
- `smartphoneOnly` モードでは `lastCanData` ゼロ埋めにより CAN 版指標が一切発火せず `scoreList` が空になるため、**全スコア項目が未算出の 100** として表示される（[[middleware.sensor-service]]）。

## `joinMessage(msg1, msg2)`
- 両方非空 → `msg1 + "\n" + msg2`
- 片方のみ → 非空の方
- 両方空 → `""`

## `getRank(score)`
- `rank = 101 - Math.round(score)`、100 超は 100 に丸める。

## 業務ルール
- 表示対象は直近 1 走行のみ。他の走行を選ぶ導線は本画面には無い（履歴からは [[ui.history.page]] を参照）。
- 本画面は読み取り専用であり、スコア・順位・メッセージを利用者が編集する手段は無い。
- `%COUNT` は選定された代表 message の id と同じ id の出現数（＝そのメッセージが何回発火したか）で置換される。
- ヒヤリ地点 (`/bad-spot/:path`) への遷移について、真実源に基づく現行記述では**本画面から発生しない**。UC08 の導線所在は未確定（open question 参照）。
- Android では画面表示時に縦向き（PORTRAIT）固定される。

---

# 2026 年度改修要求

開発期限は **2026 年 11 月末**（2026 年 12 月から高齢者を招いた実験が開始されるため）。先方からも「11 月末までに完了は可能でしょうか」と確認されている。

## 表示構成の変更（確定）
- 従来の **☆によるスコア表示を削除**し、**レーダーチャート＋評価コメント**を表示する。
- レーダーチャートの表示仕様:
  - 項目は **筋力・柔軟性・空間把握・危険予測・視力・視野の 6 項目**。
  - 各項目は **1〜5 の 5 段階**（5 に近いほど良好、3 が年齢の平均）。
  - 各項目に **「n 点（5 点満点）」** と **2 行程度の評価コメント** を併記する。
  - チャートは **「今回」** と **「過去の平均」** の **2 系列** を図示する。
  - 各項目に添えるアイコンは **いらすとや** の素材を使用する。
- 「過去の平均」系列は、診断開始前画面 (1-2) の前回結果表示と同じ「履歴平均」概念に対応する。すなわち「前回」は直近 1 件ではなく**過去の履歴の平均**を指す。前回の記録が存在しない場合は線を描画しない（[[ui.opening.page]] / [[ui.previousResult.page]] と整合させる）。

## 評価コメント切り替えタブ（確定）
- **評価コメント切り替えタブは、診断終了後の本画面（5-1 アドバイス表示）にのみ設ける。**
- 目的は「どの評価コメントが効果的か」を利用者アンケートで確認することであり、利用者が複数の評価コメント案を切り替えて比較・閲覧できるようにする。
- タブ切り替え後の表示も、6 項目のレーダーチャートと各項目の「n 点（5 点満点）」＋ 2 行程度の評価コメントという構成を保つ。
- これは **既存の他画面にタブ切り替えを追加するものではない**。改修要求②「タブ切り替えの追加」および新規画面 **8-1 サービス案表示** のタブ（サービス案 1 / サービス案 2）とは別物であり、混同してはならない。

> **注記（スコープ）**: 8-1 サービス案表示については、ノード新設（`ui.servicePlan.page`）が取り下げられ、関連する要求は **本改修の対象外（後続検証）** として open_question に格下げされている。本画面のタブ仕様を 8-1 の仕様と結びつけて設計してはならない。

## 導線（未確定）
- 現行実装では、診断終了後に**スコア欄（☆）をタップする操作が本画面への唯一の導線**である。
- 改修により☆表示を削除するため、この導線は失われる。先方資料には「レーダーチャートを押すと 5-1 に遷移」との記載もあり、置き換え方の確定が必要（open question 参照）。

## 画面向き（未確定）
- 先方から「縦横変更できるようにしてください」との要求があるが、現行実装は Android で PORTRAIT 固定であり、履歴画面・本画面などで `screenOrientation.lock` が掛かっている。
- 本画面をどちらの向きに対応させるか、横向きでのレーダーチャート＋コメントのレイアウト構成が未確定（open question 参照）。

## データ供給（未確定・凍結中）
- 6 項目の採点データ形式（スコア値・評価メッセージの受け取り方）は先方検討中で「試作中に提示します」とされており未確定。
- スコアロジック（`scoreLogicFunction.txt` 系および `scoreLogic.json`）は打ち合わせ後まで**変更凍結**であり、本資料でも凍結は解除されていない。現時点では新仕様の 6 項目値を供給できない。
- 既存の能力指標保持構造（`capability_score` は `scoreA` / `scoreB` / `scoreC` の 3 列・0〜100 の REAL）は、6 項目・1〜5 段階の新仕様と列数も尺度も一致しない（[[db.capability-score.repository]] 側の判断が必要）。

## 未解決事項
### 現行仕様に関するもの
- UC08「ヒヤリ地点確認導線」が本画面に存在するか（`comment.page.html` のマーカー要素・`/bad-spot/:path` 遷移の有無）。
- 未設定スコア（`score3` / `score4` / `scoreC`）の行を非表示にするか、空ラベル＋100 を表示するか。
- 代表メッセージ選定における同点時の採用規則。

### 改修要求に関するもの
- ☆スコア表示削除後の本画面への導線（レーダーチャートタップに置き換えるのか、別導線を設けるのか）。
- 切り替え可能な評価コメントの**種類数・切替単位（6 項目全体か項目単位か）・切替結果の保存有無**（アンケート集計方法を含む）。
- 6 項目のスコアと評価コメントのデータ形式・供給元。
- 過去平均の集計期間（現行 `capability_score_target_days` 既定 30 日を流用するか、別定義を置くか）。
- 本画面の縦横対応範囲と横向きレイアウト。
- 既存の 5×2 マトリクス方式メッセージ（`msgOverAll` / `msg1..4`）を新方式の評価コメントに置き換えるのか、併存させるのか。

## 関連ノード
- 依存: [[db.score.repository]] / [[middleware.login.service]] / [[middleware.log.service]]
- 参照: [[middleware.score-logicCan]] / [[middleware.sensor-service]] / [[infra.assets-scoreLogicJson]] / [[ui.history.page]] / [[ui.opening.page]] / [[ui.previousResult.page]] / [[db.capability-score.repository]]

```json
{
  "required_changes": [
    {"node": "ui.comment.page", "entrypoint": "spec/ui/comment-page.md", "description": "2026年度改修要求が全5本であることと本画面が③レーダーチャート表示の対象である旨を出所節に明記"},
    {"node": "ui.comment.page", "entrypoint": "spec/ui/comment-page.md", "description": "『過去の平均』が直近1件ではなく過去の履歴の平均であることを明示し ui.previousResult.page との整合を追記"},
    {"node": "ui.comment.page", "entrypoint": "spec/ui/comment-page.md", "description": "評価コメント切り替え後もレーダーチャート＋n点（5点満点）＋2行コメントの構成を保つ旨を追記"},
    {"node": "ui.comment.page", "entrypoint": "spec/ui/comment-page.md", "description": "8-1 サービス案表示のノード新設取り下げ・本改修対象外（後続検証）である旨のスコープ注記を追加"},
    {"node": "ui.comment.page", "entrypoint": "spec/ui/comment-page.md", "description": "開発期限2026年11月末を改修要求章の冒頭に明示し、スコアロジック凍結が本資料でも解除されていない旨を追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "6項目1〜5段階のスコアと評価コメントを供給する責務が未定義で、スコアロジックは打ち合わせ後まで変更凍結のため供給方式の判断が必要"},
    {"domain": "DB-agent", "severity": "must", "reason": "capability_score が scoreA/scoreB/scoreC の3列0〜100 REAL であり6項目1〜5段階と列数・尺度が一致しないため保持構造の判断が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "☆スコア表示削除により診断終了後から本画面への唯一の導線が失われるためルーティング・遷移契機の再定義が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "過去平均系列の集計期間を capability_score_target_days（既定30日）に揃えるか別定義にするかの決定が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "縦横変更要求に対し本画面の screenOrientation.lock(PORTRAIT) を維持するか解除するかの判断が必要"},
    {"domain": "DB-agent", "severity": "should", "reason": "評価コメント切替のアンケート目的上、どのコメントが選択・閲覧されたかを記録する必要があるか判断が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "現行の5×2マトリクス表示と新レーダーチャート表示の併存/置換方針が確定するまで期待結果を確定できない"}
  ],
  "requirements_context": "ui.comment.page（画面5-1 アドバイス表示）は UC07（アドバイス表示）および UC08（ヒヤリ地点確認導線）に紐づく。【現行仕様】直近1走行（loginService.scoreId = startTimestamp）の診断結果を対象に、over_all / score1..4 × positive/negative の 5×2 マトリクスで positive は最高スコア・negative は最低スコアの代表 message を選出し、%COUNT（同一 id の出現回数）と %INTERSECTION（交差点名）を置換して表示する。scoreShowStarArea1/2 によりスコア表示（星エリア）を制御し、orderOfMessage により positive→negative / negative→positive の表示順を制御する。順位表示は getRank(score) = 101 - Math.round(score)（100超は100に丸め）。joinMessage は両方非空なら改行連結、片方のみならその値、両方空なら空文字。Android では ionViewWillEnter 時に PORTRAIT 固定。読み取り専用で編集手段は無い。CAN 版スコアロジックが設定するのは score1 / score2 / overAll / scoreA / scoreB のみで score3 / score4 / scoreC は未設定、scoreLogic.json の settings.label の label3 / label4 / labelC も空であるため、当該スコアは Score 初期値 100 のまま・ラベルは空文字・msg3/msg4 は空となる。『4指標算出』という記述は誤りであり用いない。smartphoneOnly モードでは lastCanData ゼロ埋めにより CAN 版の全指標が発火せず scoreList が空となり全項目が未算出の 100 として表示される。表示対象は直近1走行のみで他走行の選択導線は本画面に無い（履歴は ui.history.page）。【2026年度改修要求】出所は日産自動車『運転機能チェックアプリの一次仕様』2026-08-04（業務委託相談2026-07-17分を合本、全14枚）およびメイサンソフト『要求仕様確認』2026-09-17（全8枚、先方回答併記、特に4ページ）。改修要求は全5本（①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善）で、本画面は③および付随する評価コメント切り替えが対象。従来の☆によるスコア表示を削除し、レーダーチャート＋評価コメントを表示する。レーダーチャートは筋力・柔軟性・空間把握・危険予測・視力・視野の6項目、1〜5の5段階（5に近いほど良好、3が年齢平均）、各項目に『n点（5点満点）』と2行程度の評価コメントを併記し、『今回』と『過去の平均』の2系列を図示、アイコンはいらすとや素材を使用する。『過去の平均』は直近1件ではなく過去の履歴の平均を指し、診断開始前画面(1-2)の前回結果表示と同一概念で、記録が無い場合は線を描画しない。評価コメント切り替えタブは診断終了後の本画面(5-1)にのみ設け、どの評価コメントが効果的かアンケートを取るために複数の評価コメント案を切り替えて比較できるようにする。切り替え後も6項目レーダーチャート＋n点（5点満点）＋2行程度コメントの構成を保つ。これは既存画面へのタブ追加ではなく、改修要求②のタブ切り替えおよび新規画面8-1サービス案表示のタブ（サービス案1/2）とは別物である。なお 8-1 についてはノード新設（ui.servicePlan.page）が取り下げられ本改修の対象外（後続検証）とされているため、本画面のタブ仕様を8-1と結びつけてはならない。開発期限は2026年11月末（12月から高齢者実験開始、先方から完了可否を確認されている）。未確定点として、☆削除後の本画面への導線（現行はスコア欄タップが唯一、資料には『レーダーチャートを押すと5-1に遷移』の記載もある）、評価コメントの種類数・切替単位・選択結果の保存有無、6項目の採点データ形式（先方検討中・試作中に提示、スコアロジックは打ち合わせ後まで凍結され本資料でも解除されていない）、能力指標保持構造（capability_score は scoreA/scoreB/scoreC の3列0〜100 REAL で6項目1〜5と列数も尺度も不一致）、過去平均の集計期間（現行 capability_score_target_days 既定30日の流用可否）、縦横変更要求と現行 PORTRAIT 固定（履歴画面・アドバイス画面で screenOrientation.lock）の衝突、既存5×2マトリクスメッセージと新評価コメントの置換/併存方針がある。UC08 のヒヤリ地点遷移導線の所在も未確定のまま。",
  "fact_candidates": [
    {
      "type": "display_rule",
      "title": "アドバイス表示画面は従来の☆スコア表示を削除しレーダーチャートと評価コメントを表示する",
      "statement": "アドバイス表示画面（5-1）は従来の☆によるスコア表示を削除し、レーダーチャートと評価コメントを表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "評価コメント切り替えタブはアドバイス表示画面にのみ設ける",
      "statement": "評価コメントを切り替えるタブは診断終了後のアドバイス表示画面（5-1）にのみ設置し、他の既存画面にはタブ切り替えを追加しない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "評価コメントは複数案を切り替えて比較できる",
      "statement": "アドバイス表示画面では、どの評価コメントが効果的かをアンケートで確認する目的で、利用者が複数の評価コメント案をタブで切り替えて比較・閲覧できる",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "コメント切り替え後もレーダーチャートとn点表記の構成を保つ",
      "statement": "アドバイス表示画面のコメント切り替えタブを切り替えた後も、表示は6項目のレーダーチャートと各項目の『n点（5点満点）』および2行程度の評価コメントで構成される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "レーダーチャートは6項目を1〜5の5段階で表示する",
      "statement": "アドバイス表示画面のレーダーチャートは筋力・柔軟性・空間把握・危険予測・視力・視野の6項目を1〜5の5段階で表示し、5に近いほど良好・3が年齢の平均を意味する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "レーダーチャートは今回と過去の平均の2系列を表示する",
      "statement": "アドバイス表示画面のレーダーチャートは『今回』と『過去の平均』の2系列を図示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "過去の平均は直近1件ではなく履歴の平均である",
      "statement": "アドバイス表示画面のレーダーチャートにおける『過去の平均』系列は直近1件の結果ではなく、過去の履歴の平均値を描画する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "各項目にn点（5点満点）と2行程度の評価コメントを併記する",
      "statement": "アドバイス表示画面は6項目それぞれに『n点（5点満点）』の表記と2行程度の評価コメントを併記して表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "レーダーチャートの項目アイコンはいらすとや素材を使用する",
      "statement": "アドバイス表示画面のレーダーチャート各項目に添えるアイコンはいらすとやの素材を使用する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "過去平均の記録が無い場合は過去系列を描画しない",
      "statement": "過去の記録が存在しない場合、アドバイス表示画面のレーダーチャートは過去平均系列の線を描画しない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "アドバイス表示画面のタブは8-1サービス案表示のタブとは別物である",
      "statement": "アドバイス表示画面の評価コメント切り替えタブは、8-1サービス案表示のサービス案1/サービス案2切り替えタブおよび改修要求②のタブ切り替えとは別の機能である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "8-1サービス案表示は本改修の対象外である",
      "statement": "8-1サービス案表示に関するノード新設は取り下げられ本改修の対象外（後続検証）とされているため、アドバイス表示画面のタブ仕様を8-1の仕様と結びつけて設計してはならない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "アドバイス表示画面は直近1走行のみを表示する",
      "statement": "アドバイス表示画面は loginService.scoreId（startTimestamp）で取得した結果配列の末尾（最新）1件のスコアとメッセージのみを表示し、他走行を選択する導線を持たない",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "score3 / score4 は CAN 版では算出されないため未算出値が表示される",
      "statement": "CAN 版スコアロジックは score3 / score4 を設定しないため、アドバイス表示画面の score3 / score4 および対応順位は Score 初期値 100 に基づく未算出値として表示される",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "label3 / label4 は空文字で表示される",
      "statement": "scoreLogic.json の settings.label のうち label3 / label4 / labelC が空であるため、アドバイス表示画面の該当ラベル表示は空文字となる",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "score3 / score4 の代表メッセージは表示されない",
      "statement": "CAN 版では score3 / score4 に対応する messages が発火しないため、msg3 / msg4 は空となり joinMessage の結果として該当メッセージ領域は空表示となる",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "positive は最高スコア・negative は最低スコアの message を代表として表示する",
      "statement": "各 (key, type) について score !== -1 のメッセージのうち positive は最も高い score、negative は最も低い score を持つ message を代表として表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "%COUNT は同一 id メッセージの出現回数で置換される",
      "statement": "代表 message の本文中の %COUNT は、選定された message と同一 id を持つメッセージの件数（発火回数）を数値文字列に置換して表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "%INTERSECTION は交差点名で置換される",
      "statement": "代表 message の本文中の %INTERSECTION は message の intersection 値に置換して表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "メッセージ表示順は orderOfMessage で切り替わる",
      "statement": "orderOfMessage が 0 のとき positive→negative の順、1 のとき negative→positive の順でメッセージを表示する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "スコア表示は scoreShowStarArea1 / scoreShowStarArea2 で制御される",
      "statement": "現行のアドバイス表示画面のスコア表示（星エリア1／エリア2）は設定値 scoreShowStarArea1 / scoreShowStarArea2 の真偽で表示・非表示が切り替わる",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "順位表示は 101 - Math.round(score) で算出した値を表示する",
      "statement": "アドバイス表示画面の順位表示は getRank(score) = 101 - Math.round(score)（100 を超える場合は 100 に丸め）の結果を表示する",
      "status": "candidate"
    },
    {
      "type": "input_rule",
      "title": "アドバイス表示画面はスコア値を編集できない",
      "statement": "アドバイス表示画面はスコア値・順位・評価コメントを表示するのみで、利用者がこれらの値を編集・入力する手段を持たない（評価コメントの切り替え操作は表示切替であり値の編集ではない）",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "Android では画面表示時に縦向き固定される",
      "statement": "ionViewWillEnter 時、プラットフォームが Android の場合のみ画面の向きを PORTRAIT にロックする",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "smartphoneOnly では全項目が未算出の 100 として表示される",
      "statement": "smartphoneOnly モードでは CAN 版指標が発火せず scoreList が空になるため、アドバイス表示画面の全スコア項目は未算出値 100 として表示される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "アドバイス表示画面の改修は2026年11月末までに完了する必要がある",
      "statement": "アドバイス表示画面のレーダーチャート化および評価コメント切り替え対応は、2026年12月からの高齢者実験開始に間に合わせるため2026年11月末までに完了する必要がある",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "スコアロジックの変更凍結は解除されていない",
      "statement": "scoreLogicFunction.txt 系および scoreLogic.json の変更凍結は2026-09-17時点の資料でも解除されておらず、アドバイス表示画面の6項目スコアを供給する実装に着手できない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "☆スコア表示を削除した後、診断終了後からアドバイス表示画面（5-1）へ遷移する導線が未確定。現行はスコア欄タップが唯一の導線であり、先方資料には『レーダーチャートを押すと5-1に遷移』との記載もあるが、削除対象の☆と遷移元レーダーチャートの所在（診断終了画面か本画面か）が読み取れない。確定しないと本画面のナビゲーション仕様と UC07 の起動契機が定義できない（UI + Middleware ルーティング判断が必要）。",
    "評価コメント切り替えの具体仕様が未確定。切り替え可能なコメント案の種類数、切替単位（6項目全体一括か項目単位か）、切替結果を保存・記録するか（アンケート集計のため）、タブのラベル表記が資料から読み取れない。確定しないとタブUIとデータ取得契約、保存要否（DB影響）が定義できない。",
    "6項目（筋力・柔軟性・空間把握・危険予測・視力・視野）のスコア値と評価コメントの供給方式が未確定。先方が『試作中に提示します』としており形式が未定で、かつスコアロジック（scoreLogicFunction.txt / scoreLogic.json）は打ち合わせ後まで変更凍結（本資料でも未解除）のため、現時点では6項目値を算出・供給できない（Middleware 判断が必要）。表示仕様の実装着手可否に影響する。",
    "既存の能力指標保持構造（capability_score は scoreA/scoreB/scoreC の3列・0〜100 REAL）が新仕様の6項目・1〜5段階と列数も尺度も一致しない。3列拡張／新テーブル／尺度変換のいずれを取るかが未確定で、過去平均系列の取得元が定まらない（DB 判断が必要）。",
    "『過去の平均』の集計期間が未確定。現行は scoreLogic.json の capability_score_target_days（既定30日）で能力指標を平均しているが、これを流用するのか別期間定義を置くのかが資料から判断できない。1-2 前回結果表示との整合にも影響する。",
    "本画面を縦横両対応にするかが未確定。先方は『縦横変更できるようにしてください』と要求しているが、現行は Android で PORTRAIT 固定（履歴画面・アドバイス画面で screenOrientation.lock）であり、横向きでのレーダーチャート＋6項目コメントのレイアウト構成も未定（UI + プロダクト判断が必要）。",
    "現行の5×2マトリクス方式メッセージ（msgOverAll / msg1..4、%COUNT・%INTERSECTION 置換）を新方式の評価コメントで完全置換するのか併存させるのかが未確定。置換する場合、score1/score2/overAll のメッセージ発火ロジックと %COUNT・%INTERSECTION の意味づけが不要になるかの判断が必要。",
    "UC08（ヒヤリ地点確認導線）の所在が未確定。真実源に基づく既存仕様は『ヒヤリ地点への遷移は本画面から発生しない』と記述しており、comment.page.html にマーカー／遷移要素が存在するかの実装確認（UI + Middleware ルーティング判断）が必要。確定しないと UC08 のトレーサビリティが確定できない。",
    "score3 / score4 が未設定・label3 / label4 が空の場合、UI が該当行を非表示にするのか、空ラベル＋100 を表示するのかが comment.page.html から未確認。レーダーチャート化により本論点が解消されるのか、移行期間中に残るのかも未定。",
    "代表メッセージ選定で score が同点の場合に先勝ち／後勝ちのどちらになるかが厳密不等号の記述から断定できない。表示メッセージが非決定的に見える恐れがあり Middleware/実装確認が必要。",
    "score3 / score4 に対応する messages が Score レコード上に一切存在しないのか、score = -1 として存在するのかが UI からは断定できない（DB/Middleware 確認が必要）。msg3/msg4 の空判定条件に影響する。"
  ],
  "rationale_notes": [
    "本画面は表示責務のみを持ち、スコア値・ヒヤリ判定・メッセージ発火・6項目評価の算出責務は Middleware 側にある。UI 仕様では『表示する』ことのみを断定し、算出方式は参照に留める。",
    "承認済み design_decision（node=ui.comment.page）2件に従い、評価コメント切り替えタブは本画面限定であること、および切り替え後も6項目レーダーチャート＋n点＋2行コメントの構成を保つことを明記した。改修要求②『タブ切り替えの追加』および8-1のタブと混同しないよう注記を維持・強化している。",
    "8-1 サービス案表示については ui.servicePlan.page のノード新設が取り下げられ本改修対象外（後続検証）となった承認済み判断を反映し、本画面のタブ設計が 8-1 の未確定仕様（画像貼り付け方式・切り替え方式）に引きずられないようスコープ注記を追加した。",
    "『過去の平均』は 1-2 前回結果表示の承認済みファクト（前回＝直近1件ではなく履歴平均、記録なしは未描画）と同一概念であることを明示し、集計期間の具体値は未確定として open question に分離した。",
    "現行実装と改修要求が大きく異なるため、md を『現行仕様（実装実態）』と『2026年度改修要求』の2章に分離した構成を維持した。実装凍結中（スコアロジック変更禁止）の状況下で、実装実態の記述を失わずに要求を併記するための構成である。",
    "承認済みファクトに従い『4指標算出』という表現は用いず、CAN 版で実際に設定される score1 / score2 / overAll / scoreA / scoreB と、未設定の score3 / score4 / scoreC を区別して記述した。",
    "5×2 マトリクスというループ構造の記述は comment.page.ts の実装実態であるため維持し、その上で CAN 版では score3/score4 側が実質空になる帰結を維持した。",
    "未算出時に 100 が表示されることは仕様上の是非を含む論点だが、実装実態としてのみ記述し良否判断は書かない方針を維持した。",
    "開発期限（2026年11月末／12月実験開始）は承認済み constraint であり、改修要求章の冒頭に移して優先度判断の前提として読めるようにした。"
  ]
}
```