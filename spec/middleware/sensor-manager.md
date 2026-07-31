# middleware.sensor.manager — センサーキャリブレーション & 座標変換ユーティリティ

## 概要
`SensorManager` は静的クラスで、起動直後のセンサーサンプルからキャリブレーションオフセット（方位・姿勢）を算出し、以降のサンプルをローパスフィルタ + 座標回転で補正するユーティリティ。Android の `SensorManager.getRotationMatrix / remapCoordinateSystem / getOrientation` の TypeScript ポートを内包する。

## 真実源
- `src/data/src/app/data/sensor-manager.ts`

## 定数
```
CALIBRATION_SET_TIME  = 1000  // ms、キャリブレーション用サンプル収集期間
CALIBRATION_SKIP_TIME = 100   // ms、起動直後の破棄期間
T   = 0.0167                  // 時定数（サンプル周期）
F   = 0.2                     // カットオフ周波数
tau = 1 / (2 * PI * F)        // ≈ 0.796
AXIS_X = 1, AXIS_Y = 2, AXIS_Z = 3, ±付きは MSB フラグ 0x80
```

## 内部状態
```
calibrationOffset = {
  acceleration:  { offsetX, offsetY, offsetZ, lastX, lastY, lastZ },
  magnetometer:  { offsetX, offsetY, offsetZ },
  orientation:   { azimuth, pitch, roll }
};
calibrationTotalTime: number
calibrationSensorData: Array
```

## `initializeCalibration()`
- `calibrationOffset` を全 0 で再作成し、`calibrationTotalTime=0`、`calibrationSensorData=[]`。診断開始時（[[middleware.sensor.service]] の `startScoreLogic`）に呼ばれる。

## `calibration(sensorData)`
1. `sensorData.calibration / offset / orientation` が未定義なら `calculateCalibrationOffset(sensorData)` を呼び、`sensorData.calibration` を true / false で設定（true=キャリブ完了）。
2. `sensorData.offset` が未定義なら現在の `calibrationOffset.acceleration.offsetX/Y/Z` を書き込み、定義済みなら逆に `calibrationOffset` を書き換える（ログ再生時にオフセットを復元する用途）。
3. `sensorData.orientation` も同様（`pitch, roll` のみ）。
4. **ローパスフィルタ**: 加速度の `accelerationIncludingGravity.{x,y,z}` を τ / (T+τ) の 1 次 IIR で処理し `lowPass.{x,y,z}` を付加。`lastX/Y/Z` を更新。
5. **座標回転**: `rotateVector([x,y,z])` を加速度と加速度 lowPass に適用し `rotate.{x,y,z,lowPass}` を付加。
6. **ジャイロ**: `rotateVector([beta, gamma, 0])` を `gyroscope.rotate.{beta, gamma}` に付加（alpha は北基準なので回転補正しない）。

## `calculateCalibrationOffset(sensorData)` (private)
- `calibrationTotalTime >= SKIP+SET (1100ms)` なら即 true（既にキャリブレーション完了）。
- `putCalibrationData()` で `SKIP < totalTime` の期間だけサンプルを蓄積。
- `calibrationSensorData` の平均で加速度・磁力計のオフセットを算出。
- Android と同じ 3 段: `getRotationMatrix(inR, I, accelerationData, geomagneticData)` → `remapCoordinateSystem(inR, AXIS_X, AXIS_Z, outR)` → `getOrientation(outR, orientationValues)`
- `azimuth = orientationValues[0]*180/π`、`pitch = orientationValues[1]*180/π`、`roll = orientationValues[2]*180/π`
- 収集期間中は false、完了後 true を返す。

## `rotateVector(vector)` (private)
- `|roll| >= 45` のときは端末が横向きと判定し、x/y を反転して座標系を整える。
- `ax, ay` は roll の符号で pitch 補正を切替、`az = roll`。
- x → y → z の順にオイラー回転行列を掛ける（`calc()` は 3×3 と 3-vector の積）。

## `getRotationMatrix / remapCoordinateSystem / getOrientation`
- Android 公式実装のロジックをそのまま TypeScript に移植。詳細な数式はコード参照。
- `getRotationMatrix` は加速度が `normsqA < 0.01 * 9.81²`（自由落下相当）なら false を返して失敗。

## `invertM / multiplyMV / transposeM`
- 4×4 行列演算のユーティリティ（Android Matrix クラス相当）。現状の運転診断コードでは呼び出されていない（将来の座標系変換用）。

## 業務ルール
- キャリブレーション対象は診断開始 100ms 〜 1100ms のサンプル 1 秒分。
- オフセット確定後、Storage には保存せずインメモリ保持。診断終了 → 再開で再キャリブレーションされる。

## 関連ノード
- 呼び出し元: [[middleware.sensor.service]]（10ms 周期の calibration 呼び出し）、[[ui.edit.page]]（デモ再生時のキャリブレーション）
