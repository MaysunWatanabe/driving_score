<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:31:28 JST -->

```json
{
  "required_changes": [
    {"node": "middleware.login.service", "entrypoint": "spec/middleware/login-service.md", "description": "UC01〜UC05 とメソッドの対応表、MD5 ハッシュ認証の扱い、パスワード '****' 維持ルールの責務境界を追記"}
  ],
  "suggested_impacts": [
    {"domain": "UI-agent", "severity": "must", "reason": "パスワード '****' 表示時に未変更とみなす判定と送信値の取り扱いを ui.account.page 側で確定する必要がある"},
    {"domain": "DB-agent", "severity": "must", "reason": "MD5 ハッシュ化の実施箇所（selectUser/insertUser/updateUser のいずれか）と '****' 受領時の既存パスワード維持責務を db.user.repository で確定する必要がある"},
    {"domain": "QA-agent", "severity": "should", "reason": "自動ログイン期限境界（3日）、'****' 維持、logout 後の lastLoginUserId 残存の検証観点が必要"}
  ],
  "requirements_context": "middleware.login.service は ID/PASSWORD による認証（パスワードは MD5 ハッシュで扱う）、ログイン状態の保持、3日（72時間）以内の自動ログイン、ログアウト、およびアカウントの作成・編集・削除を担う。永続化は db.user.repository / db.user.model、ログイン情報・最終ログイン userId・アプリ設定の一部は Ionic Storage、スコアロジック由来の設定値は infra.assets.scoreLogicJson（Storage の scoreLogicJsonKey）から読み込み settings に展開する。settings は publicly mutable で全画面共有、Storage 永続化はページ側責務。ユースケース対応は UC01 未ログインのログイン=login()、UC02 自動ログイン=autoLogin()、UC03 アカウント作成=insert()、UC04 アカウント編集=update()、UC05 アカウント削除=delete()。アカウント系メソッドは呼び出し前に必ず logout() を実行する。ログアウト時は loginKey を削除するが lastLoginUserId は保持し、次回ログイン画面の userId 初期値に用いる。パスワード '****' 維持ルール（編集画面でパスワード未変更時は既存値を維持）は ui.account.page と整合させる必要があるが、判定・維持の実施箇所（UI / Middleware / DB）は未確定。",
  "fact_candidates": [
    {"type": "business_rule", "title": "認証は userId と userPassword の組で行う", "statement": "login は db.selectUser(userId, userPassword) の照合結果で loginStatus を決定する", "status": "candidate"},
    {"type": "data_semantics", "title": "パスワードは MD5 ハッシュとして扱う", "statement": "ユーザーパスワードは MD5 ハッシュ値として保存・照合される", "status": "candidate"},
    {"type": "business_rule", "title": "自動ログインの有効期限は3日", "statement": "autoLogin は Date.now() - 1000*60*60*24*3 <= loginData.timestamp を満たす場合のみ認証照合を行う", "status": "candidate"},
    {"type": "business_rule", "title": "既ログイン時の autoLogin は何もしない", "statement": "autoLogin は loginStatus が true の場合 false を返し、Storage 参照も認証照合も行わない", "status": "candidate"},
    {"type": "state_rule", "title": "ログイン成功時に loginKey を保存する", "statement": "login 成功時に Storage へ loginKey = { timestamp: Date.now(), userId, userPassword } を保存する", "status": "candidate"},
    {"type": "state_rule", "title": "ログイン成功時に lastLoginUserId を保存する", "statement": "login 成功時に Storage へ lastLoginUserId として userId を保存する", "status": "candidate"},
    {"type": "state_rule", "title": "logout は loginKey を削除する", "statement": "logout は Storage から loginKey を削除する", "status": "candidate"},
    {"type": "state_rule", "title": "logout は lastLoginUserId を削除しない", "statement": "logout 実行後も Storage の lastLoginUserId は保持される", "status": "candidate"},
    {"type": "state_rule", "title": "logout は状態を初期化する", "statement": "logout は loginUser を new User()、loginStatus を false、scoreId を -1 に設定する", "status": "candidate"},
    {"type": "constraint", "title": "アカウント操作前に必ず logout する", "statement": "insert / update / delete は DB 操作の前に logout() を実行する", "status": "candidate"},
    {"type": "business_rule", "title": "delete は lastLoginUserId も削除する", "statement": "delete は logout 後に Storage の lastLoginUserId を削除してから db.deleteUser(userId) を呼ぶ", "status": "candidate"},
    {"type": "api_contract", "title": "insert/update の成否は userId で判定する", "statement": "insert / update は DB 操作後の user.userId !== '' を戻り値とする", "status": "candidate"},
    {"type": "api_contract", "title": "getLastLoginUserId は null を空文字に正規化する", "statement": "getLastLoginUserId は Storage の lastLoginUserId が null の場合に空文字を返す", "status": "candidate"},
    {"type": "business_rule", "title": "insert は既存ユーザー上書きを許可しない指定で呼ぶ", "statement": "insert は db.insertUser(user, false) を呼ぶ", "status": "candidate"},
    {"type": "input_rule", "title": "パスワード欄の '****' は未変更を意味する", "statement": "アカウント編集でパスワードが '****' のまま送信された場合は既存パスワードを維持する", "status": "open_question"},
    {"type": "business_rule", "title": "settings は scoreLogicJson の値で上書きされる", "statement": "initialize は Storage の scoreLogicJsonKey を JSON.parse し、orderOfMessage / label.* / scoreLogicInterval / capabilityScoreTargetDays / scoreShowStar.area1-3 を settings に上書きする", "status": "candidate"},
    {"type": "business_rule", "title": "scoreLogicJson が無い場合は既定値を維持する", "statement": "scoreLogicJsonKey が null または settings キーを持たない場合、settings の上書きを行わない", "status": "candidate"},
    {"type": "constraint", "title": "Android 以外では計測系設定を強制する", "statement": "Android 以外のプラットフォームでは recording=false, gpsDemo=true, logStorage=false, sensorLogStorage=false を強制する", "status": "candidate"},
    {"type": "business_rule", "title": "selectedSensorMode の既定値は smartphoneOnly", "statement": "initialize 時に settingSelectedSensorMode が未設定なら 'smartphoneOnly' を Storage に保存する", "status": "candidate"},
    {"type": "constraint", "title": "settings の永続化はページ側責務", "statement": "settings のプロパティ変更後の storage.set() 呼び出しは呼び出し元ページが行う", "status": "candidate"},
    {"type": "data_semantics", "title": "未ログイン時の loginUser は空 User", "statement": "未ログイン状態では loginUser は new User() の値を保持する", "status": "candidate"}
  ],
  "open_questions": [
    "MD5 ハッシュ化を行う層が未確定。login.service が平文を受け取って db 側でハッシュするのか、UI からハッシュ済み値が渡るのかで loginKey に保存される userPassword の値（平文/ハッシュ）が変わり、自動ログインの照合とセキュリティ評価に影響する。DB-agent / UI-agent 確認が必要。",
    "パスワード '****' 維持ルールの実施箇所が未確定。UI が送信前に既存値へ差し替えるのか、middleware.login.service が '****' を検知して更新対象から除外するのか、db.user.repository の updateUser が判定するのかで UC04 の実装責務が変わる。UI-agent / DB-agent 確認が必要。",
    "loginKey に userPassword を平文相当で保存している場合の許容可否が未確定。決まらないと自動ログイン方式（トークン化するか否か）に影響する。",
    "自動ログイン期限3日がマジックナンバーのままでよいか未確定（定数化・設定化の要否）。決まらないと infra.assets.scoreLogicJson へ設定追加するかの判断ができない。",
    "UC05 アカウント削除時に当該ユーザーのスコア・ログデータを連鎖削除するかが未確定。DB-agent 確認が必要で、決まらないと孤児データの扱いが定まらない。",
    "アカウント作成・更新時の入力バリデーション（userId 重複、パスワード長・文字種）を UI と Middleware のどちらで担保するかが未確定。db.insertUser(user, false) の false が重複拒否を意味するかも要確認。",
    "autoLogin 失敗時（期限切れ・照合不一致）に loginKey を削除すべきかが未確定。現状は残存し、期限内に戻ることはないが Storage にパスワードが残り続ける。"
  ],
  "rationale_notes": [
    "login.service は認証・ログイン状態というセッション責務と、settings というアプリ全体設定の責務を兼務している。責務分離は望ましいが、settings が全画面から直接参照される現状の設計を尊重し、本改訂では構成変更を提案しない。",
    "アカウント系メソッドが必ず logout() を先行実行するのは、編集・削除対象と現在のログインユーザーの不整合（削除済みユーザーでログイン状態が続く等）を防ぐための意図的な設計と解釈できる。",
    "logout が lastLoginUserId を残すのは、ログイン画面の userId 初期表示という UX 要件のためであり、セキュリティ上の抜けではなく意図的な仕様である。",
    "パスワード '****' は「値」ではなく「未変更マーカー」であり、認証値として DB に渡ってはならない。この点を UI / Middleware / DB のどこで保証するかを明文化しないと、誤って '****' の MD5 がパスワードとして保存される不具合を招く。",
    "既存ファクトはスコアロジックおよびファイル書き出しルートに関するもので、本ノードの認証・設定読み込み責務と直接の競合はない。settings.label の label3/label4/labelC が空である事実は CAN 版スコアロジックが当該スコアを設定しない実装実態に対応しており、login.service 側は scoreLogicJson の値をそのまま展開するだけで解釈は行わない。"
  ]
}
```

以下、`spec/middleware/login-service.md` の更新版（差分反映後の全文）です。

```markdown
# middleware.login.service — ログイン・アプリ設定サービス

## 概要
`LoginService` はユーザー認証・ログイン状態管理・アプリ設定 (`settings`) の永続化を担う。scoreLogicJson から取得した設定を `settings` オブジェクトに展開し、全画面で共有する。

## 真実源
- `src/data/src/app/services/login.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `LogService`（[[middleware.log.service]]）、`UserDbService`（[[db.user.repository]]）、`Storage`（Ionic）

## ユースケース対応
| UC | 内容 | 主メソッド | 備考 |
|---|---|---|---|
| UC01 | 未ログインのログイン | `login(userId, userPassword)` | 成功時に `loginKey` / `lastLoginUserId` を保存 |
| UC02 | 自動ログイン | `autoLogin()` | `loginKey.timestamp` が 3 日以内のときのみ照合 |
| UC03 | アカウント作成 | `insert(user)` | 事前に `logout()` |
| UC04 | アカウント編集 | `update(user)` | 事前に `logout()`。パスワード `'****'` 維持ルールあり |
| UC05 | アカウント削除 | `delete(userId)` | 事前に `logout()` + `lastLoginUserId` 削除 |

## 公開状態
```
loginUser: User;              // ログイン中のユーザー（未ログイン時は new User()）
loginStatus: boolean = false; // ログイン成否
scoreId: number;              // 直近の走行 ID（診断開始 timestamp）
settings = {
  recording: false,           // 録画 ON/OFF（Android 実機以外は強制 false）
  gpsDemo: true,              // GPS デモモード（Android 以外は強制 true）
  logStorage: false,          // ログ保存 ON/OFF
  sensorLogStorage: false,    // センサログ保存 ON/OFF
  selectedSensorMode: '',     // 'smartphoneOnly' | 'canDataOnly' | 'combination'
  orderOfMessage: 0,          // 0: positive→negative, 1: negative→positive
  label: {
    label1: 'ラベル1', label2: 'ラベル2', label3: '', label4: '',
    labelA: 'ラベル5', labelB: 'ラベル6', labelC: ''
  },
  scoreLogicInterval: 300,     // ms
  capabilityScoreTargetDays: 30,
  scoreShowStar: { area1: true, area2: true, area3: true }
};
```

## `initialize()`
1. `db.initialize()`（[[db.user.repository]]）と `storage.create()` を実行。
2. Ionic Storage から `settingSelectedSensorMode` を読み、未設定なら `'smartphoneOnly'` を保存。
3. Storage の `settingRecording` / `settingGpsDemo` / `settingLogStorage` / `settingSensorLogStorage` を `settings` に反映。既定値は `recording=true`（未設定時）、他は false。
4. Android 以外では強制的に `recording=false`, `gpsDemo=true`, `logStorage=false`, `sensorLogStorage=false`。
5. Storage の `scoreLogicJsonKey` を JSON.parse し、`settings.orderOfMessage`, `label.*`, `scoreLogicInterval`, `capabilityScoreTargetDays`, `scoreShowStar.area1/2/3` を上書き。JSON が null または `settings` が無ければ以降スキップ。

> `settings.label` の `label3` / `label4` / `labelC` が空文字であるのは、CAN 版スコアロジックが対応スコア（score3 / score4 / scoreC）を設定しない実装実態と対応する（[[infra.assets.scoreLogicJson]]、[[middleware.score-logicCan]]）。`LoginService` は値をそのまま展開するだけで、意味解釈は行わない。

## 認証方式（ID / PASSWORD）
- 認証は `userId` と `userPassword` の組で行い、照合は [[db.user.repository]] の `selectUser` に委譲する。
- パスワードは **MD5 ハッシュ**として保存・照合される（[[db.user.model]]）。
- ハッシュ化を行う層（UI / 本サービス / DB リポジトリ）は未確定。確定次第、`loginKey` に保存される `userPassword` が平文かハッシュかも合わせて明記する（open question）。

## `autoLogin(): Promise<boolean>`
- 既に `loginStatus=true` なら false（何もしない）。
- `storage.get(environment.loginKey)` から `{ timestamp, userId, userPassword }` を取得。null なら false。
- **`Date.now() - (1000*60*60*24*3) <= loginData.timestamp`** を満たすなら（＝直近 3 日以内）`db.selectUser(userId, userPassword)` で照合し、`userId !== ''` なら `loginStatus=true` にして true を返す。
- 期限切れ・照合不一致の場合、`loginKey` は削除されず Storage に残存する（現状仕様）。

## `login(userId, userPassword): Promise<boolean>`
- `db.selectUser(userId, userPassword)` の結果で `loginStatus` を判定。
- 成功時: Storage に `loginKey = { timestamp: Date.now(), userId, userPassword }` を保存、`lastLoginUserId` に userId を保存。
- 戻り値: `loginStatus`

## `logout()`
- `loginUser = new User()`、`loginStatus = false`
- Storage から `loginKey` を削除、`scoreId = -1`。
- **`lastLoginUserId` は削除しない**（次回ログイン画面で userId の初期値として表示するため）。

## ユーザーライフサイクル系メソッド
すべて呼び出し前に `logout()` を実行してから DB 操作を行う。

| メソッド | 挙動 |
|---|---|
| `insert(user)` | `logout()` → `db.insertUser(user, false)`。戻り値 `user.userId !== ''` |
| `update(user)` | `logout()` → `db.updateUser(user)`。戻り値 `user.userId !== ''` |
| `delete(userId)` | `logout()` → `storage.remove(lastLoginUserId)` → `db.deleteUser(userId)` |

## パスワード `'****'` 維持ルール
- [[ui.account.page]] はアカウント編集時、パスワード欄に実値ではなく `'****'` を表示する。
- `'****'` は「値」ではなく **未変更マーカー**であり、認証値として DB へ渡してはならない。
- したがって `'****'` のまま更新された場合は、既存のパスワード（MD5 ハッシュ）を維持する。
- 判定・維持を行う層（UI が送信前に既存値へ差し替える / 本サービスが検知して更新対象から除外する / `db.updateUser` が判定する）は未確定。[[ui.account.page]] および [[db.user.repository]] と整合を取ること（open question）。

## `getLastLoginUserId(): Promise<string>`
- Storage の `lastLoginUserId` を返す。null なら空文字。

## 業務ルール
- 自動ログイン有効期限は **3 日 (72 時間)**。設計書と実装の食い違い（3 日 vs 72 時間の表記）は同義。定数化はされていない。
- `settings` オブジェクトは publicly mutable。[[ui.settings.page]] などが直接プロパティを書き換え、Storage への永続化はページ側で `storage.set()` を呼ぶ責務。
- ユーザー操作前に必ず `logout()` を実行する運用（重要）。編集・削除対象と現ログインユーザーの不整合を防ぐため。
- `logout()` 後も `lastLoginUserId` が残るのは意図的（ログイン画面の userId 初期表示）。`delete()` のみ明示的に削除する。

## 関連ノード
- 依存: [[db.user.repository]]、[[middleware.log.service]]、[[db.user.model]]、[[infra.assets.scoreLogicJson]]
- 整合: [[ui.account.page]]（パスワード `'****'` 維持ルール）
- 呼び出し元: 全 UI Page、[[db.score.repository]]、[[middleware.sensor.service]]
```