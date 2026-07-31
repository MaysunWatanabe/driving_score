# middleware.login.service — ログイン・アプリ設定サービス

## 概要
`LoginService` はユーザー認証・ログイン状態管理・アプリ設定 (`settings`) の永続化を担う。scoreLogicJson から取得した設定を `settings` オブジェクトに展開し、全画面で共有する。

## 真実源
- `src/data/src/app/services/login.service.ts`

## Angular DI
- `@Injectable({ providedIn: 'root' })`
- コンストラクタ引数: `LogService`（[[middleware.log.service]]）、`UserDbService`（[[db.user.repository]]）、`Storage`（Ionic）

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

## `autoLogin(): Promise<boolean>`
- 既に `loginStatus=true` なら false（何もしない）。
- `storage.get(environment.loginKey)` から `{ timestamp, userId, userPassword }` を取得。null なら false。
- **`Date.now() - (1000*60*60*24*3) <= loginData.timestamp`** を満たすなら（＝直近 3 日以内）`db.selectUser(userId, userPassword)` で照合し、`userId !== ''` なら `loginStatus=true` にして true を返す。

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

## `getLastLoginUserId(): Promise<string>`
- Storage の `lastLoginUserId` を返す。null なら空文字。

## 業務ルール
- 自動ログイン有効期限は **3 日 (72 時間)**。設計書と実装の食い違い（3 日 vs 72 時間の表記）は同義。定数化はされていない。
- `settings` オブジェクトは publicly mutable。[[ui.settings.page]] などが直接プロパティを書き換え、Storage への永続化はページ側で `storage.set()` を呼ぶ責務。
- ユーザー操作前に必ず `logout()` を実行する運用（重要）。

## 関連ノード
- 依存: [[db.user.repository]]、[[middleware.log.service]]、[[db.user.model]]、[[infra.assets.scoreLogicJson]]
- 呼び出し元: 全 UI Page、[[db.score.repository]]、[[middleware.sensor.service]]
