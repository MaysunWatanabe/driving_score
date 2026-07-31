<!-- 作成: 2026-07-20 09:55:53 JST | 更新: 2026-07-23 19:31:28 JST -->

```json
{
  "required_changes": [
    {
      "node": "env.app.bootstrap",
      "entrypoint": "spec/env/app-bootstrap.md",
      "description": "approved fact に基づき IntersectionObserver 問題の回避策（特定バージョン厳密ピンまたは Zone.js unpatch 案C）をブートストラップ制約として追記する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "infra",
      "severity": "could",
      "reason": "Zone.js unpatch や依存バージョンピンはビルド/バンドル設定側の確認が必要になる場合がある"
    }
  ],
  "requirements_context": "# env.app.bootstrap — Angular/Ionic アプリのブートストラップ\n\n## 概要\nIonic 7 + Angular 15 + Capacitor 4 の SPA を起動し、Cordova/Capacitor プラグイン群を DI 登録し、8 経路のルータを配線するルートモジュール。`src/data/src/main.ts` が `AppModule` を bootstrap する。\n\n## 真実源\n- `src/data/src/main.ts`\n- `src/data/src/app/app.module.ts`\n- `src/data/src/app/app-routing.module.ts`\n- `src/data/src/app/app.component.ts`\n- `src/data/src/app/app.component.html`\n\n## 起動シーケンス\n1. `main.ts` は `environment.production === true` の場合 `enableProdMode()` を呼ぶ。\n2. `platformBrowserDynamic().bootstrapModule(AppModule)` で `AppModule` を起動する。失敗時は `console.log(err)` のみ。\n3. `AppComponent`（selector: `app-root`）が `app.component.html` を描画し、Ionic のルーターアウトレットを通じてルーティングを受ける。\n\n## DI で登録する Cordova/Capacitor プラグイン\n`AppModule.providers` に以下を登録する（すべて `@awesome-cordova-plugins/*/ngx` からインポート）。\n- `ScreenOrientation`\n- `Geolocation`（awesome-cordova-plugins 版）\n- `DeviceMotion`\n- `Magnetometer`\n- `SQLite`\n- `AndroidPermissions`\n- `{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }`\n\nコメントアウトで残っているが登録しないもの: `BLE`（`@awesome-cordova-plugins/ble/ngx`）、`Diagnostic`（`@ionic-native/diagnostic/ngx`）。実際の BLE は `@capacitor-community/bluetooth-le` を [[infra.ble.device]] 経由で使う。\n\n## imports される Angular/Ionic モジュール\n- `BrowserModule`\n- `IonicStorageModule.forRoot()`\n- `IonicModule.forRoot()`\n- `AppRoutingModule`\n- `HttpClientModule`\n\n## ルーティング\n`RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })` を使用し、すべての子モジュールを事前ロードする。`routes` は次の順で定義される。\n\n| path | 遷移先モジュール | 対応ノード |\n|---|---|---|\n| `''` | `redirectTo: 'opening'`, `pathMatch: 'full'` | — |\n| `account/:type` | `AccountPageModule`（lazy load） | [[ui.account.page]] |\n| `bad-spot/:path` | `BadSpotPageModule` | [[ui.badspot.page]] |\n| `comment` | `CommentPageModule` | [[ui.comment.page]] |\n| `driving` | `DrivingPageModule` | [[ui.driving.page]] |\n| `history` | `HistoryPageModule` | [[ui.history.page]] |\n| `opening` | `OpeningPageModule` | [[ui.opening.page]] |\n| `settings` | `SettingsPageModule` | [[ui.settings.page]] |\n| `edit` | `EditPageModule` | [[ui.edit.page]] |\n\n## `AppComponent`\n- `selector: 'app-root'`、`templateUrl: 'app.component.html'`\n- コンストラクタは空。ライフサイクル処理は各 Page 側に持つ。\n\n## Zone.js / IntersectionObserver 回避制約\nブートストラップ／実行時安定化のため、次のいずれかの方針で IntersectionObserver 起因の問題を根本回避しなければならない（approved design_decision）。\n- 対象依存を特定バージョン（例: `3.55`）に厳密ピンする\n- または Zone.js の IntersectionObserver unpatch フラグ（案 C）を用いる\n\n## 関連ノード\n- 依存先: [[env.config.environment]]（`environment.production` の参照）、[[infra.cordova.sensors]]（プラグイン群）\n- 派生: 8 つの UI Page モジュール\n",
  "fact_candidates": [
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
    "厳密ピン対象のパッケージ名が fact 上『例 3.55』のみで未特定である。どの依存（例: swiper 等）を 3.55 にピンするのか、パッケージ名の確定が Infra/依存管理側で必要。決まらないと bootstrap の依存制約を実装レベルで固定できない。",
    "回避策は『バージョン厳密ピン』と『Zone.js IntersectionObserver unpatch（案C）』の二者択一か併用可かが未記載。採用する一方を env と infra で確定する必要があり、決まらないと main.ts / polyfills のどちらを変更するかが定まらない。"
  ],
  "rationale_notes": [
    "既存 spec md を維持し、node_id=env.app.bootstrap の approved design_decision のみを『Zone.js / IntersectionObserver 回避制約』節として差分追加した。",
    "docs/design/ 配下の scoping レポート永続化 fact は canonical spec / spec_documents に触れない設計判断のため、本 bootstrap 仕様には反映しない。",
    "facts と既存 md の矛盾は当該 design_decision 以外に見当たらなかったため、起動シーケンス・DI・ルーティング記述は維持した。"
  ]
}
```