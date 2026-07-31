<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-20 10:30:52 JST -->

```json
{
  "required_changes": [
    {"node": "db.score.model", "entrypoint": "spec/db/score-model.md", "description": "score系フィールドが小数(REAL)を保持する前提と、丸めは表示層責務であることを明記"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "should", "reason": "スコアは小数値を保持するため、表示時の丸め処理はUI（表示層）責務となる"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "ScoreLogic出力の小数スコアがモデル/DBへそのまま保持される整合を確認"}
  ],
  "requirements_context": "db.score.repository のscore系カラムをREAL化する型是正に合わせ、Score/Message/CapabilityScoreモデルの各スコアフィールドが小数を保持する前提を明記する。モデル側は既にTypeScriptのnumber型のため実質整合済みだが、DBスキーマ(REAL)との型一致を注記する。丸め処理は表示層(UI)の責務であり、モデルおよびDBは小数値を丸めずそのまま保持する。CapabilityScoreコンストラクタのscoreA→B/C上書き挙動（バグの疑い）は判断保留のため現状記述を維持し、spec/unknowns.md参照を残す（今回は変更しない）。makeDbScore/makeDbMessage/makeDbCapabilityScoreの復元ロジックは現行維持。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "スコア系フィールドは小数値を保持する",
      "statement": "Score.overAll/score1..4、Message.score、CapabilityScore.scoreA/B/C は小数値(REAL相当)を保持し、丸めずに保存する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "スコア系フィールドの-1は未設定を表す",
      "statement": "overAll/score1..4 および scoreA/B/C の初期値-1は未設定状態を意味する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "モデルのスコア型はDBスキーマ(REAL)と一致する",
      "statement": "モデルのnumber型スコアフィールドはdb.score.repositoryのREALカラムと型一致する",
      "status": "candidate"
    },
    {
      "type": "display_rule",
      "title": "スコアの丸めは表示層責務",
      "statement": "スコア値の丸め処理は表示層(UI)が担い、モデルおよびDBは小数値をそのまま保持する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "Score.timestampはscore_idを採用する",
      "statement": "makeDbScoreではtimestampにscore_id(PK相当)を採用する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "スコアモデルは3テーブルと1:1対応する",
      "statement": "Score/Message/CapabilityScoreはscore/score_history/capability_scoreテーブルと1:1で対応する",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "CapabilityScoreのscoreA→B/C上書きはバグの疑い",
      "statement": "コンストラクタがcapabilityScore.score.scoreAをA/B/Cすべてに代入しており、B/CがAの値で上書きされる挙動がバグかどうか未確定",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "CapabilityScoreコンストラクタでscoreAをscoreB/scoreCにも代入している挙動がバグか意図的かはMiddleware/QA判断が必要。誤りの場合、能力指標B/Cの保存値が不正となり集計・表示に影響する（今回は判断保留・現状維持、spec/unknowns.md参照）"
  ],
  "rationale_notes": [
    "モデルのスコアフィールドは既にTypeScriptのnumber型であり小数を扱えるため、コード上の変更は不要で、DBスキーマREAL化との型一致を注記するに留める",
    "丸めをモデル/DBで行わない方針にすることで、集計や再計算時の精度劣化を防ぎ、表示要件の変更をUI側に閉じ込められる",
    "makeDb*系の復元ロジックおよびmakeDummyDataは今回の型是正の対象外であり現行挙動を維持する"
  ]
}
```

差分更新した仕様書は以下の通りです（`## 型と精度` セクションを追加、その他は維持）：

```markdown
# db.score.model — Score / Message / CapabilityScore モデル

## 概要
運転診断結果のドメインモデル。3 つのクラスを持ち、JSON（ロジック出力）／DB SELECT／ダミー生成の 3 経路で復元できる。

## 真実源
- `src/data/src/app/data/score.ts`

## 型と精度
- 各スコアフィールド（`Score.overAll` / `score1..4`、`Message.score`、`CapabilityScore.scoreA/B/C`）は **小数値** を保持する。TypeScript の `number` 型であり、[[db.score.repository]] の `REAL` カラムと型一致する（型是正 P-6 に対応）。
- モデルおよび DB は小数値を **丸めずにそのまま保持** する。**丸め（表示桁数の調整など）は表示層（UI）の責務**であり、モデル層では行わない。
- 初期値 `-1` は「未設定」を意味する（`overAll/score1..4`、`scoreA/B/C` 共通）。

## Message
```
class Message {
  initialize: boolean = false;
  timestamp: number;
  intersection: string;
  id: number;
  key: string;      // 'over_all' | 'score1' | 'score2' | 'score3' | 'score4'
  type: string;     // 'positive' | 'negative'
  text: string;
  score: number = 0;

  constructor(data: any, score: Score);
  static makeDbMessage(data: any): Message;
}
```
- コンストラクタ: `data.id` と `data.message` の両方が非 null のときのみ `initialize=true` にする。`score` フィールドは `data.key` に応じて親 `Score` の対応スコア値を代入する。
- `makeDbMessage`: DB SELECT 結果（`message_id/message_key/message_type/message_text/intersection/timestamp/score`）から再構築し `initialize=true` を強制する。

## CapabilityScore
```
class CapabilityScore {
  initialize: boolean = false;
  timestamp: number;
  scoreA: number = -1;   // -1 は未設定
  scoreAMessage: string = "";
  scoreB: number = -1;
  scoreBMessage: string = "";
  scoreC: number = -1;
  scoreCMessage: string = "";

  constructor(data: any, timestamp: number);
  static makeDbCapabilityScore(data: any): CapabilityScore;
}
```
- コンストラクタは `data.capabilityScore.score` から `scoreA/B/C` を読む。ソースは `capabilityScore.score.scoreA ?? -1` を A/B/C すべてに代入している（**バグの疑い**: B/C が A の値で上書きされる）。この挙動は現状の実挙動として尊重し、`spec/unknowns.md` にも記載。
- `scoreA/B/C` の少なくとも 1 つが `-1` より大きいときのみ `initialize=true`。
- messages は `messageA/B/C.message` を `scoreAMessage/BMessage/CMessage` へ格納。
- `makeDbCapabilityScore`: DB の `score_a/score_b/score_c/score_a_message/…` から復元。`initialize=true` を強制。

## Score
```
class Score {
  initialize: boolean = false;
  timestamp: number;
  overAll: number = -1;    // -1 は未設定
  score1: number = -1;
  score2: number = -1;
  score3: number = -1;
  score4: number = -1;
  hiyari: boolean = false;
  intersection: string = '';
  messages: Array<Message>;
  capabilityScore: CapabilityScore;
  graphCapabilityScoreList: Array<CapabilityScore>;

  constructor(data: any, timestamp: number, dummy?: boolean);
  static makeDbScore(data: any): Score;
}
```
- コンストラクタ:
  - `data == null && dummy` のときは `makeDummyData()` を呼びランダムな Score を作る（ブラウザ検証用）。
  - `data.drivingScore.score` から `overAll/score1..4` を復元。
  - `capabilityScore` は `new CapabilityScore(data, timestamp)`。
  - スコア・ヒヤリ・能力指標いずれかが有効なら `initialize=true`。
  - `data.drivingScore.messages[i]` を `Message` へ変換して `messages` に追加（`initialize=true` のもののみ）。
- `makeDbScore`: DB SELECT の `score_id/score_over_all/score1..4` から復元。`timestamp` は `score_id` を採用（PK 相当）。

## `Score.makeDummyData`（ブラウザ用ダミー）
50% の確率で空。50% の確率で `overAll/score1..4` を `Math.random()*100`、`hiyari` を 10% 確率で true、`capabilityScore` を 10% 確率で生成し、10 種類の代表メッセージから抽選する。

## 保存側との対応
[[db.score.repository]] の 3 テーブル（`score` / `score_history` / `capability_score`）と 1:1 で対応する。スコア系カラムは `REAL`（小数）であり、本モデルの `number` 型スコアフィールドと型一致する。

## 関連ノード
- 永続化: [[db.score.repository]]
- 生成元: [[middleware.score.logic]]（ScoreLogic の実行結果を Score へ変換）
- 参照元: [[ui.driving.page]] / [[ui.comment.page]] / [[ui.history.page]] / [[ui.badspot.page]]
```