<!-- 作成: 2026-09-18 18:50:47 JST | 更新: 2026-09-30 17:50:32 JST -->

# ScoreDbService（スコア永続化）仕様

- ノード: `db.score.repository`
- エントリポイント: `spec/db/score-repository.md`
- 対象DB: `driving-score.db`
- 対象テーブル: `score` / `score_history` / `capability_score`（保存・参照・削除）、`hiyari`（削除時の連鎖削除のみ）
- 対象ファイル: 走行ごとのヒヤリ動画ファイル `hiyari.NN.webm`（削除時のみ）

## 1. 概要

ScoreDbService は運転診断結果の**保存と参照**を担う永続化ドメインである。診断1回（以下「走行」）ごとに、次の情報を保存する。

- 総合スコア
- 項目別スコア
- 時系列スコア履歴
- 能力指標

また、UI/Middleware からの参照要求（アドバイス表示、履歴表示、前回結果表示）に応答する。

ユーザー単位の削除では、`score` に紐づく `hiyari` レコードとヒヤリ動画ファイル（`hiyari.NN.webm`）もあわせて削除する（§8）。

スコア算出ロジック自体（採点式・重み・未評価値の扱い）は本ノードの責務ではなく、Middleware 側に置く。DB は**算出結果を事実として保持し、保持している値を正直に返す**ことのみを責務とする。

## 2. 対象ユースケース

| UC | 内容 | 本ノードの役割 |
|----|------|----------------|
| UC06 | 運転診断の実行 | 走行結果（score / score_history / capability_score）の保存 |
| UC07 | アドバイス表示 | 直近1走行の評価コメント取得 |
| UC09 | 過去の診断結果閲覧 | 直近30走行のスコア推移取得、能力指標の期間平均取得 |
| UC01（2026改修 1-2） | 診断開始前画面の前回結果表示 | **過去履歴の平均**（直近1件ではない）の取得 |
| —（ユーザー単位削除） | ユーザーの診断結果削除 | score 系3テーブル・hiyari・ヒヤリ動画ファイルの連鎖削除 |

## 3. スコープ（ユーザー単位）

- すべての保存・参照・削除は、ログイン中ユーザーでスコープする。`userId` は `middleware.login.service` から取得する。
- ユーザー横断の参照は行わない。
- `userId` が空文字（未ログイン）の場合は次のとおりとする。
  - SELECT は **0件返却**
  - INSERT / DELETE は **no-op**（レコードを生成・変更しない）
  - 削除に付随するヒヤリ動画ファイルの削除も行わない

## 4. スコア値の型と丸め規則

- 実装はスコアを小数値として算出・格納・復元しており、履歴の Chart 表示も小数前提である。
- したがって以下のカラムは **REAL 宣言**とする。従来の INTEGER 宣言は実挙動との乖離であり、是正対象である。
  - `score.score_over_all`, `score.score1`〜`score4`
  - `capability_score.score_a` / `score_b` / `score_c`
  - `score_history.score`
- 丸め規則: **保存は小数のまま行う。丸めが必要な場合は表示層で `Math.round` を適用する。** DB 側では丸めを行わない。
- 現行の `capability_score` は `score_a` / `score_b` / `score_c` の 3 列で、値域は 0〜100 の REAL である。

## 5. 識別子と参照関係

- `score_id` は診断開始時刻の UnixTime(ms) である。同一ユーザー内で重複しない前提を維持する。
- `score_history` / `capability_score` は、`score_id` を介して `score` を参照する。
- `hiyari` も `score_id` を介して `score` を参照する。
  - ユーザーとの対応は `score.user_id` を経由して辿る。
  - `hiyari` は、ヒヤリ動画ファイルへの参照 `video_path` を保持する。
- score 系3テーブルの参照整合性を保証する。**孤児レコード（score のみ残留、または score 不在の子レコード）は許容しない。**
- `hiyari` についても、削除時に `score` より先に削除する。これにより、`score` 不在の `hiyari` を残さない（§8）。

## 6. 保存（insertScore）— トランザクション

UC06 の走行結果保存では、以下の順に INSERT する。

1. `score`（1件）
2. `score_history`（1000レコード刻みのバルク INSERT）
3. `capability_score`（1000レコード刻みのバルク INSERT）

これらを **単一トランザクション**で囲み、途中失敗時は当該走行分の3テーブル書き込みをすべてロールバックする。これにより、従来の欠陥（明示的トランザクションがなく、部分失敗で score のみ残留する）を解消する。

## 7. 参照系

### 7.1 直近1走行のコメント取得（UC07）

- 当該ユーザーの最新走行（`score_id` 降順の先頭1件）に紐づく評価コメントを返す。
- 該当なしの場合は 0件を返す。既定コメント等を DB 側で生成しない。

### 7.2 直近30走行のスコア推移取得（UC09）

- 当該ユーザーの走行を `score_id` 降順で **最大30件**取得する。
- 30件未満の場合は存在する件数のみを返し、不足分の補完は行わない。

### 7.3 能力指標の期間平均取得（UC09 / 2026改修 1-2）

- `capability_score` の `score_a` / `score_b` / `score_c` について、指定期間に属する走行を対象に平均値を返す。
  - 指定期間は過去 N 日とする。現行は `scoreLogic.json` の `capability_score_target_days`（既定 30 日）。
- 平均値は**集計値としてテーブルに保持しない。走行別の生値から都度算出**する。
- 対象0件時は平均値を算出せず、**0件（未算出）**として返す。DB 側で 100 等の既定値を生成しない。
- 既存の3段 JOIN SELECT 仕様は現行維持する。

### 7.4 前回結果表示のための履歴平均（2026改修 1-2）

- 診断開始前画面（1-2）の「前回」は、**直近1件ではなく過去履歴の平均**を指す。レーダーチャートも履歴平均で描画される。
- 本ノードは、この履歴平均の算出に用いる**走行別の生値**を提供する。7.3 と同一の集計要求として扱う。
- 過去の記録が存在しない場合は 0件（未算出）を返す。
  - UI 側はこの 0件をもって**線を描画しない**判断を行う。
  - そのため、DB は代替値を返してはならない。

## 8. 削除（delete）

`ScoreDbService.delete(id)`（`score-db.service.ts`）は、ユーザー単位で当該ユーザーの診断結果を削除する。削除は以下の順序で実行する。

1. **ヒヤリ動画パスの取得**
   - 既存の DELETE を実行する前に、当該ユーザーの走行に紐づく `hiyari.video_path` を SELECT する。
2. **ヒヤリ動画ファイルの削除**
   - 取得した `video_path` が指す `hiyari.NN.webm` を、**1 件ずつ**削除する。
3. **`hiyari` レコードの削除**
   - `score` を削除する前に、次の SQL を実行する。

     ```sql
     DELETE FROM hiyari WHERE score_id IN (SELECT score_id FROM score WHERE user_id = ?)
     ```

   - この副問い合わせは `score` を経由してユーザーを特定する。そのため、必ず `score` 削除より前に実行しなければならない。
4. **既存の連鎖削除**
   - `capability_score` → `score_history` → `score` の順に削除する（現行仕様を維持）。

### 8.1 削除しないもの

次のものは `delete(id)` では削除せず、残す。

- 走行ディレクトリ（`hiyari.NN.webm` の格納先）
- `sensor-log`
- `log`
- `scoreLogic`

### 8.2 未ログイン時

`userId` が空文字の場合、上記 1〜4 のいずれも実行しない（no-op）。

## 9. 操作ログ

- 保存・参照・削除の各操作について、`middleware.log.service` へ操作ログを出力する。
- ログには次の項目を含める。
  - 操作種別
  - 対象 `score_id`（保存/削除時）
  - 件数
  - 成否
- **ログ出力の失敗は DB 操作自体の成否に影響させない。**

## 10. 2026 年度改修による影響（未確定領域）

2026 年度改修要求は、次の2資料に基づく。

- 日産自動車『運転機能チェックアプリの一次仕様』2026-08-04
- メイサンソフト『要求仕様確認』2026-09-17

これにより、本ノードのデータ構造に次の影響が想定される。いずれも**現時点では未確定**であり、確定まで既存スキーマを凍結する。

- **能力指標の構造不一致**
  - 新仕様のレーダーチャートは**6項目・1〜5 の5段階**である。
    - 項目: 筋力・柔軟性・空間把握・危険予測・視力・視野
    - 尺度: 5 に近いほど良好、3 が年齢平均
  - 現行 `capability_score` は 3列・0〜100 REAL であり、列数も尺度も一致しない。
  - 3列の拡張／新テーブル新設／尺度の対応づけのいずれを採るかが未確定である。
- **評価コメントの粒度**
  - 新仕様は、各項目に「n 点（5 点満点）」と 2 行程度の評価コメントを併記する。
  - 現行の UC07 は、走行単位の単一コメントを前提としている。
  - **項目別コメント（最大6件/走行）**を保存するのか、表示時に生成するのかが未確定である。
- **採点データ形式の未確定**
  - 6 項目の採点データ形式（スコア・評価メッセージの受け取り方）は先方で検討中である（「試作中に提示します」）。
  - 既存のスコアロジック凍結（打ち合わせ後まで変更しない）は解除されていない。
- **履歴平均の集計期間**
  - 1-2 の「過去の履歴の平均」の集計範囲が未確定である。
  - 現行の `capability_score_target_days`（既定30日）を流用するのか、別定義を置くのかが決まっていない。
- **ヒヤリポイントの参照件数**
  - 1-2 のマップに表示する過去ヒヤリポイントを、直近何回分に限定するかが検討中である。全件だとマーカーで埋まるため、件数制限を検討している。
  - `hiyari` テーブル（`score_id` / `video_path` を保持）は、本ノードの削除処理（§8）の対象である。
  - 一方、次の点は要整理である。
    - `hiyari` の保存・参照（発生位置・時刻を含むメタデータ）の責務が本ノードにあるか
    - 件数制限をどこで適用するか
- **ヒヤリ動画の個別化**
  - ヒヤリ動画は、走行ディレクトリ内の `hiyari.NN.webm` として、`hiyari` レコードの `video_path` から参照される。
  - ヒヤリ前後15秒の個別動画方式では、走行1本の通し動画前提から**ヒヤリ単位の動画参照**へ、データ意味論が変わる。
  - 連続ヒヤリ（30秒以内）を1本にまとめるか個別生成するかは、実装都合で選んでよいとされている。
  - DB はいずれの方式でも、「個別にヒヤリポイントの動画を確認できる」参照を成立させる必要がある。
- **CAN データの保存**
  - CAN データを確認用に保存できるかは、先方の宿題として未確定である。
  - 保存が要求された場合は、新規テーブルおよび容量設計が必要になる。

## 11. スコープ外

- 未算出時に 100 を返す挙動の是非（Middleware 責務）
- 表示層での丸め桁数（Middleware / UI 責務）
- スコア算出ロジック（`_simple` ロジック配線を含む）
- 画面の縦横対応、タブ切り替え、サービス案表示（8-1）の表示仕様
- BLE 受信の安定化・パラレル処理化（仮説段階であり、確定した対策ではない）
- 削除時に残す走行ディレクトリ・`sensor-log` / `log` / `scoreLogic` の後始末

## 12. 非機能・整合性の前提

- 開発完了目標は 2026 年 11 月末である（2026 年 12 月に高齢者を招いた実験が開始されるため）。スキーマ変更を伴う改修は、マイグレーション検証を含めてこの期限内に収める必要がある。
- 既存端末には、INTEGER 宣言の `driving-score.db` が存在する。これに対する型宣言是正がマイグレーションを要するかは、Infra と要確認である（SQLite の型親和性により、既存データは小数を保持できている）。
- 削除処理（§8）は、DB 操作とファイルシステム操作（`hiyari.NN.webm` の削除）を跨ぐ。そのため、単一の DB トランザクションでは原子性を保証できない。途中失敗時の扱いは未確定である（open_questions 参照）。

```json
{
  "required_changes": [
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "対象テーブルにhiyari（削除時の連鎖削除のみ）と対象ファイルhiyari.NN.webmを追加し、hiyariがscore_idでscoreを参照しvideo_pathを保持する参照関係を明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "delete(id)の手順をvideo_pathのSELECT→hiyari.NN.webmの1件ずつ削除→DELETE FROM hiyari WHERE score_id IN (SELECT score_id FROM score WHERE user_id = ?)→capability_score→score_history→scoreの順に改訂"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "delete(id)で走行ディレクトリ・sensor-log・log・scoreLogicは削除せず残すことを明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "未ログイン時（userId空文字）はhiyari削除・動画ファイル削除を含め削除処理全体をno-opとすることを明記"},
    {"node": "db.score.repository", "entrypoint": "spec/db/score-repository.md", "description": "2026改修の未確定領域におけるヒヤリ関連記述を、hiyariテーブル（score_id/video_path）と走行ディレクトリ内hiyari.NN.webmの存在を前提とした表現に更新"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "should", "reason": "delete(id)がhiyariレコードとhiyari.NN.webmを削除するようになるため、ヒヤリ動画を扱う他サービス（録画・6-1表示）が削除後の参照切れを考慮する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "動画ファイル削除失敗時にDELETEを継続するか中断するかの方針と、削除件数を操作ログに含めるかの確認が必要"},
    {"domain": "QA-agent", "severity": "must", "reason": "delete(id)でhiyari.NN.webmが1件ずつ削除されhiyariレコードがscoreより先に削除されること、走行ディレクトリ・sensor-log・log・scoreLogicが残ること、他ユーザーのhiyariと動画が削除されないこと、未ログイン時no-opの検証が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "video_pathが指すファイルが既に存在しない場合や削除途中失敗時の挙動（DBとファイルの不整合）の検証観点が必要"},
    {"domain": "Infra-agent", "severity": "could", "reason": "削除後も走行ディレクトリやsensor-log等が残るため端末ストレージ使用量の見積りに影響する"}
  ],
  "requirements_context": "ScoreDbService（db.score.repository / spec/db/score-repository.md）は driving-score.db の score / score_history / capability_score の3テーブルに対し、運転診断結果の保存と参照を担う永続化ドメインである。加えてユーザー単位削除において hiyari テーブルとヒヤリ動画ファイル hiyari.NN.webm の削除を担う。関連ユースケースは UC06:運転診断の実行（走行結果の保存）、UC07:アドバイス表示（直近1走行のコメント取得）、UC09:過去の診断結果閲覧（直近30回分のスコア推移取得、能力指標の期間平均取得）、2026改修の1-2:診断開始前画面の前回結果表示（過去履歴の平均取得）、およびユーザー単位の診断結果削除。\n\n【スコープ】すべての保存・参照・削除はログイン中ユーザー（middleware.login.service から取得する userId）でスコープする。userId が空文字（未ログイン）の場合、SELECT は0件返却、INSERT/DELETE は no-op とし、レコードを生成・変更しない。削除に付随するヒヤリ動画ファイル削除も行わない。ユーザー横断の参照は行わない。\n\n【スコア型】実装は小数値を算出・格納・復元しており（Chart 表示も小数前提）、score.score_over_all/score1..4、capability_score.score_a/score_b/score_c、score_history.score を REAL 宣言とする。現行 capability_score は score_a/score_b/score_c の3列で値域 0〜100 の REAL。丸め規則は『保存は小数のまま、丸めが必要な場合は表示層で Math.round を適用』とし、DB 側では丸めを行わない。\n\n【insertScore のトランザクション化】UC06 の走行結果保存では score → score_history → capability_score の順に INSERT する（score_history / capability_score は1000レコード刻みのバルク INSERT）。これらを単一トランザクションで囲み、途中失敗時は当該走行分の3テーブル書き込みをすべてロールバックする。孤児レコードは許容しない。\n\n【識別子と参照関係】score_id は診断開始の UnixTime(ms) であり、同一ユーザー内で重複しない前提を維持する。score_history / capability_score / hiyari は score_id を介して score を参照する。hiyari のユーザー対応は score.user_id 経由で辿る。hiyari はヒヤリ動画ファイルへの参照 video_path を保持する。\n\n【参照系】(1) 直近1走行のコメント取得（UC07）: 当該ユーザーの score_id 降順の先頭1件に紐づくコメントを返し、該当なしは0件返却。(2) 直近30回分のスコア推移取得（UC09）: score_id 降順で最大30件、30件未満は存在件数のみを返し補完しない。(3) 能力指標の期間平均取得（UC09/1-2）: capability_score の score_a/score_b/score_c について指定期間（現行は scoreLogic.json の capability_score_target_days、既定30日）に属する走行を対象に平均を都度算出して返す。平均値自体はテーブルに保持しない。対象0件時は未算出（0件）として返し、DB 側で100等の代替値を生成しない。既存の3段 JOIN SELECT は現行維持。\n\n【2026改修 1-2】診断開始前画面の『前回』は直近1件ではなく過去履歴の平均を指し、レーダーチャートも履歴平均で描画される。前回の記録が存在しない場合は線を描画しないため、DB は0件（未算出）を正直に返す。\n\n【削除】score-db.service.ts の ScoreDbService.delete(id) はユーザー単位で以下の順に実行する。(1) 既存の DELETE の前に当該ユーザーの走行に紐づく hiyari.video_path を SELECT する。(2) 取得した video_path が指す hiyari.NN.webm を1件ずつ削除する。(3) score を削除する前に DELETE FROM hiyari WHERE score_id IN (SELECT score_id FROM score WHERE user_id = ?) を実行する（副問い合わせが score に依存するため必ず score 削除より前）。(4) capability_score → score_history → score の順に連鎖削除する現行仕様を維持する。走行ディレクトリ、sensor-log / log / scoreLogic は削除せず残す。未ログイン時は全手順 no-op。削除は DB 操作とファイル操作を跨ぐため単一 DB トランザクションで原子性を保証できず、途中失敗時の扱いは未確定。\n\n【操作ログ】保存・参照・削除の各操作について middleware.log.service へ操作種別・対象 score_id・件数・成否を含む操作ログを出力する。ログ出力の失敗は DB 操作の成否に影響させない。\n\n【2026改修による未確定領域】新仕様のレーダーチャートは筋力・柔軟性・空間把握・危険予測・視力・視野の6項目・1〜5の5段階（5に近いほど良好、3が年齢平均）であり、現行の3列・0〜100 REAL と列数も尺度も一致しない。各項目には『n点（5点満点）』と2行程度の評価コメントが併記されるため、項目別コメントの保存要否も未確定。6項目の採点データ形式は先方検討中でスコアロジックは凍結中。その他、以下も未確定である。履歴平均の集計期間。1-2 マップに表示する過去ヒヤリの件数上限。hiyari の保存・参照（発生位置・時刻を含む）の責務所在。ヒヤリ前後15秒の個別動画に伴うヒヤリ単位の動画参照（連続ヒヤリ30秒以内をまとめるか個別化するかは実装都合で可）。CAN データの確認用保存可否。これらが確定するまで既存スキーマを凍結する。\n\n【スケジュール前提】2026年12月に高齢者を招いた実験が開始されるため、アプリ開発は2026年11月末完了が目標であり、スキーマ変更はマイグレーション検証を含めてこの期限内に収める。\n\n【スコープ外】未算出時に100を返す挙動の是非、表示層での丸め桁数、スコア算出ロジック（_simple 配線含む）、画面の縦横対応・タブ切り替え・サービス案表示（8-1）、BLE 安定化（パラレル処理化は仮説段階）、削除時に残す走行ディレクトリ・sensor-log / log / scoreLogic の後始末。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "hiyariはscore_idでscoreを参照する", "statement": "hiyariテーブルのレコードはscore_idを介してscoreに紐づき、ユーザーとの対応はscore.user_id経由で特定される", "status": "candidate"},
    {"type": "data_semantics", "title": "hiyariはヒヤリ動画のパスを保持する", "statement": "hiyariテーブルはヒヤリ動画ファイル（hiyari.NN.webm）への参照としてvideo_pathを保持する", "status": "candidate"},
    {"type": "business_rule", "title": "delete時にhiyariをscoreより先に削除する", "statement": "ScoreDbService.delete(id)はscoreを削除する前にDELETE FROM hiyari WHERE score_id IN (SELECT score_id FROM score WHERE user_id = ?)を実行する", "status": "candidate"},
    {"type": "business_rule", "title": "delete時にヒヤリ動画ファイルを1件ずつ削除する", "statement": "ScoreDbService.delete(id)は既存のDELETE実行前にvideo_pathをSELECTし、hiyari.NN.webmを1件ずつ削除する", "status": "candidate"},
    {"type": "data_semantics", "title": "delete時に走行ディレクトリとログ類は残す", "statement": "ScoreDbService.delete(id)は走行ディレクトリ、sensor-log、log、scoreLogicを削除せず残す", "status": "candidate"},
    {"type": "business_rule", "title": "score系の連鎖削除順は現行維持", "statement": "deleteはhiyari削除後にcapability_score→score_history→scoreの順で連鎖削除する", "status": "candidate"},
    {"type": "input_rule", "title": "未ログイン時は削除処理全体がno-op", "statement": "userIdが空文字の場合、delete(id)はhiyariレコード・ヒヤリ動画ファイルを含め何も削除しない", "status": "candidate"},
    {"type": "data_semantics", "title": "スコア値は小数のまま保存される", "statement": "score.score_over_all/score1..4、capability_score.score_a/b/c、score_history.scoreは小数値をそのまま格納するためREAL型で保持する", "status": "candidate"},
    {"type": "business_rule", "title": "丸めは表示層責務", "statement": "スコア値は保存時に丸めず小数のまま保持し、丸めが必要な場合は表示層でMath.roundを適用する", "status": "candidate"},
    {"type": "constraint", "title": "insertScoreは単一トランザクションで実行される", "statement": "insertScoreにおけるscore/score_history/capability_scoreへの全INSERTは単一トランザクション内で実行され、途中失敗時は当該走行分をすべてロールバックする", "status": "candidate"},
    {"type": "permission_rule", "title": "永続化操作はログイン中ユーザーでスコープされる", "statement": "保存・参照・削除はmiddleware.login.serviceから取得したuserIdでスコープし、ユーザー横断の参照は行わない", "status": "candidate"},
    {"type": "data_semantics", "title": "能力指標の期間平均は都度算出する", "statement": "capability_scoreのscore_a/b/cの期間平均は走行別値から都度集計し、平均値自体をテーブルに保持しない", "status": "candidate"},
    {"type": "state_rule", "title": "集計対象0件時は代替値を生成しない", "statement": "期間平均・履歴平均の対象走行が0件の場合は未算出（0件）として返し、DB側で100等の既定値を生成しない", "status": "candidate"},
    {"type": "constraint", "title": "ログ出力失敗はDB操作を失敗させない", "statement": "middleware.log.serviceへのログ出力が失敗してもDB操作自体の成否には影響させない", "status": "candidate"}
  ],
  "open_questions": [
    "hiyari.NN.webmの削除途中でファイル削除に失敗した場合、DELETEを継続するのか中断するのかが未確定。DBとファイルシステムを跨ぐため単一トランザクションで保証できず、Middleware/QA判断が必要で、決まらないと失敗時にhiyariレコードが存在しない動画を指す、または動画だけ残る不整合の扱いが定義できない",
    "ファイル削除後にDB側DELETEが失敗した場合、動画が消えたhiyariレコードが残る状態を許容するか、再試行や整合回復を行うかが未確定。QA/Middleware確認が必要",
    "video_pathがNULLまたは指すファイルが既に存在しない場合の扱い（スキップして継続か）が未確定。決まらないと削除処理の例外挙動がテストできない",
    "video_pathのSELECTもDELETE FROM hiyariと同じくscore.user_id経由の副問い合わせでユーザースコープするかが明示されていない。他ユーザーの動画を誤削除しないための条件として要確認",
    "delete(id)のDB DELETE群（hiyari→capability_score→score_history→score）を単一トランザクションで囲むかが未確定。insertScoreと同等の原子性を削除にも求めるかDB/QAで要確認",
    "削除後に残す走行ディレクトリ・sensor-log・log・scoreLogicは対応するscoreレコードを失うため、誰がいつ後始末するか（あるいは恒久的に残すか）が未確定。Infra/Middleware判断が必要でストレージ使用量に影響する",
    "hiyari.NN.webmのNN（連番）が走行内のヒヤリ順序を表すのか、連続ヒヤリ（30秒以内）をまとめた単位なのかが未確定。走行:ヒヤリ:動画の多重度に影響する",
    "hiyariテーブルの保存・参照（発生位置・時刻等のメタデータ、1-2マップ用の件数制限付き参照）の責務がdb.score.repositoryにあるのか別ノードにあるのかが未確定。削除のみ本ノードが担う現状でドメイン境界の整理が必要",
    "削除操作の操作ログに動画ファイル削除件数・失敗件数を含めるかが未確定。Middleware（middleware.log.service）と要確認",
    "6項目・1〜5段階の能力指標を現行capability_score（3列・0〜100 REAL）の拡張で表すか新テーブルとするか、尺度対応をどう定義するかが未確定。採点データ形式が先方検討中でスキーマ確定とマイグレーション設計に着手できない",
    "各項目の『n点（5点満点）』と評価コメントを走行×項目単位で保存するか表示時に生成するかが未確定。Middlewareとの切り分けが必要",
    "1-2の履歴平均の集計期間が現行capability_score_target_days（既定30日）流用か別定義かが未確定",
    "1-2マップに表示する過去ヒヤリポイントを直近何回分に限定するかが未確定で、ヒヤリ参照クエリの件数上限とインデックス設計が定義できない",
    "CANデータを確認用に保存できるかが先方の宿題として未確定。保存要求が確定した場合の新規テーブル・保持期間・容量設計が未定",
    "既存INTEGER宣言DBに対しREAL宣言是正のマイグレーションが必要かDB/Infraで要確認"
  ],
  "rationale_notes": [
    "DELETE FROM hiyariの副問い合わせはscore.user_idに依存してユーザーを特定するため、scoreを先に消すと対象を特定できずhiyariが孤児化する。したがってscore削除より前に実行する順序が必須となる",
    "video_pathはhiyariレコードにしか保持されないため、動画ファイルの特定はhiyariのDELETEより前に行う必要があり、SELECT→ファイル削除→DELETEの順序となる",
    "削除範囲をヒヤリ動画（hiyari.NN.webm）に限定し走行ディレクトリ・sensor-log・log・scoreLogicを残すのは承認済みの設計判断であり、本仕様ではその範囲を明記するに留め、残置の理由や後始末は未確定事項として分離した",
    "SQLiteの型親和性により従来INTEGER宣言でも小数が格納できていたが、宣言を実挙動に一致させて仕様と実装の乖離を解消する意図",
    "トランザクション化の主目的はscoreのみ残留する孤児レコードの防止であり、3段JOIN参照を前提とする参照整合性を保証するため",
    "能力指標の平均を走行別生値から都度算出することで、走行の追加・削除時に集計値の再計算漏れが起きないようにする",
    "未算出時の既定値付与はMiddlewareに一元化し、DBは0件を正直に返す。これは『前回の記録がなければレーダーチャートの線を描画しない』要求と整合する",
    "6項目化・尺度変更は影響が広いため、採点データ形式が提示されるまでスキーマ変更に着手せず凍結して手戻りを防ぐ",
    "2026年12月の実験開始に対して11月末完了が目標であるため、スキーマ変更を要する改修は早期確定が必要"
  ]
}
```