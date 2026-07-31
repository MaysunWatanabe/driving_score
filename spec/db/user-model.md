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

## 各フィールドの意味
- `sex`: 1=男 / 2=女 / 3=その他（[[ui.account.page]] の `sexList` を参照）
- `birthYear` / `birthMonth`: 1900–2020 / 1–12（[[ui.account.page]] の入力可能範囲）
- `height`: 数値（cm）。`^[1-2][0-9]{2}(\.[0-9]+)?$` の正規表現でバリデーションされる（100〜299 の 3 桁 + 任意の小数）
- `prefecture`: 1〜47 の都道府県 ID（[[ui.account.page]] の `prefectureList` に対応）

## 関連ノード
- 永続化: [[db.user.repository]]
- 書き込み元: [[ui.account.page]]、[[middleware.login.service]]
- 参照元: [[middleware.login.service]]（`loginUser` として保持）、`Md5.hashStr()`（`ts-md5`）
