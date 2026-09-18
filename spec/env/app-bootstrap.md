<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:27:31 JST -->

```json
{
  "required_changes": [
    {
      "node": "env.app.bootstrap",
      "entrypoint": "spec/env/app-bootstrap.md",
      "description": "承認済みファクトに基づき『ビルド前提ランタイム: Node 18.19.x を唯一の正とし nvm + src/data/.nvmrc=18.19.1 で管理』を前提条件節として追記（実行時コード変更なし）"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "infra",
      "severity": "should",
      "reason": "CI/ビルドパイプラインおよびローカル開発手順が Node 18.19.x 固定・.nvmrc 参照に整合している必要がある"
    },
    {
      "domain": "env",
      "severity": "could",
      "reason": "env.config.environment 等の他 env ノードでも同一 Node バージョン前提を共有する必要がある"
    }
  ],
  "requirements_context": "# env.app.bootstrap — Angular/Ionic アプリのブートストラップ\n\n## 概要\nIonic 7 + Angular 15 + Capacitor 4 の SPA を起動し、Cordova/Capacitor プラグイン群を DI 登録し、8 経路のルータを配線するルートモジュール。`src/data/src/main.ts` が `AppModule` を bootstrap する。\n\n## 真実源\n- `src/data/src/main.ts`\n- `src/data/src/app/app.module.ts`\n- `src/data/src/app/app-routing.module.ts`\n- `src/data/src/app/app.component.ts`\n- `src/data/src/app/app.component.html`\n- `src/data/.nvmrc`\n\n## ビルド前提ランタイム（Node）\n- 本アプリのビルド／開発に使用する Node は **18.19.x を唯一の正** とする。他系列（16/20/22 等）でのビルドは前提外とする。\n- バージョン管理は **nvm** を用い、`src/data/.nvmrc` に `18.19.1` を記載して固定する。作業前に `src/data` 配下で `nvm use` を実行し、18.19.x が有効であることを確認する。\n- 本前提は**ビルド時のみ**の制約であり、`main.ts` / `AppModule` などの実行時コードの変更を伴わない。\n- Angular / Ionic / Capacitor 本体のバージョンは本件では変更しない（Ionic 7 + Angular 15 + Capacitor 4 のまま）。\n\n## 起動シーケンス\n1. `main.ts` は `environment.production === true` の場合 `enableProdMode()` を呼ぶ。\n2. `platformBrowserDynamic().bootstrapModule(AppModule)` で `AppModule` を起動する。失敗時は `console.log(err)` のみ。\n3. `AppComponent`（selector: `app-root`）が `app.component.html` を描画し、Ionic のルーターアウトレットを通じてルーティングを受ける。\n\n## DI で登録する Cordova/Capacitor プラグイン\n`AppModule.providers` に以下を登録する（すべて `@awesome-cordova-plugins/*/ngx` からインポート）。\n- `ScreenOrientation`\n- `Geolocation`（awesome-cordova-plugins 版）\n- `DeviceMotion`\n- `Magnetometer`\n- `SQLite`\n- `AndroidPermissions`\n- `{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }`\n\nコメントアウトで残っているが登録しないもの: `BLE`（`@awesome-cordova-plugins/ble/ngx`）、`Diagnostic`（`@ionic-native/diagnostic/ngx`）。実際の BLE は `@capacitor-community/bluetooth-le` を [[infra.ble.device]] 経由で使う。\n\n## imports される Angular/Ionic モジュール\n- `BrowserModule`\n- `IonicStorageModule.forRoot()`\n- `IonicModule.forRoot()`\n- `AppRoutingModule`\n- `HttpClientModule`\n\n## ルーティング\n`RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })` を使用し、すべての子モジュールを事前ロードする。`routes` は次の順で定義される。\n\n| path | 遷移先モジュール | 対応ノード |\n|---|---|---|\n| `''` | `redirectTo: 'opening'`, `pathMatch: 'full'` | — |\n| `account/:type` | `AccountPageModule`（lazy load） | [[ui.account.page]] |\n| `bad-spot/:path` | `BadSpotPageModule` | [[ui.badspot.page]] |\n| `comment` | `CommentPageModule` | [[ui.comment.page]] |\n| `driving` | `DrivingPageModule` | [[ui.driving.page]] |\n| `history` | `HistoryPageModule` | [[ui.history.page]] |\n| `opening` | `OpeningPageModule` | [[ui.opening.page]] |\n| `settings` | `SettingsPageModule` | [[ui.settings.page]] |\n| `edit` | `EditPageModule` | [[ui.edit.page]] |\n\n## `AppComponent`\n- `selector: 'app-root'`、`templateUrl: 'app.component.html'`\n- コンストラクタは空。ライフサイクル処理は各 Page 側に持つ。\n\n## Zone.js / IntersectionObserver 回避制約\nブートストラップ／実行時安定化のため、次のいずれかの方針で IntersectionObserver 起因の問題を根本回避しなければならない（approved design_decision）。\n- 対象依存を特定バージョン（例: `3.55`）に厳密ピンする\n- または Zone.js の IntersectionObserver unpatch フラグ（案 C）を用いる\n\n## ユースケース対応\n- UC01: 未ログインのログイン → `''` → `opening` → `account/:type`\n- UC02: 自動ログイン → `opening` 起動時に [[env.config.environment]] 参照および保存資格情報で遷移\n- UC06: 運転診断の実行 → `driving`（[[infra.cordova.sensors]] のプラグイン初期化に依存）\n- UC12: 編集とデモ再生 → `edit`\n\n## 関連ノード\n- 依存先: [[env.config.environment]]（`environment.production` の参照）、[[infra.cordova.sensors]]（プラグイン群）\n- 派生: 8 つの UI Page モジュール\n",
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
    }
  ],
  "open_questions": [
    "CI/ビルドパイプライン側で Node 18.19.x を強制する仕組み（setup-node の node-version-file 指定等）が既に存在するかが未確認。Infra 判断が必要で、決まらないとローカルと CI でビルド環境が乖離するリスクが残る。",
    "package.json に engines フィールドで node 18.19.x を宣言するか否かが未決。Env/Infra の合意が必要で、決まらないと誤バージョンでの install/build を機械的に検出できない。",
    "厳密ピン対象のパッケージ名が fact 上『例 3.55』のみで未特定である。どの依存を 3.55 にピンするのか、パッケージ名の確定が Infra/依存管理側で必要。決まらないと bootstrap の依存制約を実装レベルで固定できない。",
    "IntersectionObserver 回避策は『バージョン厳密ピン』と『Zone.js unpatch（案C）』の二者択一か併用可かが未記載。採用する一方を env と infra で確定する必要があり、決まらないと main.ts / polyfills のどちらを変更するかが定まらない。"
  ],
  "rationale_notes": [
    "既存 spec md の構成・記述を維持し、今回の承認済みファクトである Node ランタイム前提のみを『ビルド前提ランタイム（Node）』節として差分追加した。",
    "真実源に src/data/.nvmrc を追加したのは、Node バージョンの正の所在をドキュメント上で辿れるようにするため。",
    "Node 前提はビルド環境の制約であり実行時仕様ではないため、起動シーケンス・DI・ルーティングの記述には一切手を入れていない。",
    "context に記載の UC01/UC02/UC06/UC12 とルートの対応を明示する節を追加し、ブートストラップ仕様とユースケースの追跡性を確保した。",
    "既存 approved facts のうち externalDataDirectory / scoreLogic 系は infra・middleware ドメインの事実であり、bootstrap 仕様の記述対象外として反映していない。"
  ]
}
```