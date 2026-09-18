<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:33:15 JST -->

# db.user.model — User モデル

## 概要
ユーザー情報を表す POCO クラス。パスワードは MD5 ハッシュ済み文字列として保持する。

## 真実源
- `src/data/src/app/data/user.ts`

## クラス定義
```
class User {
  userId: string = '';    // 空文字既定
  userPassword: string = '';  // MD5 ハッシュ済み文字列
  sex: number;
  birthYear: number;
  birthMonth: number;
  height: number;
  prefecture: number;

  static dummy(): User;
}
```

- インスタンス生成時のデフォルトは `userId=''`, `userPassword=''`。他プロパティは undefined。
- 未認証ユーザ判定はページ側で `user.userId === ''` を用いる（[[middleware.login.service]] の `logout()` は `new User()` を代入する）。

## `User.dummy()`
ブラウザ実行時（Android 非実機）のフォールバック用固定ユーザーを返す。
```
userId       = 'test'
userPassword = Md5.hashStr('12345678').toString()
sex          = 2
birthYear    = 1999
birthMonth   = 9
height       = 185.5
prefecture   = 12
```

### シード用途での扱い
- 開発・ブラウザ実行時のシードユーザは、既存の `User.dummy()` をそのまま用いる。
- シード生成のための UI（settings ページ上のシードボタン等）は追加しない。
- シード専用の in-memory `DbService` 実装は追加しない（実機は既存の SQLite 永続化、非実機は `User.dummy()` フォールバックの2系統のみ）。

## 各フィールドの意味
- `sex`: 1=男 / 2=女 / 3=その他（[[ui.account.page]] の `sexList` を参照）
- `birthYear` / `birthMonth`: 1900–2020 / 1–12（[[ui.account.page]] の入力可能範囲）
- `height`: 数値（cm）。`^[1-2][0-9]{2}(\.[0-9]+)?$` の正規表現でバリデーションされる（100〜299 の 3 桁 + 任意の小数）
  - モデル上は小数を許容する（`User.dummy()` は `185.5`）。したがって永続化側の列型も小数を保持できる必要があり、`users.height` は [[db.schema.corrections]] の `CREATE TABLE` における `REAL` 是正対象である。
- `prefecture`: 1〜47 の都道府県 ID（[[ui.account.page]] の `prefectureList` に対応）

## 一意性・識別
- `userId` がユーザーを識別する値であり、アカウント作成（UC03）／編集（UC04）／削除（UC05）／ログイン（UC01）はすべて `userId` を鍵として扱う。

## 関連ノード
- 永続化: [[db.user.repository]]
- スキーマ是正: [[db.schema.corrections]]（`users.height` の `REAL` 化）
- 書き込み元: [[ui.account.page]]、[[middleware.login.service]]
- 参照元: [[middleware.login.service]]（`loginUser` として保持）、`Md5.hashStr()`（`ts-md5`）

```json
{
  "required_changes": [
    {"node": "db.user.model", "entrypoint": "spec/db/user-model.md", "description": "height が小数を保持する意味を明記し、users.height が db.schema.corrections の REAL 是正対象であることを追記"},
    {"node": "db.user.model", "entrypoint": "spec/db/user-model.md", "description": "シードは既存 User.dummy() を用い、シード UI および in-memory DbService を追加しない方針を追記"}
  ],
  "suggested_impacts": [
    {"domain": "DB-agent", "severity": "must", "reason": "db.schema.corrections 側で users.height の列型を REAL とする CREATE TABLE 是正が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "小数身長（例 185.5）の保存・再読込で値が丸められないことの回帰確認が必要"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "非実機時のフォールバックは User.dummy() のみとし、シード専用サービスを設けない前提を共有する必要がある"}
  ],
  "requirements_context": "User モデルは userId / userPassword(MD5) / sex / birthYear / birthMonth / height / prefecture を保持する POCO であり、真実源は src/data/src/app/data/user.ts。UC01(ログイン)・UC03(アカウント作成)・UC04(編集)・UC05(削除) が本モデルを利用し、userId が識別鍵となる。既定値は userId='' / userPassword='' で、未認証判定は userId==='' を用いる（logout() は new User() を代入）。sex は 1=男/2=女/3=その他、birthYear は 1900–2020、birthMonth は 1–12、prefecture は 1–47、height は cm で ^[1-2][0-9]{2}(\\.[0-9]+)?$ により 100–299 の整数部＋任意小数を許容する。User.dummy() は非実機（ブラウザ）実行時のフォールバック固定ユーザ（userId='test', password=Md5.hashStr('12345678'), sex=2, birthYear=1999, birthMonth=9, height=185.5, prefecture=12）。承認済みファクトとして、height が小数を保持するため users.height は db.schema.corrections の CREATE TABLE における REAL 是正対象である。またシード用途は既存 User.dummy() を用い、settings へのシード UI や in-memory DbService は追加しない。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "User は userId で識別される",
      "statement": "User エンティティは userId を識別値として保持し、アカウント作成・編集・削除・ログインはすべて userId を鍵として扱う",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "パスワードは MD5 ハッシュ済み文字列として保存される",
      "statement": "userPassword は平文ではなく MD5 ハッシュ済み文字列として保持・保存される",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "身長は小数を含む値として保存される",
      "statement": "height は cm 単位で小数を含む値（例 185.5）を保持する必要があり、整数型では表現できない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "users.height は REAL 是正対象である",
      "statement": "users テーブルの height 列は db.schema.corrections の CREATE TABLE における REAL 型是正の対象である",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "空 userId は未認証状態を表す",
      "statement": "userId が空文字である User インスタンスは未認証状態を表し、永続化された有効ユーザとしては扱わない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "シードは既存 User.dummy() を用いる",
      "statement": "シード用途のユーザデータは既存 User.dummy() の固定値を用い、新たなシードデータ定義を追加しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "シード UI と in-memory DbService は追加しない",
      "statement": "settings 画面へのシード投入 UI および in-memory の DbService 実装は追加しない",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "各フィールドの取り得る値域",
      "statement": "sex は 1/2/3、birthYear は 1900–2020、birthMonth は 1–12、prefecture は 1–47、height は 100–299 の整数部＋任意小数の範囲で扱われる",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "userId の一意性がDBレベルの UNIQUE/PRIMARY KEY 制約で担保されているか、アプリ側チェックのみかが未確定（db.user.repository / db.schema.corrections の判断が必要。重複アカウント作成時の挙動に影響）",
    "アカウント削除（UC05）が物理削除か論理削除かが本ノードだけでは確定できない（DB/Middleware の判断が必要。過去の走行・スコアデータの参照整合性に影響）",
    "users テーブルに複数ユーザを保持する想定か単一ユーザ前提かが未確定（DB/Middleware 判断。ログイン時の検索条件とスキーマ設計に影響）",
    "height の REAL 是正が既存 DB に対するマイグレーションを伴うのか、CREATE TABLE 文の修正のみ（新規作成時のみ有効）なのかが未確定（db.schema.corrections の判断が必要。既存端末のデータ移行に影響）"
  ],
  "rationale_notes": [
    "User はモデル（POCO）定義であり、列型・制約の確定責務は db.user.repository / db.schema.corrections 側に置く。本ノードでは『何を意味する値として保持するか』を優先して記述した。",
    "height を REAL 是正対象とする根拠は、モデル既定値 User.dummy() が 185.5 を持ち、バリデーション正規表現も小数を許容している点にある（整数列では値が丸められる）。",
    "User.dummy() は非実機実行時のフォールバックという既存責務を持つため、シード専用の別経路（シード UI・in-memory DbService）を新設せず既存経路に寄せる判断とした。",
    "既存仕様の記述（未認証判定、sexList/prefectureList との対応、正規表現バリデーション、関連ノード）は変更理由がないため維持した。"
  ]
}
```