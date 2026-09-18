<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:34:33 JST -->

```json
{
  "required_changes": [
    {"node": "db.score.model", "entrypoint": "spec/db/score-model.md", "description": "スコア系フィールドのREAL整合（db.schema.corrections）、CAN版が実際に設定するのはscore1/score2/overAll/scoreA/scoreBのみで残りは未設定、未算出時に既定100が保持される実装実態、score.ts:70-72のscoreA三重代入を実装バグとして記録（コード変更なし）を追記"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "should", "reason": "未算出時に100が保持されるため、score3/score4/scoreC が満点として表示され得る（表示可否の判断が必要）"},
    {"domain": "QA-agent", "severity": "should", "reason": "保持値100が「未算出」か「満点」か区別できないため、期待値検証の前提を明示する必要がある"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "未算出100の出所（scoreLogicFunction.txt:105-107 / L871-874）およびscore3/score4/scoreC未設定はmiddleware側ファクトと整合させる"}
  ],
  "requirements_context": "db.score.model は Score / Message / CapabilityScore の3クラスからなる運転診断結果のドメインモデルで、JSON（ScoreLogic出力）／DB SELECT／ダミー生成の3経路で復元される。scoreテーブル群（score / score_history / capability_score）と1:1対応する。今回反映すべき承認済みファクトは4点。(1) スコア系カラムは db.schema.corrections が管理する REAL 型是正の対象であり、モデル側は TypeScript number 型のためコード変更不要、DBスキーマ(REAL)との型一致を注記するにとどめる。丸めは表示層（UI）責務で、モデル・DBは小数を丸めず保持する。(2) 実運用（CAN版 scoreLogicFunction.txt）で実際に値が設定されるのは score1 / score2 / overAll / scoreA / scoreB のみであり、score3 / score4 / scoreC は算出処理そのものが存在せず未設定のまま保持される。したがってモデル上フィールドは存在するが、実データとしては意味を持たない。(3) 未算出時はスコアロジック側の既定値により 100 が保持される（出所: scoreLogicFunction.txt:105-107、および同 L871-874 が null を返し scoreList が空になる経路）。モデルのフィールド初期値 -1 は「未設定」を意味するが、ScoreLogic 経由で復元される実データでは -1 ではなく 100 が入り得るため、-1 と 100 の二系統の未設定表現が並存する。(4) CapabilityScore コンストラクタ（score.ts:70-72）が capabilityScore.score.scoreA を scoreA / scoreB / scoreC の3箇所へ代入しており、scoreB / scoreC が scoreA の値で上書きされる。これは実装バグとして記録するのみで、修正は打ち合わせ後とし今回コードは1行も変更しない。ただし CAN 版が設定するのは scoreA / scoreB のみであり、この三重代入により scoreB の算出値がDBに保存されない可能性がある点も実装実態として記録する。makeDbScore（timestamp に score_id を採用）／makeDbMessage／makeDbCapabilityScore の復元ロジックおよび makeDummyData は今回の対象外で現行挙動を維持する。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "スコア系フィールドは小数値を保持する",
      "statement": "Score.overAll/score1..4、Message.score、CapabilityScore.scoreA/B/C は小数値(REAL相当)を丸めずに保持する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "モデルのスコア型はDBのREALカラムと一致する",
      "statement": "モデルのnumber型スコアフィールドはdb.schema.correctionsで是正されたREALカラムと型一致する",
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
      "title": "実際に値が設定されるスコアはscore1/score2/overAll/scoreA/scoreBのみ",
      "statement": "CAN版スコアロジックが値を設定するのは score1 / score2 / overAll / scoreA / scoreB のみで、score3 / score4 / scoreC は未設定のまま保持される",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "未算出スコアは既定100として保持される",
      "statement": "スコアが算出されない場合、ScoreLogic側の既定値により各スコアは100として保持・保存される（出所: scoreLogicFunction.txt:105-107 および L871-874 の null 復帰による scoreList 空）",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "モデルのフィールド初期値-1は未設定を表す",
      "statement": "Score.overAll/score1..4 および CapabilityScore.scoreA/B/C のフィールド初期値-1はモデル上の未設定状態を意味する",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "未設定表現が-1と100の二系統で並存する",
      "statement": "モデル初期値の-1とScoreLogic既定値の100が並存するため、保持値だけでは未算出か満点かを判別できない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "score.ts:70-72のscoreA三重代入は実装バグとして記録のみ",
      "statement": "CapabilityScoreコンストラクタ(score.ts:70-72)がcapabilityScore.score.scoreAをscoreA/scoreB/scoreCの3箇所へ代入しscoreB/scoreCを上書きする挙動は実装バグとして記録し、修正は打ち合わせ後とする（今回コード変更しない）",
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
      "type": "data_semantics",
      "title": "CapabilityScoreのinitialize判定はA/B/Cのいずれかが-1超のとき成立する",
      "statement": "CapabilityScoreはscoreA/B/Cの少なくとも1つが-1より大きい場合にinitialize=trueとなる",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "未算出時に保持される100を「未算出」として識別する手段が必要か未確定。DBには実スコア100と同一値が入り区別不能で、履歴閲覧(UC09)や集計・平均計算の妥当性、UI表示（満点扱い）に影響する。DB/Middleware/QA/UIの合意が必要",
    "score3/score4/scoreC 列を将来も保持し続けるか（列は残すが常に既定値のまま）が未確定。算出処理が存在しないため意味を持たないカラムが残存し、スキーマ設計とQAの期待値定義に影響する",
    "score.ts:70-72のscoreA三重代入により、CAN版が算出するscoreBの値がDBへ保存されているか未確定（上書きされている疑い）。修正は打ち合わせ後のためMiddleware/QAでの実測確認が必要で、能力指標Bの履歴データ全体の信頼性に影響する"
  ],
  "rationale_notes": [
    "モデルのスコアフィールドは既にTypeScriptのnumber型で小数を扱えるため、REAL化に伴うコード変更は不要であり、DBスキーマとの型一致を注記するに留める",
    "丸めをモデル/DBで行わない方針により、集計や再計算時の精度劣化を防ぎ、表示要件の変更をUI側に閉じ込められる",
    "score3/score4/scoreC はモデル定義としては存在するがCAN版では算出されないため、仕様書では「フィールドは存在するが実データとしては意味を持たない」ことを明示し、実装実態と設計意図を混同させない",
    "未算出100はモデル側の初期値-1ではなくScoreLogic側の既定値に由来するため、責務の所在（middleware.score.logic）を明記して読者の誤解を防ぐ",
    "score.ts:70-72 の三重代入は既存データにも影響し得るが、承認済み方針どおり記録のみとし、コード修正やマイグレーション提案は行わない",
    "makeDb*系の復元ロジックおよびmakeDummyDataは今回の是正対象外であり現行挙動を維持する"
  ]
}
```

差分更新した仕様書は以下の通りです（`## 型と精度` を更新、`## 実際に保持される値` を新設、CapabilityScore の記述を実装バグ記録として整理。その他は維持）。

```markdown
# db.score.model — Score / Message / CapabilityScore モデル

## 概要
運転診断結果のドメインモデル。3 つのクラスを持ち、JSON（ロジック出力）／DB SELECT／ダミー生成の 3 経路で復元できる。

## 真実源
- `src/data/src/app/data/score.ts`

## 型と精度
- 各スコアフィールド（`Score.overAll` / `score1..4`、`Message.score`、`CapabilityScore.scoreA/B/C`）は **小数値** を保持する。TypeScript の `number` 型であり、[[db.schema.corrections]] による型是正後の `REAL` カラム（[[db.score.repository]]）と型一致する。
- モデルおよび DB は小数値を **丸めずにそのまま保持** する。**丸め（表示桁数の調整など）は表示層（UI）の責務**であり、モデル層では行わない。
- モデルのフィールド初期値 `-1` は「モデル上の未設定」を意味する（`overAll/score1..4`、`scoreA/B/C` 共通）。

## 実際に保持される値（実装実態）
本モデルは 5 指標＋3 能力指標のフィールドを持つが、実運用（CAN 版スコアロジック）で実際に値が設定されるのは以下に限られる。

| フィールド | 実運用での扱い |
| --- | --- |
| `overAll` / `score1` / `score2` | CAN 版が算出し値を設定する |
| `score3` / `score4` | **算出処理が存在せず未設定のまま** |
| `scoreA` / `scoreB` | CAN 版が算出する（ただし後述の三重代入の影響を受ける） |
| `scoreC` | **算出処理が存在せず未設定のまま** |

- **未算出時は既定 100 が保持される。** これはモデルの初期値 `-1` ではなく、スコアロジック側の既定値に由来する（出所: `assets/data/scoreLogicFunction.txt:105-107`、および同 L871-874 が `null` を返して `scoreList` が空になる経路）。詳細は [[middleware.score.logic]] / [[middleware.score.logicCan]] を参照。
- 結果として、**未設定表現が `-1`（モデル初期値）と `100`（ロジック既定値）の二系統で並存**する。DB に保存される実データ側は `100` が入り得るため、保持値だけでは「未算出」と「満点」を判別できない（→ `spec/unknowns.md`）。

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
- `key` は `score3` / `score4` も取り得る形になっているが、CAN 版は当該スコアを設定しないためメッセージも生成されない。

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
- コンストラクタは `data.capabilityScore.score` から `scoreA/B/C` を読む。**実装実態として `score.ts:70-72` は `capabilityScore.score.scoreA ?? -1` を `scoreA` / `scoreB` / `scoreC` の 3 箇所すべてへ代入しており、`scoreB` / `scoreC` が `scoreA` の値で上書きされる。**
  - これは **実装バグとして記録するのみ**であり、修正は打ち合わせ後とする（本更新でコードは変更しない）。
  - CAN 版が算出するのは `scoreA` / `scoreB` のみであるため、この三重代入により `scoreB` の算出値が保存されていない可能性がある（未確定・`spec/unknowns.md` 参照）。
- `scoreA/B/C` の少なくとも 1 つが `-1` より大きいときのみ `initialize=true`。
- messages は `messageA/B/C.message` を `scoreAMessage/BMessage/CMessage` へ格納。
- `makeDbCapabilityScore`: DB の `score_a/score_b/score_c/score_a_message/…` から復元。`initialize=true` を強制する（この経路では三重代入は行われない）。

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
- ヒヤリは `hiyari=true` とメッセージのみを保持し、スコア値には影響しない（[[middleware.score.logicCan]] の実装実態）。

## `Score.makeDummyData`（ブラウザ用ダミー）
50% の確率で空。50% の確率で `overAll/score1..4` を `Math.random()*100`、`hiyari` を 10% 確率で true、`capabilityScore` を 10% 確率で生成し、10 種類の代表メッセージから抽選する。実機の実データとは異なり `score3/score4/scoreC` にも値が入るため、ダミーデータでの検証結果を実運用の期待値としてはならない。

## 保存側との対応
[[db.score.repository]] の 3 テーブル（`score` / `score_history` / `capability_score`）と 1:1 で対応する。スコア系カラムは [[db.schema.corrections]] の型是正により `REAL`（小数）であり、本モデルの `number` 型スコアフィールドと型一致する。`score3` / `score4` / `score_c` 相当の列は存在するが、実運用では算出処理がないため既定値のまま保存される。

## 関連ノード
- 永続化: [[db.score.repository]] / 型是正: [[db.schema.corrections]]
- 生成元: [[middleware.score.logic]] / [[middleware.score.logicCan]]（ScoreLogic の実行結果を Score へ変換）
- 参照元: [[ui.driving.page]] / [[ui.comment.page]] / [[ui.history.page]] / [[ui.badspot.page]]
```