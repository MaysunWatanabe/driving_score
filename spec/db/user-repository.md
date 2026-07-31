<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-20 10:30:50 JST -->

```json
{
  "required_changes": [
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "users.height の宣言型を INTEGER から REAL に是正し、実装挙動(185.5等の小数格納)との整合を明記する"},
    {"node": "db.user.repository", "entrypoint": "spec/db/user-repository.md", "description": "selectUser が 0件時に空User(userId='')を返す挙動を未ログイン制御の前提として明記する"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "should", "reason": "selectUser の空User(userId='')返却を login.service が未ログイン判定として利用する前提の確認が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "height REAL 化に伴う小数値の保存・復元テスト、および空User返却時の未ログイン導線テストが必要"}
  ],
  "requirements_context": "users テーブルの height カラムは実装上 185.5 等の小数値を格納・復元しているため、宣言を INTEGER から REAL に是正する。UI/Model 側のバリデーション正規表現 ^[1-2][0-9]{2}(\\.[0-9]+)?$ は小数を許容しており REAL 宣言と整合する。selectUser は該当ユーザが 0件のとき空User(userId='')を返し、この挙動が未ログイン制御(UI層が空userIdで必須画面へ到達させないガード)の前提となることを明記する。updateUser の WHERE句文字列連結、MD5パスワード保存等の他仕様は現行維持する。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "身長は小数を含む数値として保存される", "statement": "users テーブルの height カラムは REAL として宣言され、185.5 等の小数値を格納・復元する", "status": "candidate"},
    {"type": "constraint", "title": "身長入力は小数を許容する正規表現で検証される", "statement": "身長の入力値は ^[1-2][0-9]{2}(\\.[0-9]+)?$ で検証され、小数値を許容するため REAL 宣言と整合する", "status": "candidate"},
    {"type": "state_rule", "title": "該当ユーザ不在時は空Userを返す", "statement": "selectUser は user_id/password 一致レコードが 0件のとき userId='' の空 User を返す", "status": "candidate"},
    {"type": "business_rule", "title": "空Userは未ログイン状態を表す", "statement": "userId='' の空 User は未ログイン状態を表し、UI層が必須画面への到達をガードする前提となる", "status": "candidate"},
    {"type": "data_semantics", "title": "パスワードはMD5ハッシュで保存される", "statement": "user_password は MD5 ハッシュ済み文字列として保存される", "status": "candidate"},
    {"type": "constraint", "title": "user_idは主キーとして一意である", "statement": "users テーブルの user_id は PRIMARY KEY であり一意である", "status": "candidate"}
  ],
  "open_questions": [
    "既存DBで height が INTEGER 宣言のまま格納されている環境に対するマイグレーション要否・方法が未確定（SQLite の型親和性により実データは影響を受けない可能性が高いが、CREATE TABLE 変更の適用タイミングをMiddleware/QAと要確認）"
  ],
  "rationale_notes": [
    "SQLite は型親和性が緩く INTEGER 宣言でも小数値が保存されるが、宣言型を実挙動(REAL)に合わせることで仕様と実装の乖離を解消する狙い",
    "空User返却は例外を投げない設計方針の一部であり、DB層は戻り値で状態を通知し呼び出し元(login.service/UI)が制御を担う責務分担"
  ]
}
```

以下、差分更新した仕様書本文です。

# db.user.repository — users テーブルの CRUD サービス

## 概要
`UserDbService` は Cordova SQLite プラグイン (`@awesome-cordova-plugins/sqlite/ngx`) 経由で `driving-score.db` の `users` テーブルに CRUD 操作を行う。ブラウザ実行時は SQLite を使わず [[db.user.model]] の `User.dummy()` を返す。

## 真実源
- `src/data/src/app/services/user-db.service.ts`

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

## 未ログイン制御の前提（空 User の意味論）
- `selectUser` は該当レコードが 0 件のとき `userId=''` の空 `User` を返す。
- この空 `User` は **未ログイン状態を表す**。UI 層は `userId` が空の場合に必須画面（ログイン後前提の画面）へ到達させないガードを行う（[[middleware.login.service]] 経由）。
- DB 層は例外を投げず戻り値（空 User）で状態を通知する。ログイン判定・画面遷移の責務は呼び出し元が担う。

## セキュリティ観点
- `updateUser` の WHERE 句は `user_id = '${id}'` と直接埋め込みしている。`user_id` は Reactive Forms の `^[a-zA-Z0-9]+$` パターンで検証済のため実害はない見込みだが、パターンをすり抜ける改変には注意。
- 実装時のパスワード保存は MD5 ハッシュ済み文字列（[[db.user.model]] を参照）。

## エラー処理
- SQLite 呼び出しは全て try/catch し、失敗は [[middleware.log.service]] の `error()` に記録。呼び出し元へは戻り値（空 User / false）で通知する（例外は再スローしない）。

## 関連ノード
- 呼び出し元: [[middleware.login.service]]
- 依存: [[db.user.model]]、SQLite（Cordova）