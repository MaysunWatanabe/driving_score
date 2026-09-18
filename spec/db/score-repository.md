<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:34:18 JST -->

```json
{
  "required_changes": [
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "score/score_history/capability_scoreのスコア系カラムをINTEGER宣言からREAL宣言に是正し丸め規則（保存=小数のまま/丸めは表示層）を明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "insertScoreの3テーブルINSERT（history/capabilityは1000件刻みバルク）を単一トランザクション化し途中失敗時は全ロールバックする仕様に是正"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "全SELECT/INSERT/DELETEをログイン中ユーザー（middleware.login.service由来のuserId）でスコープする前提をUC06/UC07/UC09の各参照系に明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "直近1走行のコメント取得（UC07）・直近30走行のスコア推移取得（UC09）・能力指標の過去N日平均取得の3参照系のスコープ・並び順・件数上限・0件時の返却規約を仕様化"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "永続化操作（保存・参照・削除）の実行結果をmiddleware.log.serviceへ操作ログとして出力する責務を明記（ログ出力失敗はDB操作を失敗させない）"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "userIdのスコープ供給元がmiddleware.login.serviceであり、未ログイン時（userId空文字）の呼び出し可否と戻り値解釈を計算/表示責務側と揃える必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "スコアを小数のまま保存するため表示層でのMath.round適用箇所と桁数、および過去N日平均をSQL集計とするかアプリ側再計算とするかの責務分担を確認する必要がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "トランザクション化による部分失敗時の孤児レコード非生成、バルクINSERT途中失敗時の全ロールバック、未ログイン時の0件/no-op、直近30件・過去N日平均の境界値検証が必要"},
    {"domain": "Infra-agent", "severity": "could", "reason": "既存INTEGER宣言のdriving-score.dbに対する型宣言是正でマイグレーションが必要になる可能性がある"}
  ],
  "requirements_context": "ScoreDbService（db.score.repository / spec/db/score-repository.md）は driving-score.db の score / score_history / capability_score の3テーブルに対し、運転診断結果の保存と参照を担う永続化ドメインである。関連ユースケースは UC06:運転診断の実行（走行結果の保存）、UC07:アドバイス表示（直近1走行のコメント取得）、UC09:過去の診断結果閲覧（直近30回分のスコア推移取得、能力指標の過去N日平均取得）。\n\n【スコープ】すべての保存・参照・削除はログイン中ユーザー（middleware.login.service から取得する userId）でスコープする。userId が空文字（未ログイン）の場合、SELECT は 0 件返却、INSERT/DELETE は no-op とし、レコードを生成・変更しない。ユーザー横断の参照は行わない。\n\n【スコア型是正】実装は小数値を算出・格納・復元しており（ヒストリーの Chart 表示も小数前提）、これに合わせて score.score_over_all / score1..4、capability_score.score_a / score_b / score_c、score_history.score の各カラムを INTEGER 宣言から REAL 宣言に是正する。丸め規則は『保存は小数のまま、丸めが必要な場合は表示層で Math.round を適用』とし、DB 側では丸めを行わない。\n\n【insertScore のトランザクション化】UC06 の走行結果保存では score → score_history → capability_score の順に INSERT する（score_history / capability_score は 1000 レコード刻みのバルク INSERT）。これらを単一トランザクションで囲み、途中失敗時は当該走行分の3テーブル書き込みをすべてロールバックする。従来の『明示的トランザクションなし・部分失敗で score のみ残留』欠陥を解消し、3段 JOIN 参照の前提となる参照整合性を保証する（孤児レコードを許容しない）。\n\n【識別子】score_id は診断開始の UnixTime(ms) であり、同一ユーザー内で重複しない前提を維持する。score_history / capability_score は score_id を介して score を参照する。\n\n【参照系】(1) 直近1走行のコメント取得（UC07）: 当該ユーザーの最新走行（score_id 降順の先頭1件）に紐づくコメントを返す。該当なしは 0 件返却。(2) 直近30回分のスコア推移取得（UC09）: 当該ユーザーの走行を score_id 降順で最大30件取得する。30件未満の場合は存在する件数のみを返し、不足分の補完は行わない。(3) 能力指標の過去N日平均取得（UC09）: capability_score の score_a / score_b / score_c について、指定期間（過去N日）に属する走行を対象に平均値を返す。対象0件時は平均値を算出せず0件（未算出）として返し、DB側で既定値100等の代替値を生成しない。既存の3段 JOIN SELECT 仕様は現行維持する。\n\n【削除】delete はユーザー単位で capability_score → score_history → score の順に連鎖削除する現行仕様を維持する。\n\n【操作ログ】保存・参照・削除の各操作について、middleware.log.service へ操作ログを出力する。ログには操作種別・対象 score_id（保存/削除時）・件数・成否を含める。ログ出力の失敗は DB 操作自体の成否に影響させない。\n\n【スコープ外】未算出時に100を返す挙動の是非、表示層での丸め桁数、_simple ロジック配線は本ノードの対象外とし、Middleware 側の責務とする。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "スコア値は小数のまま保存される", "statement": "score.score_over_all/score1..4、capability_score.score_a/b/c、score_history.scoreは小数値をそのまま格納するためREAL型で保持する", "status": "candidate"},
    {"type": "business_rule", "title": "丸めは表示層責務", "statement": "スコア値は保存時に丸めず小数のまま保持し、丸めが必要な場合は表示層でMath.roundを適用する", "status": "candidate"},
    {"type": "constraint", "title": "insertScoreは単一トランザクションで実行される", "statement": "insertScoreにおけるscore/score_history/capability_scoreへの全INSERTは単一トランザクション内で実行される", "status": "candidate"},
    {"type": "constraint", "title": "バルクINSERT途中失敗時は全ロールバック", "statement": "1000レコード刻みのバルクINSERTが途中で失敗した場合、当該走行分の3テーブルへの書き込みをすべてロールバックする", "status": "candidate"},
    {"type": "state_rule", "title": "孤児レコードを生成しない", "statement": "insertScoreの失敗時にscoreテーブルのみレコードが残留する状態を許容しない", "status": "candidate"},
    {"type": "permission_rule", "title": "永続化操作はログイン中ユーザーでスコープされる", "statement": "score/score_history/capability_scoreへの保存・参照・削除はmiddleware.login.serviceから取得したuserIdでスコープし、ユーザー横断の参照は行わない", "status": "candidate"},
    {"type": "input_rule", "title": "未ログイン時はレコードを生成しない", "statement": "userIdが空文字（未ログイン）の場合、SELECTは0件返却、INSERT/DELETEはno-opとしレコードを生成・変更しない", "status": "candidate"},
    {"type": "business_rule", "title": "score_idは診断開始タイムスタンプ", "statement": "score_idは診断開始のUnixTime(ms)であり同一ユーザー内で重複しない前提を維持する", "status": "candidate"},
    {"type": "data_semantics", "title": "走行コメントは走行単位で保存される", "statement": "アドバイス表示に用いるコメントは走行（score_id）単位のデータとして保持され、直近1走行分を取得できる", "status": "candidate"},
    {"type": "business_rule", "title": "直近1走行コメントは最新score_idで特定する", "statement": "直近1走行のコメント取得は当該ユーザーのscore_id降順の先頭1件を対象とし、該当なしの場合は0件を返す", "status": "candidate"},
    {"type": "business_rule", "title": "スコア推移は直近30走行を上限とする", "statement": "スコア推移取得は当該ユーザーの走行をscore_id降順で最大30件返し、30件未満の場合は存在する件数のみを返して不足分を補完しない", "status": "candidate"},
    {"type": "data_semantics", "title": "能力指標の過去N日平均は集計値として都度算出する", "statement": "capability_scoreのscore_a/b/cの過去N日平均は保存済みの走行別値から都度集計して求め、平均値自体をテーブルに保持しない", "status": "candidate"},
    {"type": "state_rule", "title": "集計対象0件時は代替値を生成しない", "statement": "過去N日平均の対象走行が0件の場合は未算出（0件）として返し、DB側で100等の既定値を生成しない", "status": "candidate"},
    {"type": "business_rule", "title": "delete連鎖削除は現行維持", "statement": "deleteはユーザー単位でcapability_score→score_history→scoreの順に連鎖削除する仕様を維持する", "status": "candidate"},
    {"type": "constraint", "title": "永続化操作は操作ログを出力する", "statement": "保存・参照・削除の各操作はmiddleware.log.serviceへ操作種別・対象score_id・件数・成否を含む操作ログを出力する", "status": "candidate"},
    {"type": "constraint", "title": "ログ出力失敗はDB操作を失敗させない", "statement": "middleware.log.serviceへのログ出力が失敗してもDB操作自体の成否には影響させない", "status": "candidate"}
  ],
  "open_questions": [
    "SQLiteはREAL宣言でも緩やかな型親和性を持つため、既存INTEGER宣言DBに対しマイグレーションが必要か（列型再定義が必要か、新規CREATEのみで足りるか）はDB/Infra/実装で要確認。決まらないと既存端末の既存データ互換に影響する",
    "表示層でMath.roundを適用する具体的箇所・桁数（整数丸めか小数第n位か）が未確定。Middleware/UI判断が必要で、決まらないとChart表示値とDB保存値の乖離検証ができない",
    "insertScoreHistory/insertCapabilityScoreが再帰バルクINSERTである中で、トランザクション境界をinsertScore全体に張るのか各バルク単位かの実装粒度が未確定。Middleware/実装判断が必要で、決まらないと部分ロールバック挙動が定義できない",
    "走行コメントがscoreテーブルの列として保存されるのか、別テーブル/走行外で生成される値なのかが未確定。Middleware（アドバイス生成責務）との切り分けが必要で、決まらないとUC07の取得元スキーマが確定しない",
    "能力指標の過去N日平均のNの値、および期間判定の基準（score_id=診断開始時刻を使うか別の日時列を使うか）が未確定。Middleware/UI判断が必要で、決まらないと集計クエリの境界条件が定義できない",
    "過去N日平均をSQLのAVGで算出するかアプリ側で再計算するかの責務分担が未確定。Middlewareとの合意が必要で、決まらないと-1等の未評価値を集計から除外する規則の実装位置が決まらない",
    "スコア推移の30件上限をDB側のLIMITで保証するか呼び出し側で切るかが未確定。Middlewareと要確認で、決まらないと取得件数の責務が二重化する",
    "未ログイン時に参照系を呼び出した場合、0件返却とエラーのどちらを呼び出し側が期待するかが未確定。Middleware.login.serviceとの契約確認が必要"
  ],
  "rationale_notes": [
    "SQLiteの型親和性により従来INTEGER宣言でも小数が格納できていたが、宣言を実挙動（小数保持）に一致させることで仕様と実装の乖離を解消する意図",
    "トランザクション化の主目的はscoreのみ残留する孤児レコードの防止であり、3段JOIN参照を前提とする参照整合性を保証するため",
    "score_id・3段JOIN SELECT・delete連鎖等は本改修のスコープ外とし現行維持を明示することで回帰リスクを限定する",
    "能力指標の平均は走行別の生値から都度算出する方針とすることで、走行の追加・削除時に集計値の再計算漏れが起きないようにする",
    "未算出時に100を返す挙動（既存ファクトに記録されたMiddleware側の実装実態）はDB責務では再現せず、DBは0件（データなし）を正直に返す方針とし、既定値の付与位置をMiddlewareに一元化する",
    "操作ログ出力は監査・障害解析目的の副作用であり、主機能（永続化）の可用性を損なわないよう失敗を伝播させない設計とする"
  ]
}
```