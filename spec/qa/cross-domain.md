# QA Test Specification — Cross-domain

> このドキュメントは qa-maintainer-cross によって生成された正本です。
> Generation: 1 / Generated: 2026-07-20 01:22:36 UTC

## ドメイン横断検証シナリオ



### XQA-001 — 未ログイン(userId='')状態での画面別アクセス制御とDB整合

- **involved_domains**: ui, middleware, db
- **trigger_use_case**: `UC1262`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: ui は「未ログイン時の画面別アクセス制御が spec 未記載」、db は「userId='' での DB アクセスの期待挙動が未定義」を独立して抱えており、UI のガードと DB の受け入れ挙動が食い違うと空 userId でのレコード生成/参照が発生する。単一ドメイン QA では境界の受け渡しが検証できない。

**検証手順**:

1. step 1 (ui): 未ログイン状態で driving/history/account 各ページへ直接遷移を試行

1. step 2 (middleware/db): UI がガードせず処理が到達した場合、userId='' で repository が呼ばれないこと、または明示的に拒否されることを確認

1. step 3 (db/DOM): DB に userId='' のレコードが insert されていないこと、UI がログイン画面へリダイレクトすることを観測



### XQA-002 — 自動ログイン72時間しきい値の境界(有効/失効)の端到端検証

- **involved_domains**: ui, middleware, db
- **trigger_use_case**: `UC1263`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: 72時間しきい値が ui・qa 双方で open question 化しており、境界値(71:59 / 72:00 / 72:01)での有効/失効判定が middleware(login.service) と UI 遷移で一致するかは横断でしか確認できない。境界の解釈差はセッション破綻の起点になる。

**検証手順**:

1. step 1 (db): 最終ログイン時刻を 72時間直前/直後にセットしたユーザーを用意

1. step 2 (middleware): login.service が有効/失効をどちらに判定するか(境界含む)を確認

1. step 3 (ui): 有効時はホーム、失効時はオープニング/ログインへ遷移することを観測



### XQA-003 — アカウント削除のカスケードとスコア/ログの残存整合

- **involved_domains**: ui, middleware, db
- **trigger_use_case**: `UC1266`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: qa の「削除のカスケード対象と整合性」と db の「未定義の整合性方針」が接続されていない。UI の削除操作後に score/log レコードが残存すると孤児データとなり、history/advice 集計が破綻する。副作用伝播の典型。

**検証手順**:

1. step 1 (ui): 診断結果を複数持つユーザーで削除を実行

1. step 2 (db): user 削除に伴い score・log の関連レコードがカスケード削除される(または明示保持方針に従う)ことを確認

1. step 3 (ui/db): 同 userId での再ログイン不可・history が空/エラーにならないことを観測



### XQA-004 — 運転診断実行→スコア算出→SQLite保存→履歴表示の連鎖

- **involved_domains**: ui, middleware, db, infra
- **trigger_use_case**: `UC1267`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: 診断は infra(sensor)→middleware(score.logic)→db(insertScore)→ui(history) と全ドメインを貫く。qa は「保存スキーマとタイミング」、db は「insertScore の部分失敗時整合性」を独立して抱えるが、算出値が保存され履歴で再現されることは横断でしか担保できない。

**検証手順**:

1. step 1 (infra/middleware): センサ入力からスコアが算出される

1. step 2 (db): insertScore が算出値どおり保存され、部分失敗時にロールバック/整合が保たれる

1. step 3 (ui): history ページで保存値と同一のスコアが表示されることを観測



### XQA-005 — insertScore 部分失敗時のUI表示とDB状態の整合

- **involved_domains**: ui, middleware, db
- **trigger_use_case**: `UC1267`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: db の「部分失敗時の整合性方針未定義」は UI のエラー表示要件と接続が必要。保存失敗が UI に伝播せず成功表示されると、履歴不一致というデータ一貫性破綻を生む。エラー伝播の検証。

**検証手順**:

1. step 1 (db): insertScore を意図的に部分失敗させる

1. step 2 (middleware): エラーが UI レイヤへ伝播すること

1. step 3 (ui/db): UI が失敗を通知し、DB に中途半端なレコードが残らないことを観測



### XQA-006 — ヒヤリ地点: 診断ログ蓄積→マーカー生成→click→/bad-spot遷移

- **involved_domains**: ui, middleware, infra, db
- **trigger_use_case**: `UC1269`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: infra が「マーカー click から /bad-spot 遷移のマーカー生成仕様が未記載」を抱え、UI の badspot.page と接続が必要。ログ(db/middleware)→地図マーカー(infra/map.service)→UI遷移の連鎖は単一ドメインで検証不能。

**検証手順**:

1. step 1 (db/middleware): ヒヤリ地点ログを保有するユーザーを用意

1. step 2 (infra): map 上に該当マーカーが生成される

1. step 3 (ui): マーカー click で /bad-spot に正しい地点情報付きで遷移することを観測



### XQA-007 — スコアロジック/辞書更新の反映(運用担当者→ドライバー診断)

- **involved_domains**: ui, middleware, infra
- **trigger_use_case**: `UC1271`
- **priority**: `should`
- **applicable_roles**: operator, user
- **rationale**: 運用担当者ロールの更新(scoreLogicJson/辞書)がドライバーの診断・アドバイス表示に反映されるかは、ロール境界とデータ一貫性を跨ぐ。qa は「運用担当者/開発者ロールのアクセス制御」を open question 化しており横断検証が必須。

**検証手順**:

1. step 1 (ui/middleware): 運用担当者ロールでスコアロジック/辞書を更新

1. step 2 (infra): scoreLogicJson/辞書アセットが更新値を保持

1. step 3 (ui): ドライバーロールでの診断/アドバイスに更新後ロジックが反映されることを観測



### XQA-008 — 運用担当者/開発者ロールのアクセス境界(可視/操作可否)

- **involved_domains**: ui, middleware
- **trigger_use_case**: `UC1271`
- **priority**: `must`
- **applicable_roles**: user, operator, developer
- **rationale**: qa の「運用担当者/開発者ロールのアクセス制御」、env の「role 定義未定義」が横断的に未確定。ロール別にスコアロジック編集・センサモード切替・デモ再生の可否境界をドライバーロールと対比しないと権限昇格リスクを見逃す。

**検証手順**:

1. step 1 (ui): user / operator / developer の各ロールで settings/edit ページへアクセス

1. step 2 (middleware): 権限外操作(ロジック編集/モード切替)がサーバ側でも拒否されること

1. step 3 (ui/API): 見える/編集可/不可の境界が定義どおりで、権限外操作が API レベルで弾かれることを観測



### XQA-009 — センサーモード切替とスコアロジック本体差し替えの結線

- **involved_domains**: ui, middleware, infra
- **trigger_use_case**: `UC1272`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: middleware は「センサーモード切替とスコアロジック本体差し替えの結線」を open question 化。切替 UI 操作が sensor.manager/service の実データ差し替えに波及し、以降の診断スコアが変わることは横断でしか検証できない。副作用伝播。

**検証手順**:

1. step 1 (ui): 運用担当者がセンサーモードを切替

1. step 2 (middleware/infra): sensor.service のデータソースが切替後モード(実センサ/demoData)に差し替わる

1. step 3 (ui): 切替後の診断で対応するスコアロジックが適用されることを観測



### XQA-010 — 開発者: スコアロジック編集→testScoreLogic合否→Storage更新→デモ再生

- **involved_domains**: ui, middleware, infra
- **trigger_use_case**: `UC1273`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: qa の「testScoreLogic の合否判定基準と Storage 更新条件」、infra の「gpsDemo 経路再生の設計意図と実装の齟齬(未接続)」が接続されていない。編集→検証→保存→再生の連鎖が破綻すると誤ったロジックが本番反映される。

**検証手順**:

1. step 1 (ui): 開発者がスコアロジックを編集し testScoreLogic を実行

1. step 2 (middleware/infra): 合格時のみ Storage が更新され、gpsDemo 経路再生に反映される

1. step 3 (ui): 不合格時は Storage 未更新のままであること、デモ再生が編集後ロジックで動くことを観測



### XQA-011 — bootstrap失敗時の権限/キー欠如がUI・診断に与える連鎖影響

- **involved_domains**: env, infra, ui
- **trigger_use_case**: `UC1267`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: env の「bootstrap 失敗時の UI フィードバック要件」、infra の「WRITE_EXTERNAL_STORAGE 未宣言と requestPermission の齟齬」「Maps API キー2箇所平文」が独立している。権限/キー欠如が起動→地図/保存→診断に波及するかは横断検証が必要。

**検証手順**:

1. step 1 (env/infra): WRITE_EXTERNAL_STORAGE 未付与/Maps キー不正状態で起動

1. step 2 (infra): file.storage / google.maps の初期化失敗が発生

1. step 3 (ui): bootstrap 失敗が UI に通知され、診断/地図機能が安全に無効化されることを観測



### XQA-012 — アドバイス/ヒストリー集計とDB保存データの整合(空状態含む)

- **involved_domains**: ui, middleware, db
- **trigger_use_case**: `UC1268`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: qa の「集計仕様(件数上限/N日平均/空状態)」と db のスコア保存が接続されていない。UI 集計が DB 実データと一致し、0件時に破綻しないことは横断でしか担保できない。

**検証手順**:

1. step 1 (db): 0件 / N日境界 / 上限超過の各データセットを用意

1. step 2 (middleware): 集計(N日平均/件数上限)ロジックを実行

1. step 3 (ui): advice/history が空状態・境界・上限で正しく表示されることを観測





---

## Integration Gaps



- **gap**: 未ログイン(userId='')が UI ガードをすり抜けた場合の DB 受け入れ挙動が両ドメインで宙に浮いている
  - **missing_in_domains**: ui, db, middleware
  - **suggested_owner**: db
  - **or_new_cross_scenario**: XQA-001 として追加済み

- **gap**: 72時間しきい値の境界値の判定主体(middleware か ui か)と一貫性が定義されていない
  - **missing_in_domains**: ui, middleware, qa
  - **suggested_owner**: middleware
  - **or_new_cross_scenario**: XQA-002 として追加済み

- **gap**: アカウント削除時の score/log カスケード方針が db 未定義のまま UI 削除フローが存在
  - **missing_in_domains**: db, middleware
  - **suggested_owner**: db
  - **or_new_cross_scenario**: XQA-003 として追加済み

- **gap**: 運用担当者/開発者ロールの定義そのものが env で未定義で、UI/middleware のアクセス制御検証の前提が欠落
  - **missing_in_domains**: env, ui, middleware
  - **suggested_owner**: env
  - **or_new_cross_scenario**: XQA-008 として追加(ただし role 定義の先行確定が前提)

- **gap**: insertScore の INTEGER カラムへの小数保存許容有無が UI 表示値の丸めと整合しているか未検証
  - **missing_in_domains**: db, ui
  - **suggested_owner**: db
  - **or_new_cross_scenario**: XQA-004/XQA-005 に丸め観測点を追加すべき

- **gap**: CapabilityScore コンストラクタの scoreA→B/C 上書き挙動が middleware 算出値と DB 保存値の一致検証を汚染する可能性
  - **missing_in_domains**: db, middleware
  - **suggested_owner**: middleware
  - **or_new_cross_scenario**: XQA-004 で算出値と保存値の一致を検証する際に併せて確認



---

## 整合性問題



### [role]

- **対象ドメイン**: env, qa, ui, middleware
- **description**: qa は「運用担当者/開発者」ロールを扱うが env は role 定義自体が未定義、他ドメインの roles_involved も空。ロール概念の定義元が存在しない。
- **proposed_resolution**: env もしくは共通 spec にロール定義(user/operator/developer)と各ロールの権限マトリクスを canonical に定め、全ドメイン QA が参照する


### [expectation]

- **対象ドメイン**: ui, middleware, qa
- **description**: 自動ログイン72時間しきい値が ui と qa で別々に open question 化され、境界(含む/含まない)の期待値が未統一。
- **proposed_resolution**: しきい値の判定主体を middleware に一本化し、境界の含意(72時間ちょうどは有効か)を canonical spec に明記


### [api_contract]

- **対象ドメイン**: env, infra
- **description**: Google Maps API キーが environment と AndroidManifest の2箇所で平文管理され、値が異なる可能性(env open question)。infra は同キーを消費するため契約が二重化。
- **proposed_resolution**: キーの単一情報源(single source of truth)を定め、ビルド時注入で両参照を同期。QA でキー一致を検証


### [expectation]

- **対象ドメイン**: env, infra
- **description**: WRITE_EXTERNAL_STORAGE が Manifest 未宣言だが infra 側で requestPermission が呼ばれる齟齬。env と infra で期待挙動が食い違う。
- **proposed_resolution**: Manifest 宣言の要否を確定し、宣言/コードのどちらを正とするか決定。file.storage 初期化失敗時のフォールバックを定義


### [expectation]

- **対象ドメイン**: db, middleware, ui
- **description**: 運転診断スコアのデータ型: db は INTEGER カラムだが小数保存許容が未定、middleware 算出は小数の可能性。保存値と UI 表示値の期待が不整合になりうる。
- **proposed_resolution**: スコアのデータ型と丸め規則を canonical に定義し、算出・保存・表示の3層で統一




---

## 横断視点での優先度調整



- `qa: アカウント削除のカスケード対象と整合性` : `should` → **must**
  - reason: 削除カスケード漏れは孤児 score/log を生み、以降の history/advice 集計を破綻させるデータ一貫性破綻の起点。横断視点で must に格上げ。

- `db: insertScore の部分失敗時の整合性` : `should` → **must**
  - reason: 保存の部分失敗が UI 成功表示と結合すると履歴と実データの永続的不一致を生む。診断は中核 UC(UC1267)であり must。

- `qa: 運用担当者/開発者ロールのアクセス制御` : `should` → **must**
  - reason: ロール境界の欠陥はドライバーによるスコアロジック改変等の権限昇格に直結する。全ロール横断のセキュリティ境界として must。

- `ui: 未ログイン時の画面別アクセス制御` : `should` → **must**
  - reason: UI ガードと DB の userId='' 受け入れ挙動が両方未定義のため、空ユーザーでのレコード汚染の起点になりうる。認証境界として must。



---

## Open Questions



### ロール定義の正本(canonical source)が存在しない

- **質問**: user/operator/developer の定義と権限マトリクスをどのドメイン(env or 共通 spec)が保持するか。定義がないとロール境界 QA(XQA-007/008/009/010)の期待値が確定できない。
- **保留中の判断**: XQA-008 の合否基準, XQA-007/009/010 の applicable_roles 確定, UC1271/1272/1273 の権限検証


### スコアのデータ型・丸め規則の統一方針

- **質問**: middleware 算出値(小数可能性) → db INTEGER 保存 → ui 表示の3層で、どこで丸めどの型を正とするか。
- **保留中の判断**: XQA-004 の保存値=表示値の一致基準, XQA-005 の観測点定義


### 72時間しきい値の判定主体と境界含意

- **質問**: 判定は middleware(login.service)で行うか UI で行うか、72時間ちょうどは有効か失効か。
- **保留中の判断**: XQA-002 の境界期待値, UC1263 の自動ログイン合否基準


### アカウント削除のカスケード対象範囲

- **質問**: user 削除時に score/log を物理削除するか論理削除/保持するか。ヒヤリ地点ログの匿名保持要件があるか。
- **保留中の判断**: XQA-003 の削除後観測点, XQA-006 のマーカー元データ残存有無


### gpsDemo 経路再生の結線状態

- **質問**: infra 側で未接続とされるデモ再生を UC1273 の QA 対象に含めるか、それとも既知の未実装として scope 外とするか。
- **保留中の判断**: XQA-010 の step3 観測可否




---

## Spec to update（参考）



- `spec/qa/cross-domain-auth-boundary.md`

- `spec/qa/cross-domain-role-matrix.md`

- `spec/qa/cross-domain-diagnosis-pipeline.md`

- `spec/qa/cross-domain-account-lifecycle.md`

- `spec/qa/cross-domain-consistency-issues.md`


