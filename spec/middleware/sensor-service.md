<!-- 作成: 2026-09-10 17:32:26 JST | 更新: 2026-09-18 19:02:11 JST -->

# SensorService（middleware.sensor.service）

## 1. 目的とスコープ

SensorService は、運転診断に必要な各種センサー入力を単一の集約点でまとめ、上位の診断・スコアロジックへ一定周期で供給するミドルウェア層のサービスである。

対象センサー／入力源:

| 名称 | 内部保持値 | 取得元 |
|---|---|---|
| GPS（位置情報） | `lastGeolocation` | Geolocation / DemoData |
| 加速度 | `lastAcceleration` | DeviceMotion / DemoData |
| ジャイロ・方位 | `lastGyroscope` | DeviceOrientation / DemoData |
| 磁力計 | `lastMagnetometer` | Magnetometer / DemoData |
| CAN データ | `lastCanData` | BLE notify（`ble.ts` 経由） / DemoData |

利用ユースケース: UC06（運転診断の実行）、UC11（センサーモード切替）、UC12（編集とデモ再生）。

本ノードの責務は「入力の購読」「10ms 周期の集約」「モード別の入力妥当性判定（ゲート）」「下流の null 安全化（ゼロ値補完）」「キャリブレーション状態の管理」「コールバック通知」である。スコア計算そのもの（score-logic）は本ノードの責務外である。

---

## 2. データソースの切替（デモ再生 / 実センサー）

### 2.1 判定条件

デモ再生と実センサー購読の切替は **`DemoData.getSensorLogDataSize()` の戻り値のみ** で判定する。

| 条件 | 動作 |
|---|---|
| `DemoData.getSensorLogDataSize() > 0` | DemoData のセンサログを再生する |
| `DemoData.getSensorLogDataSize() === 0` | 実センサーを購読する |

- この判定に **Android / 非 Android のプラットフォーム判定を条件として含めない**。
- 非 Android 環境であっても、センサログが 1 件以上あれば DemoData 再生が行われる。
- 実装コメントは上記条件と一致した記述に保つ。過去の「非 Android 時のみデモ再生」というコメント表現は誤りであり、是正対象とする。

### 2.2 非 Android 時の位置情報保存

非 Android 時、`DemoData.getSensorLogData()` から取得した `geolocation` を Ionic Storage の `geolocation-last-pos-key` に保存する。

### 2.3 `geolocation.json` の扱い（注記）

`infra.assets.geolocation`（`geolocation.json`）は **現状どのモジュールからもロードされていない死にアセット** である。SensorService もこれを直接参照しない。デモ再生時の位置情報ソースは DemoData であり、`geolocation.json` ではない。

したがって本ノードの依存関係として扱わず、注記として記録する（将来利用予定の有無は infra ドメインの判断事項）。

---

## 3. センサーモード

SensorService が扱うセンサーモードは以下の 3 種類である。

- `smartphoneOnly`
- `canDataOnly`
- `combination`

本仕様の改修においてこの 3 分岐構成は変更しない。

---

## 4. 10ms 集約処理

### 4.1 処理順序（厳守）

10ms 周期の集約コールバックは以下の順序で処理する。順序の入れ替えは許されない。

1. **モード別ゲート評価**（`middleware.sensor.manager` #28 の条件）
   必須センサーが全て非 null であることを確認する。不成立ならこの周期の処理を打ち切る。
2. **ゼロ値補完**
   ゲート対象外かつ `null` / `undefined` の `lastXxx` に構造化ゼロ値を代入する。
3. **インクリメント処理**
   `lastGeolocation.repeat++` などのカウンタ更新を行う。
4. **キャリブレーション処理**
5. **コールバック呼び出し**（診断・スコアロジックへの通知）

> **制約**: ゲート評価より前にゼロ値を代入してはならない。必須センサーの `null` をゼロ値が隠蔽し、入力が揃っていないまま診断が成立してしまうため。

### 4.2 モード別必須センサー（ゲート条件）

全モードで GPS（`geolocation`）が必須である。

| モード | 必須センサー |
|---|---|
| `canDataOnly` | geolocation + canData |
| `smartphoneOnly` | geolocation + acceleration + gyroscope（方位） + magnetometer |
| `combination` | geolocation + acceleration + gyroscope + magnetometer + canData |

この定義は `middleware.sensor.manager` #28 のゲート条件と同一でなければならない。

### 4.3 ゼロ値補完の対象

| モード | ゼロ値補完対象 |
|---|---|
| `canDataOnly` | `lastAcceleration` / `lastGyroscope` / `lastMagnetometer` |
| `smartphoneOnly` | `lastCanData` |
| `combination` | なし（ゲート対象外センサーが存在しない） |

- 補完は **ゲート対象外かつ値が `null` または `undefined`** のものに限る。既存の実測値を上書きしてはならない。
- `geolocation` は全モードで必須センサーであるため、**ゼロ値補完の対象外** とする。

### 4.4 構造化ゼロ値の定義

```json
{
  "acceleration": {
    "accelerationIncludingGravity": { "x": 0, "y": 0, "z": 0 },
    "rotationRate": { "beta": 0, "gamma": 0, "alpha": 0 },
    "interval": 10,
    "repeat": -1
  },
  "gyroscope": { "beta": 0, "gamma": 0, "alpha": 0, "repeat": -1 },
  "magnetometer": { "x": 0, "y": 0, "z": 0, "repeat": -1 },
  "canData": {
    "vehicleSpeed": 0,
    "longAcc": 0,
    "latAcc": 0,
    "frontDistance": 0,
    "lateralDistance": 0,
    "steeringAngle": 0,
    "accelPedalPosition": 0,
    "brakePressure": 0,
    "brakeSwitch": 0,
    "shiftIndication": 0,
    "turnSignal": 0,
    "repeat": -1
  }
}
```

- `repeat` は **補完値であることを示すセンチネル値 `-1`** とする。
- `acceleration.interval` は **`10`** とし、**`0` にしてはならない**。
  `interval = 0` の場合 `calibrationTotalTime` が `1100` に到達せず、`calibration` が永久に `false` となり診断が開始しない。

---

## 5. BLE 受信ログ

`sensor.service.ts` の BLE 受信コールバック直後（現行 L394）において、以下を **毎回・無条件に** 出力する。

```ts
self.logService.debug('[DrivingScore][SensorService]', self.lastCanData);
```

- サンプリング・条件分岐は設けない（受信欠落・順序異常の解析にはサンプリングログでは不十分なため、例外的に無条件出力を許可する）。
- 変更対象は `sensor.service.ts` のみ。`ble.ts`、送信側、`LogService` 本体、エミュレータ A / B は変更しない。
- 書き出し先は `{externalRootDirectory}/Documents/driving-score/debug-log/` 配下（既存仕様のまま）。

---

## 6. 実装実態の記録：smartphoneOnly の未算出スコア

`sensor.service.ts:463-466` の `smartphoneOnly` における `lastCanData` ゼロ埋め（`shiftIndication = 0` 等）により、以下の連鎖が発生する。

1. CAN 値が常時ゼロのため、CAN 版スコアロジックの全指標が発火しない。
2. 指標が発火しないため `scoreLogicFunction.txt` L871-874 が `null` を返す。
3. `scoreList` が空となり、スコアは **全項目 100 の未算出状態** となる。

本仕様書はこれを **実装実態として記録するのみ** であり、是正の是非は記述しない（評価モデルの是非は score-logic ドメインおよび打ち合わせ判断に委ねる）。

---

## 7. 非変更範囲

以下は本改修の対象外であり、変更しない。

- モード別ゲート条件そのもの
- センサーリスナーの購読処理
- `score-logic`
- `DemoData.convertOldData`
- 正準モック 6 ファイル
- センサーモード 3 分岐（`smartphoneOnly` / `canDataOnly` / `combination`）の構成
- 10ms 集約周期そのもの

---

## 8. 2026 年度改修要求との関係（参照）

2026 年度の改修要求 5 本（日産自動車提供資料に基づく）のうち、本ノードに関係するのは **④ BLE 通信の安定化** である。

- BLE 受信の不安定さに対する「シーケンス処理ではなくパラレル処理にすれば改善するのではないか」という先方指摘は **仮説であり確定した原因・対策ではない**。実機で確認しながら調整する領域であり、本仕様では設計判断として確定させない。
- 再現・調整に必要なテスト用ナビ端末は先方提供予定だが、提供時期は未定。
- 本ノードの当面の対応は §5 の BLE 受信ログ無条件出力による観測性確保に留める。

また、標識認識・先行車検知の追加に伴い CAN ペイロード（現行 12 バイト固定長、`PAYLOAD_LEN = 12`、offset 5-6 のみ u16 BE）のバイト長・割り当てが変更される可能性があるが、現時点で未確定である。変更された場合は `lastCanData` のデコード仕様および `qa.mockdata.ble.emulator` の 12 バイト前提が影響を受ける。

開発スケジュールは 2026 年 11 月末完了目標（12 月から高齢者を招いた実験開始）である。

---

## 9. 依存関係

| 種別 | 対象 | 内容 |
|---|---|---|
| 依存 | `middleware.sensor.manager` | モード別ゲート条件（#28）の定義元 |
| 依存 | `infra.ble` (`ble.ts`) | CAN データの notify 受信 |
| 依存 | `middleware.demo.data` (`DemoData`) | センサログ再生、件数判定 |
| 依存 | `middleware.log.service` | debug ログ出力 |
| 依存 | Ionic Storage | `geolocation-last-pos-key` の保存 |
| 下流 | `score-logic` | 集約結果の消費（本ノードからは変更しない） |
| 注記 | `infra.assets.geolocation` (`geolocation.json`) | 現状どこからもロードされない死にアセット。本ノードは参照しない |

```json
{
  "required_changes": [
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "デモ/実機の切替条件を『非Android判定』ではなく DemoData.getSensorLogDataSize()>0 に統一して記述し、実装とコメントの不一致を解消する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "infra.assets.geolocation(geolocation.json) を依存ではなく『未参照の死にアセット』として注記に降格する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "10ms集約の処理順序を『モード別ゲート評価 → ゼロ値補完 → repeat++ 等インクリメント → キャリブレーション → コールバック』として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "モード別必須センサー（全モードGPS必須、canDataOnly=GPS+canData、smartphoneOnly=GPS+加速度+方位+磁力計、combination=両方）を明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "ゲート対象外センサーへの構造化ゼロ値（acceleration/gyroscope/magnetometer/canData）と repeat=-1、interval=10 の固定値を仕様として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "acceleration.interval を 0 にしてはならない制約（calibrationTotalTime が 1100 に到達せず calibration が永久 false になる）を制約として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "smartphoneOnly の lastCanData ゼロ埋め(sensor.service.ts:463-466)による全項目100の未算出を実装実態として記録する（是正是非は記述しない）"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "BLE 受信コールバック直後（現行 L394）の logService.debug を毎回・無条件に出力する仕様として明記する（ble.ts・送信側・LogService本体・エミュレータは対象外）"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "2026年度改修要求④BLE通信の安定化との関係（パラレル化は仮説、テスト端末時期未定、CANペイロード長未確定、11月末完了目標）を参照章として追記する"}
  ],
  "suggested_impacts": [
    {"domain": "infra-agent", "severity": "should", "reason": "infra.assets.geolocation(geolocation.json) が現状どのモジュールからもロードされない死にアセットである点を infra 側仕様でも整合させる必要がある"},
    {"domain": "middleware-agent", "severity": "must", "reason": "モード別必須センサー定義は middleware.sensor.manager #28 のゲート条件と同一である必要があり、両ノードの記述を一致させる必要がある"},
    {"domain": "qa-agent", "severity": "must", "reason": "BLE 受信ごとの無条件 debug ログにより 10ms オーダーでログ量が増加し、debug-log の容量・ローテーション・フラッシュ挙動の確認が必要"},
    {"domain": "qa-agent", "severity": "should", "reason": "smartphoneOnly では CAN 版指標が未発火で全項目 100 の未算出となるため、期待値としてのスコア確認手順が影響を受ける"},
    {"domain": "qa-agent", "severity": "should", "reason": "CAN ペイロード長が 12 バイトから変更された場合 qa.mockdata.ble.emulator の 12 バイト前提（short11/long13 の --inject-invalid 含む）と正準モック符号化規則が影響を受ける"},
    {"domain": "ui-agent", "severity": "could", "reason": "smartphoneOnly 実行時の診断結果が全項目 100（未算出）で表示される実装実態があり、結果画面の解釈に影響する"}
  ],
  "requirements_context": "【SensorService の責務】SensorService は GPS(geolocation)/加速度(acceleration)/ジャイロ・方位(gyroscope)/磁力計(magnetometer)/BLE 経由 CAN(canData) を購読し、10ms 周期で最新値(lastXxx)を集約し、モード別ゲート評価・ゼロ値補完・インクリメント・キャリブレーションを経て上位（診断・スコアロジック）のコールバックへ渡す。UC06(運転診断の実行)、UC11(センサーモード切替)、UC12(編集とデモ再生)から利用される。スコア計算そのもの(score-logic)は責務外。\n\n【データソース切替（デモ/実機）】デモ再生と実センサー購読の切替判定は DemoData.getSensorLogDataSize() の戻り値のみで行う。1 件以上（>0）のときは DemoData のセンサログを再生し、0 件のときは実センサーを購読する。判定は Android/非 Android のプラットフォーム判定を条件に含めず、非 Android 環境でも同じ条件で DemoData 再生が行われる。実装コメントはこの条件に一致させる（過去の『非 Android 時のみデモ再生』という記述は誤りとして正す）。非 Android 時、DemoData.getSensorLogData() の geolocation は Ionic Storage の geolocation-last-pos-key に保存される。\n\n【geolocation.json（infra.assets.geolocation）】geolocation.json は現状どのモジュールからもロードされない死にアセットであり、SensorService も直接参照しない。デモ再生時の位置情報ソースは DemoData であって geolocation.json ではない。依存関係としては扱わず、注記として残す。将来利用予定の有無は infra ドメイン判断。\n\n【センサーモード】smartphoneOnly / canDataOnly / combination の 3 種類。本改修で 3 分岐構成は変更しない。\n\n【10ms 集約の処理順序】(1) モード別ゲート（middleware.sensor.manager #28）を最初に評価し、不成立ならその周期の処理を打ち切る。(2) ゲート成功後、かつ lastGeolocation.repeat++ 等のインクリメント処理より前に、ゲート対象外かつ null/undefined の lastXxx へ構造化ゼロ値を代入する。(3) インクリメント、(4) キャリブレーション、(5) コールバック呼び出しを行う。ゲート評価前にゼロ値を代入してはならない（必須センサーの null を隠蔽し、入力未充足のまま診断が成立するため）。\n\n【モード別必須センサー（ゲート条件）】全モードで GPS(geolocation) が必須。canDataOnly は GPS + canData。smartphoneOnly は GPS + 加速度 + 方位(gyroscope) + 磁力計。combination は GPS + 加速度 + 方位 + 磁力計 + canData。必須センサーが非 null であることをゲートで確認する。本定義は middleware.sensor.manager #28 と同一でなければならない。\n\n【ゼロ値補完対象】canDataOnly では lastAcceleration / lastGyroscope / lastMagnetometer を補完する。smartphoneOnly では lastCanData を補完する。combination では補完しない。補完はゲート対象外かつ null/undefined のものに限り、既存実測値を上書きしない。geolocation は全モード必須のためゼロ埋め対象外。\n\n【構造化ゼロ値の定義】acceleration = {accelerationIncludingGravity:{x:0,y:0,z:0}, rotationRate:{beta:0,gamma:0,alpha:0}, interval:10, repeat:-1}、gyroscope = {beta:0,gamma:0,alpha:0,repeat:-1}、magnetometer = {x:0,y:0,z:0,repeat:-1}、canData = {vehicleSpeed:0,longAcc:0,latAcc:0,frontDistance:0,lateralDistance:0,steeringAngle:0,accelPedalPosition:0,brakePressure:0,brakeSwitch:0,shiftIndication:0,turnSignal:0,repeat:-1}。repeat は補完値であることを示すセンチネルとして -1。acceleration.interval は 10 とし 0 にしてはならない（interval=0 では calibrationTotalTime が 1100 に到達せず calibration が永久に false となり診断が開始しない）。\n\n【BLE 受信ログ】BLE 受信コールバック直後（現行 sensor.service.ts L394）の self.logService.debug('[DrivingScore][SensorService]', self.lastCanData) を毎回・無条件に有効化する（コメントアウトを外す）。サンプリング・条件分岐は設けない。変更対象は sensor.service.ts のみで、ble.ts、送信側、LogService 本体、エミュレータ A/B は変更しない。デバッグログ書き出し先は {externalRootDirectory}/Documents/driving-score/debug-log/ 配下（既存仕様のまま）。\n\n【smartphoneOnly の未算出実装実態】sensor.service.ts:463-466 の smartphoneOnly における lastCanData ゼロ埋め（shiftIndication=0 等）により CAN 版スコアロジックの全指標が発火せず、scoreLogicFunction.txt L871-874 が null を返し、scoreList が空となり、全項目 100 の未算出状態となる。本仕様書では実装実態として記録するのみで、是正の是非は記述しない。\n\n【2026 年度改修要求との関係】2026 年度改修要求は日産自動車提供の 2 資料（『運転機能チェックアプリの一次仕様』2026-08-04 全 14 枚、メイサンソフト『要求仕様確認』2026-09-17 全 8 枚）に基づく 5 本（①診断開始前画面の前回結果表示 ②タブ切り替えの追加 ③採点スコアのレーダーチャート表示 ④BLE 通信の安定化 ⑤ヒヤリ発生時の録画データサイズ改善）。本ノードに関係するのは ④。BLE 受信不安定に対する『パラレル処理化で改善するのではないか』という先方指摘は仮説であり確定した原因・対策ではないため、設計判断として確定させない。再現・調整用テスト端末は先方提供予定だが時期未定。標識認識・先行車検知の追加により CAN ペイロード（現行 12 バイト固定長、PAYLOAD_LEN=12、offset 5-6 のみ u16 BE）のバイト長・割り当てが変更される可能性があるが未確定で、変更時は lastCanData デコード仕様と qa.mockdata.ble.emulator の 12 バイト前提が影響を受ける。開発スケジュールは 2026 年 11 月末完了目標（12 月から高齢者を招いた実験開始）。\n\n【非変更範囲】ゲート条件そのもの、センサーリスナーの購読処理、score-logic、DemoData.convertOldData、正準モック 6 ファイル、センサーモード 3 分岐構成、10ms 周期そのものは変更しない。",
  "fact_candidates": [
    {
      "type": "business_rule",
      "title": "デモ再生の判定は DemoData.getSensorLogDataSize()>0 である",
      "statement": "SensorService は DemoData.getSensorLogDataSize() が 1 以上のときデモセンサログを再生する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "センサログ 0 件のときは実センサーを購読する",
      "statement": "SensorService は DemoData.getSensorLogDataSize() が 0 のとき実センサーを購読する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "デモ/実機切替はプラットフォーム判定に依存しない",
      "statement": "SensorService のデモ/実機切替判定は Android/非 Android のプラットフォーム判定を条件に含めない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "非 Android でも DemoData 再生が行われる",
      "statement": "非 Android 環境においても DemoData.getSensorLogDataSize()>0 であれば DemoData のセンサログが再生される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "実装とコメントの記述を一致させる",
      "statement": "sensor.service.ts のデモ/実機切替に関するコメントは DemoData.getSensorLogDataSize()>0 という実装条件と一致した記述にする",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "geolocation.json はどのモジュールからもロードされない",
      "statement": "infra.assets.geolocation(geolocation.json) は現状どのモジュールからもロードされておらず死にアセットである",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "SensorService は geolocation.json を直接参照しない",
      "statement": "SensorService はデモ再生において geolocation.json を直接ロードせず DemoData 経由のデータのみを用いる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "非 Android 時に geolocation を Ionic Storage へ保存する",
      "statement": "SensorService は非 Android 時に DemoData.getSensorLogData() の geolocation を Ionic Storage の geolocation-last-pos-key に保存する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "10ms 周期でセンサー値を集約する",
      "statement": "SensorService は 10ms 周期で lastXxx のセンサー値を集約しキャリブレーション後にコールバックへ渡す",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "モード別ゲートを最初に評価する",
      "statement": "SensorService の 10ms 集約コールバックはモード別ゲート（必須センサーが非 null）を最初に評価する",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "ゲート不成立時はその周期の処理を打ち切る",
      "statement": "モード別ゲートが不成立の場合、その 10ms 周期のゼロ値補完・インクリメント・キャリブレーション・コールバックは実行しない",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "全モードで GPS が必須である",
      "statement": "SensorService のモード別ゲートは全センサーモードで geolocation を必須センサーとする",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "canDataOnly の必須センサーは GPS と canData である",
      "statement": "canDataOnly モードのゲートは geolocation と canData が非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "smartphoneOnly の必須センサーは GPS/加速度/方位/磁力計である",
      "statement": "smartphoneOnly モードのゲートは geolocation・acceleration・gyroscope(方位)・magnetometer が非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "combination の必須センサーは両系統すべてである",
      "statement": "combination モードのゲートは geolocation・acceleration・gyroscope・magnetometer・canData のすべてが非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "モード別必須センサー定義は sensor.manager #28 と同一である",
      "statement": "SensorService のモード別必須センサー定義は middleware.sensor.manager #28 のゲート条件と一致していなければならない",
      "status": "candidate"
    },
    {
      "type": "state_rule",
      "title": "ゼロ値補完はゲート成功後に行う",
      "statement": "ゲート対象外センサーへのゼロ値代入はモード別ゲートが成功した後に実行する",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "ゼロ値補完は repeat インクリメントより前に行う",
      "statement": "ゲート対象外センサーへのゼロ値代入は lastGeolocation.repeat++ 等のインクリメント処理より前に実行する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ゲート前にゼロ値を代入してはならない",
      "statement": "モード別ゲート評価より前にゲート対象外センサーへゼロ値を代入してはならない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "ゼロ値補完対象は null/undefined のみである",
      "statement": "ゼロ値代入はゲート対象外かつ値が null または undefined の lastXxx に対してのみ行う",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "canDataOnly では加速度/ジャイロ/磁力計をゼロ値で埋める",
      "statement": "canDataOnly モードでは lastAcceleration・lastGyroscope・lastMagnetometer にゼロ値を代入する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "smartphoneOnly では canData をゼロ値で埋める",
      "statement": "smartphoneOnly モードでは lastCanData にゼロ値を代入する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "combination ではゼロ値補完を行わない",
      "statement": "combination モードではゲート対象外センサーが存在しないためゼロ値代入を行わない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "geolocation はゼロ埋めしない",
      "statement": "geolocation は全モードで必須センサーであるためゼロ値代入の対象外とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "acceleration のゼロ値定義",
      "statement": "acceleration のゼロ値は {accelerationIncludingGravity:{x:0,y:0,z:0}, rotationRate:{beta:0,gamma:0,alpha:0}, interval:10, repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "gyroscope のゼロ値定義",
      "statement": "gyroscope のゼロ値は {beta:0,gamma:0,alpha:0,repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "magnetometer のゼロ値定義",
      "statement": "magnetometer のゼロ値は {x:0,y:0,z:0,repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "canData のゼロ値定義",
      "statement": "canData のゼロ値は vehicleSpeed/longAcc/latAcc/frontDistance/lateralDistance/steeringAngle/accelPedalPosition/brakePressure/brakeSwitch/shiftIndication/turnSignal をすべて 0、repeat を -1 とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "ゼロ値の repeat は -1 である",
      "statement": "ゼロ値代入された各センサー値の repeat は -1 とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "acceleration.interval を 0 にしてはならない",
      "statement": "ゼロ値の acceleration.interval は 10 とし 0 にしてはならない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "interval が 0 だとキャリブレーションが完了しない",
      "statement": "acceleration.interval が 0 の場合 calibrationTotalTime が 1100 に到達せず calibration が永久に false となる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "smartphoneOnly の lastCanData ゼロ埋め箇所",
      "statement": "sensor.service.ts:463-466 において smartphoneOnly 時に lastCanData が shiftIndication=0 等のゼロ値で埋められる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "ゼロ埋めにより CAN 版指標が発火しない",
      "statement": "lastCanData のゼロ値により CAN 版スコアロジックの全指標が発火しない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "指標未発火時 scoreLogicFunction は null を返す",
      "statement": "指標が発火しない場合 scoreLogicFunction.txt L871-874 は null を返す",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "scoreList 空により全項目 100 の未算出となる",
      "statement": "scoreList が空の場合スコアは全項目 100 の未算出状態となる",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "未算出 100 の是正是非は本仕様に記述しない",
      "statement": "smartphoneOnly の未算出 100 は実装実態として記録し是正の是非は本仕様書に記述しない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "BLE 受信直後の debug ログを無条件で出力する",
      "statement": "sensor.service.ts の BLE 受信コールバック直後（現行 L394）で logService.debug('[DrivingScore][SensorService]', lastCanData) を毎回・無条件に出力する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE ログ有効化に伴う他モジュール変更は行わない",
      "statement": "BLE 受信ログの有効化に際し ble.ts・送信側・LogService 本体・エミュレータは変更しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE ログにサンプリングや条件分岐を設けない",
      "statement": "BLE 受信ログにサンプリング・条件分岐を設けず毎回無条件に出力する",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "デバッグログの書き出し先",
      "statement": "デバッグログは {externalRootDirectory}/Documents/driving-score/debug-log/ 配下に書き出される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "本変更でゲート条件・購読処理・score-logic は変更しない",
      "statement": "ゲート条件・センサーリスナー購読・score-logic・DemoData.convertOldData・正準モック 6 ファイルは変更しない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "センサーモードは 3 種類である",
      "statement": "SensorService が扱うセンサーモードは smartphoneOnly / canDataOnly / combination の 3 種類である",
      "status": "approved"
    },
    {
      "type": "assumption",
      "title": "BLE のパラレル処理化は仮説である",
      "statement": "BLE 受信不安定に対するパラレル処理化は先方指摘に基づく仮説であり、確定した原因・対策として設計判断に採用しない",
      "status": "assumption"
    },
    {
      "type": "constraint",
      "title": "開発完了目標は 2026 年 11 月末である",
      "statement": "本ノードを含むアプリ改修は 2026 年 11 月末までの完了を目標とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "現行 CAN ペイロードは 12 バイト固定長である",
      "statement": "現行の BLE notify ペイロードは PAYLOAD_LEN=12 の固定長で offset 5-6 のみ u16 BE である",
      "status": "approved"
    }
  ],
  "open_questions": [
    "Android 実機かつ DemoData.getSensorLogDataSize()>0 の場合にデモ再生が優先される挙動が意図どおりか未確定。実装条件を正とすると実機でセンサログが残存している間は実センサーが使われないため UC06(運転診断)の実機動作に影響する。DemoData のクリア責務（middleware / UI 設定・編集画面）と併せた判断が必要",
    "DemoData のセンサログ件数が診断中に 0 から 1 以上へ変化した場合（記録中の追記）に切替判定を再評価するのか、開始時点の一度のみ評価するのかが未確定。センサー購読のライフサイクル仕様に影響する",
    "geolocation.json を今後利用予定があるのか（削除対象か将来接続予定か）は infra ドメインの判断が必要。放置すると死にアセットの扱いが宙ぶらりんになる",
    "smartphoneOnly の必須センサーに挙げられた『方位』が gyroscope（deviceorientation 由来）と magnetometer のどちらを指すか命名レベルで曖昧。ゲート条件の一致確認のため middleware.sensor.manager #28 の定義との突合が必要",
    "BLE 受信ごとの無条件 debug ログにより debug-log の出力量が増大するが、許容上限・ローテーション有無・本番リリース時の扱いが未確定。infra(ファイル書き出し)/QA(採取手順)の判断が必要",
    "smartphoneOnly で全項目 100 が返る未算出状態を UI がどう表示・区別するか（未算出であることの表現）は UI ドメインの判断が必要。是正是非は本ノードでは扱わない",
    "標識認識・先行車検知の追加により CAN ペイロードのバイト長・割り当てが変更されるかが未確定。変更された場合 lastCanData のデコード仕様・ゼロ値定義のフィールド構成・qa.mockdata.ble.emulator の 12 バイト前提が影響を受けるため、先方の CAN 仕様確定を待つ必要がある",
    "CAN データを確認用に保存できるかが先方宿題として未回答。保存する場合、SensorService の canData 取得経路にログ以外の保存責務が加わる可能性があり、middleware/DB 側の設計に影響する",
    "BLE 受信の不安定さの実際の原因が未特定。テスト用ナビ端末の提供時期も未定であるため、安定化対策（パラレル化を含む）の設計確定時期が読めず、11 月末完了目標に対するリスクとなる",
    "新仕様の 6 項目 5 段階スコアへの移行にともない score-logic の指標発火条件が変わる可能性があるが、採点データ形式が先方検討中で未確定。確定するまで smartphoneOnly 未算出問題の扱い方も定まらない"
  ],
  "rationale_notes": [
    "デモ/実機の切替をデータ件数（getSensorLogDataSize()>0）で判定する構造は、プラットフォーム判定に依存しないため PC ブラウザ・エミュレータ・実機で同一コードパスを検証できる利点がある。一方で実機にログが残っている場合の優先順位という副作用があるため open_question として残す",
    "ゼロ値補完をゲート成功後に限定するのは、必須センサーの欠落（null）をゼロ値で隠蔽して診断が誤って成立することを防ぐため。ゲート＝入力妥当性検証、ゼロ値補完＝下流ロジックの null 安全化という責務分離である",
    "repeat=-1 は『実測値ではなく補完値である』ことを下流に伝えるためのセンチネル。score-logic が repeat を進行判定に使う箇所で補完値を実測と誤認しないための設計意図",
    "acceleration.interval のみ 0 を許さないのは、キャリブレーション経過時間を interval の積算で計測しているため。ゼロ値であっても時間軸に寄与する値は実効値（10ms）を保持する必要がある",
    "geolocation を全モード必須としているため、ゼロ値定義に geolocation を含めない。含めると『GPS 未取得でも診断が進む』という仕様矛盾が生じる",
    "smartphoneOnly の未算出 100 は、ゼロ値補完（null 安全化）とスコアロジック側の発火条件（CAN 値の変化を前提）が噛み合っていないことに起因する。本仕様書は実装実態の記録に留め、評価モデルの是非は score-logic ドメインおよび打ち合わせ判断に委ねる",
    "BLE ログを条件付き・サンプリングにせず毎回無条件としたのは、受信欠落・順序異常の解析にはサンプリングしたログでは不十分であるという判断（例外的な許可）。本番リリース時の扱いは別途判断が必要",
    "infra.assets.geolocation は依存グラフ上『依存』として残すと参照実態があるかのように読めるため、注記へ降格する。非 Android 時の geolocation は DemoData 由来であり geolocation.json 由来ではないため、Ionic Storage への保存事実と矛盾しない",
    "2026 年度改修要求のうち本ノードに直接関係するのは④BLE 通信の安定化のみ。①②③は UI ドメイン、⑤は録画（media）ドメインの主管であり、本仕様書では参照章として位置づけのみ記載する",
    "BLE 安定化について先方から提示されたパラレル処理化は、原因が未特定のまま実装方式を固定すると誤った最適化になるため、仮説として明示的に留保する。まず §5 の無条件ログで受信実態（欠落・順序・間隔）を観測可能にすることを先行させる",
    "CAN ペイロードの拡張可能性を仕様書内に明記しておくのは、ゼロ値定義（canData のフィールド一覧）が現行 12 バイト前提のフィールド構成に依存しているため。ペイロード変更時にゼロ値定義も同時改訂が必要になる連鎖を見落とさないための注記である"
  ]
}
```