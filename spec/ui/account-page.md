# ui.account.page — アカウント作成／編集／削除画面 (画面2-1 / 2-2)

## 概要
1 ページでアカウントの作成・編集・削除を切り替える。ルートパラメータ `type` (`create` | `modify`) で挙動を分岐。ID・PASSWORD・性別・生年月・身長・居住地を Reactive Forms でバリデーションし、PASSWORD は Md5 ハッシュ済みで保存する。

## 真実源
- `src/data/src/app/account/account.page.ts`
- `src/data/src/app/account/account.page.html`
- `src/data/src/app/account/account.module.ts`

## ルーティング
- パス: `/account/:type`（`type` = `create` | `modify`、既定は `create`）

## 初期状態
```
pageType: string           // create | modify
pageTitle: string          // 'アカウント作成' | 'アカウント編集'
userId / userPassword: string
selectSexId: number = 1    // 男
selectBirthdayYear: '1980年'
selectBirthdayMonth: '1月'
selectPrefecture: number = 13  // 東京都
height: number
sexList: [ {id:1,'　男　'}, {id:2,'　女　'}, {id:3,'その他'} ]
yearList: 1900 年〜2020 年（121 件）
monthList: 1 月〜12 月
prefectureList: 47 都道府県 { id: 1..47, value: 名前 }
```

## Reactive Forms
```
ionicForm = formBuilder.group({
  userId:              [Validators.required, minLength(1), pattern('^[a-zA-Z0-9]+$')]        // 半角英数、20 文字上限は HTML 側の maxlength で制御
  userPassword:        [Validators.required, minLength(1), pattern('^[a-zA-Z0-9!-/:-@¥[-`{-~]+$')]  // 半角英数記号、30 文字上限は HTML 側
  selectSexId:         []
  selectBirthdayYear:  []
  selectBirthdayMonth: []
  height:              [Validators.required, minLength(1), pattern('^[1-2][0-9]{2}(\.[0-9]+)?$')]  // 3 桁 100-299 + 小数
  selectPrefecture:    []
});
```

## ライフサイクル
- **constructor**: `logService.initialize(file)`。
- **`ngOnInit()`**: パラメータ取り出し。`type='modify'` なら `loginService.loginUser` の値を初期表示。`userPassword` には `'****'`（4 文字の伏字）を代入。
- **`ionViewWillEnter()`**: `screenOrientation.lock(PORTRAIT)`。

## アカウント作成 (`onCreateAccount`)
1. Form バリデーション NG なら `showCreateFailDialog()`（**注: 作成失敗ダイアログを兼用**）。
2. 新規 User を組み立て、`Md5.hashStr(userPassword)` を代入。生年月から `'年'` `'月'` を除去して整数化。
3. `loginService.insert(user)` を await。true なら `showCreateFinishDialog()`、false なら `showCreateFailDialog()`。
4. 成功ダイアログの閉じる押下で `navCtrl.navigateBack('opening')`。

## アカウント編集 (`onModifyAccount`)
1. Form バリデーション NG なら `showModifyFailedDialog()`。
2. `loginService.loginUser` を起点にフィールドを上書き。
3. **パスワード変更判定**: `ionicForm.value.userPassword != '****' && user.userPassword != ionicForm.value.userPassword` のとき、`Md5.hashStr(userPassword)` に置換。変更なしなら現行維持。
4. `loginService.update(user)` を await。成否で `showModifyFinishDialog()` / `showModifyFailedDialog()`。

## アカウント削除 (`onDeleteAccount`)
1. `loginService.delete(user.userId)` を await（内部で `logout()` → `db.deleteUser`）。
2. コールバックで `scoreDbService.delete(user.userId)` を await（3 テーブルの連鎖削除）。
3. `showDeleteDialog()` で「本当にアカウントを削除しますか？」を確認。
4. 「削除」選択で `showDeleteFinishDialog()` を表示。閉じるで `logout()` → `navigateBack('opening')`。

## ダイアログ
| ダイアログ | ヘッダ | ボタン |
|---|---|---|
| `showCreateFinishDialog` | 「アカウントを作成しました。」 | 閉じる → `logout()` + `navigateBack('opening')` |
| `showCreateFailDialog` | 「アカウントを作成できませんでした。」 | 閉じる |
| `showModifyFinishDialog` | 「アカウントを更新しました。」 | 閉じる → `logout()` + `navigateBack('opening')` |
| `showModifyFailedDialog` | 「アカウントを更新できませんでした。」 | 閉じる |
| `showDeleteDialog` | 「本当にアカウントを削除しますか？」 | キャンセル／削除 |
| `showDeleteFinishDialog` | 「アカウントを削除しました。」 | 閉じる → `logout()` + `navigateBack('opening')` |

## 業務ルール
- PASSWORD 入力は全画面で伏字（HTML 側 `type='password'`）。編集画面では初期値 `****`（4 文字固定）。
- 作成成功時と編集成功時は必ず `logout()` してオープニングに戻る（＝再ログインが必要）。
- 削除時は `logout()` に加えて Storage の `lastLoginUserId` も削除される（[[middleware.login.service]] を参照）。

## 関連ノード
- 依存: [[middleware.login.service]] / [[db.score.repository]] / [[db.user.model]] / [[middleware.log.service]]
- 遷移: [[ui.opening.page]] へ戻る
