<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:32:58 JST -->

```json
{
  "required_changes": [
    {"node": "middleware.sensor.manager", "entrypoint": "spec/middleware/sensor-manager.md", "description": "既存のキャリブレーション/座標変換仕様を維持したまま、センサーリスナー購読・モード別可用性ゲート（全モードGPS必須）・10ms周期runScoreLogic・DemoData経路・起動時一度きり判定と前回値保持・実機検証時のGPS供給（adbテストプロバイダgps／fused非登録）を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "qa-agent", "severity": "must", "reason": "実機検証時のGPS供給は qa.mockdata.gps.feeder（adb テストプロバイダ gps、fused 非登録）を前提とするため手順側と整合が必要"},
    {"domain": "ui-agent", "severity": "should", "reason": "モード切替時に必須センサーが未充足だった場合の提示（警告・切替可否）の扱いをUI側で決める必要がある"}
  ],
  "requirements_context": "middleware.sensor.manager は (a) 起動直後サンプルからのキャリブレーションオフセット算出とローパス／座標回転補正、(b) センサーリスナーの購読とモード別可用性ゲート判定の2責務を持つ。ゲートは承認済みファクトにより改訂され、全モード（canDataOnly / smartphoneOnly / combination）で GPS を必須とする。canDataOnly は GPS+canData、smartphoneOnly は GPS+加速度+方位+磁力計、combination は両方の合集合を必須とする。10ms 周期でのサンプル処理と runScoreLogic 呼び出し、デモ再生時の DemoData 経路、必須センサー可用性の判定はアプリ起動時に一度きりで以降再判定しない点、起動後にセンサー更新が途切れた場合は前回値を保持する点は従前どおり維持する。実機検証時の GPS 供給は B 案（qa.mockdata.gps.feeder による adb テストプロバイダ gps 投入）を採用済みで、実機 GPS 受信との競合が疑われる場合は fused を登録せず gps のみを扱う。キャリブレーションは診断開始 100ms〜1100ms の 1 秒分を対象とし、オフセットはインメモリ保持で永続化しない（診断終了→再開で再キャリブレーション）。UC06 運転診断の実行、UC11 センサーモード切替、UC12 編集とデモ再生が本ノードに依存する。",
  "fact_candidates": [
    {
      "type": "business_rule",
      "title": "全センサーモードで GPS が必須である",
      "statement": "canDataOnly / smartphoneOnly / combination のいずれのモードでも GPS を必須センサーとして扱う",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "canDataOnly の必須センサーは GPS と canData",
      "statement": "canDataOnly モードでは GPS と canData が利用可能であることを必須とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "smartphoneOnly の必須センサーは GPS・加速度・方位・磁力計",
      "statement": "smartphoneOnly モードでは GPS、加速度、方位、磁力計が利用可能であることを必須とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "combination の必須センサーは canDataOnly と smartphoneOnly の両方",
      "statement": "combination モードでは GPS、canData、加速度、方位、磁力計のすべてが利用可能であることを必須とする",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "必須センサー可用性の判定は起動時に一度きり行う",
      "statement": "モード別必須センサーの可用性判定はアプリ起動時に一度だけ実行し、起動後は再判定しない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "起動後にセンサー更新が途切れた場合は前回値を保持する",
      "statement": "起動後にセンサーからの更新が得られない期間は、直近に取得した値を保持して処理を継続する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "センサーデータ処理周期は 10ms である",
      "statement": "購読中のセンサーデータは 10ms 周期で処理される",
      "status": "approved"
    },
    {
      "type": "api_contract",
      "title": "10ms 周期で runScoreLogic を呼び出す",
      "statement": "10ms 周期のセンサー処理ごとに runScoreLogic を呼び出してスコアロジックへサンプルを渡す",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "デモ再生時のセンサーデータは DemoData 経路から供給される",
      "statement": "デモ再生時は実センサーではなく DemoData 経路のサンプルを同一の処理経路に流す",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "実機検証時の GPS は adb テストプロバイダ gps で供給する",
      "statement": "実機検証時の GPS 供給は qa.mockdata.gps.feeder による adb テストプロバイダ gps への投入で行う",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "競合が疑われる場合は fused を登録せず gps のみを扱う",
      "statement": "実機 GPS 受信とテストプロバイダの競合が疑われる場合、fused プロバイダは登録せず gps プロバイダのみを扱う",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "キャリブレーション対象は診断開始 100ms〜1100ms のサンプル",
      "statement": "キャリブレーションは診断開始後 100ms（CALIBRATION_SKIP_TIME）から 1100ms までの 1 秒分のサンプルを対象とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "キャリブレーションオフセットは永続化されない",
      "statement": "算出したキャリブレーションオフセットは Storage に保存せずインメモリのみで保持し、診断終了後の再開時に再算出される",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "ログ再生時はサンプル側のオフセット値でキャリブレーション状態を復元する",
      "statement": "sensorData.offset / sensorData.orientation が既に定義されている場合は、その値で calibrationOffset を上書きしてキャリブレーション状態を復元する",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "自由落下相当の加速度では回転行列を算出しない",
      "statement": "getRotationMatrix は加速度の二乗ノルムが 0.01 * 9.81^2 未満の場合 false を返し、姿勢算出を失敗として扱う",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "必須センサーが未充足だった場合の挙動（診断開始を拒否するか、警告のみで継続するか、モード切替自体を禁止するか）が未確定。UI表示と診断可否の双方に影響するため ui-agent と Middleware の合意が必要。",
    "モード別ゲートの正典をどのノード（middleware.sensor.manager / middleware.sensor.service）に置くかが未確定。両ノードに同内容が記述されると更新漏れによる齟齬が生じる。",
    "起動後の前回値保持に上限時間やタイムアウト（一定時間更新がない場合の劣化・停止）があるかが未確定。長時間の欠測時のスコア妥当性に影響する。",
    "テストプロバイダ gps を用いる際、アプリ側で fused を登録しない切替が必要か（実装上どこで制御するか、debug ビルド限定か）が未確定。qa-agent の手順とアプリ実装の双方に影響する。",
    "GPS の可用性判定基準（パーミッション付与のみで可用とみなすか、実測 fix 取得までを条件とするか）が未確定。起動時一度きり判定の結果に直結する。"
  ],
  "rationale_notes": [
    "本ノードは『どのセンサーを購読してよいか（ゲート）』と『取得サンプルをどう補正するか（キャリブレーション・座標変換）』の 2 責務を持つ。スコア算出そのものの責務は score-logic 側に置き、本ノードは runScoreLogic への受け渡しまでを担う。",
    "ゲート判定を起動時一度きりに限定しているのは、走行中の一時的なセンサー欠測でモードが切り替わり評価モデルが途中で変わることを避けるため。欠測は前回値保持で吸収する設計意図。",
    "全モードで GPS を必須にした理由は、canDataOnly でも速度・位置系の指標や走行判定で GPS 由来値に依存するため。",
    "実機 GPS 受信との競合懸念に対しては、fused を登録せず gps プロバイダのみを扱うことで供給元を一意にする方針（B 案）。この制約は実機検証時の運用上の制約であり、製品挙動の恒久仕様ではない点に注意。",
    "既存の Android ポート（getRotationMatrix / remapCoordinateSystem / getOrientation / invertM 等）は数式を含むため、仕様書ではロジックの位置づけのみを記述しコード参照に委ねる方針を維持した。",
    "invertM / multiplyMV / transposeM は現状未使用だが将来の座標系変換用として残す旨の既存記述はそのまま維持した。"
  ]
}
```

以下が更新後の仕様本文です。

````markdown
# middleware.sensor.manager — センサーリスナー購読 / モードゲート / キャリブレーション & 座標変換

## 概要
`SensorManager` は静的クラスで、次の 2 つの責務を持つ。

1. **センサーリスナー購読とモードゲート** — 選択中のセンサーモードに応じて必須センサーの可用性を判定し、購読対象を確定する。10ms 周期でサンプルを処理し `runScoreLogic` へ渡す。
2. **キャリブレーション & 座標変換** — 起動直後のセンサーサンプルからキャリブレーションオフセット（方位・姿勢）を算出し、以降のサンプルをローパスフィルタ + 座標回転で補正する。Android の `SensorManager.getRotationMatrix / remapCoordinateSystem / getOrientation` の TypeScript ポートを内包する。

スコア算出そのものは本ノードの責務ではなく、`runScoreLogic` 経由で [[middleware.score.logic]] 側に委譲する。

## 真実源
- `src/data/src/app/data/sensor-manager.ts`

---

## 1. センサーリスナー購読とモードゲート

### 1.1 モード別 必須センサー
**全モードで GPS を必須とする。**

| モード | 必須センサー |
| --- | --- |
| `canDataOnly` | GPS + canData |
| `smartphoneOnly` | GPS + 加速度 + 方位 + 磁力計 |
| `combination` | GPS + canData + 加速度 + 方位 + 磁力計（両モードの合集合） |

- `canDataOnly` でも走行判定・速度／位置系の指標が GPS 由来値に依存するため、GPS は例外なく必須。
- モード判定に用いる値は選択中のセンサーモード（`selectedSensorMode`）。

### 1.2 ゲート判定のタイミング
- 必須センサーの可用性判定は **アプリ起動時に一度きり** 実行する。
- 起動後は再判定しない。走行中の一時的な欠測でモードや評価モデルが切り替わることを避けるため。

### 1.3 起動後の欠測時の扱い
- 起動後にセンサーからの更新が得られない期間は、**直近に取得した値（前回値）を保持** して処理を継続する。
- 前回値保持の上限時間・タイムアウトは未定（open question）。

### 1.4 処理周期と runScoreLogic
- 購読中のセンサーデータは **10ms 周期** で処理される。
- 10ms 周期の処理ごとに `calibration(sensorData)` を適用したうえで **`runScoreLogic` を呼び出す**。

### 1.5 DemoData 経路
- デモ再生時（[[ui.edit.page]] / UC12）は実センサーを購読せず、**DemoData 経路** のサンプルを同一の処理経路（10ms 周期 → `calibration` → `runScoreLogic`）に流す。
- ログ再生／デモ再生では、サンプル側に格納済みのオフセット値でキャリブレーション状態を復元する（後述 `calibration()` の手順 2・3）。

### 1.6 実機検証時の GPS 供給（QA 連携）
- 実機検証時の GPS は **[[qa.mockdata.gps.feeder]]** による **adb テストプロバイダ `gps`** への投入で供給する（B 案採用）。
- 実機 GPS 受信とテストプロバイダの **競合が疑われる場合は `fused` を登録せず `gps` プロバイダのみを扱う**。供給元を一意にする目的。
- 本項は実機検証時の運用上の制約であり、製品の恒久挙動ではない。

---

## 2. キャリブレーション & 座標変換

### 定数
```
CALIBRATION_SET_TIME  = 1000  // ms、キャリブレーション用サンプル収集期間
CALIBRATION_SKIP_TIME = 100   // ms、起動直後の破棄期間
T   = 0.0167                  // 時定数（サンプル周期）
F   = 0.2                     // カットオフ周波数
tau = 1 / (2 * PI * F)        // ≈ 0.796
AXIS_X = 1, AXIS_Y = 2, AXIS_Z = 3, ±付きは MSB フラグ 0x80
```

### 内部状態
```
calibrationOffset = {
  acceleration:  { offsetX, offsetY, offsetZ, lastX, lastY, lastZ },
  magnetometer:  { offsetX, offsetY, offsetZ },
  orientation:   { azimuth, pitch, roll }
};
calibrationTotalTime: number
calibrationSensorData: Array
```

### `initializeCalibration()`
- `calibrationOffset` を全 0 で再作成し、`calibrationTotalTime=0`、`calibrationSensorData=[]`。診断開始時（[[middleware.sensor.service]] の `startScoreLogic`）に呼ばれる。

### `calibration(sensorData)`
1. `sensorData.calibration / offset / orientation` が未定義なら `calculateCalibrationOffset(sensorData)` を呼び、`sensorData.calibration` を true / false で設定（true=キャリブ完了）。
2. `sensorData.offset` が未定義なら現在の `calibrationOffset.acceleration.offsetX/Y/Z` を書き込み、定義済みなら逆に `calibrationOffset` を書き換える（ログ再生時にオフセットを復元する用途）。
3. `sensorData.orientation` も同様（`pitch, roll` のみ）。
4. **ローパスフィルタ**: 加速度の `accelerationIncludingGravity.{x,y,z}` を τ / (T+τ) の 1 次 IIR で処理し `lowPass.{x,y,z}` を付加。`lastX/Y/Z` を更新。
5. **座標回転**: `rotateVector([x,y,z])` を加速度と加速度 lowPass に適用し `rotate.{x,y,z,lowPass}` を付加。
6. **ジャイロ**: `rotateVector([beta, gamma, 0])` を `gyroscope.rotate.{beta, gamma}` に付加（alpha は北基準なので回転補正しない）。

### `calculateCalibrationOffset(sensorData)` (private)
- `calibrationTotalTime >= SKIP+SET (1100ms)` なら即 true（既にキャリブレーション完了）。
- `putCalibrationData()` で `SKIP < totalTime` の期間だけサンプルを蓄積。
- `calibrationSensorData` の平均で加速度・磁力計のオフセットを算出。
- Android と同じ 3 段: `getRotationMatrix(inR, I, accelerationData, geomagneticData)` → `remapCoordinateSystem(inR, AXIS_X, AXIS_Z, outR)` → `getOrientation(outR, orientationValues)`
- `azimuth = orientationValues[0]*180/π`、`pitch = orientationValues[1]*180/π`、`roll = orientationValues[2]*180/π`
- 収集期間中は false、完了後 true を返す。

### `rotateVector(vector)` (private)
- `|roll| >= 45` のときは端末が横向きと判定し、x/y を反転して座標系を整える。
- `ax, ay` は roll の符号で pitch 補正を切替、`az = roll`。
- x → y → z の順にオイラー回転行列を掛ける（`calc()` は 3×3 と 3-vector の積）。

### `getRotationMatrix / remapCoordinateSystem / getOrientation`
- Android 公式実装のロジックをそのまま TypeScript に移植。詳細な数式はコード参照。
- `getRotationMatrix` は加速度が `normsqA < 0.01 * 9.81²`（自由落下相当）なら false を返して失敗。

### `invertM / multiplyMV / transposeM`
- 4×4 行列演算のユーティリティ（Android Matrix クラス相当）。現状の運転診断コードでは呼び出されていない（将来の座標系変換用）。

---

## 業務ルール
- **全モードで GPS 必須。** `canDataOnly`=GPS+canData、`smartphoneOnly`=GPS+加速度+方位+磁力計、`combination`=両方。
- 必須センサー可用性の判定は起動時に一度きり。起動後は再判定せず、欠測時は前回値を保持する。
- センサーデータは 10ms 周期で処理し、毎周期 `runScoreLogic` を呼び出す。
- デモ再生時は DemoData 経路のサンプルを同一処理経路に流す。
- キャリブレーション対象は診断開始 100ms 〜 1100ms のサンプル 1 秒分。
- オフセット確定後、Storage には保存せずインメモリ保持。診断終了 → 再開で再キャリブレーションされる。
- 実機検証時の GPS は adb テストプロバイダ `gps` から供給し、競合が疑われる場合は `fused` を登録しない。

## 未確定事項
- 必須センサーが未充足だった場合の挙動（診断開始拒否 / 警告のみ継続 / モード切替禁止）。
- 前回値保持の上限時間・タイムアウトの有無。
- GPS 可用性の判定基準（パーミッション付与のみか、実測 fix 取得までか）。
- `fused` を登録しない制御の実装箇所（debug ビルド限定か）。

## 関連ノード
- 呼び出し元: [[middleware.sensor.service]]（10ms 周期の calibration 呼び出し）、[[ui.edit.page]]（デモ再生時のキャリブレーション）
- 連携: [[qa.mockdata.gps.feeder]]（実機検証時の GPS 供給）
````