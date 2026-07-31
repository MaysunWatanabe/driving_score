# QA Test Specification — db

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: db / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 8
- **coverage_notes**: 既存 QA が 0 件のため、db ドメインの 4 ノード (db.score.model / db.score.repository / db.user.model / db.user.repository) すべてが未検証状態。特に永続化サービスの中核である以下が完全に歯抜け: (1) db.user.repository の insert/update/delete/select 各 CRUD と 0 件時の空 User フォールバック、(2) db.score.repository の 1000 レコード刻みバルク INSERT・部分失敗時の残留・3 段 JOIN SELECT のグルーピング復元、(3) db.user.model の User.dummy()/height 正規表現、(4) db.score.model の makeDbScore/makeDbMessage/makeDbCapabilityScore による DB→モデル復元。CapabilityScore の B/C=A 上書きバグは実挙動として固定検証が必要。
- **quality_notes**: 既存 QA が存在しないため API only への偏りは現状評価不能。新規追加は全て『保存 → 再SELECT → モデル復元 → 別セッション/再読込での一致』まで通す方針とし、単なるメソッド戻り値 true の確認では終わらせない。ブラウザ(非Android)経路と Android(SQLite実機)経路で挙動が分岐する点を各シナリオで明示する。
- **drift_notes**: spec 内に既に明記された不整合が複数あり QA で固定すべき: (1) score / capability_score の score カラムは INTEGER 宣言だが小数を格納 (SQLite緩型)、(2) users.height も INTEGER 宣言だが number(小数)保存、(3) CapabilityScore コンストラクタが scoreA を B/C にも代入する疑いバグ、(4) insertScore に明示トランザクションがなく部分失敗で score テーブルにのみ残留、(5) updateUser の WHERE 句が user_id 文字列連結。facts が空のため approved 根拠での確定は不可、いずれも open_questions へ回す。

---

## 検証シナリオ（追加）



### TC-DB-USER-001 — アカウント作成→再ログインでユーザーが永続化され MD5 パスワードで認証できる

- **node_id**: `db.user.repository`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: UC1264 / UC1262 から導出。db.user.repository の insertUser → selectUser(id,password) の往復が未検証。パスワードは MD5 ハッシュ保存 (db.user.model) のため平文では認証不可であることを固定する。

**検証手順**:

1. ユーザー操作: オープニング→アカウント作成で ID/PASSWORD/性別/生年月/身長/都道府県 を入力し登録

1. 期待 DB / API 状態: users テーブルに 1 レコード INSERT、user_password は Md5.hashStr(入力) と一致 (平文ではない)

1. 期待 DOM 反映: 作成後は自動ログアウトしオープニングへ遷移

1. 再読込・別セッションでの再確認: 再度 selectUser(id, 正しいPW) で User が返り、selectUser(id, 誤PW) では userId='' の空 User が返る



### TC-DB-USER-002 — selectUser が該当 0 件時に空 User(userId='') を返し未認証扱いになる

- **node_id**: `db.user.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: db.user.repository で 0 件時に new User() を返す仕様。UC1262 のログイン失敗パス (エラーパス) が未検証。

**検証手順**:

1. ユーザー操作: 存在しない ID または誤 PASSWORD でログイン

1. 期待 DB / API 状態: selectUser が userId='' の User を返す

1. 期待 DOM 反映: ログイン失敗として扱われオープニングに留まる (over_all メッセージは表示されない)

1. 再読込・別セッションでの再確認: 再試行しても同様に空 User が返り、ログイン状態にならない



### TC-DB-USER-003 — アカウント編集でパスワード欄'****'は現行維持、変更時のみ MD5 で更新される

- **node_id**: `db.user.repository`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: UC1265 から導出。updateUser とパスワード維持ロジックの往復が未検証。updateUser の WHERE 句が user_id 文字列連結である点も検証対象。

**検証手順**:

1. ユーザー操作(A): 編集画面でパスワードを'****'のまま他項目(身長等)を変更し保存

1. 期待 DB / API 状態(A): user_password は変更前ハッシュのまま、身長等のみ UPDATE

1. ユーザー操作(B): パスワードを新値に変更して保存

1. 期待 DB / API 状態(B): user_password が Md5.hashStr(新値) に更新

1. 再読込・別セッションでの再確認: (A)は旧PWでログイン可、(B)は新PWでログイン可・旧PWは不可



### TC-DB-USER-004 — height の小数値が INTEGER カラムにそのまま保存・復元される (緩型 drift 固定)

- **node_id**: `db.user.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec 明記の drift: users.height は INTEGER 宣言だが db.user.model は number(小数)。185.5 のような値が丸められず保存・復元されることを固定する。

**検証手順**:

1. ユーザー操作: 身長 185.5 (正規表現 ^[1-2][0-9]{2}(\.[0-9]+)?$ に合致) でアカウント作成

1. 期待 DB / API 状態: users.height に 185.5 が格納される (整数丸めされない)

1. 期待 DOM 反映: 編集画面再表示時に 185.5 が表示される

1. 再読込・別セッションでの再確認: selectUser 後の User.height が 185.5 で一致



### TC-DB-USER-005 — 身長バリデーション: 正規表現に反する値は保存経路に到達しない

- **node_id**: `db.user.model`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec gap: db.user.model は height 正規表現 (100〜299 3桁+任意小数) を記載するが検証発火が UI 側 (ui.account.page) のため db ドメインでは境界のみ確認。UC1264/UC1265 のバリデーション失敗パスが未検証。

**検証手順**:

1. ユーザー操作: 身長に 99 / 300 / abc / 空 を入力

1. 期待 DOM 反映: フォームバリデーションエラーが表示され保存ボタンが無効

1. 期待 DB / API 状態: insertUser/updateUser が呼ばれず users テーブルに不正値が入らない

1. 再読込・別セッションでの再確認: 該当ユーザーの height が不正値で上書きされていない



### TC-DB-USER-006 — アカウント削除で user と関連 score/score_history/capability_score が連鎖削除される

- **node_id**: `db.score.repository`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: UC1266 から導出。deleteUser + ScoreDbService.delete(userId) の連鎖削除 (capability_score→score_history→score 順) が未検証。削除順・IN サブクエリの範囲が対象。

**検証手順**:

1. ユーザー操作: 診断結果を持つユーザーでアカウント編集→削除→確認ダイアログで確定

1. 期待 DOM 反映: 削除後オープニングへ遷移、当該ユーザーで再ログイン不可

1. 期待 DB / API 状態: users から該当 user_id 削除、score/score_history/capability_score の該当 user_id 由来 score_id レコードが全削除

1. 再読込・別セッションでの再確認: 他ユーザーのレコードは削除されていない (score_id IN サブクエリが user 単位に限定)



### TC-DB-USER-007 — 削除確認ダイアログでキャンセル時はレコードが残る

- **node_id**: `db.score.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: UC1266 の確認ダイアログ (最終確認) の否定パスが未検証。誤削除防止の基本挙動。

**検証手順**:

1. ユーザー操作: アカウント削除→確認ダイアログでキャンセル

1. 期待 DOM 反映: 編集画面に留まる

1. 期待 DB / API 状態: users/score/score_history/capability_score のいずれも変化なし

1. 再読込・別セッションでの再確認: 該当ユーザーで引き続きログイン・診断結果閲覧が可能



### TC-DB-SCORE-001 — 運転診断終了で score/score_history/capability_score の 3 テーブルへ保存され SELECT で復元される

- **node_id**: `db.score.repository`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: UC1267 の中核。insertScore → selectScore → Score.makeDbScore の往復が未検証。score_id が診断開始 UnixTime(ms) であること、messages と graphCapabilityScoreList が score_id グルーピングで正しく紐付くことを固定。

**検証手順**:

1. ユーザー操作: 診断開始→走行→終了で結果を保存

1. 期待 DB / API 状態: score 1 レコード (score_id=startTimestamp)、score_history に各メッセージ、capability_score に能力指標が INSERT

1. 期待 DOM 反映: 終了ダイアログに over_all/score1..4 が表示、地図にヒヤリマーカー

1. 再読込・別セッションでの再確認: selectLastScore の Score が overAll/score1..4/messages/graphCapabilityScoreList を保存内容と一致して復元 (makeDbScore の timestamp=score_id)



### TC-DB-SCORE-002 — 1000 レコード超のメッセージ/能力指標がバルク INSERT で欠落なく保存される (境界)

- **node_id**: `db.score.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec 明記の 1000 レコード刻み再帰バルク INSERT の境界検証。999/1000/1001/2000 件で欠落・重複が起きないことを確認。

**検証手順**:

1. ユーザー操作: score_history が 999/1000/1001/2000 件相当となる走行を保存 (擬似データ投入)

1. 期待 DB / API 状態: 各境界で score_history の件数が投入件数と完全一致、1000 の倍数境界で最終バッチが欠落しない

1. 期待 DOM 反映: アドバイス/ヒストリー画面で全メッセージが参照可能

1. 再読込・別セッションでの再確認: selectAllScore/selectScore で件数と内容が保存時と一致



### TC-DB-SCORE-003 — insertScore の途中失敗時に score テーブルにのみ残留する挙動 (トランザクション欠如 drift)

- **node_id**: `db.score.repository`
- **priority**: `nice`
- **applicable_roles**: user
- **rationale**: spec 明記の drift: 明示的トランザクション未使用のため部分失敗で score のみ残る可能性。実挙動を固定しつつ open_questions で整合性方針を逆フィードバック。

**検証手順**:

1. ユーザー操作: insertScoreHistory 途中で SQLite 失敗を発生させる (障害注入)

1. 期待 DB / API 状態: score に 1 レコードが残るが score_history/capability_score は不完全

1. 期待 DOM 反映: 後続の selectScore が messages 欠落の Score を返し得る

1. 再読込・別セッションでの再確認: 不整合レコードが SELECT でクラッシュせず makeDbScore が空 messages で復元される



### TC-DB-SCORE-004 — scoreList が空/非Android の insertScore は no-op で true を返し DB を汚さない

- **node_id**: `db.score.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec 明記の insertScore no-op 分岐。空状態・ブラウザ経路のガードが未検証。

**検証手順**:

1. ユーザー操作(A): scoreList 空の診断終了、(B): ブラウザ(非Android)で診断終了

1. 期待 DB / API 状態: (A)(B)ともに INSERT が発行されず戻り値 true

1. 期待 DOM 反映: エラー表示なくフロー継続、ブラウザ時は SELECT でダミースコアが返る

1. 再読込・別セッションでの再確認: score/score_history/capability_score にゴミレコードが残っていない



### TC-DB-SCORE-005 — CapabilityScore 復元時 scoreA が B/C に上書きされる実挙動を固定 (バグ疑い)

- **node_id**: `db.score.model`
- **priority**: `nice`
- **applicable_roles**: user
- **rationale**: spec 明記のバグ疑い: コンストラクタが capabilityScore.score.scoreA を A/B/C 全てに代入。spec/unknowns.md 記載の現状挙動を回帰基準として固定し、修正判断は open_questions へ。ただし makeDbCapabilityScore は DB の score_a/b/c から個別復元するため経路差を明確化する。

**検証手順**:

1. ユーザー操作: 能力指標 A≠B≠C を持つロジック出力から Score を構築 (コンストラクタ経路)

1. 期待 DB / API 状態: コンストラクタ経由の CapabilityScore は scoreA/B/C が全て A の値 (現状バグ挙動)

1. 期待 DOM 反映: ヒストリー能力指標タブでの表示値が上記に一致

1. 再読込・別セッションでの再確認: makeDbCapabilityScore(DB復元経路)では score_a/score_b/score_c が個別値で復元され、コンストラクタ経路との差異が明確



### TC-DB-SCORE-006 — 過去の診断結果は直近 30 回分に制限され score_id DESC 順で返る (境界)

- **node_id**: `db.score.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: UC1270 から導出。selectAllScore/_selectScore(-1,-1) の 30 件制限と DESC ソート、0件時の空状態が未検証。

**検証手順**:

1. ユーザー操作: 診断結果 0件/1件/30件/31件を持つユーザーでヒストリー画面を開く

1. 期待 DB / API 状態: 31件時は直近 30 件のみ、score_id DESC 順で返る

1. 期待 DOM 反映: 0件時は空状態表示、Chart.js が空/N件で崩れない

1. 再読込・別セッションでの再確認: 再表示しても同じ 30 件・同じ順序で一致



### TC-DB-SCORE-007 — score/capability_score の小数値が INTEGER カラムに丸められず保存・復元される (緩型 drift)

- **node_id**: `db.score.repository`
- **priority**: `nice`
- **applicable_roles**: user
- **rationale**: spec 明記の drift: score カラムは INTEGER 宣言だが Math.random()*100 の小数がそのまま格納される。丸め欠損がないことを固定。

**検証手順**:

1. ユーザー操作: 小数スコア (例 73.42) を含む診断結果を保存

1. 期待 DB / API 状態: score_over_all 等に 73.42 が丸められず格納

1. 期待 DOM 反映: アドバイス/ヒストリーで小数を含むスコアが表示

1. 再読込・別セッションでの再確認: makeDbScore 後の overAll が 73.42 で一致



### TC-DB-SCORE-008 — ログイン済みユーザーが存在しない状態での保存/SELECT が破綻しない

- **node_id**: `db.score.repository`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec 明記の業務ルール: SELECT/INSERT は loginService.loginUser.userId に依存。未ログイン(userId='')でのエラーパスが未検証。

**検証手順**:

1. ユーザー操作: 未ログイン状態 (loginUser.userId='') で SELECT/insert 経路に到達

1. 期待 DB / API 状態: user_id='' 条件で 0 件返却、または no-op となりクラッシュしない

1. 期待 DOM 反映: 未認証としてオープニングへ誘導される

1. 再読込・別セッションでの再確認: 他ユーザーのレコードが誤って取得されない





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `TC-DB-USER-001` → **must** : アカウント作成→認証の永続化往復は全ユーザーフローの前提。MD5 保存の固定が必須。

- `TC-DB-USER-003` → **must** : パスワード維持/更新ロジックの誤りは認証事故に直結するため must。

- `TC-DB-USER-006` → **must** : 削除の連鎖範囲誤りは他ユーザーデータ破壊のリスクがあり must。

- `TC-DB-SCORE-001` → **must** : 診断結果の 3 テーブル保存→復元は db ドメインの中核機能。

- `TC-DB-USER-002` → **should** : ログイン失敗パスは重要だが基本フローに従属。

- `TC-DB-USER-004` → **should** : 緩型 drift 固定。実害は低いが回帰防止に有効。

- `TC-DB-USER-005` → **should** : バリデーション発火が UI 側のため db では境界確認に留まる。

- `TC-DB-USER-007` → **should** : 誤削除防止の否定パス。

- `TC-DB-SCORE-002` → **should** : バルク INSERT 境界。データ量依存だが欠落は重大。

- `TC-DB-SCORE-004` → **should** : no-op ガードは DB 汚染防止に有効。

- `TC-DB-SCORE-006` → **should** : 30 件制限とソートの境界。0件空状態含む。

- `TC-DB-SCORE-008` → **should** : 未ログイン依存の破綻防止。

- `TC-DB-SCORE-003` → **nice** : トランザクション欠如 drift。方針未確定のため nice で現状固定。

- `TC-DB-SCORE-005` → **nice** : バグ疑いの実挙動固定。修正方針が open_question のため断定せず。

- `TC-DB-SCORE-007` → **nice** : 緩型 drift。表示影響は限定的。



---

## Open Questions



### insertScore の部分失敗時の整合性方針が未定義

- **質問**: insertScore は明示的トランザクションを張らないため insertScoreHistory/insertCapabilityScore 途中失敗で score テーブルにのみレコードが残る。この残留を許容 (現状) するのか、トランザクション導入で全ロールバックするのが正なのか spec に方針記載がない。
- **保留中の判断**: TC-DB-SCORE-003


### CapabilityScore コンストラクタの scoreA→B/C 上書きはバグか仕様か

- **質問**: db.score.model のコンストラクタは capabilityScore.score.scoreA を A/B/C 全てに代入している(バグ疑い)。修正対象なら回帰テストの期待値を反転する必要がある。修正/据え置きの判断を spec 側で確定してほしい。
- **保留中の判断**: TC-DB-SCORE-005


### 身長バリデーションの db 側での責務範囲

- **質問**: height 正規表現の検証は ui.account.page でのみ発火し db.user.repository には二重チェックがない。UI をすり抜けた不正値 (例: updateUser の直接呼び出し) に対し db 層で防御すべきかが未記載。
- **保留中の判断**: TC-DB-USER-005


### INTEGER カラムへの小数保存を許容する方針か

- **質問**: score/capability_score/users.height は INTEGER 宣言だが小数を保存している。SQLite 緩型に依存した現状を許容するのか、スキーマを REAL に是正するのか方針が未定義。テスト期待値 (丸めなし固定) が方針変更で無効化される恐れ。
- **保留中の判断**: TC-DB-USER-004, TC-DB-SCORE-007


### 未ログイン(userId='')状態での DB アクセス時の期待挙動

- **質問**: SELECT/INSERT は loginUser.userId に依存するが、userId='' で到達した場合の期待挙動 (no-op / 空返却 / 例外) が spec に明記されていない。
- **保留中の判断**: TC-DB-SCORE-008




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/db-user-repository.md`

- `spec/qa/db-score-repository.md`

- `spec/qa/db-model.md`


