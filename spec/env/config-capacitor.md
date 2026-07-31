<!-- 作成: 2026-07-20 10:02:59 JST | 更新: 2026-07-20 10:30:33 JST -->

```json
{
  "required_changes": [
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "geo.API_KEYにAndroidネイティブMaps SDK専用キーである旨とenvironment.mapsKeyとの用途分離注記を追加"},
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "パーミッション一覧にWRITE_EXTERNAL_STORAGEを追記しAndroid12以降自動許可想定の注記を付す"}
  ],
  "suggested_impacts": [
    {"domain": "Infra-agent", "severity": "should", "reason": "infra.cordova.sensorsのパーミッション要求リストとWRITE_EXTERNAL_STORAGE整合を確認する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "ui.opening.pageのcheckPermission()が要求するパーミッションとManifest宣言の整合を確認する必要がある"}
  ],
  "requirements_context": "env.config.capacitorはCapacitorによるWeb→Androidラップのビルド設定およびAndroidマニフェスト・パーミッション・Google Maps APIキー埋め込みを規定する。今回のPATCHでは、(1) com.google.android.geo.API_KEY をAndroidネイティブMaps SDK専用キーとして位置づけ、JS用のenvironment.mapsKeyとは意図的に別キー（用途分離）である旨を明記する。(2) AndroidManifest.xmlをパーミッション宣言の規範とし、パーミッション一覧にWRITE_EXTERNAL_STORAGEを追記、Android 12以降は自動許可される想定である旨を注記する。これによりui.opening.pageのcheckPermission()およびinfra.cordova.sensorsのパーミッション要求リストとの整合を担保する。appId(jp.co.nissan.drivingscore)/appName(driving-score)/webDir(www)、依存バージョン、FileProvider設定(${applicationId}.fileprovider)等の他項目は現行仕様を維持する。",
  "fact_candidates": [
    {"type": "external_integration_rule", "title": "geo.API_KEYはAndroidネイティブMaps SDK専用キー", "statement": "AndroidManifest.xmlのcom.google.android.geo.API_KEYはAndroidネイティブMaps SDK専用キーであり、JS用のenvironment.mapsKeyとは意図的に別キーとして用途分離される", "status": "candidate"},
    {"type": "external_integration_rule", "title": "geo.API_KEYとenvironment.mapsKeyの値が異なることは正当", "statement": "geo.API_KEYとenvironment.mapsKeyは利用元（ネイティブSDK/JS SDK）が異なるため値が異なってよく、値の相違は誤りではなく意図された設計である", "status": "candidate"},
    {"type": "constraint", "title": "AndroidManifest.xmlがパーミッション宣言の規範", "statement": "Androidのパーミッション宣言はAndroidManifest.xmlを規範とし、ランタイム側の要求リストは本マニフェストの宣言と整合させる", "status": "candidate"},
    {"type": "constraint", "title": "WRITE_EXTERNAL_STORAGEをManifestに追記", "statement": "AndroidManifest.xmlのパーミッション一覧にWRITE_EXTERNAL_STORAGEを追記する", "status": "candidate"},
    {"type": "assumption", "title": "WRITE_EXTERNAL_STORAGEはAndroid12以降自動許可想定", "statement": "WRITE_EXTERNAL_STORAGEはAndroid 12以降では自動的に許可される想定である", "status": "assumption"}
  ],
  "open_questions": [
    "WRITE_EXTERNAL_STORAGEのAndroid12以降『自動許可』想定は実機/OSバージョン別の実挙動と一致するか要検証（Infra/QA判断。実挙動が異なるとファイル書き込み系機能が失敗する）",
    "infra.cordova.sensorsのパーミッション要求リストにWRITE_EXTERNAL_STORAGEが含まれるか、Manifest宣言と完全整合しているか要確認（Infra判断）"
  ],
  "rationale_notes": [
    "geo.API_KEYとenvironment.mapsKeyを別キーにするのは用途分離（ネイティブSDKとJS SDKで利用元が異なる）が目的であり、値が異なることは誤りではなく意図された設計である",
    "WRITE_EXTERNAL_STORAGEはManifest未宣言のままcheckPermission()で要求される状態だったが、Android12以降の自動許可想定を前提にManifestへ明示追記して宣言の一貫性を確保する",
    "既存仕様書はほぼ本PATCHの内容を反映済みであったため、注記文言の明確化と整合確認以外の他項目（appId/webDir/依存/FileProvider等）は変更していない"
  ]
}
```

以下、差分更新した仕様書本文です。

```markdown
# env.config.capacitor — Capacitor/Ionic/Angular/Android ビルド設定

## 概要
Capacitor で Web ソースを Android にラップするビルド設定と、Android 側のマニフェスト・パーミッション・Google Maps API キー埋め込み。

## 真実源
- `src/data/capacitor.config.ts`
- `src/data/ionic.config.json`
- `src/data/angular.json`
- `src/data/package.json`
- `src/data/android/app/src/main/AndroidManifest.xml`（**パーミッション宣言の規範**）
- `src/data/tsconfig.json` / `tsconfig.app.json`

## Capacitor 設定（capacitor.config.ts）
```
{
  appId: 'jp.co.nissan.drivingscore',
  appName: 'driving-score',
  webDir: 'www',
  bundledWebRuntime: false
}
```

## Ionic/Angular
- `ionic.config.json`: `type: 'angular'`、`integrations.capacitor: {}`
- `angular.json`: 標準の Ionic テンプレート（`src/data/src/*` を build 対象、`fileReplacements` で prod ビルド時に `environment.ts` を `environment.prod.ts` へ差し替え）

## 主要依存
`package.json` の抜粋（バージョンは実測値）。
- `@angular/*`: `^15.0.0`
- `@ionic/angular`: `^7.8.6`
- `@ionic/storage-angular`: `^4.0.0`
- `@capacitor/core`: `^4.8.2`、`@capacitor/android`: `^4.8.2`
- `@capacitor/geolocation` / `motion` / `haptics` / `keyboard` / `status-bar`: `^4.x`
- `@capacitor-community/bluetooth-le`: `^2.3.0`
- `@awesome-cordova-plugins/*`: `^6.13.0`（screen-orientation, geolocation, device-motion, magnetometer, sqlite, sqlite-porter, file, insomnia, android-permissions）
- `@googlemaps/js-api-loader`: `^1.15.2`
- `chart.js`: `^4.4.7`
- `pako`: `^2.1.0`
- `ts-md5`: `^1.3.1`
- `crypto-browserify` / `path-browserify` / `es6-promise-plugin`（Node ビルトインの polyfill）

## Android マニフェスト（AndroidManifest.xml）
> AndroidManifest.xml を **パーミッション宣言の規範** とする。ランタイム側（`checkPermission()` 等）の要求リストは本マニフェストの宣言と整合させること。

- `package="jp.co.nissan.drivingscore"`
- `<application>` 属性: `requestLegacyExternalStorage=true` / `allowBackup=false` / `theme=@style/AppTheme`
- `MainActivity`: `launchMode="singleTask"`、`configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"`、`exported="true"`、intent-filter に `MAIN` + `LAUNCHER`

### Google Maps API キー（用途分離）
- `com.google.android.geo.API_KEY`: `AIzaSyA8DXX0csw-0tcTI0vI2LUvK2B5za5fveU`
  - **Android ネイティブ Maps SDK 専用キー。** JS 用の [[env.config.environment]] の `mapsKey`（`environment.mapsKey`）とは **意図的に別キー（用途分離）** である。
  - ネイティブ SDK と JS SDK で利用元が異なるため分離しており、**両者の値が異なることは誤りではなく意図された設計** である。片方の値でもう片方を上書き・統一しないこと。

### FileProvider
- FileProvider を `${applicationId}.fileprovider` として登録し、`@xml/file_paths` を meta-data に指定（現行維持）

### 付与する Android パーミッション
- `INTERNET`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `MODIFY_AUDIO_SETTINGS`
- `RECORD_AUDIO`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`（**Android 12 以降は自動的に許可される想定**）
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`

> 上記パーミッションは [[ui.opening.page]] の `checkPermission()` および [[infra.cordova.sensors]] のパーミッション要求リストと整合させること。`WRITE_EXTERNAL_STORAGE` を Manifest に明示追記したことで、`checkPermission()` の要求リストと宣言の一貫性を確保する。
>
> 注意: `WRITE_EXTERNAL_STORAGE` の「Android 12 以降自動許可」想定は実機/OS バージョン別の実挙動と一致するか要検証（Infra/QA）。実挙動が異なる場合、ファイル書き込み系機能が失敗する可能性がある。

## 関連ノード
- 参照元: [[env.app.bootstrap]]、[[env.build.installer]]
- 整合先: [[env.config.environment]]、[[ui.opening.page]]、[[infra.cordova.sensors]]
```