<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:34:25 JST -->

```json
{
  "required_changes": [
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "アカウント削除(UC05)時に users / score / score_history / capability_score のユーザー単位レコードを削除する削除範囲と責務分担を明記する"},
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "アカウント編集(UC04)におけるパスワード '****' = 現行維持 / 変更時のみ MD5 で更新するデータ意味論を明記する"},
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "CRUD 各操作が middleware.log.service へ操作ログを出力する（成功/失敗ともに）ことを明記する"},
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "対応ユースケース(UC01/UC03/UC04/UC05)と API の対応表を追加する"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "4テーブル横断のユーザー削除は単一リポジトリで完結せず、削除順序・トランザクション境界・部分失敗時のリカバリを呼び出し元(削除フロー)で定義する必要がある"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "パスワード '****' 判定と MD5 変換をどの層(UI/Model/Middleware/DB)で行うかの責務確定が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "削除後に score / score_history / capability_score の孤児レコードが残らないこと、'****' 保存時にパスワードが書き換わらないことの検証が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "height REAL 化に伴う小数値の保存・復元テスト、および空User返却時の未ログイン導線テストが必要"}
  ],
  "requirements_context": "db.user.repository は users テーブルの CRUD を担い、UC01(ログイン)/UC03(アカウント作成)/UC04(アカウント編集)/UC05(アカウント削除)を支える。UC01 は selectUser(user_id, MD5パスワード) による認証取得で、0件時は userId='' の空 User を返し未ログイン状態を表す（UI層が必須画面へのガードに利用）。UC03 は insertUser で user_id を主キーとする新規行を作成し、既存 user_id との重複は INSERT OR IGNORE で無視される。UC04 は updateUser で属性を更新し、パスワード欄が '****' の場合は現行の user_password を維持し、変更された場合のみ MD5 ハッシュ化した値で更新する（平文は保存しない）。UC05 のアカウント削除は users 行の物理削除に加え、当該 user_id に紐づく score / score_history / capability_score のユーザー単位レコードも削除し、ユーザーデータを残さない（論理削除・アーカイブは行わない）。users テーブルは user_id TEXT PRIMARY KEY, user_password TEXT(MD5), sex INTEGER, birth_year INTEGER, birth_month INTEGER, height REAL, prefecture INTEGER。height は 185.5 等の小数を格納するため REAL 宣言とし、入力バリデーション ^[1-2][0-9]{2}(\\.[0-9]+)?$ と整合する。SQLite 呼び出しは全て try/catch し、成功・失敗ともに middleware.log.service へ操作ログを出力する。DB層は例外を再スローせず戻り値（空 User / false）で状態を通知する。Android 以外（ブラウザ）では SQLite を使わず User.dummy() 等のスタブを返す。updateUser の WHERE 句は user_id を文字列連結しているが、user_id は ^[a-zA-Z0-9]+$ で検証済みである前提。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "身長は小数を含む数値として保存される", "statement": "users テーブルの height カラムは REAL として宣言され、185.5 等の小数値を格納・復元する", "status": "candidate"},
    {"type": "constraint", "title": "身長入力は小数を許容する正規表現で検証される", "statement": "身長の入力値は ^[1-2][0-9]{2}(\\.[0-9]+)?$ で検証され、小数値を許容するため REAL 宣言と整合する", "status": "candidate"},
    {"type": "state_rule", "title": "該当ユーザ不在時は空Userを返す", "statement": "selectUser は user_id/password 一致レコードが 0件のとき userId='' の空 User を返す", "status": "candidate"},
    {"type": "business_rule", "title": "空Userは未ログイン状態を表す", "statement": "userId='' の空 User は未ログイン状態を表し、UI層が必須画面への到達をガードする前提となる", "status": "candidate"},
    {"type": "data_semantics", "title": "パスワードはMD5ハッシュで保存される", "statement": "user_password は MD5 ハッシュ済み文字列として保存され、平文パスワードは保存されない", "status": "candidate"},
    {"type": "constraint", "title": "user_idは主キーとして一意である", "statement": "users テーブルの user_id は PRIMARY KEY であり一意である", "status": "candidate"},
    {"type": "business_rule", "title": "パスワード '****' は現行維持を意味する", "statement": "アカウント編集時にパスワード値が '****' の場合、user_password は更新せず現行の保存値を維持する", "status": "candidate"},
    {"type": "business_rule", "title": "パスワード変更時のみMD5で上書きする", "statement": "アカウント編集でパスワードが '****' 以外に変更された場合のみ、MD5 ハッシュ化した値で user_password を更新する", "status": "candidate"},
    {"type": "data_semantics", "title": "アカウント削除は関連4種のユーザー単位レコードを削除する", "statement": "アカウント削除では users に加え、当該 user_id に紐づく score / score_history / capability_score のユーザー単位レコードを削除する", "status": "candidate"},
    {"type": "data_semantics", "title": "アカウント削除は物理削除である", "statement": "アカウント削除は行の物理削除であり、論理削除フラグや削除済みユーザーのアーカイブ保持は行わない", "status": "candidate"},
    {"type": "data_semantics", "title": "user_id が関連テーブルの参照キーである", "statement": "score / score_history / capability_score は user_id によって users を参照する", "status": "candidate"},
    {"type": "state_rule", "title": "削除結果は真偽値で返す", "statement": "deleteUser は削除成功時 true、例外発生時 false を返し、例外は再スローしない", "status": "candidate"},
    {"type": "business_rule", "title": "CRUD操作は操作ログに記録される", "statement": "users への select / insert / update / delete 操作は middleware.log.service へ操作ログとして出力される", "status": "candidate"},
    {"type": "constraint", "title": "重複ユーザー登録はIGNOREで無視される", "statement": "insertUser は ignore 指定時 INSERT OR IGNORE を用い、既存 user_id との重複時に既存行を上書きしない", "status": "candidate"}
  ],
  "open_questions": [
    "アカウント削除における 4テーブル（users / score / score_history / capability_score）削除の原子性が未確定。単一トランザクションで実行するのか、テーブル毎に個別実行するのかが決まっておらず、部分失敗時に孤児レコードが残る可能性がある。Middleware（削除フローの責務）判断が必要で、決まらないとデータ整合性保証とQAの検証手順が定まらない。",
    "削除順序（子テーブル→users か users→子テーブルか）と、外部キー制約/ON DELETE CASCADE を宣言するか否かが未確定。DB定義（現状 users に FK 宣言なし）とMiddleware実装のどちらで担保するかの判断が必要。",
    "パスワード '****' の判定と MD5 変換をどの層で行うかが未確定（UI/Model/Middleware/DB のいずれか）。決まらないと updateUser のインターフェース（MD5済み値を受け取るのか平文を受け取るのか）が確定しない。",
    "削除されたユーザーの user_id を含む操作ログを、削除後も保持してよいか（監査要件・個人情報の扱い）が未確定。Middleware/セキュリティ判断が必要。",
    "既存DBで height が INTEGER 宣言のまま格納されている環境に対するマイグレーション要否・方法が未確定（SQLite の型親和性により実データは影響を受けない可能性が高いが、CREATE TABLE 変更の適用タイミングをMiddleware/QAと要確認）。",
    "同一 user_id を削除後に再作成した場合、過去の score / score_history が残存しないこと（=別人として扱うこと）が保証されるかの確認が必要。"
  ],
  "rationale_notes": [
    "SQLite は型親和性が緩く INTEGER 宣言でも小数値が保存されるが、宣言型を実挙動(REAL)に合わせることで仕様と実装の乖離を解消する狙い",
    "空User返却は例外を投げない設計方針の一部であり、DB層は戻り値で状態を通知し呼び出し元(login.service/UI)が制御を担う責務分担",
    "'****' プレースホルダは、編集画面に既存パスワードのハッシュを露出させないための UI 慣習であり、DB層から見ると『当該カラムを UPDATE 対象から除外する』という意味を持つ",
    "UserDbService 自体は users テーブルのみを扱う単一テーブルリポジトリであるため、アカウント削除の横断削除は各リポジトリの deleteXxx(userId) を削除フローが順に呼ぶ構成になる想定。本ノードでは users 行の削除責務のみを規定し、横断の調整責務は Middleware に置く",
    "物理削除を採る前提であるため、削除後のユーザー復旧手段は存在しない。復旧要件が発生した場合は論理削除への設計変更が必要になる"
  ]
}
```

以下、差分更新した仕様書本文です。

# db.user.repository — users テーブルの CRUD サービス

## 概要
`UserDbService` は Cordova SQLite プラグイン (`@awesome-cordova-plugins/sqlite/ngx`) 経由で `driving-score.db` の `users` テーブルに CRUD 操作を行う。ブラウザ実行時は SQLite を使わず [[db.user.model]] の `User.dummy()` を返す。

本ノードは **users テーブルのみを扱う単一テーブルリポジトリ** である。アカウント削除で必要となる関連テーブル（score / score_history / capability_score）の削除は各リポジトリが担い、その順序と原子性の調整は呼び出し元（削除フロー）の責務とする（「アカウント削除時の削除範囲」参照）。

## 真実源
- `src/data/src/app/services/user-db.service.ts`

## 対応ユースケース
| UC | 内容 | 主に使用する API |
|---|---|---|
| UC01 | 未ログインのログイン | `selectUser(user_id, md5(password))` |
| UC03 | アカウント作成 | `insertUser(user, ignore)` |
| UC04 | アカウント編集 | `updateUser(user)`（パスワードは `'****'` で現行維持） |
| UC05 | アカウント削除 | `deleteUser(user_id)` + 関連テーブル削除 |

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `LogService`（[[middleware.log.service]]）、`SQLite`
- `Capacitor.getPlatform() === 'android'` のときのみ SQLite を使用（`cordovaAvailable` フラグ）

## テーブル定義
```
CREATE TABLE IF NOT EXISTS users (
  user_id       TEXT PRIMARY KEY,
  user_password TEXT,
  sex           INTEGER,
  birth_year    INTEGER,
  birth_month   INTEGER,
  height        REAL,
  prefecture    INTEGER
);
```
※ `height` は小数を含む数値（例: `185.5`）を格納・復元するため `REAL` で宣言する。これは [[db.user.model]] が number（小数を含む）で扱う挙動、および入力バリデーション正規表現 `^[1-2][0-9]{2}(\.[0-9]+)?$`（小数を許容）と整合する。
※ SQLite は型親和性が緩く、旧環境で INTEGER 宣言のまま格納された小数値も影響を受けない見込みだが、既存DBへの適用タイミングは [[middleware.login.service]] / QA と要確認。
※ 外部キー制約は宣言していない。`score` / `score_history` / `capability_score` は `user_id` によって論理的に `users` を参照する。

## API
| メソッド | 引数 | 戻り値 | 挙動 |
|---|---|---|---|
| `initialize()` | — | `Promise<void>` | Android のみ `sqlite.create({ name: 'driving-score.db', location: 'default' })` で DB を開き、`createDb()` を実行 |
| `createDb()` | — | `Promise<void>` | 上記 `CREATE TABLE IF NOT EXISTS users` を実行 |
| `selectUsers()` | — | `Promise<User[]>` | 全件 SELECT。ブラウザ時は `[User.dummy()]` |
| `selectUser(id, password)` | `string`, `string` | `Promise<User>` | `SELECT * FROM users WHERE user_id = ? AND user_password = ?`。0 件時は `new User()`（`userId=''`）を返す。ブラウザ時は `User.dummy()` |
| `insertUser(user, ignore)` | `User`, `boolean` | `Promise<User>` | `INSERT (or IGNORE) INTO users (…) VALUES (…)`。成功時は再度 `selectUser` で取得して返す。ブラウザ時は `selectUser` |
| `updateUser(user)` | `User` | `Promise<User>` | `UPDATE users SET … WHERE user_id = '<id>'`（**注: user_id 部分は文字列連結、他フィールドはプレースホルダ**）。成功時は再取得。ブラウザ時は `selectUser` |
| `deleteUser(id)` | `string` | `Promise<boolean>` | `DELETE FROM users WHERE user_id = ?`。成功=`true`、例外時 `false`。ブラウザ時は `true` |

## アカウント作成（UC03）
- `user_id` は PRIMARY KEY であり一意。既存 `user_id` と重複する場合、`ignore=true`（`INSERT OR IGNORE`）では既存行を上書きせず無視する。
- 登録時のパスワードは MD5 ハッシュ済み文字列として `user_password` に保存する（平文は保存しない）。

## アカウント編集（UC04）— パスワード更新規則
- 編集画面には既存パスワードのハッシュを露出させず、プレースホルダ `'****'` を表示する。
- **パスワード値が `'****'` の場合**: 現行の `user_password` を維持し、更新対象から除外する。
- **パスワード値が `'****'` 以外に変更された場合のみ**: 入力値を MD5 ハッシュ化して `user_password` を更新する。
- 上記判定・MD5 変換をどの層（UI / [[db.user.model]] / Middleware / 本サービス）で行うかは未確定（open_question）。本ノードは「`'****'` は現行維持を意味する」というデータ意味論のみを規定する。

## アカウント削除（UC05）— 削除範囲
アカウント削除では、対象 `user_id` に紐づく以下のユーザー単位レコードをすべて削除し、ユーザーデータを残さない。

| テーブル | 削除対象 | 担当リポジトリ |
|---|---|---|
| `users` | `user_id` 一致の 1 行 | 本ノード（`deleteUser`） |
| `score` | `user_id` 一致の全行 | score 系リポジトリ |
| `score_history` | `user_id` 一致の全行 | score 系リポジトリ |
| `capability_score` | `user_id` 一致の全行 | score 系リポジトリ |

- 削除は **物理削除** であり、論理削除フラグや削除済みユーザーのアーカイブ保持は行わない。削除後の復旧手段は存在しない。
- 本サービスの `deleteUser` は `users` 行の削除のみを行う。4 テーブル横断の削除順序・トランザクション境界・部分失敗時の扱いは呼び出し元（削除フロー）が定義する（[[middleware.log.service]] へのログ出力を含む）。→ open_question として Middleware と要確認。

## 未ログイン制御の前提（空 User の意味論）
- `selectUser` は該当レコードが 0 件のとき `userId=''` の空 `User` を返す。
- この空 `User` は **未ログイン状態を表す**。UI 層は `userId` が空の場合に必須画面（ログイン後前提の画面）へ到達させないガードを行う（[[middleware.login.service]] 経由）。
- DB 層は例外を投げず戻り値（空 User）で状態を通知する。ログイン判定・画面遷移の責務は呼び出し元が担う。

## 操作ログ
- `select` / `insert` / `update` / `delete` の各操作は [[middleware.log.service]] へ操作ログを出力する。
- 失敗時は同サービスの `error()` に記録する。
- 削除済みユーザーの `user_id` を含むログを削除後も保持してよいかは未確定（open_question）。

## セキュリティ観点
- `updateUser` の WHERE 句は `user_id = '${id}'` と直接埋め込みしている。`user_id` は Reactive Forms の `^[a-zA-Z0-9]+$` パターンで検証済のため実害はない見込みだが、パターンをすり抜ける改変には注意。
- 実装時のパスワード保存は MD5 ハッシュ済み文字列（[[db.user.model]] を参照）。平文パスワードはいかなるカラムにも保存しない。

## エラー処理
- SQLite 呼び出しは全て try/catch し、失敗は [[middleware.log.service]] の `error()` に記録。呼び出し元へは戻り値（空 User / false）で通知する（例外は再スローしない）。

## 関連ノード
- 呼び出し元: [[middleware.login.service]]
- 依存: [[db.user.model]]、[[middleware.log.service]]、SQLite（Cordova）
- 削除連携: score / score_history / capability_score の各リポジトリ