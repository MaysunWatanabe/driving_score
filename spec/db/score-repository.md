<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-20 10:30:38 JST -->

```json
{
  "required_changes": [
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "score/score_history/capability_scoreのスコア系カラムをINTEGERからREAL宣言に是正し丸め規則を明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "insertScoreの3テーブルINSERTを単一トランザクション化し途中失敗時は全ロールバックする仕様に是正"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "should", "reason": "score算出値が小数のまま保存されるため、表示層でのMath.round適用有無を計算/表示責務側で確認する必要がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "トランザクション化により部分失敗時の孤児レコード非生成、バルクINSERT途中失敗時の全ロールバックを検証する必要がある"}
  ],
  "requirements_context": "ScoreDbServiceはdriving-score.dbのscore/score_history/capability_scoreの3テーブルへ運転診断結果を保存・参照する。(1)スコア型是正: 実装は小数値を算出・格納・復元しており（ヒストリーChart表示も小数前提）、これに合わせてscore.score_over_all/score1..4、capability_score.score_a/b/c、score_history.scoreの各カラムをINTEGER宣言からREALに是正する。丸め規則は『保存=小数のまま、表示層で必要に応じMath.round』とする。(2)insertScoreのトランザクション化: score→score_history→capability_scoreへのINSERT（history/capabilityは1000レコード刻みバルクINSERT）を単一トランザクションで囲み、途中失敗時は全ロールバックする。従来の『明示的トランザクションなし・部分失敗でscoreのみ残留』欠陥を解消し孤児レコードを防ぐ。未ログイン(userId='')時はSELECT/INSERTが0件返却/no-opでレコードを生成しない。score_id=診断開始UnixTime(ms)、3段JOIN SELECT、delete連鎖削除等の他仕様は現行維持。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "スコア値は小数のまま保存される", "statement": "score.score_over_all/score1..4、capability_score.score_a/b/c、score_history.scoreは小数値をそのまま格納するためREAL型で保持する", "status": "candidate"},
    {"type": "business_rule", "title": "丸めは表示層責務", "statement": "スコア値は保存時に丸めず小数のまま保持し、丸めが必要な場合は表示層でMath.roundを適用する", "status": "candidate"},
    {"type": "constraint", "title": "insertScoreは単一トランザクションで実行される", "statement": "insertScoreにおけるscore/score_history/capability_scoreへの全INSERTは単一トランザクション内で実行される", "status": "candidate"},
    {"type": "constraint", "title": "バルクINSERT途中失敗時は全ロールバック", "statement": "1000レコード刻みのバルクINSERTが途中で失敗した場合、当該走行分の3テーブルへの書き込みをすべてロールバックする", "status": "candidate"},
    {"type": "state_rule", "title": "孤児レコードを生成しない", "statement": "insertScoreの失敗時にscoreテーブルのみレコードが残留する状態を許容しない", "status": "candidate"},
    {"type": "input_rule", "title": "未ログイン時はレコードを生成しない", "statement": "userIdが空文字（未ログイン）の場合、SELECTは0件返却、INSERTはno-opとしレコードを生成しない", "status": "candidate"},
    {"type": "business_rule", "title": "score_idは診断開始タイムスタンプ", "statement": "score_idは診断開始のUnixTime(ms)であり同一ユーザー内で重複しない前提を維持する", "status": "candidate"},
    {"type": "business_rule", "title": "delete連鎖削除は現行維持", "statement": "deleteはユーザー単位でcapability_score→score_history→scoreの順に連鎖削除する仕様を維持する", "status": "candidate"}
  ],
  "open_questions": [
    "SQLiteはREAL宣言でも実際は緩やかな型親和性を持つため、既存INTEGER宣言DBに対しマイグレーションが必要か（列型再定義/新規CREATEのみで足りるか）はDB/実装で要確認",
    "表示層でMath.roundを適用する具体的箇所・桁数（整数丸めか小数第n位か）はMiddleware/UIで要確認",
    "insertScoreHistory/insertCapabilityScoreが再帰バルクINSERTである中で、トランザクション境界をinsertScore全体に張るのか各バルク単位かの実装粒度はMiddleware/実装で要確認"
  ],
  "rationale_notes": [
    "SQLiteの型親和性により従来INTEGER宣言でも小数が格納できていたが、宣言を実挙動（小数保持）に一致させることで仕様と実装の乖離を解消する意図",
    "トランザクション化の主目的はscoreのみ残留する孤児レコードの防止であり、参照整合性（3段JOIN前提）を保証するため",
    "score_id・3段JOIN SELECT・delete連鎖等は本改修のスコープ外とし現行維持を明示することで回帰リスクを限定する"
  ]
}
```