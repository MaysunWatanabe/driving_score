<!-- 作成: 2026-09-10 17:28:11 JST | 更新: 2026-09-25 10:54:28 JST -->

# env.config.environment — アプリ全体で共有する設定値

## 概要
Angular の `fileReplacements` で `environment.ts`（開発用）と `environment.prod.ts`（本番用）を切り替える。`production` 以外の値は 2 ファイルとも同じ。秘匿値（Maps API キー等）は、両ファイルが **`environment.secrets.ts`** を import して受け取る。

## 真実源
- `src/data/src/environments/environment.ts` … 開発用の設定値
- `src/data/src/environments/environment.prod.ts` … 本番用の設定値（`fileReplacements` で `environment.ts` を置き換える）
- `src/data/src/environments/environment.secrets.ts` … **秘匿値のみ**を持つ。**VCS 管理外（`.gitignore`）**
- `src/data/src/environments/environment.secrets.example.ts` … 上記のテンプレート（キー名のみで、実値は空）。**コミットするのはこのファイルのみ**

## ファイルの役割と読み込み順

| # | ファイル | 役割 | VCS |
|---|---|---|---|
| 1 | `environment.secrets.ts` | 秘匿値（`mapsKey` 等）を定義する | 管理外 |
| 2 | `environment.ts` / `environment.prod.ts` | 非秘匿の設定値を定義し、1 を import して合成する | 管理対象 |
| 3 | 各サービス／ページ | `import { environment }` で 2 を参照する | 管理対象 |

読み込み順は次のとおり。

1. `environment.secrets.ts`
2. `environment.ts`（production ビルドでは `fileReplacements` により `environment.prod.ts` に差し替わる）
3. 利用側の `import { environment }`

### ビルド時の必須条件
- **`environment.secrets.ts` が未配置の場合、`ionic build` は失敗しなければならない。**
- **エラーを黙殺して `cap sync` に進んではならない。** 秘匿値が `undefined` のまま実機に配布され、地図が表示されないといった遅い失敗につながるのを防ぐため。
- 初回セットアップでは `environment.secrets.example.ts` を複製し、実キーを設定する。

## 定義される値

| キー | 型 | 値 | 用途 |
|---|---|---|---|
| `production` | boolean | dev=false / prod=true | [[env.app.bootstrap]] が `enableProdMode()` を呼ぶかどうかの判定 |
| `mapsKey` | string | **`environment.secrets.ts` から供給（実値はリポジトリにも本仕様にも平文で載せない）** | [[middleware.map.service]] が Google Maps **JS API Loader**（`@googlemaps/js-api-loader`）に渡すキー（UC06 の地図描画） |
| `geolocationMaximumAge` | number | `0` | `Geolocation.watchPosition` の `maximumAge`（ms） |
| `geolocationTimeout` | number | `1000` | `Geolocation.watchPosition` の `timeout`（ms） |
| `geolocationLastPosKey` | string | `'geolocation-last-pos-key'` | Ionic Storage キー：最後に取得できた緯度経度（`{lat,lng}` を JSON 文字列で保存） |
| `sensorStockTime` | number | `60000` | [[middleware.score.logic]] が古いセンサーサンプルを間引く上限（ms） |
| `scoreLogicKey` | string | `'driving-score-logic'` | Ionic Storage キー：動的に評価する運転診断ロジックの JS 本体 |
| `scoreLogicJsonKey` | string | `'score-logic-json'` | Ionic Storage キー：スコアメッセージ辞書 JSON |
| `loginKey` | string | `'login'` | Ionic Storage キー：自動ログイン用の `{timestamp, userId, userPassword}`（UC01） |
| `lastLoginUserId` | string | `'last-login-user-id'` | Ionic Storage キー：直近にログインした userId（UC01） |
| `settingRecording` | string | `'setting-recording'` | Ionic Storage キー：録画 ON/OFF |
| `settingRecordingMargin` | string | `'setting-recording-margin'` | Ionic Storage キー：ヒヤリ録画のマージン値（**新規追加**。詳細は下記「settingRecordingMargin」） |
| `settingGpsDemo` | string | `'setting-gps-demo'` | Ionic Storage キー：GPS デモモード ON/OFF |
| `settingLogStorage` | string | `'setting-log-storage'` | Ionic Storage キー：デバッグログ保存 ON/OFF |
| `settingSensorLogStorage` | string | `'setting-sensor-log-storage'` | Ionic Storage キー：センサーログ保存 ON/OFF |
| `settingSelectedSensorMode` | string | `'setting-selected-sensor-mode'` | Ionic Storage キー：センサーモード（`smartphoneOnly` / `canDataOnly` / `combination`） |

### キー命名規則
- プロパティ名は **camelCase**、値（Storage キー文字列）は **kebab-case** とする。これが既存の形式であり、新しいキーもこれに従う。

### settingRecordingMargin（ヒヤリ録画改修で追加）
ヒヤリ録画改修（fact #4633〜#4638）にともない追加したキー。

**定義**
- `environment.ts` / `environment.prod.ts` に `settingRecordingMargin: 'setting-recording-margin'` を追加する。`production` 以外は両ファイルで同じ値にするという原則に従う。

**既定値と読み込み**
- 既定値は環境ファイルには置かない。[[middleware.login.service]]（`login.service.ts`）の `settings` に `recordingMargin: 15` を追加して与える。
- 読み込みは既存の設定項目と同じ形式で行う。
  ```ts
  await this.storage.get(environment.settingRecordingMargin) ?? 15
  ```

**非 Android 時の扱い**
- 非 Android 時の強制値は**設けない**。
- `login.service.ts:78-81` の非 Android 強制ブロックには**追加しない**。

**保存**
- 既存の設定項目と同じく `storage.set` で**即時に**保存する。

**未確定事項**
- 値 `15` の単位（秒など）と、許容範囲・入力制約は本ノードでは定めない。未確定事項として扱う（下記「未確定事項」を参照）。

## 変更許可（ヒヤリ録画改修）

**包括許可**
- ヒヤリ録画改修（fact #4633〜#4638）にともなう次の 6 ファイルの変更を包括的に許可する。
  - `driving.page`
  - `bad-spot.page`
  - `settings.page`
  - `map.service`
  - `login.service`
  - `environment.ts`
- 本ノードの `environment.ts`（および値を同じにする `environment.prod.ts`）への `settingRecordingMargin` 追加は、この許可の範囲に含まれる。

**一般則**
- 対応する approved fact がある機能改修については、個別の例外許可 fact を不要とする。

**維持される制約**
- `qa.mockdata.ble.emulator` の「エミュレータの都合でアプリを変えない」制約は維持する。
- TC-BLE-EMU-020 の FAIL 条件も維持する。
- 上記の包括許可や一般則は、エミュレータ都合によるアプリ変更を正当化する根拠にはならない。

## ロール定義
アプリで想定するロールは次のとおり。**これらは概念上の役割区分であり、アプリ内に RBAC（ロールベースアクセス制御）等の技術的な権限制御ゲートは実装されていない。**

| ロール | 位置づけ | 権限制御 |
|---|---|---|
| `driver` | アプリの主ユーザー。運転診断（スコアリング）の対象。 | なし（技術的なゲートなし） |
| `operator` | 運用上の役割区分。 | なし（違いは到達できる画面程度に留まる） |
| `developer` | 開発上の役割区分。 | なし（違いは到達できる画面程度に留まる） |

- 認証は [[middleware.login.service]]（LoginService）による**単一ユーザー認証のみ**で、ログインの成否だけを扱う（UC01）。
- **ロールに基づく権限分岐コードはアプリ内に存在しない。** operator / developer と driver の違いは機能上の権限差ではなく、「どの画面に到達し得るか」という運用上の区別に留まる。

## Maps API キーの取り扱い

### 供給経路（分離を維持）

| 用途 | 参照箇所 | 供給経路 |
|---|---|---|
| Web / JS（Maps JS API） | `environment.mapsKey` → [[middleware.map.service]] | **`environment.secrets.ts`** |
| Android ネイティブ（Maps SDK） | `AndroidManifest.xml` の `com.google.android.geo.API_KEY` | **`local.properties` + `manifestPlaceholders`**（[[env.config.capacitor]]） |

- **供給経路は常に分離を維持する。** 一方のファイルからもう一方を参照する構成にしてはならない。

### キー値の共用（フェーズ限定）
- **開発／実機検証フェーズに限り、Web(JS API) と Android(SDK) で同じキー値を共用してよい。**（承認済みの判断）
- ただし前述のとおり**供給経路の分離は維持する**。共用してよいのは「値」だけである。
- **本番 release での分離方針は別の判断であり、本仕様では未決として扱う。** 詳細は `spec/unknowns.md` を参照。

### その他の遵守事項
- **既存のキー 2 本は失効させ、新しいキーに入れ替える。** 以前平文で埋め込まれていた値は無効として扱う。
- **仕様書にもリポジトリにも実キー値を掲載・コミットしない。**
- キー管理ガバナンス（ローテーション方針、API キー制限の設定有無、管理責任者など）の運用詳細は未整理のため、`spec/unknowns.md` を参照。

## 注意事項
- 環境ファイルは dev/prod の 2 種類のみで、**staging 用の分岐は存在しない**。
- `environment.secrets.ts` にキー名を追加した場合は、`environment.secrets.example.ts` にも同じ名前のキー（空値）を追加する。テンプレートを更新し忘れると、他の開発者のビルドが失敗する原因になる。
- Storage キーを新しく追加する場合は、以下を満たす。
  - `environment.ts` と `environment.prod.ts` の両方に同じ値で追加する。
  - 命名規則（camelCase / kebab-case）に従う。
  - 既定値は、利用側（例：`login.service.ts` の `settings`）で `?? 既定値` として与える。

## 未確定事項（本ノード関連）
- `recordingMargin` の既定値 `15` の単位と、許容範囲・入力 UI 上の制約は未確定（Middleware／UI の確認が必要）。
- 本番 release での Maps キー分離方針、ビルド失敗を検出するレイヤ、鍵ローテーションや API キー制限、CI での secrets 供給方法は未確定（`spec/unknowns.md`）。

## 関連ノード
- 参照元：全サービス／ページ（`import { environment }` で利用）
- [[middleware.map.service]]：`mapsKey`（Maps JS API 用）を利用する（UC06）。ヒヤリ録画改修の包括許可の対象ファイル。
- [[env.config.capacitor]]：`AndroidManifest.xml` の `geo.API_KEY` を `local.properties` + `manifestPlaceholders` で供給する。
- [[middleware.login.service]]：単一ユーザー認証を担い、ロールベースの権限分岐は持たない（UC01）。`settings.recordingMargin`（既定 15）を読み込む。
- [[env.app.bootstrap]]：`production` を見て `enableProdMode()` を判定する。
- [[qa.mockdata.ble.emulator]]：「エミュレータの都合でアプリを変えない」制約と TC-BLE-EMU-020 の FAIL 条件は、包括許可の後も維持される。

```json
{
  "required_changes": [
    {"node": "env.config.environment", "entrypoint": "spec/env/config-environment.md", "description": "定義値表に settingRecordingMargin: 'setting-recording-margin' を追加し、既定値 15 を login.service.ts の settings で与えて `storage.get(...) ?? 15` で読み込むこと、非 Android 強制ブロック（login.service.ts:78-81）には追加しないこと、storage.set で即時保存することを明記する"},
    {"node": "env.config.environment", "entrypoint": "spec/env/config-environment.md", "description": "Storage キーの命名規則（プロパティ名 camelCase / 値 kebab-case）を明文化する"},
    {"node": "env.config.environment", "entrypoint": "spec/env/config-environment.md", "description": "ヒヤリ録画改修（fact #4633〜#4638）にともなう 6 ファイルの包括変更許可、approved fact がある改修では個別例外許可 fact を不要とする一般則、qa.mockdata.ble.emulator の制約と TC-BLE-EMU-020 の FAIL 条件を維持することを追記する"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "login.service.ts の settings に recordingMargin: 15 を追加し、environment.settingRecordingMargin から ?? 15 で読み込み、非 Android 強制ブロックには含めない実装仕様を middleware.login.service に反映する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "settings.page で recordingMargin を編集し storage.set で即時保存する UI と、driving.page / bad-spot.page での録画マージン利用を、単位と入力範囲を含めて定義する必要がある"},
    {"domain": "QA-agent", "severity": "should", "reason": "包括許可の後も qa.mockdata.ble.emulator のエミュレータ都合によるアプリ変更禁止と TC-BLE-EMU-020 の FAIL 条件が維持されることをテスト観点で確認する必要がある"},
    {"domain": "Infra-agent", "severity": "must", "reason": "Android 側は local.properties + manifestPlaceholders 経路で geo.API_KEY を供給する前提であり、値共用の許容と経路分離の維持、未配置時のビルド失敗挙動を capacitor/Gradle 側仕様と同期させる必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "environment.secrets.ts と local.properties は VCS 管理外のため、CI/ローカル環境での secrets 供給手順とテンプレート（.example）配置がビルド成立の条件になる"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "middleware.map.service が参照する environment.mapsKey の供給元が environment.secrets.ts 経由となるため、UC06 の地図描画と UC01 後の初期化経路で値が未設定の場合の挙動整合を確認する必要がある"}
  ],
  "requirements_context": "env.config.environment は Angular の fileReplacements による environment.ts（開発）/ environment.prod.ts（本番）の切り替えを真実源とし、production 以外の値は両ファイルで同一である。secrets の実体は environment.secrets.ts で、environment.ts / environment.prod.ts の双方がこれを import して mapsKey 等の秘匿値を取得する（読み込み順: environment.secrets.ts → environment(.prod).ts → 各サービスの import { environment }）。environment.secrets.ts は VCS 管理外（.gitignore）で、テンプレート（environment.secrets.example.ts）のみをコミットする。environment.secrets.ts が未配置の場合 ionic build は失敗しなければならず、黙殺して cap sync に進んではならない。Google Maps キーは開発／実機検証フェーズに限り Web(JS API) と Android(SDK) で同一キー値を共用してよいが、供給経路は environment.secrets.ts（JS 側）と local.properties + manifestPlaceholders（Android 側）で分離を維持する。本番 release における分離方針は未決とする。従前平文で埋め込まれていた既存キー 2 本は失効させて新キーに入れ替え、実キー値を仕様書・リポジトリに掲載・コミットしない。定義値は production / mapsKey / geolocationMaximumAge=0 / geolocationTimeout=1000 / geolocationLastPosKey='geolocation-last-pos-key' / sensorStockTime=60000 / scoreLogicKey='driving-score-logic' / scoreLogicJsonKey='score-logic-json' / loginKey='login' / lastLoginUserId='last-login-user-id' / settingRecording='setting-recording' / settingRecordingMargin='setting-recording-margin'（新規）/ settingGpsDemo='setting-gps-demo' / settingLogStorage='setting-log-storage' / settingSensorLogStorage='setting-sensor-log-storage' / settingSelectedSensorMode='setting-selected-sensor-mode'。Storage キーの命名はプロパティ名 camelCase・値 kebab-case の既存形式に従う。settingRecordingMargin はヒヤリ録画改修（fact #4633〜#4638）で追加し、既定値は login.service.ts の settings に recordingMargin: 15 として与え、既存項目と同じく `await this.storage.get(environment.settingRecordingMargin) ?? 15` で読み込む。非 Android 時の強制値は設けず（login.service.ts:78-81 の強制ブロックには追加しない）、保存は storage.set で即時に行う。値 15 の単位・範囲は未確定。ヒヤリ録画改修にともなう 6 ファイル（driving.page / bad-spot.page / settings.page / map.service / login.service / environment.ts）の変更は包括許可され、対応する approved fact がある機能改修では個別例外許可 fact を不要とする一般則がある。ただし qa.mockdata.ble.emulator の『エミュレータ都合でアプリを変えない』制約と TC-BLE-EMU-020 の FAIL 条件は維持する。UC01 は loginKey / lastLoginUserId、UC06 は sensorStockTime / scoreLogicKey / scoreLogicJsonKey / geolocation 系 / mapsKey に依存する。ロール（driver=主ユーザー・運転診断対象、operator・developer=運用・開発上の区分）は概念上のものであり、RBAC 等の技術的な権限ゲートはなく、認証は LoginService による単一ユーザー認証のみである。staging 用の分岐は存在しない。鍵ローテーションや API キー制限の運用、本番の鍵分離方針、ビルド失敗の検出レイヤ、CI での secrets 供給方法は未確定。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "settingRecordingMargin の Storage キーは 'setting-recording-margin'", "statement": "environment.ts に settingRecordingMargin: 'setting-recording-margin' を定義する", "status": "approved"},
    {"type": "data_semantics", "title": "recordingMargin の既定値は 15", "statement": "login.service.ts の settings に recordingMargin: 15 を追加し、storage.get(environment.settingRecordingMargin) ?? 15 で読み込む", "status": "approved"},
    {"type": "constraint", "title": "recordingMargin に非 Android 強制値を設けない", "statement": "recordingMargin は login.service.ts:78-81 の非 Android 強制ブロックに追加してはならない", "status": "approved"},
    {"type": "constraint", "title": "recordingMargin は storage.set で即時保存する", "statement": "recordingMargin の保存は既存の設定項目と同じく storage.set で即時に行う", "status": "approved"},
    {"type": "constraint", "title": "Storage キー命名は camelCase / kebab-case", "statement": "environment の Storage キーはプロパティ名を camelCase、値を kebab-case とする既存形式に従う", "status": "candidate"},
    {"type": "constraint", "title": "ヒヤリ録画改修の 6 ファイル変更は包括許可", "statement": "ヒヤリ録画改修（fact #4633〜#4638）にともなう driving.page / bad-spot.page / settings.page / map.service / login.service / environment.ts の変更は包括的に許可される", "status": "approved"},
    {"type": "constraint", "title": "approved fact がある改修は個別例外許可 fact 不要", "statement": "対応する approved fact がある機能改修については個別の例外許可 fact を不要とする", "status": "approved"},
    {"type": "constraint", "title": "エミュレータ都合のアプリ変更禁止は維持", "statement": "qa.mockdata.ble.emulator の『エミュレータ都合でアプリを変えない』制約と TC-BLE-EMU-020 の FAIL 条件は包括許可の後も維持される", "status": "approved"},
    {"type": "constraint", "title": "秘匿値は environment.secrets.ts に分離される", "statement": "mapsKey 等の秘匿値は environment.secrets.ts に定義され、environment.ts / environment.prod.ts はこれを import して参照する", "status": "candidate"},
    {"type": "constraint", "title": "environment.secrets.ts は VCS 管理外", "statement": "environment.secrets.ts は .gitignore の対象でコミットせず、テンプレートとして .example ファイルのみを配布する", "status": "candidate"},
    {"type": "constraint", "title": "environment.secrets.ts 未配置時は ionic build を失敗させる", "statement": "environment.secrets.ts が未配置の場合 ionic build は失敗しなければならず、エラーを黙殺して cap sync に進んではならない", "status": "candidate"},
    {"type": "constraint", "title": "環境設定の読み込み順は secrets → environment → 利用側", "statement": "environment.secrets.ts が environment.ts / environment.prod.ts に取り込まれ、production ビルドでは fileReplacements で差し替えた上で各サービスが import { environment } で参照する", "status": "candidate"},
    {"type": "external_integration_rule", "title": "開発／実機検証フェーズは Maps キー値の共用を許容する", "statement": "Google Maps キーは開発および実機検証フェーズに限り Web(JS API) と Android(SDK) で同一キー値を共用してよい", "status": "approved"},
    {"type": "constraint", "title": "Maps キーの供給経路は分離を維持する", "statement": "値を共用する場合でも、供給経路は JS 側が environment.secrets.ts、Android 側が local.properties + manifestPlaceholders として分離を維持する", "status": "approved"},
    {"type": "open_question", "title": "本番 release の Maps キー分離方針は未決", "statement": "本番 release における Web(JS API) と Android(SDK) の Maps キー分離方針は未決として扱う", "status": "open_question"},
    {"type": "constraint", "title": "既存 Maps API キー 2 本は失効させ新キーに入れ替える", "statement": "従前平文で埋め込まれていた Maps 用 API キー 2 本は失効させ、secrets 分離後の新キーに入れ替える", "status": "candidate"},
    {"type": "constraint", "title": "実キー値を仕様・リポジトリに平文で記載しない", "statement": "仕様書およびコミット対象のソースに Maps API キーの実値を平文で記載してはならない", "status": "candidate"},
    {"type": "external_integration_rule", "title": "mapsKey は Google Maps JS API 専用キー", "statement": "environment.mapsKey は @googlemaps/js-api-loader に渡す JS Maps API 専用の API キーである", "status": "candidate"},
    {"type": "external_integration_rule", "title": "geo.API_KEY はネイティブ Maps SDK 専用", "statement": "AndroidManifest の com.google.android.geo.API_KEY はネイティブ Maps SDK 用の設定項目であり、mapsKey とは供給経路が分離されている", "status": "candidate"},
    {"type": "permission_rule", "title": "driver は主ユーザー（運転診断の対象）", "statement": "ロール driver はアプリの主ユーザーであり運転診断の対象である", "status": "candidate"},
    {"type": "permission_rule", "title": "operator/developer は技術的な権限ゲートを持たない", "statement": "operator および developer は運用・開発上の役割区分であり、技術的な権限制御ゲートを持たない", "status": "candidate"},
    {"type": "permission_rule", "title": "認証は LoginService の単一ユーザー認証のみ", "statement": "認証は LoginService による単一ユーザー認証のみで、ロールに基づく権限分岐コードは存在しない", "status": "candidate"},
    {"type": "constraint", "title": "staging 用 environment 分岐は存在しない", "statement": "環境ファイルは dev/prod の 2 種類のみで staging 用の分岐は存在しない", "status": "candidate"}
  ],
  "open_questions": [
    "recordingMargin 既定値 15 の単位（秒など）と許容範囲・入力制約が未確定。本ノードの facts には単位の記載がないため。Middleware（録画制御）と UI（settings.page）の判断が必要で、決まらないとヒヤリ録画の前後マージンの挙動と設定 UI が確定しない。",
    "本番 release で Web(JS API) と Android(SDK) の Maps キーを分離するか、同一キーのまま制限設定で運用するかは未決。セキュリティ／運用方針の判断（Infra ドメインを含む）が必要で、決まらないとリリース時の鍵発行手順が確定しない。",
    "ionic build の失敗をどのレイヤで検出するか（TypeScript の import 解決エラーに委ねるか、prebuild スクリプトで明示チェックするか）は未確定。Infra/ビルド設定側の判断が必要で、決まらないと開発者が遭遇するエラーの形が定まらない。",
    "新しい mapsKey / geo.API_KEY のローテーションポリシーと API キー制限の設定有無、管理責任者は未確定。運用・セキュリティ担当または Infra の判断が必要で、決まらないと鍵管理ガバナンスが確定しない。",
    "CI での environment.secrets.ts / local.properties の供給方法が env 仕様の範囲か Infra/CI 仕様の範囲かは未確定。Infra の確認が必要で、決まらないとデプロイ手順が確定しない。",
    "operator/developer ロールの『画面到達可否程度の区別』が具体的にどの画面/ルートで生じるかは、UI/ルーティング側の確認が必要。"
  ],
  "rationale_notes": [
    "recordingMargin の既定値を環境ファイルではなく login.service の settings と `?? 15` で与えるのは、既存の設定項目と同じパターンに揃え、Storage 未設定時のフォールバックを一箇所に集約するため。",
    "非 Android 強制ブロックに追加しないのは、録画マージンがプラットフォームで値を強制すべき性質の設定ではないという approved 判断に従ったもの。",
    "包括許可の一般則はエミュレータ制約を緩和しないことを明記した。BLE エミュレータ都合でアプリを変更する口実にならないようにするため。",
    "キー値の共用許容は開発／実機検証フェーズ限定の運用緩和であり、供給経路の分離は緩和対象に含めない。経路を分けておけば、本番で値を分ける判断に移ってもコード構造を変えずに済む。",
    "未配置時にビルドを失敗させるのは、mapsKey が undefined のまま実機配布まで進み、『地図が表示されない』という遅い失敗になるのを防ぐため。",
    "ロール定義は RBAC 実装を伴わない概念上の区分であることを維持し、実装上の誤解を防ぐ。"
  ]
}
```