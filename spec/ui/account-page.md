<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:29:14 JST -->

# ui.account.page — アカウント作成／編集／削除画面 (画面2-1 / 2-2)

## 概要
1 ページでアカウントの作成・編集・削除を切り替える。ルートパラメータ `type` (`create` | `modify`) で挙動を分岐。ID・PASSWORD・性別・生年月・身長・居住地（都道府県）を Reactive Forms でバリデーションし、PASSWORD は Md5 ハッシュ済みで保存する。作成成功／編集成功／削除完了のいずれもログアウトしてオープニング画面へ戻る。

対応ユースケース: UC03（アカウント作成）／UC04（アカウント編集）／UC05（アカウント削除）

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

## 入力項目一覧

| 項目 | UI 部品 | 作成時 | 編集時 | 備考 |
|---|---|---|---|---|
| ID | テキスト入力（maxlength=20） | 入力可 | 入力可（現行値を初期表示） | 半角英数のみ |
| PASSWORD | `type='password'`（maxlength=30） | 入力可 | 入力可（初期値 `'****'`） | 保存は MD5 ハッシュ |
| 性別 | セレクト（男／女／その他） | 選択可 | 選択可 | 既定 id=1 |
| 生年 | セレクト（1900〜2020 年） | 選択可 | 選択可 | 既定 1980年 |
| 生月 | セレクト（1〜12 月） | 選択可 | 選択可 | 既定 1月 |
| 身長 | 数値入力（小数許容） | 入力可 | 入力可 | 100〜299、小数第 n 位まで許容 |
| 居住地 | セレクト（47 都道府県） | 選択可 | 選択可 | 既定 id=13 東京都 |

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

### 身長入力の型（REAL 是正対象）
- 身長は **小数を含む値を入力できる**。バリデーションパターン `^[1-2][0-9]{2}(\.[0-9]+)?$` により、整数（例: `170`）と小数（例: `170.5`）の双方を受理する。
- 永続化先 `users.height` は [[db.schema.corrections]] の REAL 是正対象カラムであり、UI は小数値をそのまま保持できる前提で入力型を定義する。UI 側で整数への丸め・切り捨てを行ってはならない。
- UI は入力値を数値（浮動小数）として `User` に格納するのみで、桁数の正規化・単位変換は行わない。

## ライフサイクル
- **constructor**: `logService.initialize(file)`。
- **`ngOnInit()`**: パラメータ取り出し。`type='modify'` なら `loginService.loginUser` の値を初期表示。`userPassword` には `'****'`（4 文字の伏字）を代入。
- **`ionViewWillEnter()`**: `screenOrientation.lock(PORTRAIT)`。

## アカウント作成 (`onCreateAccount`) — UC03
1. Form バリデーション NG なら `showCreateFailDialog()`（**注: 作成失敗ダイアログを兼用**）。
2. 新規 User を組み立て、`Md5.hashStr(userPassword)` を代入。生年月から `'年'` `'月'` を除去して整数化。身長は入力値（小数可）をそのまま設定。
3. `loginService.insert(user)` を await。true なら `showCreateFinishDialog()`、false なら `showCreateFailDialog()`。
4. 成功ダイアログの閉じる押下で `logout()` → `navCtrl.navigateBack('opening')`。作成直後は自動ログアウトされるため、利用者は改めてログインする必要がある。

## アカウント編集 (`onModifyAccount`) — UC04
1. Form バリデーション NG なら `showModifyFailedDialog()`。
2. `loginService.loginUser` を起点にフィールドを上書き。
3. **パスワード変更判定**: `ionicForm.value.userPassword != '****' && user.userPassword != ionicForm.value.userPassword` のとき、`Md5.hashStr(userPassword)` に置換。`'****'` のまま（＝未編集）なら現行のハッシュ値を維持する。
4. `loginService.update(user)` を await。成否で `showModifyFinishDialog()` / `showModifyFailedDialog()`。
5. 成功ダイアログの閉じる押下で `logout()` → `navigateBack('opening')`。

## アカウント削除 (`onDeleteAccount`) — UC05
仕様上の手順:
1. `showDeleteDialog()` で「本当にアカウントを削除しますか？」を確認（キャンセル／削除）。
2. 「削除」選択時、当該ユーザーのレコードを削除する。削除対象は **user / score / score_history / capability_score** のユーザー単位レコード。
   - `loginService.delete(user.userId)`（内部で `logout()` → `db.deleteUser`）
   - `scoreDbService.delete(user.userId)`（score / score_history / capability_score の連鎖削除）
3. `showDeleteFinishDialog()`（「アカウントを削除しました。」）を表示。閉じるで `logout()` → `navigateBack('opening')`。

> **注記（実装実態との差異）**: 既存記述では `loginService.delete` / `scoreDbService.delete` の await が `showDeleteDialog()` の表示より前に記述されており、確認ダイアログの結果を待たずに削除が走る可能性がある。確認前削除かどうかは実装確認が必要（open question 参照）。

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
- PASSWORD 入力は全画面で伏字（HTML 側 `type='password'`）。編集画面では初期値 `****`（4 文字固定）であり、この値のままなら現行パスワードを維持する。
- 生パスワードは画面外に平文で持ち出さず、保存直前に `Md5.hashStr()` でハッシュ化する。
- 作成成功時と編集成功時は必ず `logout()` してオープニングに戻る（＝再ログインが必要）。
- 削除時は `logout()` に加えて Storage の `lastLoginUserId` も削除される（[[middleware.login.service]] を参照）。
- 身長は小数入力を受け付ける（`users.height` の REAL 是正が前提）。UI 側で丸めは行わない。

## 関連ノード
- 依存: [[middleware.login.service]] / [[db.score.repository]] / [[db.user.model]] / [[middleware.log.service]] / [[db.schema.corrections]]
- 遷移: [[ui.opening.page]] へ戻る

```json
{
  "required_changes": [
    {"node": "ui.account.page", "entrypoint": "spec/ui/account-page.md", "description": "身長入力を小数許容（users.height の REAL 是正前提）として入力型・丸め禁止を明記"},
    {"node": "ui.account.page", "entrypoint": "spec/ui/account-page.md", "description": "削除フローを『確認ダイアログ→user/score/score_history/capability_score 削除→完了ダイアログ→logout→opening』として整理し、実装実態との差異を注記"},
    {"node": "ui.account.page", "entrypoint": "spec/ui/account-page.md", "description": "作成成功時に logout してオープニングへ戻る（再ログイン必要）ことを明記"},
    {"node": "ui.account.page", "entrypoint": "spec/ui/account-page.md", "description": "入力項目一覧（ID/PASSWORD/性別/生年月/身長/都道府県）と作成時・編集時の入力可否を表として追加"}
  ],
  "suggested_impacts": [
    {"domain": "db-agent", "severity": "must", "reason": "users.height の REAL 是正が未完了だと UI の小数入力が保存時に丸められ表示と不整合になる"},
    {"domain": "db-agent", "severity": "must", "reason": "削除対象が user/score/score_history/capability_score の4テーブルであることをリポジトリ仕様と整合させる必要がある"},
    {"domain": "middleware-agent", "severity": "must", "reason": "確認ダイアログ前に delete が走る実装順序の是非と、loginService.delete/scoreDbService.delete の呼び出し順・トランザクション性の確認が必要"},
    {"domain": "middleware-agent", "severity": "should", "reason": "編集時のパスワード未変更判定（'****' 比較）がサービス側でなく画面側にある責務配置の確認"}
  ],
  "requirements_context": "ui.account.page は UC03 アカウント作成 / UC04 アカウント編集 / UC05 アカウント削除を 1 画面で担う。ルート /account/:type の type=create|modify で表示タイトルと処理を分岐する。入力項目は ID（半角英数・maxlength20）、PASSWORD（半角英数記号・maxlength30・type=password）、性別（男/女/その他、既定 id=1）、生年（1900-2020、既定1980年）、生月（1-12、既定1月）、身長（100-299 の3桁+小数、必須）、都道府県（47件、既定 id=13 東京都）。編集時は loginService.loginUser の現行値を初期表示し、PASSWORD 欄には伏字 '****' を初期設定する。作成時は Md5.hashStr でハッシュ化して保存し、生年月は '年''月' を除去して整数化する。編集時は PASSWORD 欄が '****' のままなら現行ハッシュを維持し、変更されていれば Md5.hashStr で再ハッシュして保存する。削除は「本当にアカウントを削除しますか？」の確認ダイアログを経て、user / score / score_history / capability_score のユーザー単位レコードを削除し、完了ダイアログ後に logout して opening へ戻る。作成成功・編集成功も同様に logout + navigateBack('opening') となり再ログインが必要。削除時は Storage の lastLoginUserId も削除される。身長は db.schema.corrections における REAL 是正対象カラム users.height に対応するため、UI は小数入力を受理し丸めを行わない。画面は ionViewWillEnter で PORTRAIT 固定、constructor で logService.initialize を行う。",
  "fact_candidates": [
    {"type": "display_rule", "title": "アカウント画面は type パラメータでタイトルを切り替える", "statement": "/account/:type の type が create のとき『アカウント作成』、modify のとき『アカウント編集』をページタイトルに表示する", "status": "candidate"},
    {"type": "input_rule", "title": "アカウント画面の入力項目は6種類である", "statement": "アカウント画面では ID・PASSWORD・性別・生年月・身長・都道府県を入力または選択できる", "status": "candidate"},
    {"type": "input_rule", "title": "身長は小数を含む値を入力できる", "statement": "身長入力は 100〜299 の3桁整数に加えて小数部を含む値を受理する", "status": "candidate"},
    {"type": "input_rule", "title": "UIは身長を丸めない", "statement": "画面は入力された身長値を丸めず、そのまま保存対象の値として渡す", "status": "candidate"},
    {"type": "validation_rule", "title": "ID は半角英数のみ", "statement": "ID は必須かつ ^[a-zA-Z0-9]+$ に一致する必要があり、最大20文字である", "status": "candidate"},
    {"type": "validation_rule", "title": "PASSWORD は半角英数記号のみ", "statement": "PASSWORD は必須かつ半角英数記号パターンに一致する必要があり、最大30文字である", "status": "candidate"},
    {"type": "display_rule", "title": "編集時のパスワード欄は伏字4文字で初期表示される", "statement": "type=modify で画面を開いたとき、PASSWORD 入力欄には '****' が初期値として表示される", "status": "candidate"},
    {"type": "input_rule", "title": "パスワード欄が '****' のままなら現行パスワードを維持する", "statement": "編集時に PASSWORD 欄が '****' から変更されていない場合、パスワードは更新されない", "status": "candidate"},
    {"type": "state_rule", "title": "パスワード変更時は MD5 ハッシュで保存する", "statement": "PASSWORD が '****' から変更されている場合、Md5.hashStr の結果を保存値とする", "status": "candidate"},
    {"type": "state_rule", "title": "アカウント作成成功後は自動ログアウトしてオープニングへ戻る", "statement": "作成完了ダイアログを閉じると logout が実行され opening 画面へ遷移する", "status": "candidate"},
    {"type": "state_rule", "title": "アカウント編集成功後も自動ログアウトしてオープニングへ戻る", "statement": "更新完了ダイアログを閉じると logout が実行され opening 画面へ遷移する", "status": "candidate"},
    {"type": "state_rule", "title": "アカウント削除は確認ダイアログを伴う", "statement": "削除操作時に『本当にアカウントを削除しますか？』の確認ダイアログを表示し、キャンセルと削除の選択肢を提示する", "status": "candidate"},
    {"type": "state_rule", "title": "削除対象は4テーブルのユーザー単位レコードである", "statement": "アカウント削除では user / score / score_history / capability_score の当該ユーザーのレコードが削除される", "status": "candidate"},
    {"type": "state_rule", "title": "削除完了後は logout して opening へ戻る", "statement": "削除完了ダイアログを閉じると logout が実行され opening 画面へ遷移する", "status": "candidate"},
    {"type": "display_rule", "title": "PASSWORD 入力は常に伏字表示される", "statement": "PASSWORD 入力欄は type='password' で表示される", "status": "candidate"},
    {"type": "validation_rule", "title": "バリデーション NG 時は失敗ダイアログを表示する", "statement": "作成時のバリデーション NG では作成失敗ダイアログ、編集時のバリデーション NG では更新失敗ダイアログを表示する", "status": "candidate"},
    {"type": "display_rule", "title": "画面は縦向き固定である", "statement": "アカウント画面は表示時に画面の向きを PORTRAIT に固定する", "status": "candidate"},
    {"type": "display_rule", "title": "各選択肢リストの既定値が定義されている", "statement": "性別の既定は id=1（男）、生年の既定は 1980年、生月の既定は 1月、都道府県の既定は id=13（東京都）である", "status": "candidate"},
    {"type": "data_semantics", "title": "生年月は数値へ変換して保存される", "statement": "選択された生年月から '年' '月' の文字を除去した整数値を保存対象とする", "status": "candidate"}
  ],
  "open_questions": [
    "削除処理の実行順序が未確定: 既存仕様記述では loginService.delete / scoreDbService.delete が showDeleteDialog の表示より前に await されており、確認ダイアログでキャンセルしても削除済みになる恐れがある。UI（確認後実行）と Middleware（実装実態）のどちらを正とするか判断が必要で、決まらないと UC05 の受入基準とキャンセル時の期待挙動を確定できない。",
    "身長入力の HTML 入力型が未確定: type='number' か type='text' + pattern かでモバイルのキーボードや小数点入力可否が変わる。users.height の REAL 是正（db.schema.corrections）と併せて DB/UI 双方の確認が必要で、決まらないと小数入力の実機受入が判定できない。",
    "身長の小数許容桁数が未確定: 現行パターンは小数部の桁数を制限していない。表示・保存時の桁丸め方針は DB/Middleware の判断が必要。",
    "編集時にユーザーが意図的に '****' という文字列をパスワードとして設定したい場合の扱いが未確定: 現行判定では変更なしと解釈される。セキュリティ/Middleware 判断が必要。",
    "アカウント作成成功後に自動ログアウトする仕様意図が未確定: 作成したユーザーで自動ログインする方が UX 上自然だが現行は再ログインを要求する。プロダクト判断が必要で、決まらないと UC03 の遷移仕様を固定できない。",
    "削除処理中のローディング表示やエラー時（削除失敗）のダイアログが定義されていない: 失敗時 UX の要否は Middleware のエラー返却仕様と併せて確認が必要。",
    "ID の重複チェックがどの時点でユーザーに提示されるか未確定: 現行は insert 失敗時の汎用『アカウントを作成できませんでした。』のみで、原因別メッセージの要否は要確認。"
  ],
  "rationale_notes": [
    "UI は表示・入力・遷移の責務のみを持ち、パスワードのハッシュ化や複数テーブルの連鎖削除の実処理は Middleware / DB 層に委ねる。ただし現行実装では '****' 判定と Md5 変換が画面側に置かれているため、実装実態としてそのまま記載した。",
    "身長を小数許容としたのは users.height が REAL 是正対象であることを前提とするため。UI 側で整数丸めを入れると是正の意図（小数精度の保持）を無効化するため明示的に禁止した。",
    "作成・編集・削除いずれの成功系も logout + opening 遷移で統一されており、認証状態の整合性を単純化する設計と解釈できる。ただし作成後の自動ログアウトは UX 上の議論余地があるため open_question に残した。",
    "既存仕様の削除フロー記述順序は実装実態を写したものと思われるが、UC05 の記述（確認後に削除）と矛盾するため、既存記述を消さずに注記として残し差異を可視化した。",
    "文字数上限（ID 20 / PASSWORD 30）は Reactive Forms ではなく HTML の maxlength で制御されている点は既存記述を維持した。"
  ]
}
```