<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:36:16 JST -->

# infra.cordova.sensors — 端末センサープラグイン群

## 概要
GPS・加速度計・ジャイロスコープ・磁力計・画面向き・スリープ抑止・SQLite・ランタイム権限を担う Cordova/Capacitor プラグイン群。DI 登録は [[env.app.bootstrap]]、実利用は [[middleware.sensor.service]] / [[db.user.repository]] / [[db.score.repository]] などにわたる。

本ノードは「どのプラグインから、どの単位系で値が入ってくるか」を確定させる層であり、値の解釈・スコア化は [[middleware.sensor.service]] 以降の責務とする。

## 真実源
- `src/data/package.json`
- `src/data/src/app/app.module.ts`
- `src/data/src/app/services/sensor.service.ts`
- `src/data/src/app/opening/opening.page.ts` — パーミッション要求

## プラグイン一覧
| プラグイン | 用途 | 呼び出し方法 |
|---|---|---|
| `@capacitor/geolocation` | GPS 監視 | `Geolocation.watchPosition({ maximumAge, timeout, enableHighAccuracy: true }, cb)` |
| `@capacitor/motion` | Web の `deviceorientation` イベント補完（実際は `window.addEventListener('devicemotion' / 'deviceorientationabsolute')` を使用） |
| `@awesome-cordova-plugins/device-motion` | DI に登録するが実利用は `window.addEventListener('devicemotion')` |
| `@awesome-cordova-plugins/magnetometer` | 磁力計 | `magnetometer.watchReadings().subscribe(cb)` |
| `@awesome-cordova-plugins/screen-orientation` | 画面向き固定・監視 | `screenOrientation.lock('portrait')` / `.unlock()` / `.onChange().subscribe()` |
| `@awesome-cordova-plugins/insomnia` | スリープ抑止 | `insomnia.keepAwake()` / `.allowSleepAgain()`（[[ui.driving.page]] のみ） |
| `@awesome-cordova-plugins/sqlite` | SQLite | `sqlite.create({ name: 'driving-score.db', location: 'default' })` |
| `@awesome-cordova-plugins/sqlite-porter` | SQLite の import/export（現状は依存追加のみ、コード呼び出しなし） |
| `@awesome-cordova-plugins/android-permissions` | ランタイム権限要求 | `androidPermissions.checkPermission()` / `.requestPermission()` |

## 購読チャネルと単位系
センサー値は W3C 仕様（DeviceMotion / DeviceOrientation / Geolocation API）に準拠した単位系でアプリに渡る。プラグイン層で単位変換は行わない。

| 購読チャネル | 取得元 | フィールド | 単位 |
|---|---|---|---|
| 加速度 | `window.addEventListener('devicemotion')` | `acceleration.{x,y,z}`（重力除去済み） | m/s² |
| 加速度（重力込み） | 同上 | `accelerationIncludingGravity.{x,y,z}` | m/s² |
| 角速度（ジャイロ） | 同上 | `rotationRate.{alpha,beta,gamma}` | deg/s |
| サンプリング間隔 | 同上 | `interval` | ms |
| 方位・傾き | `window.addEventListener('deviceorientationabsolute')` | `alpha` / `beta` / `gamma` | deg |
| 磁力 | `magnetometer.watchReadings()` | `x` / `y` / `z`（`magnitude` を含む） | µT |
| 位置 | `Geolocation.watchPosition()` | `coords.latitude` / `coords.longitude` | deg（WGS84） |
| 位置 | 同上 | `coords.accuracy` / `coords.altitude` | m |
| 速度 | 同上 | `coords.speed` | m/s |
| 進行方向 | 同上 | `coords.heading` | deg（真北基準・時計回り） |
| 時刻 | 同上 | `timestamp` | ms（UNIX epoch） |

- 速度を km/h として扱う箇所（表示・スコア判定）は m/s → km/h 換算を行う側の責務であり、本ノードは m/s のまま引き渡す。
- `coords.speed` / `coords.heading` は端末・測位状況により `null` になり得る。null 耐性は [[middleware.sensor.service]] 側で担保する。

## `acceleration.interval` に関する制約（変更禁止）
- `devicemotion` イベントの `interval` は **10（ms）を維持すること**。
- キャリブレーション判定は受信イベントごとに `calibrationTotalTime += interval` を積算し、**1100 に到達した時点で `calibration = true`** となる。
- `interval` を `0` にすると `calibrationTotalTime` が加算されず 1100 に到達しないため、**`calibration` が永久に false のまま**となり、運転診断（[[uc.UC06]]）が開始されない。
- サンプリング周期の変更提案は、`calibrationTotalTime` の閾値 1100 とセットでレビューすること（片方のみの変更は禁止）。

## 実機検証時の GPS 供給経路
- 通常経路：端末の測位（`enableHighAccuracy: true`）→ `Geolocation.watchPosition()` コールバック。
- 検証経路：[[qa.mockdata.gps.feeder]] が **adb 経由でテストプロバイダ `gps` に位置を注入**する。この場合もアプリ側は `watchPosition()` の同一コールバックで値を受信し、アプリコードに検証専用の分岐は存在しない。
- テストプロバイダ利用には端末の開発者オプション（モック位置情報アプリの許可 / debug ビルド）が前提となる。リリースビルドでの注入は前提としない。
- 注入値も通常値と同じく `lastGeolocation` および Ionic Storage の `geolocation-last-pos-key` に保存されるため、検証後の残留値に注意する。

## パーミッション要求フロー
[[ui.opening.page]] の `checkPermission()` が起動時に以下を **順次** 要求する（Android のみ実行）。
- `INTERNET`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`
- `CAMERA`
- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`

`WRITE_EXTERNAL_STORAGE` は Manifest 未宣言だが `requestPermission()` は呼ばれる（Android 12 以降では自動許可扱い）。

## 業務ルール
- センサー購読は [[ui.driving.page]] 起動中のみ（`sensor.service.start()` → 10ms 周期タイマ）。他ページに戻ると `sensor.service.stop()` で全解除。
- `runScoreLogic` フラグが false のとき、`devicemotion` / `deviceorientationabsolute` / magnetometer の受信ハンドラは早期リターンして、`lastAcceleration/Gyroscope/Magnetometer` を更新しない。GPS の `watchPosition` はフラグに関わらず値を保存する（`lastGeolocation` と Ionic Storage の `geolocation-last-pos-key`）。
- センサーモード切替（[[uc.UC11]]、smartphoneOnly / CAN 連携）は購読するプラグイン集合を変えない。差異は取得値の後段合成（`lastCanData` のゼロ埋めなど）で表現される。
- センサーログの書き出しは診断中のみ行い、出力先は `{externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/` とする（[[infra.file.export]] の決定に従う）。追加パーミッションは要求しない。

## 関連ノード
- 呼び出し元: [[middleware.sensor.service]]、[[ui.opening.page]]、[[ui.driving.page]]、[[db.user.repository]]、[[db.score.repository]]
- 検証: [[qa.mockdata.gps.feeder]]

```json
{
  "required_changes": [
    {"node": "infra.cordova.sensors", "entrypoint": "spec/infra/cordova-sensors.md", "description": "購読チャネルと単位系（W3C DeviceMotion/DeviceOrientation/Geolocation 準拠）の表を追加"},
    {"node": "infra.cordova.sensors", "entrypoint": "spec/infra/cordova-sensors.md", "description": "acceleration.interval=10 の維持制約と calibrationTotalTime 1100 到達条件を明記"},
    {"node": "infra.cordova.sensors", "entrypoint": "spec/infra/cordova-sensors.md", "description": "実機検証時に adb テストプロバイダ gps 経由でも GPS 値が同一コールバックへ供給される経路を追記"},
    {"node": "infra.cordova.sensors", "entrypoint": "spec/infra/cordova-sensors.md", "description": "センサーモード切替が購読プラグイン集合を変えない旨と、センサログ出力先（既存承認済ルート）を業務ルールに追記"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "coords.speed は m/s・rotationRate は deg/s で渡るため km/h 換算と null 耐性は sensor.service 側責務となる"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "calibration 判定が interval 積算に依存するため、サンプリング周期変更時は閾値1100とセットでレビューが必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "adb テストプロバイダ注入値も lastGeolocation/Ionic Storage に残留するため検証後のクリーンアップ手順が必要"},
    {"domain": "DB-agent", "severity": "could", "reason": "geolocation-last-pos-key に検証用のモック座標が保存され得る"}
  ],
  "requirements_context": "infra.cordova.sensors は UC06(運転診断の実行) と UC11(センサーモード切替) を支える端末センサー層の仕様。加速度・ジャイロは window.addEventListener('devicemotion')、方位・傾きは 'deviceorientationabsolute'、磁力計は @awesome-cordova-plugins/magnetometer の watchReadings()、GPS は @capacitor/geolocation の watchPosition({maximumAge, timeout, enableHighAccuracy:true}) で購読する。単位系は W3C 仕様準拠で、acceleration/accelerationIncludingGravity は m/s²、rotationRate は deg/s、devicemotion の interval は ms、orientation の alpha/beta/gamma は deg、磁力は µT、位置は WGS84 の deg、accuracy/altitude は m、speed は m/s、heading は真北基準 deg、timestamp は UNIX epoch ms。プラグイン層で単位変換は行わず、km/h 換算や null 耐性は middleware 側責務。acceleration.interval は 10 を維持しなければならない。キャリブレーションはイベントごとに calibrationTotalTime += interval を積算し 1100 到達で calibration=true となるため、interval を 0 にすると永久に false となり診断が開始できない。周期変更は閾値 1100 とセットでレビューする。センサー購読は ui.driving.page 起動中のみで、離脱時は sensor.service.stop() で全解除。runScoreLogic=false の間は devicemotion/deviceorientationabsolute/magnetometer ハンドラは早期リターンし last* を更新しないが、GPS watchPosition はフラグに関わらず lastGeolocation と Ionic Storage の geolocation-last-pos-key を更新する。実機検証時の GPS は qa.mockdata.gps.feeder が adb 経由でテストプロバイダ 'gps' に注入する経路でも供給され、アプリ側は同一コールバックで受信する（検証専用分岐は無し）。テストプロバイダ利用は開発者オプション/モック位置情報アプリ許可・debug ビルドを前提とし、注入値も通常値と同じ保存先に残る。センサーモード切替（smartphoneOnly / CAN）は購読プラグイン集合を変えず、差異は lastCanData のゼロ埋め等の後段合成で表現される。パーミッションは ui.opening.page の checkPermission() が Android のみで INTERNET/ACCESS_FINE_LOCATION/ACCESS_COARSE_LOCATION/CAMERA/RECORD_AUDIO/MODIFY_AUDIO_SETTINGS/READ_EXTERNAL_STORAGE/WRITE_EXTERNAL_STORAGE/BLUETOOTH_SCAN/BLUETOOTH_CONNECT/BLUETOOTH_ADVERTISE を順次要求し、WRITE_EXTERNAL_STORAGE は Manifest 未宣言のまま requestPermission() が呼ばれる。センサログ書き出しは診断中のみで、出力先は既承認の {externalRootDirectory}/Documents/driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ とし追加パーミッションは要求しない。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "devicemotion の interval は 10ms を維持する",
      "statement": "devicemotion イベントの acceleration.interval は 10（ms）でなければならない",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "calibration は calibrationTotalTime が 1100 に到達して true になる",
      "statement": "受信イベントごとに calibrationTotalTime += interval が積算され、1100 に到達した時点で calibration が true になる",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "interval=0 では calibration が永久 false になる",
      "statement": "interval を 0 に設定すると calibrationTotalTime が 1100 に到達せず calibration が永久に false となり運転診断が開始されない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "加速度・角速度は W3C DeviceMotion の単位系で渡る",
      "statement": "acceleration および accelerationIncludingGravity は m/s²、rotationRate は deg/s、interval は ms で渡る",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "位置情報は W3C Geolocation の単位系で渡る",
      "statement": "coords.latitude/longitude は WGS84 の度、accuracy/altitude は m、speed は m/s、heading は真北基準の度、timestamp は UNIX epoch ミリ秒である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "方位・傾きと磁力の単位",
      "statement": "deviceorientationabsolute の alpha/beta/gamma は度、magnetometer の x/y/z は µT である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "プラグイン層で単位変換を行わない",
      "statement": "センサープラグイン層は取得値の単位変換を行わず、W3C 準拠の単位のまま上位層へ引き渡す",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "GPS 監視は enableHighAccuracy: true で購読する",
      "statement": "Geolocation.watchPosition は maximumAge / timeout / enableHighAccuracy: true のオプションで購読される",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "実機検証時の GPS は adb テストプロバイダ経由でも供給される",
      "statement": "実機検証時、GPS 値は qa.mockdata.gps.feeder が adb 経由でテストプロバイダ 'gps' に注入する経路でも供給され、アプリは同一の watchPosition コールバックで受信する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "テストプロバイダ注入は debug/開発者オプション前提",
      "statement": "adb テストプロバイダによる位置注入は端末の開発者オプション（モック位置情報アプリ許可）および debug ビルドを前提とし、リリースビルドでは前提としない",
      "status": "assumption"
    },
    {
      "type": "state_rule",
      "title": "GPS 値は runScoreLogic フラグに関わらず保存される",
      "statement": "watchPosition の受信値は runScoreLogic の値に関わらず lastGeolocation と Ionic Storage の geolocation-last-pos-key に保存される",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "モーション系ハンドラは runScoreLogic=false で早期リターンする",
      "statement": "runScoreLogic が false のとき devicemotion / deviceorientationabsolute / magnetometer のハンドラは早期リターンし lastAcceleration/Gyroscope/Magnetometer を更新しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "センサー購読は運転診断画面の起動中のみ",
      "statement": "センサー購読は ui.driving.page 起動中のみ行われ、離脱時に sensor.service.stop() で全解除される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "センサーモード切替は購読プラグイン集合を変更しない",
      "statement": "センサーモード切替（smartphoneOnly / CAN 連携）は購読するプラグイン集合を変えず、差異は後段の値合成で表現される",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "起動時に Android ランタイム権限を順次要求する",
      "statement": "ui.opening.page の checkPermission() は Android のみで INTERNET・ACCESS_FINE_LOCATION・ACCESS_COARSE_LOCATION・CAMERA・RECORD_AUDIO・MODIFY_AUDIO_SETTINGS・READ_EXTERNAL_STORAGE・WRITE_EXTERNAL_STORAGE・BLUETOOTH_SCAN・BLUETOOTH_CONNECT・BLUETOOTH_ADVERTISE を順次要求する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "センサログの書き出しに追加パーミッションを要求しない",
      "statement": "センサログ書き出しは診断中のみ行われ、{externalRootDirectory}/Documents/driving-score/ 配下を出力先として追加パーミッションを要求しない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "coords.speed / coords.heading が null になった場合の扱い（前回値保持か 0 扱いか）が本ノードだけでは確定できない。Middleware（sensor.service）判断が必要で、決まらないと診断値の欠損時挙動が不定になる。",
    "devicemotion の interval が端末実装により 10 以外で通知される場合（Android/WebView 依存）に calibration 到達時間がずれる可能性。実機での実測値が未確認で、QA/Infra 双方の検証が必要。",
    "adb テストプロバイダ注入で残った geolocation-last-pos-key の残留値をリセットする運用手順が未定義。QA/DB 判断が必要で、決まらないと検証後の初期表示が誤った座標になる。",
    "モック位置注入をリリースビルドで禁止する（あるいは技術的に不可である）ことの明文化が未確定。セキュリティ観点で Infra/QA 判断が必要。",
    "magnetometer の watchReadings のサンプリング周期がプラグイン既定値か明示指定かが未確認。決まらないと磁力系指標の時間分解能が不定になる。"
  ],
  "rationale_notes": [
    "本ノードは『どのプラグインからどの単位で値が来るか』の確定に責務を限定し、値の解釈・スコア化は middleware 側に置く。単位変換をプラグイン層に持ち込まないことで、W3C 準拠の生値をログ・検証で再現できる状態を維持する。",
    "interval=10 の維持を明示的な制約として書いたのは、周期最適化の際に calibrationTotalTime=1100 の閾値と切り離して変更されると diagnose 開始不能という致命的な退行になるため。両者はセットでレビューする旨も併記した。",
    "検証用の GPS 注入をアプリ側の分岐で実現していない（テストプロバイダ経由で OS レイヤに注入する）ことは、本番コードに検証コードを混入させないという設計意図として重要なので記載した。",
    "センサログ出力先は既承認の design_decision（Documents 配下へ戻す決定）に整合させ、追加パーミッションを要求しない方針を維持した。"
  ]
}
```