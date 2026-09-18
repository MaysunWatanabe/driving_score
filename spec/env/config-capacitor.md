<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:28:21 JST -->

```json
{
  "required_changes": [
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "ファイル書き出し方針セクションを新設し、書き出しルートが externalRootDirectory/Documents/driving-score/ 配下であることと、そのためのパーミッション追加を行わない方針を明記"},
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "MANAGE_EXTERNAL_STORAGE / MediaStore / SAF を採用しない（対象外）ことを明記し、requestLegacyExternalStorage=true と既存 READ/WRITE_EXTERNAL_STORAGE 宣言で運用する旨を追記"},
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "使用プラグイン（bluetooth-le / geolocation / storage / ファイル入出力）とAndroidパーミッションの対応表を追加"},
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "UC06(運転診断の実行)/UC11(センサーモード切替)に必要な実行環境前提（BLE・位置情報・モーション）を明記"},
    {"node": "env.config.capacitor", "entrypoint": "spec/env/config-capacitor.md", "description": "関連ノードに env.config.environment を reads 関係として明示"}
  ],
  "suggested_impacts": [
    {"domain": "Infra-agent", "severity": "must", "reason": "infra.cordova.file の書き出しルートが externalRootDirectory/Documents 配下であることと、パーミッション追加なし方針の整合確認が必要"},
    {"domain": "Infra-agent", "severity": "should", "reason": "infra.cordova.sensors のランタイムパーミッション要求リストが AndroidManifest.xml の宣言と一致しているか確認が必要"},
    {"domain": "UI-agent", "severity": "should", "reason": "ui.opening.page の checkPermission() 要求集合が Manifest 宣言と一致し、追加要求を発生させないことの確認が必要"}
  ],
  "requirements_context": "env.config.capacitor は Capacitor による Web→Android ラップのビルド設定（capacitor.config.ts / ionic.config.json / angular.json / package.json / AndroidManifest.xml / tsconfig）と、Android 側のパーミッション宣言・Google Maps API キー埋め込みを規定する。appId=jp.co.nissan.drivingscore、appName=driving-score、webDir=www、bundledWebRuntime=false は現行維持。angular.json の fileReplacements により prod ビルド時に environment.ts→environment.prod.ts が差し替わるため、本ノードは env.config.environment を reads する。com.google.android.geo.API_KEY は Android ネイティブ Maps SDK 専用キーであり、JS 用の environment.mapsKey とは意図的に別キー（用途分離）で、値の相違は誤りではない。AndroidManifest.xml をパーミッション宣言の規範とし、宣言集合は INTERNET / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION / CAMERA / MODIFY_AUDIO_SETTINGS / RECORD_AUDIO / READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE / BLUETOOTH_SCAN / BLUETOOTH_CONNECT / BLUETOOTH_ADVERTISE。application 属性は requestLegacyExternalStorage=true / allowBackup=false、FileProvider は ${applicationId}.fileprovider。今回の更新では承認済みファクトを反映し、ファイル書き出しルートを {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ 配下運用とし、そのためのパーミッション追加（MANAGE_EXTERNAL_STORAGE 等）や MediaStore/SAF 移行は行わない方針を明記する。ログ採取はファイルアプリまたは adb pull /sdcard/Documents/driving-score/... を正とする。UC06(運転診断の実行)は BLE(CAN 受信) + 位置情報 + モーションセンサの実行環境前提を必要とし、UC11(センサーモード切替)はスマホ単独モードで BLE を用いない経路が存在するため、モードにより実際に要求されるパーミッションが変動しうる。",
  "fact_candidates": [
    {"type": "constraint", "title": "ファイル書き出しルートは externalRootDirectory/Documents 配下", "statement": "アプリのファイル書き出しルートは {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ とする", "status": "approved"},
    {"type": "constraint", "title": "ファイル書き出しのためのパーミッション追加は行わない", "statement": "ファイル書き出しのために AndroidManifest.xml へ新規パーミッションを追加してはならない", "status": "approved"},
    {"type": "constraint", "title": "MediaStore/SAF は対象外", "statement": "ファイル書き出し方式として MediaStore および SAF への移行は本ノードの対象外とする", "status": "approved"},
    {"type": "constraint", "title": "ログ採取手段", "statement": "書き出しファイルの採取はファイルアプリまたは adb pull /sdcard/Documents/driving-score/... を正とする", "status": "approved"},
    {"type": "constraint", "title": "requestLegacyExternalStorage=true を維持", "statement": "AndroidManifest.xml の application 属性 requestLegacyExternalStorage=true を維持する", "status": "candidate"},
    {"type": "constraint", "title": "allowBackup=false", "statement": "AndroidManifest.xml の application 属性 allowBackup は false とする", "status": "candidate"},
    {"type": "external_integration_rule", "title": "geo.API_KEYはAndroidネイティブMaps SDK専用キー", "statement": "AndroidManifest.xml の com.google.android.geo.API_KEY は Android ネイティブ Maps SDK 専用キーであり、JS 用の environment.mapsKey とは意図的に別キーとして用途分離される", "status": "candidate"},
    {"type": "external_integration_rule", "title": "geo.API_KEYとenvironment.mapsKeyの値が異なることは正当", "statement": "geo.API_KEY と environment.mapsKey は利用元（ネイティブ SDK / JS SDK）が異なるため値が異なってよく、値の相違は意図された設計である", "status": "candidate"},
    {"type": "constraint", "title": "AndroidManifest.xmlがパーミッション宣言の規範", "statement": "Android のパーミッション宣言は AndroidManifest.xml を規範とし、ランタイム側の要求リストは本マニフェストの宣言と整合させる", "status": "candidate"},
    {"type": "constraint", "title": "宣言パーミッション集合", "statement": "AndroidManifest.xml は INTERNET / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION / CAMERA / MODIFY_AUDIO_SETTINGS / RECORD_AUDIO / READ_EXTERNAL_STORAGE / WRITE_EXTERNAL_STORAGE / BLUETOOTH_SCAN / BLUETOOTH_CONNECT / BLUETOOTH_ADVERTISE を宣言する", "status": "candidate"},
    {"type": "constraint", "title": "アプリ識別子とビルド出力先", "statement": "capacitor.config.ts は appId=jp.co.nissan.drivingscore / appName=driving-score / webDir=www / bundledWebRuntime=false を指定する", "status": "candidate"},
    {"type": "constraint", "title": "prodビルドでenvironmentが差し替わる", "statement": "angular.json の fileReplacements により prod ビルド時に environment.ts が environment.prod.ts へ差し替えられる", "status": "candidate"},
    {"type": "external_integration_rule", "title": "BLE通信は@capacitor-community/bluetooth-leに依存", "statement": "CAN データ受信のための BLE 通信は @capacitor-community/bluetooth-le に依存し、BLUETOOTH_SCAN / BLUETOOTH_CONNECT / BLUETOOTH_ADVERTISE の宣言を必要とする", "status": "candidate"},
    {"type": "external_integration_rule", "title": "位置情報取得は位置パーミッションを必要とする", "statement": "運転診断中の位置情報取得は ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION の宣言を必要とする", "status": "candidate"},
    {"type": "constraint", "title": "FileProvider登録", "statement": "FileProvider を ${applicationId}.fileprovider として登録し、@xml/file_paths を meta-data に指定する", "status": "candidate"},
    {"type": "assumption", "title": "WRITE_EXTERNAL_STORAGEはAndroid12以降自動許可想定", "statement": "WRITE_EXTERNAL_STORAGE は Android 12 以降では自動的に許可される想定である", "status": "assumption"},
    {"type": "assumption", "title": "センサーモードにより要求パーミッションが変動する", "statement": "スマホ単独モードでは BLE を使用しないため、実際に要求されるパーミッション集合がモードにより変動する想定である", "status": "assumption"}
  ],
  "open_questions": [
    "WRITE_EXTERNAL_STORAGE の『Android 12 以降自動許可』想定は実機/OS バージョン別の実挙動と一致するか未検証（Infra/QA 判断。実挙動が異なると /sdcard/Documents 配下への書き出しが失敗し、UC06 のログ・データ採取に影響する）",
    "requestLegacyExternalStorage=true が有効となる targetSdkVersion の実値が未確認（Infra 判断。targetSdk が 30 以上だと Legacy Storage が無効化され、externalRootDirectory/Documents 配下運用が成立しない可能性がある）",
    "infra.cordova.sensors および ui.opening.page のランタイム要求リストに WRITE_EXTERNAL_STORAGE が含まれるか、Manifest 宣言と完全一致しているか未確認（Infra/UI 判断。不一致だとモード切替時に不要な権限ダイアログや権限不足が発生する）",
    "ファイル入出力に使用しているのが @awesome-cordova-plugins/file か @capacitor/filesystem かが未確定（Infra 判断。どちらを規範とするかでルートディレクトリ解決 API と必要パーミッションの記述が変わる）",
    "CAMERA / RECORD_AUDIO / MODIFY_AUDIO_SETTINGS が現行機能のどのユースケースで実際に使用されるか未確認（UI/Infra 判断。未使用なら不要権限としてストア審査・ユーザ不信の要因になる）"
  ],
  "rationale_notes": [
    "書き出し先を externalRootDirectory/Documents 配下に戻した決定（#79 撤回）に合わせ、本ノードでは『パーミッションを追加しない』ことを明示的な制約として記述した。追加しないこと自体が設計判断であり、後続の変更で安易に MANAGE_EXTERNAL_STORAGE を足させないための歯止めとする",
    "geo.API_KEY と environment.mapsKey を別キーにするのは用途分離（ネイティブ SDK と JS SDK で利用元が異なる）が目的であり、値の相違は誤りではなく意図された設計である",
    "既存仕様書の appId/webDir/依存バージョン/FileProvider 等は実測値であり、今回の変更対象ではないため維持した",
    "UC11（センサーモード切替）に関しては、モードによる要求パーミッションの差異が実装実態として確認できていないため assumption / open_question に留め、Manifest 宣言集合そのものは変更しない"
  ]
}
```

以下、差分更新した仕様書本文です。

```markdown
# env.config.capacitor — Capacitor/Ionic/Angular/Android ビルド設定

## 概要
Capacitor で Web ソースを Android にラップするビルド設定と、Android 側のマニフェスト・パーミッション・Google Maps API キー埋め込み。

関連ユースケース: **UC06 運転診断の実行** / **UC11 センサーモード切替**

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
  - この差し替えにより、本ノードは [[env.config.environment]] を **reads** する（prod/dev で API エンドポイントや `mapsKey` が切り替わる）。

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

> 上記パーミッションは [[ui.opening.page]] の `checkPermission()` および [[infra.cordova.sensors]] のパーミッション要求リストと整合させること。
>
> 注意: `WRITE_EXTERNAL_STORAGE` の「Android 12 以降自動許可」想定は実機/OS バージョン別の実挙動と一致するか要検証（Infra/QA）。実挙動が異なる場合、ファイル書き込み系機能が失敗する可能性がある。

## 使用プラグインとパーミッションの対応

| 用途 | プラグイン | 必要な宣言パーミッション |
| --- | --- | --- |
| CAN データ受信（BLE） | `@capacitor-community/bluetooth-le` | `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` / `BLUETOOTH_ADVERTISE` |
| 位置情報取得 | `@capacitor/geolocation`, `@awesome-cordova-plugins/geolocation` | `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` |
| モーション/地磁気センサ | `@capacitor/motion`, `@awesome-cordova-plugins/device-motion`, `magnetometer` | 追加パーミッション不要 |
| ローカル保存（設定・KVS） | `@ionic/storage-angular`, `@awesome-cordova-plugins/sqlite` | 追加パーミッション不要（アプリ内部領域） |
| ファイル書き出し（ログ/データ） | ファイル入出力プラグイン（`@awesome-cordova-plugins/file` 系） | `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE`（**既存宣言のみ。追加なし**） |
| 通信 | HTTP クライアント | `INTERNET` |
| 画面消灯抑止 | `@awesome-cordova-plugins/insomnia` | 追加パーミッション不要 |

> `CAMERA` / `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` は現行機能での使用箇所が未確認（open question）。棚卸しの上、未使用であれば削除を検討する。

## ファイル書き出しとパーミッション方針（承認済み）

- 書き出しルートは **`{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/`** とする。
- **この書き出しのために AndroidManifest.xml へ新規パーミッションを追加しない。**
  既存の `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` 宣言と `requestLegacyExternalStorage=true` の組み合わせで運用する。
- `MANAGE_EXTERNAL_STORAGE` の付与、**MediaStore / SAF（Storage Access Framework）への移行は対象外**とする。
- ファイル採取手段は次を正とする。
  - Android のファイルアプリから `Documents/driving-score/...` を参照する
  - もしくは `adb pull /sdcard/Documents/driving-score/...`
- 本方針は以前の `{externalDataDirectory}` 配下運用案（`adb shell run-as` 前提）を撤回して確定したものであり、`run-as` を前提とした採取手順は採用しない。

> 前提リスク: `requestLegacyExternalStorage=true` は targetSdkVersion が 30 以上のビルドでは無効化されるため、`/sdcard/Documents` 配下への直接書き込みが成立しない可能性がある。targetSdkVersion の実値確認は Infra 側の未解決事項。

## ユースケース別の実行環境前提

### UC06 運転診断の実行
- BLE 接続（CAN モード時）: Bluetooth 有効 + `BLUETOOTH_*` のランタイム許可
- 位置情報: 位置情報サービス有効 + `ACCESS_FINE_LOCATION` のランタイム許可
- モーション/地磁気センサが利用可能な端末であること
- 診断中のログ/データ書き出し先は上記「ファイル書き出しとパーミッション方針」に従う

### UC11 センサーモード切替
- モード切替により実際に使用するプラグインが変化する（スマホ単独モードでは BLE を使用しない）。
- ただし **AndroidManifest.xml の宣言集合はモードによらず固定** であり、モードごとにマニフェストを切り替えることはしない。
- モード切替時に追加のランタイム許可要求が発生するか否かは、[[infra.cordova.sensors]] / [[ui.opening.page]] の要求リストと整合させて確認すること（未確定）。

## 関連ノード
- 参照元: [[env.app.bootstrap]]、[[env.build.installer]]
- 参照（reads）: [[env.config.environment]]
- 整合先: [[ui.opening.page]]、[[infra.cordova.sensors]]
```