<!-- 作成: 2026-09-10 17:34:18 JST | 更新: 2026-09-18 18:50:46 JST -->

# ScoreDbService（スコア永続化）仕様

- ノード: `db.score.repository`
- エントリポイント: `spec/db/score-repository.md`
- 対象DB: `driving-score.db`
- 対象テーブル: `score` / `score_history` / `capability_score`

## 1. 概要

ScoreDbService は運転診断結果の**保存と参照**を担う永続化ドメインである。診断1回（以下「走行」）ごとに、総合スコア・項目別スコア・時系列スコア履歴・能力指標を保存し、UI/Middleware からの参照要求（アドバイス表示、履歴表示、前回結果表示）に応答する。

スコア算出ロジック自体（採点式・重み・未評価値の扱い）は本ノードの責務ではなく Middleware 側に置く。DB は**算出結果を事実として保持し、保持している値を正直に返す**ことのみを責務とする。

## 2. 対象ユースケース

| UC | 内容 | 本ノードの役割 |
|----|------|----------------|
| UC06 | 運転診断の実行 | 走行結果（score / score_history / capability_score）の保存 |
| UC07 | アドバイス表示 | 直近1走行の評価コメント取得 |
| UC09 | 過去の診断結果閲覧 | 直近30走行のスコア推移取得、能力指標の期間平均取得 |
| UC01（2026改修 1-2） | 診断開始前画面の前回結果表示 | **過去履歴の平均**（直近1件ではない）の取得 |

## 3. スコープ（ユーザー単位）

- すべての保存・参照・削除は、ログイン中ユーザー（`middleware.login.service` から取得する `userId`）でスコープする。
- ユーザー横断の参照は行わない。
- `userId` が空文字（未ログイン）の場合、
  - SELECT は **0件返却**
  - INSERT / DELETE は **no-op**（レコードを生成・変更しない）

## 4. スコア値の型と丸め規則

- 実装はスコアを小数値として算出・格納・復元しており、履歴の Chart 表示も小数前提である。
- したがって以下のカラムは **REAL 宣言**とする（従来の INTEGER 宣言は実挙動との乖離であり是正対象）。
  - `score.score_over_all`, `score.score1`〜`score4`
  - `capability_score.score_a` / `score_b` / `score_c`
  - `score_history.score`
- 丸め規則: **保存は小数のまま。丸めが必要な場合は表示層で `Math.round` を適用する。** DB 側では丸めを行わない。
- 現行の `capability_score` は `score_a`/`score_b`/`score_c` の 3 列で、値域は 0〜100 の REAL である。

## 5. 識別子と参照関係

- `score_id` は診断開始時刻の UnixTime(ms) であり、同一ユーザー内で重複しない前提を維持する。
- `score_history` / `capability_score` は `score_id` を介して `score` を参照する。
- 3テーブルの参照整合性を保証し、**孤児レコード（score のみ残留、または score 不在の子レコード）を許容しない**。

## 6. 保存（insertScore）— トランザクション

UC06 の走行結果保存では、以下の順に INSERT する。

1. `score`（1件）
2. `score_history`（1000レコード刻みのバルク INSERT）
3. `capability_score`（1000レコード刻みのバルク INSERT）

これらを **単一トランザクション**で囲み、途中失敗時は当該走行分の3テーブル書き込みをすべてロールバックする。従来の「明示的トランザクションなし・部分失敗で score のみ残留」という欠陥を解消する。

## 7. 参照系

### 7.1 直近1走行のコメント取得（UC07）

- 当該ユーザーの最新走行（`score_id` 降順の先頭1件）に紐づく評価コメントを返す。
- 該当なしは 0件返却（既定コメント等を DB 側で生成しない）。

### 7.2 直近30走行のスコア推移取得（UC09）

- 当該ユーザーの走行を `score_id` 降順で **最大30件**取得する。
- 30件未満の場合は存在する件数のみを返し、不足分の補完は行わない。

### 7.3 能力指標の期間平均取得（UC09 / 2026改修 1-2）

- `capability_score` の `score_a` / `score_b` / `score_c` について、指定期間（過去 N 日。現行は `scoreLogic.json` の `capability_score_target_days`、既定 30 日）に属する走行を対象に平均値を返す。
- 平均値は**集計値としてテーブルに保持せず、走行別の生値から都度算出**する。
- 対象0件時は平均値を算出せず **0件（未算出）**として返す。DB 側で 100 等の既定値を生成しない。
- 既存の3段 JOIN SELECT 仕様は現行維持する。

### 7.4 前回結果表示のための履歴平均（2026改修 1-2）

- 診断開始前画面（1-2）の「前回」は**直近1件ではなく過去履歴の平均**を指す。レーダーチャートも履歴平均で描画される。
- 本ノードは、この履歴平均の算出に用いる**走行別の生値**を提供する（7.3 と同一の集計要求として扱う）。
- 過去の記録が存在しない場合は 0件（未算出）を返す。UI 側はこの 0件をもって**線を描画しない**判断を行うため、DB は代替値を返してはならない。

## 8. 削除（delete）

- ユーザー単位で `capability_score` → `score_history` → `score` の順に連鎖削除する現行仕様を維持する。

## 9. 操作ログ

- 保存・参照・削除の各操作について `middleware.log.service` へ操作ログを出力する。
- ログには操作種別・対象 `score_id`（保存/削除時）・件数・成否を含める。
- **ログ出力の失敗は DB 操作自体の成否に影響させない。**

## 10. 2026 年度改修による影響（未確定領域）

2026 年度改修要求（日産自動車『運転機能チェックアプリの一次仕様』2026-08-04、メイサンソフト『要求仕様確認』2026-09-17）により、本ノードのデータ構造に次の影響が想定される。いずれも**現時点では未確定**であり、確定まで既存スキーマを凍結する。

- **能力指標の構造不一致**: 新仕様のレーダーチャートは筋力・柔軟性・空間把握・危険予測・視力・視野の**6項目・1〜5 の5段階**（5 に近いほど良好、3 が年齢平均）である。現行 `capability_score` は 3列・0〜100 REAL であり、列数も尺度も一致しない。3列の拡張／新テーブル新設／尺度の対応づけのいずれを採るかが未確定。
- **評価コメントの粒度**: 新仕様は各項目に「n 点（5 点満点）」と 2 行程度の評価コメントを併記する。現行の UC07 は走行単位の単一コメントを前提としており、**項目別コメント（最大6件/走行）**を保存するのか、表示時に生成するのかが未確定。
- **採点データ形式の未確定**: 6 項目の採点データ形式（スコア・評価メッセージの受け取り方）は先方検討中（「試作中に提示します」）。既存のスコアロジック凍結（打ち合わせ後まで変更しない）は解除されていない。
- **履歴平均の集計期間**: 1-2 の「過去の履歴の平均」の集計範囲が、現行の `capability_score_target_days`（既定30日）を流用するのか別定義を置くのかが未確定。
- **ヒヤリポイントの参照件数**: 1-2 のマップに表示する過去ヒヤリポイントを直近何回分に限定するかが検討中（全件だとマーカーで埋まるため件数制限を検討）。ヒヤリポイントおよびヒヤリ動画のメタデータ（発生位置・時刻・動画ファイル参照）の保持責務が本ノードにあるかを含めて要整理。
- **ヒヤリ動画の個別化**: ヒヤリ前後15秒の個別動画方式に変わる場合、走行1本の通し動画前提から**ヒヤリ単位の動画参照**へデータ意味論が変わる。連続ヒヤリ（30秒以内）を1本にまとめるか個別生成するかは実装都合で選んでよいとされており、DB はいずれの方式でも「個別にヒヤリポイントの動画を確認できる」参照を成立させる必要がある。
- **CAN データの保存**: CAN データを確認用に保存できるかは先方の宿題として未確定。保存が要求された場合、新規テーブルおよび容量設計が必要になる。

## 11. スコープ外

- 未算出時に 100 を返す挙動の是非（Middleware 責務）
- 表示層での丸め桁数（Middleware / UI 責務）
- スコア算出ロジック（`_simple` ロジック配線を含む）
- 画面の縦横対応、タブ切り替え、サービス案表示（8-1）の表示仕様
- BLE 受信の安定化・パラレル処理化（仮説段階であり確定した対策ではない）

## 12. 非機能・整合性の前提

- 開発完了目標は 2026 年 11 月末（2026 年 12 月に高齢者を招いた実験が開始されるため）。スキーマ変更を伴う改修はマイグレーション検証を含めてこの期限内に収める必要がある。
- 既存端末に存在する INTEGER 宣言の `driving-score.db` に対して、型宣言是正がマイグレーションを要するかは Infra と要確認（SQLite の型親和性により既存データは小数を保持できている）。

```json
{
  "required_changes": [
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "score/score_history/capability_scoreのスコア系カラムをINTEGER宣言からREAL宣言に是正し丸め規則（保存=小数のまま/丸めは表示層）を明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "insertScoreの3テーブルINSERT（history/capabilityは1000件刻みバルク）を単一トランザクション化し途中失敗時は全ロールバックする仕様に是正"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "全SELECT/INSERT/DELETEをログイン中ユーザー（middleware.login.service由来のuserId）でスコープする前提をUC06/UC07/UC09の各参照系に明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "直近1走行のコメント取得（UC07）・直近30走行のスコア推移取得（UC09）・能力指標の期間平均取得の3参照系のスコープ・並び順・件数上限・0件時の返却規約を仕様化"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "2026改修1-2の『前回』が履歴平均であることを反映し、履歴平均算出用の走行別生値提供と0件時は代替値を返さない規約を追記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "6項目・1〜5段階の能力指標および項目別評価コメントに対する現行capability_score（3列/0〜100 REAL）の構造不一致を未確定事項として明記しスキーマ凍結を宣言"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "ヒヤリポイント・ヒヤリ個別動画メタデータおよびCANデータ保存要求の保持責務が本ノードに及ぶ可能性を未確定領域として記載"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "永続化操作（保存・参照・削除）の実行結果をmiddleware.log.serviceへ操作ログとして出力する責務を明記（ログ出力失敗はDB操作を失敗させない）"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "userIdのスコープ供給元がmiddleware.login.serviceであり未ログイン時（userId空文字）の呼び出し可否と戻り値解釈を計算/表示責務側と揃える必要がある"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "1-2の『前回』が履歴平均であるため直近1件取得ではなく期間平均取得に呼び出しを切り替える必要があり、集計期間の決定責務も要確認"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "6項目1〜5段階スコアと項目別評価コメントの生成・保存責務分担が未定で、保存対象が確定しないとスキーマを確定できない"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "スコアを小数のまま保存するため表示層でのMath.round適用箇所と桁数、および期間平均をSQL集計とするかアプリ側再計算とするかの責務分担を確認する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "履歴平均0件時にレーダーチャートの線を描画しない判断はUI側が行うため、DBが代替値を返さない前提を共有する必要がある"},
    {"domain": "QA-agent", "severity": "must", "reason": "トランザクション化による部分失敗時の孤児レコード非生成、バルクINSERT途中失敗時の全ロールバック、未ログイン時の0件/no-op、直近30件・期間平均・履歴0件の境界値検証が必要"},
    {"domain": "Infra-agent", "severity": "should", "reason": "既存INTEGER宣言のdriving-score.dbに対する型宣言是正および6項目化に伴うスキーマ変更でマイグレーションが必要になる可能性があり、2026年11月末完了目標に対する作業枠確保が必要"}
  ],
  "requirements_context": "ScoreDbService（db.score.repository / spec/db/score-repository.md）は driving-score.db の score / score_history / capability_score の3テーブルに対し、運転診断結果の保存と参照を担う永続化ドメインである。関連ユースケースは UC06:運転診断の実行（走行結果の保存）、UC07:アドバイス表示（直近1走行のコメント取得）、UC09:過去の診断結果閲覧（直近30回分のスコア推移取得、能力指標の期間平均取得）、および2026改修の1-2:診断開始前画面の前回結果表示（過去履歴の平均取得）。\n\n【スコープ】すべての保存・参照・削除はログイン中ユーザー（middleware.login.service から取得する userId）でスコープする。userId が空文字（未ログイン）の場合、SELECT は0件返却、INSERT/DELETE は no-op とし、レコードを生成・変更しない。ユーザー横断の参照は行わない。\n\n【スコア型】実装は小数値を算出・格納・復元しており（Chart 表示も小数前提）、score.score_over_all/score1..4、capability_score.score_a/score_b/score_c、score_history.score を REAL 宣言とする。現行 capability_score は score_a/score_b/score_c の3列で値域 0〜100 の REAL。丸め規則は『保存は小数のまま、丸めが必要な場合は表示層で Math.round を適用』とし、DB 側では丸めを行わない。\n\n【insertScore のトランザクション化】UC06 の走行結果保存では score → score_history → capability_score の順に INSERT する（score_history / capability_score は1000レコード刻みのバルク INSERT）。これらを単一トランザクションで囲み、途中失敗時は当該走行分の3テーブル書き込みをすべてロールバックする。孤児レコードは許容しない。\n\n【識別子】score_id は診断開始の UnixTime(ms) であり、同一ユーザー内で重複しない前提を維持する。score_history / capability_score は score_id を介して score を参照する。\n\n【参照系】(1) 直近1走行のコメント取得（UC07）: 当該ユーザーの score_id 降順の先頭1件に紐づくコメントを返し、該当なしは0件返却。(2) 直近30回分のスコア推移取得（UC09）: score_id 降順で最大30件、30件未満は存在件数のみを返し補完しない。(3) 能力指標の期間平均取得（UC09/1-2）: capability_score の score_a/score_b/score_c について指定期間（現行は scoreLogic.json の capability_score_target_days、既定30日）に属する走行を対象に平均を都度算出して返す。平均値自体はテーブルに保持しない。対象0件時は未算出（0件）として返し、DB 側で100等の代替値を生成しない。既存の3段 JOIN SELECT は現行維持。\n\n【2026改修 1-2】診断開始前画面の『前回』は直近1件ではなく過去履歴の平均を指し、レーダーチャートも履歴平均で描画される。前回の記録が存在しない場合は線を描画しないため、DB は0件（未算出）を正直に返す。\n\n【削除】delete はユーザー単位で capability_score → score_history → score の順に連鎖削除する現行仕様を維持する。\n\n【操作ログ】保存・参照・削除の各操作について middleware.log.service へ操作種別・対象 score_id・件数・成否を含む操作ログを出力する。ログ出力の失敗は DB 操作の成否に影響させない。\n\n【2026改修による未確定領域】新仕様のレーダーチャートは筋力・柔軟性・空間把握・危険予測・視力・視野の6項目・1〜5の5段階（5に近いほど良好、3が年齢平均）であり、現行の3列・0〜100 REAL と列数も尺度も一致しない。各項目には『n点（5点満点）』と2行程度の評価コメントが併記されるため、項目別コメントの保存要否も未確定。6項目の採点データ形式は先方検討中でスコアロジックは凍結中。履歴平均の集計期間、1-2 マップに表示する過去ヒヤリの件数上限、ヒヤリ前後15秒の個別動画に伴うヒヤリ単位の動画参照メタデータ、CAN データの確認用保存可否も未確定であり、確定まで既存スキーマを凍結する。\n\n【スケジュール前提】2026年12月に高齢者を招いた実験が開始されるため、アプリ開発は2026年11月末完了が目標であり、スキーマ変更はマイグレーション検証を含めてこの期限内に収める。\n\n【スコープ外】未算出時に100を返す挙動の是非、表示層での丸め桁数、スコア算出ロジック（_simple 配線含む）、画面の縦横対応・タブ切り替え・サービス案表示（8-1）、BLE 安定化（パラレル処理化は仮説段階）。",
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
    {"type": "data_semantics", "title": "能力指標の期間平均は集計値として都度算出する", "statement": "capability_scoreのscore_a/b/cの期間平均は保存済みの走行別値から都度集計して求め、平均値自体をテーブルに保持しない", "status": "candidate"},
    {"type": "state_rule", "title": "集計対象0件時は代替値を生成しない", "statement": "期間平均の対象走行が0件の場合は未算出（0件）として返し、DB側で100等の既定値を生成しない", "status": "candidate"},
    {"type": "data_semantics", "title": "1-2の前回結果は履歴平均の参照要求である", "statement": "診断開始前画面（1-2）の前回結果表示は直近1走行ではなく過去履歴の平均を必要とするため、DBは期間内の走行別能力指標を提供する", "status": "candidate"},
    {"type": "state_rule", "title": "履歴が存在しない場合は未算出を返す", "statement": "過去の記録が存在しない場合、DBは0件（未算出）を返し、UI側がレーダーチャートの線を描画しない判断を行える状態にする", "status": "candidate"},
    {"type": "business_rule", "title": "delete連鎖削除は現行維持", "statement": "deleteはユーザー単位でcapability_score→score_history→scoreの順に連鎖削除する仕様を維持する", "status": "candidate"},
    {"type": "constraint", "title": "永続化操作は操作ログを出力する", "statement": "保存・参照・削除の各操作はmiddleware.log.serviceへ操作種別・対象score_id・件数・成否を含む操作ログを出力する", "status": "candidate"},
    {"type": "constraint", "title": "ログ出力失敗はDB操作を失敗させない", "statement": "middleware.log.serviceへのログ出力が失敗してもDB操作自体の成否には影響させない", "status": "candidate"},
    {"type": "constraint", "title": "6項目化が確定するまで既存スキーマを凍結する", "statement": "6項目・1〜5段階の採点データ形式が先方から提示されるまで、capability_scoreを含む既存スキーマの変更は行わない", "status": "candidate"},
    {"type": "assumption", "title": "履歴平均の集計期間は現行設定を暫定流用する", "statement": "履歴平均の集計期間は別途定義が示されるまでscoreLogic.jsonのcapability_score_target_days（既定30日）を暫定的に用いる", "status": "assumption"}
  ],
  "open_questions": [
    "6項目・1〜5段階の能力指標を現行capability_score（score_a/b/c、0〜100 REAL）の3列拡張で表すのか新テーブルを設けるのか、0〜100と1〜5の尺度対応をどう定義するのかが未確定。採点データ形式が先方検討中のためDB/Middlewareの合意が必要で、決まらないとスキーマ確定とマイグレーション設計に着手できない",
    "各項目に併記する『n点（5点満点）』と2行程度の評価コメントを走行×項目単位で保存するのか表示時に生成するのかが未確定。Middleware（コメント生成責務）との切り分けが必要で、決まらないとUC07および新レーダーチャート画面の取得元スキーマが確定しない",
    "1-2の『過去の履歴の平均』の集計期間が現行のcapability_score_target_days（既定30日）を流用するのか別期間定義を置くのかが未確定。Middleware/業務判断が必要で、決まらないと集計クエリの境界条件が定義できない",
    "期間平均をSQLのAVGで算出するかアプリ側で再計算するかの責務分担が未確定。Middlewareとの合意が必要で、決まらないと-1等の未評価値を集計から除外する規則の実装位置が決まらない",
    "期間判定の基準にscore_id（診断開始時刻）を使うか別の日時列を使うかが未確定。決まらないと期間境界の判定が実装ごとに揺れる",
    "スコア推移の30件上限をDB側のLIMITで保証するか呼び出し側で切るかが未確定。Middlewareと要確認で、決まらないと取得件数の責務が二重化する",
    "未ログイン時に参照系を呼び出した場合、0件返却とエラーのどちらを呼び出し側が期待するかが未確定。middleware.login.serviceとの契約確認が必要",
    "SQLiteはREAL宣言でも緩やかな型親和性を持つため、既存INTEGER宣言DBに対しマイグレーションが必要か（列型再定義が必要か、新規CREATEのみで足りるか）はDB/Infra/実装で要確認。決まらないと既存端末の既存データ互換に影響する",
    "表示層でMath.roundを適用する具体的箇所・桁数（整数丸めか小数第n位か）が未確定。Middleware/UI判断が必要で、決まらないとChart表示値とDB保存値の乖離検証ができない",
    "insertScoreHistory/insertCapabilityScoreが再帰バルクINSERTである中で、トランザクション境界をinsertScore全体に張るのか各バルク単位かの実装粒度が未確定。Middleware/実装判断が必要で、決まらないと部分ロールバック挙動が定義できない",
    "1-2のマップに表示する過去ヒヤリポイントを直近何回分に限定するかが未確定（全件だとマーカーで埋まるため件数制限を検討中）。決まらないとヒヤリ参照クエリの件数上限とインデックス設計が定義できない",
    "ヒヤリポイントおよびヒヤリ前後15秒の個別動画メタデータ（発生位置・時刻・動画ファイル参照）をdb.score.repositoryが保持するのか別ノードが保持するのかが未確定。ドメイン境界の判断が必要で、決まらないと6-1（ヒヤリシーン表示）の参照元が定まらない",
    "連続ヒヤリ（30秒以内）を1本の動画にまとめる方式と個別生成方式のいずれを採るかは実装都合で選んでよいとされているが、選択結果によって走行:ヒヤリ:動画の多重度が変わるためデータモデルが確定しない",
    "CANデータを確認用に保存できるかが先方の宿題として未確定。保存要求が確定した場合の新規テーブル・保持期間・容量設計が未定"
  ],
  "rationale_notes": [
    "SQLiteの型親和性により従来INTEGER宣言でも小数が格納できていたが、宣言を実挙動（小数保持）に一致させることで仕様と実装の乖離を解消する意図",
    "トランザクション化の主目的はscoreのみ残留する孤児レコードの防止であり、3段JOIN参照を前提とする参照整合性を保証するため",
    "score_id・3段JOIN SELECT・delete連鎖等は本改修のスコープ外とし現行維持を明示することで回帰リスクを限定する",
    "能力指標の平均は走行別の生値から都度算出する方針とすることで、走行の追加・削除時に集計値の再計算漏れが起きないようにする",
    "1-2の『前回』が履歴平均であるという要求は、DB側に新しい保存項目を増やすのではなく既存の期間平均参照要求と同一視できるため、参照系の再利用として整理した",
    "未算出時に100を返す挙動（Middleware側の実装実態）はDB責務では再現せず、DBは0件（データなし）を正直に返す方針とし、既定値の付与位置をMiddlewareに一元化する。これは『前回の記録がなければレーダーチャートの線を描画しない』要求と整合する",
    "6項目化・尺度変更は影響が広いため、採点データ形式が提示されるまでスキーマ変更に着手せず凍結する方針を明示して手戻りを防ぐ",
    "操作ログ出力は監査・障害解析目的の副作用であり、主機能（永続化）の可用性を損なわないよう失敗を伝播させない設計とする",
    "2026年12月の実験開始に対して11月末完了が目標であるため、スキーマ変更を要する改修は早期に確定させる必要があるという時間的制約を仕様に記録した"
  ]
}
```