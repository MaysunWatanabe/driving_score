<!-- 作成: 2026-09-10 17:27:32 JST | 更新: 2026-09-18 18:52:18 JST -->

# env.app.bootstrap — Angular/Ionic アプリのブートストラップ

## 概要
Ionic 7 + Angular 15 + Capacitor 4 の SPA を起動し、Cordova/Capacitor プラグイン群を DI 登録し、ルータを配線するルートモジュール。`src/data/src/main.ts` が `AppModule` を bootstrap する。

2026 年度改修（日産自動車からの 5 本の要求）に伴い、ルート構成に新規画面 8-1「サービス案表示」が追加される見込みであること、および画面の縦横変更要求が存在することを前提として本ノードを扱う。ただしいずれも現時点では実現方式が未確定であり、本仕様では確定した範囲のみを正とする。

## 真実源
- `src/data/src/main.ts`
- `src/data/src/app/app.module.ts`
- `src/data/src/app/app-routing.module.ts`
- `src/data/src/app/app.component.ts`
- `src/data/src/app/app.component.html`
- `src/data/.nvmrc`

## ビルド前提ランタイム（Node）
- 本アプリのビルド／開発に使用する Node は **18.19.x を唯一の正** とする。他系列（16/20/22 等）でのビルドは前提外とする。
- バージョン管理は **nvm** を用い、`src/data/.nvmrc` に `18.19.1` を記載して固定する。作業前に `src/data` 配下で `nvm use` を実行し、18.19.x が有効であることを確認する。
- 本前提は**ビルド時のみ**の制約であり、`main.ts` / `AppModule` などの実行時コードの変更を伴わない。
- Angular / Ionic / Capacitor 本体のバージョンは本件では変更しない（Ionic 7 + Angular 15 + Capacitor 4 のまま）。

## 開発スケジュール前提
- 本アプリの開発は **2026 年 11 月末までの完了を目標** とする。2026 年 12 月から高齢者を招いた実験が開始されるため、ブートストラップ層に影響する環境変更（ランタイム更新、依存の大幅アップグレード等）は原則この期限内で完結する範囲に留める。
- したがって Angular / Ionic / Capacitor 本体のメジャーアップグレードは本改修の対象外とする。

## 起動シーケンス
1. `main.ts` は `environment.production === true` の場合 `enableProdMode()` を呼ぶ。
2. `platformBrowserDynamic().bootstrapModule(AppModule)` で `AppModule` を起動する。失敗時は `console.log(err)` のみ。
3. `AppComponent`（selector: `app-root`）が `app.component.html` を描画し、Ionic のルーターアウトレットを通じてルーティングを受ける。

## DI で登録する Cordova/Capacitor プラグイン
`AppModule.providers` に以下を登録する（すべて `@awesome-cordova-plugins/*/ngx` からインポート）。
- `ScreenOrientation`
- `Geolocation`（awesome-cordova-plugins 版）
- `DeviceMotion`
- `Magnetometer`
- `SQLite`
- `AndroidPermissions`
- `{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }`

コメントアウトで残っているが登録しないもの: `BLE`（`@awesome-cordova-plugins/ble/ngx`）、`Diagnostic`（`@ionic-native/diagnostic/ngx`）。実際の BLE は `@capacitor-community/bluetooth-le` を [[infra.ble.device]] 経由で使う。

## imports される Angular/Ionic モジュール
- `BrowserModule`
- `IonicStorageModule.forRoot()`
- `IonicModule.forRoot()`
- `AppRoutingModule`
- `HttpClientModule`

## ルーティング
`RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })` を使用し、すべての子モジュールを事前ロードする。`routes` は次の順で定義される。

| path | 遷移先モジュール | 対応ノード |
|---|---|---|
| `''` | `redirectTo: 'opening'`, `pathMatch: 'full'` | — |
| `account/:type` | `AccountPageModule`（lazy load） | [[ui.account.page]] |
| `bad-spot/:path` | `BadSpotPageModule` | [[ui.badspot.page]] |
| `comment` | `CommentPageModule` | [[ui.comment.page]] |
| `driving` | `DrivingPageModule` | [[ui.driving.page]] |
| `history` | `HistoryPageModule` | [[ui.history.page]] |
| `opening` | `OpeningPageModule` | [[ui.opening.page]] |
| `settings` | `SettingsPageModule` | [[ui.settings.page]] |
| `edit` | `EditPageModule` | [[ui.edit.page]] |

### 2026 年度改修で追加される画面（ルート未確定）
- 新規画面 **8-1「サービス案表示」** を追加し、タブで表示を切り替える（サービス案 1 / サービス案 2 の 2 種が例示）。
- 8-1 をタブ配下の画面として構成するのか、独立ルート（例: `service-plan`）として `routes` に追加するのかは未確定。画像の差し込み方式・切り替え方式も未確定であるため、本仕様ではルート定義を確定させない。
- 診断開始前画面（1-2）における前回結果表示およびレーダーチャート表示は既存 `opening` 系ルート上の変更として扱い、新規ルートを要しない想定とする（UI 側の確定待ち）。

## 画面向き（オリエンテーション）の前提
- 現行実装は Android で画面を縦（`PORTRAIT`）に固定しており、履歴画面・アドバイス画面などで `screenOrientation.lock` を掛けている。`ScreenOrientation` は `AppModule.providers` に登録されており、向き制御はブートストラップ層で DI 提供される。
- 2026 年度改修で「縦横変更できるようにしてください」との要求があるが、どの画面を回転対応にするか、横向きレイアウトをどう構成するかが未確定。よって現時点では **縦固定を既定の正** とし、解除範囲が確定するまで `AppModule` 側の DI 構成および既定ロックポリシーは変更しない。

## `AppComponent`
- `selector: 'app-root'`、`templateUrl: 'app.component.html'`
- コンストラクタは空。ライフサイクル処理は各 Page 側に持つ。

## Zone.js / IntersectionObserver 回避制約
ブートストラップ／実行時安定化のため、次のいずれかの方針で IntersectionObserver 起因の問題を根本回避しなければならない（approved design_decision）。
- 対象依存を特定バージョン（例: `3.55`）に厳密ピンする
- または Zone.js の IntersectionObserver unpatch フラグ（案 C）を用いる

## ユースケース対応
- UC01: 未ログインのログイン → `''` → `opening` → `account/:type`
- UC02: 自動ログイン → `opening` 起動時に [[env.config.environment]] 参照および保存資格情報で遷移
- UC06: 運転診断の実行 → `driving`（[[infra.cordova.sensors]] のプラグイン初期化に依存）
- UC12: 編集とデモ再生 → `edit`
- 2026 年度改修: 8-1 サービス案表示（ルート未確定）、1-2 前回結果表示・レーダーチャート（`opening` 系）

## 関連ノード
- 依存先: [[env.config.environment]]（`environment.production` の参照）、[[infra.cordova.sensors]]（プラグイン群）、[[infra.ble.device]]（BLE 実体）
- 派生: 8 つの UI Page モジュール（＋ 8-1 サービス案表示は追加予定・未確定）

```json
{
  "required_changes": [
    {
      "node": "env.app.bootstrap",
      "entrypoint": "spec/env/app-bootstrap.md",
      "description": "承認済みファクトに基づき『開発スケジュール前提（2026年11月末完了／12月実験開始）』節を追加し、本体メジャーアップグレードを対象外と明記"
    },
    {
      "node": "env.app.bootstrap",
      "entrypoint": "spec/env/app-bootstrap.md",
      "description": "新規画面 8-1『サービス案表示』の追加に伴うルート追加見込みを『ルート未確定』として明記（ルート定義は確定させない）"
    },
    {
      "node": "env.app.bootstrap",
      "entrypoint": "spec/env/app-bootstrap.md",
      "description": "画面向き前提節を追加し、ScreenOrientation の DI 提供と縦固定を既定の正とすること、縦横変更要求は解除範囲確定まで未反映であることを明記"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "ui",
      "severity": "must",
      "reason": "8-1 サービス案表示のタブ構成／独立ルート可否と、縦横変更を許可する画面範囲が UI 側で確定しないと app-routing とロックポリシーを固定できない"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "縦横変更対応時は screenOrientation.lock/unlock の呼び出し箇所とネイティブ設定（AndroidManifest の screenOrientation）変更が必要になる"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "CI/ビルドパイプラインが Node 18.19.x 固定・.nvmrc 参照に整合している必要があり、2026年11月末納期に向けた環境固定が前提となる"
    },
    {
      "domain": "env",
      "severity": "could",
      "reason": "env.config.environment 等の他 env ノードでも同一 Node バージョン前提と納期制約を共有する必要がある"
    }
  ],
  "requirements_context": "env.app.bootstrap は Ionic 7 + Angular 15 + Capacitor 4 の SPA を起動するルートモジュール層の仕様である。真実源は src/data/src/main.ts, app.module.ts, app-routing.module.ts, app.component.ts/html, src/data/.nvmrc。ビルド前提ランタイムは Node 18.19.x を唯一の正とし、nvm + src/data/.nvmrc=18.19.1 で固定する。この前提はビルド時のみの制約であり実行時コードを変更しない。Angular/Ionic/Capacitor 本体バージョンは本件では変更しない。開発は 2026 年 11 月末完了目標（2026 年 12 月から高齢者を招いた実験開始）であり、ブートストラップ層の環境変更はこの期限内で完結する範囲に限定し、本体メジャーアップグレードは対象外とする。起動シーケンスは environment.production 時に enableProdMode() を呼び、platformBrowserDynamic().bootstrapModule(AppModule) で起動、失敗時は console.log(err) のみ。AppModule.providers には ScreenOrientation, Geolocation, DeviceMotion, Magnetometer, SQLite, AndroidPermissions, および RouteReuseStrategy=IonicRouteStrategy を登録する。BLE と Diagnostic はコメントアウトのままで登録しない（BLE 実体は @capacitor-community/bluetooth-le を infra.ble.device 経由で使用）。imports は BrowserModule, IonicStorageModule.forRoot(), IonicModule.forRoot(), AppRoutingModule, HttpClientModule。ルーティングは RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }) で '' → opening リダイレクト、account/:type, bad-spot/:path, comment, driving, history, opening, settings, edit の 8 経路。2026 年度改修（日産自動車の 5 要求: 診断開始前画面の前回結果表示／タブ切り替え追加／レーダーチャート表示／BLE 安定化／ヒヤリ録画データサイズ改善）に伴い、新規画面 8-1『サービス案表示』がタブ切り替えで追加されるが、タブ配下か独立ルートかは未確定であり本仕様ではルート定義を確定しない。1-2 前回結果表示・レーダーチャートは opening 系既存ルート上の変更として扱う。画面向きは現行 Android で PORTRAIT 固定（履歴・アドバイス画面で screenOrientation.lock）であり、ScreenOrientation は AppModule で DI 提供される。先方から縦横変更要求があるが対象画面と横向きレイアウトが未確定のため、縦固定を既定の正とし DI 構成とロックポリシーは変更しない。IntersectionObserver 起因問題は対象依存の厳密バージョンピン（例 3.55）または Zone.js の IntersectionObserver unpatch フラグ（案C）のいずれかで根本回避しなければならない。ユースケース対応は UC01（'' → opening → account/:type）、UC02（opening 起動時に environment 参照と保存資格情報で遷移）、UC06（driving、infra.cordova.sensors 依存）、UC12（edit）、および 2026 年度改修分（8-1 ルート未確定、1-2 は opening 系）。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "ビルド前提の Node は 18.19.x を唯一の正とする",
      "statement": "本アプリのビルド・開発に使用する Node ランタイムは 18.19.x のみを正とし、他バージョンでのビルドは前提外とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Node バージョンは nvm と .nvmrc で固定管理する",
      "statement": "Node バージョンは nvm で管理し、src/data/.nvmrc に 18.19.1 を記載して固定しなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Node バージョン固定は実行時コード変更を伴わない",
      "statement": "Node 18.19.x 前提の明記はビルド時前提条件のみであり、main.ts や AppModule 等の実行時コードを変更してはならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Angular/Ionic/Capacitor 本体バージョンは変更しない",
      "statement": "本件では Ionic 7 / Angular 15 / Capacitor 4 の本体バージョンを変更してはならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "納期制約によりブートストラップ層の大規模環境変更は行わない",
      "statement": "アプリ開発は2026年11月末完了目標であるため、ブートストラップ層の環境変更は同期限内に完結する範囲に限定し、Angular/Ionic/Capacitor 本体のメジャーアップグレードは行ってはならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "IntersectionObserver問題はバージョンピンまたはZone.js unpatchで回避する",
      "statement": "env.app.bootstrap において IntersectionObserver 起因問題は、特定バージョン（例 '3.55'）への厳密ピン、または Zone.js の IntersectionObserver unpatch フラグ（案C）のいずれかで根本回避しなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "本番時はenableProdModeを呼ぶ",
      "statement": "main.ts は environment.production が true のとき enableProdMode() を呼ばなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "AppModuleはplatformBrowserDynamicでbootstrapされる",
      "statement": "アプリケーションは platformBrowserDynamic().bootstrapModule(AppModule) により起動される",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "AppModuleにCordova/CapacitorプラグインをDI登録する",
      "statement": "AppModule.providers に ScreenOrientation, Geolocation, DeviceMotion, Magnetometer, SQLite, AndroidPermissions および IonicRouteStrategy を RouteReuseStrategy として登録する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "BLEとDiagnosticはAppModule providersに登録しない",
      "statement": "BLE（@awesome-cordova-plugins/ble/ngx）と Diagnostic（@ionic-native/diagnostic/ngx）はコメントアウトのままで AppModule に登録してはならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "ルートはPreloadAllModulesで事前ロードする",
      "statement": "RouterModule.forRoot は preloadingStrategy: PreloadAllModules を使用し子モジュールを事前ロードする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "画面向きは縦固定を既定の正とする",
      "statement": "画面向きは Android で PORTRAIT 固定を既定の正とし、縦横変更を許可する画面範囲が確定するまで AppModule の DI 構成および既定ロックポリシーを変更してはならない",
      "status": "candidate"
    },
    {
      "type": "open_question",
      "title": "8-1 サービス案表示のルート定義は未確定",
      "statement": "新規画面 8-1 サービス案表示をタブ配下の画面として構成するか独立ルートとして app-routing に追加するかは未確定であり、ルート定義を確定させてはならない",
      "status": "open_question"
    }
  ],
  "open_questions": [
    "8-1『サービス案表示』を app-routing.module.ts に独立ルートとして追加するのか、既存画面配下のタブとして構成するのかが未確定。UI ドメインのタブ設計判断が必要で、決まらないと routes と PreloadAllModules 対象モジュールを確定できない。",
    "縦横変更を許可する画面の範囲が未確定。現行は Android 縦固定＋各画面での screenOrientation.lock であり、UI/Infra の合意が必要。決まらないと ScreenOrientation の既定ロックポリシーとネイティブ側 orientation 設定を確定できない。",
    "CI/ビルドパイプライン側で Node 18.19.x を強制する仕組み（setup-node の node-version-file 指定等）が既に存在するかが未確認。Infra 判断が必要で、決まらないとローカルと CI でビルド環境が乖離するリスクが残る。",
    "package.json に engines フィールドで node 18.19.x を宣言するか否かが未決。Env/Infra の合意が必要で、決まらないと誤バージョンでの install/build を機械的に検出できない。",
    "厳密ピン対象のパッケージ名が fact 上『例 3.55』のみで未特定である。どの依存を 3.55 にピンするのか、パッケージ名の確定が Infra/依存管理側で必要。決まらないと bootstrap の依存制約を実装レベルで固定できない。",
    "IntersectionObserver 回避策は『バージョン厳密ピン』と『Zone.js unpatch（案C）』の二者択一か併用可かが未記載。採用する一方を env と infra で確定する必要があり、決まらないと main.ts / polyfills のどちらを変更するかが定まらない。",
    "レーダーチャート描画に用いるチャートライブラリの追加が bootstrap 層（AppModule imports／polyfills）に影響するかが未確認。UI/Env の判断が必要で、決まらないと Node 18.19.x・Angular 15 との依存互換を事前検証できない。"
  ],
  "rationale_notes": [
    "既存 spec md の構成と記述を維持し、今回の approved facts（2026年度改修の5要求、11月末納期、8-1 新規画面、縦横変更要求と縦固定の衝突）に対応する節のみを差分追加した。",
    "8-1 のルートは『タブ切り替えで追加』という approved fact はあるが実現方式が open_question のため、routes 表には追記せず別節で『ルート未確定』として明示した。ルート表を推測で埋めると bootstrap 仕様が誤って確定するため。",
    "縦横変更要求は approved fact 上も『現行の縦固定と衝突する open_question』であるため、既定は縦固定のままとし変更しないことを明記した。ScreenOrientation が AppModule の providers にある事実との接続だけを記述した。",
    "納期（2026年11月末／12月実験開始）は env ドメインの運用制約として bootstrap 層に効くため、本体メジャーアップグレード非対象という既存記述と結びつけて節化した。",
    "レーダーチャート・BLE 安定化・録画サイズ改善は ui/infra/middleware ドメインの事実であり、bootstrap 層では依存追加の可能性のみを open_question に残し本文の仕様化はしていない。",
    "Node 前提はビルド環境の制約であり実行時仕様ではないため、起動シーケンス・DI・ルーティングの既存記述には手を入れていない。"
  ]
}
```