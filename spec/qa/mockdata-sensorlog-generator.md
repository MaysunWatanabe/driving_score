<!-- 作成: 2026-09-25 11:17:35 JST | 更新: 2026-09-25 11:33:47 JST -->

# spec/qa/mockdata-sensorlog-generator.md

<!-- 改訂: approved facts (#10 / #12 / #13) と整合するよう全面改訂。未承認の steer_* 系シナリオ、LCG 乱数、量子化上限の改訂案は本文から除去し、open_questions に退避した。 -->
<!-- 改訂(spec-integrate): facts との再照合で次の点を補正した。
  - #10 の「再生時 timestamp は Date.now() で上書き」前提を明記
  - #10 の middleware.sensor.service の閾値コメント一致要件（<=0 実センサー / >0 デモ）を明記
  - hard_brake の各相のペダル値（#12 §4）を明記
  - sharp_curve のピーク判定を量子化後の値で行うことを明確化
  - mixed の区間境界の車速連続性が単体シナリオ定義と衝突する点を blocked 扱いに分離
  - §16 未確定事項を本文に新設 -->
<!-- 改訂(spec-integrate 2): 新たに approved となった facts を反映した。facts と既存 md が矛盾する箇所は facts を優先して改訂した。
  - 正準コミットセットを 6 ファイルから 9 シナリオ 10 ファイルに拡張した（steer_stable / steer_wobble_weak / steer_wobble_strong / hiyari_recording の各 canConnected を追加）。既存 9 ファイルのバイト列は不変とする
  - --scenario の受理値を 9 種に拡張した
  - canData 量子化の丸め方式を floor(x+0.5) に確定した。物理値域の上限（accelPedalPosition=100 / brakePressure=126 / steeringAngle=1080 / frontDistance=127）へ改訂し、ペダル出力値のクランプを明記した（#12 の値域表を置換）
  - hiyari_recording シナリオ（duration 90・9000 行・6 点発火）の生成条件と検証を追加した
  - §16 の Q4（丸め方式）を解消し、Q8 は steer_* のプロファイル未定義のみを残して縮小した -->

## 1. 目的とスコープ

本ノードは、モックセンサログを決定的に生成する Node CLI の品質保証仕様を定める。モックセンサログは gzip 圧縮した JSON Lines 形式で、デモ再生・回帰検証・スコアロジック検証（ヒヤリ判定を含む）に使う。

対象成果物：

- 生成スクリプト `src/data/tools/gen-mock-sensorlog.mjs`
- 正準モックファイル `src/data/mock/sensor-log.<scenario>.<sensorMode>.txt.gz`（9 シナリオ 10 ファイル）

本ノードは UI を持たない。そのため `ui-runtime-validation` の pageerror / console.error ゲートは適用しない。代わりに次の 3 つを失敗ゲートとする。

1. CLI の終了コードが非ゼロ
2. 生成後セルフチェックの assert 失敗
3. 既存正準ファイルを再生成したときのバイト不一致

## 2. 実行環境・依存制約

| 項目 | 条件 |
| --- | --- |
| ランタイム | Node 18.19.1 単体で実行できること |
| 依存 | 新規 npm 依存の追加は禁止。既存の `pako` のみ使用できる |
| 変更禁止 | `scoreLogicFunction.txt` / `scoreLogic.json` / `score-logic.ts` / `src/data/src/app/**` / BLE 符号化 / エミュレータ |
| 非対象 | DB シード / webm / `infra.assets.geolocation` |

ヒヤリ判定条件（1 次 IIR、T=0.05s、F=2Hz、発火後 1 秒抑止）はスコアロジック側の定義であり、本ノードでは変更しない。hiyari_recording の検証はこの判定条件を「与えられたもの」として適用する（§6 hiyari_recording 参照）。

`middleware.sensor.service` のデモ／実機切替の扱い：

- 正準閾値は `DemoData.getSensorLogDataSize() > 0` とする。`<= 0` なら実センサー、`> 0` ならデモ。
- 判定ロジック自体は変更しない。
- 実装コメントはこの閾値と一致していなければならない。
- コメントが不一致の場合に限り、コメントの修正のみを許容する。この修正が「`src/data/src/app/**` 変更禁止」とどう両立するかは §16 Q7 を参照。

`ui.edit.page` の投入経路（`FileReader` による Base64 読み込み → `pushSensorLogFile`）は現行のまま変更しない。

## 3. CLI 仕様

```
node tools/gen-mock-sensorlog.mjs \
  --scenario <cruise|accel_decel|hard_brake|sharp_curve|mixed|steer_stable|steer_wobble_weak|steer_wobble_strong|hiyari_recording> \
  --sensor-mode <smartphoneOnly|canConnected> \
  --duration <sec> \
  --out <dir> \
  [--base-time <ISO8601>]
```

- `--scenario`：上記 9 値のみを受理する。それ以外を指定した場合は非ゼロ終了する。
- `--sensor-mode`：**必須**。未指定なら非ゼロ終了する。
- `--duration`：既定は 60 秒。刻みは 10ms 固定で、行数は `duration * 100`。
  - hiyari_recording の正準ファイルは `--duration 90` で生成する（9000 行）。
- `--base-time`：任意。省略時は `T0_MS = Date.parse('2026-07-01T10:00:00.000+09:00')`。

出力は `<out>/sensor-log.<scenario>.<sensorMode>.txt.gz` で、1 回の実行につき 1 ファイル。中身は JSON Lines を `pako.gzip` したもの。**ファイル自体を Base64 化してはならない。**

## 4. 正準コミットセット（9 シナリオ 10 ファイル）

`src/data/mock/` に commit する組合せは次の 10 個のみとする。

| # | scenario | sensorMode | duration | 行数 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | cruise | smartphoneOnly | 60 | 6000 | 既存 |
| 2 | cruise | canConnected | 60 | 6000 | 既存 |
| 3 | accel_decel | canConnected | 60 | 6000 | 既存 |
| 4 | hard_brake | canConnected | 60 | 6000 | 既存 |
| 5 | sharp_curve | canConnected | 60 | 6000 | 既存 |
| 6 | mixed | canConnected | 60 | 6000 | 既存 |
| 7 | steer_stable | canConnected | （§16 Q8） | duration*100 | 既存 |
| 8 | steer_wobble_weak | canConnected | （§16 Q8） | duration*100 | 既存 |
| 9 | steer_wobble_strong | canConnected | （§16 Q8） | duration*100 | 既存 |
| 10 | hiyari_recording | canConnected | 90 | 9000 | 新規 |

- 既存 9 ファイル（#1〜#9）のバイト列は変更してはならない。
- `steer_*` と `hiyari_recording` の smartphoneOnly 版は CLI で生成できるが、commit はしない。
- その他の正準セット外の組合せも CLI で生成できるが、commit はしない。
- 生成スクリプトと正準 10 ファイルの両方を commit する。

## 5. レコードスキーマ

各行は `JSON.stringify({ date, sensor })` とする。

- `date`：`YYYY-MM-DD HH:mm:ss.SSS` 形式。**常に JST(UTC+9) 固定**で整形する。`process.env.TZ` や `Date#getHours` などのローカル TZ に依存してはならない。
- `sensor.timestamp`：行 `i`（0 起点）について `baseMs + i * 10` とする。
  - これは生成時の参考値である。
  - デモ再生時は `DemoData.getSensorLogData()` が `Date.now()` で上書きする前提とする。
  - したがって再生後の timestamp は本ノードの検証対象外。
- 毎行必須のキー：`videoTime` / `geolocation` / `acceleration` / `gyroscope` / `magnetometer`
- 単位は W3C DeviceMotion / Geolocation、および既存 BLE デコードスケールに準拠する。

### 5.1 端末取付姿勢（固定）

画面を上にして水平なダッシュボードに固定する。軸は `+y` = 車両前進、`+x` = 車両右、`+z` = 鉛直上。

- `acceleration.accelerationIncludingGravity = { x: latAcc*9.80665, y: longAcc*9.80665, z: 9.80665 }`
- `acceleration.rotationRate = { beta: 0, gamma: 0, alpha: yawRate }`（deg/s）
- `acceleration.interval = 10`
- `gyroscope = { beta: 0, gamma: 0, alpha: heading }`（0 以上 360 未満）
- `magnetometer = { x: -30.2*sin(heading_rad), y: 30.2*cos(heading_rad), z: -34.7 }`
  - 全磁力 46μT / 伏角 49° / 偏角 0 から、水平成分 30.2・鉛直成分 -34.7 として算出したもの
- `geolocation.altitude = 5.0`、`altitudeAccuracy = 3.0`、`accuracy = 5.0`（いずれも定数）

### 5.2 heading

- 全シナリオで走行開始時の `heading = 0.0`。
- 各ステップで `yawRate(deg/s) * dt_s` を積分し、`((h % 360) + 360) % 360` で正規化する。
- `cruise` と `accel_decel` は `yawRate = 0` なので、全行で heading は 0。
- `hiyari_recording` はヒヤリ以外を cruise のプロファイルで構成するため、全行で heading は 0 となる見込みである。ただし latAcc パルスに yawRate を伴わせるかは §16 Q13 で確認する。

### 5.3 canData の有無

- `sensorMode = smartphoneOnly`：`canData` キー自体を出力しない。ゼロ補充は `DemoData.convertOldData` に委ねる。
- `sensorMode = canConnected`：次の 12 フィールドを全行で明示する。
  - `vehicleSpeed` / `longAcc` / `latAcc` / `frontDistance` / `lateralDistance` / `steeringAngle`
  - `accelPedalPosition` / `brakePressure` / `brakeSwitch` / `shiftIndication` / `turnSignal` / `repeat`
- `repeat` は常に `0`。`-1` は禁止。
- `canConnected` のとき、`geolocation.speed = canData.vehicleSpeed / 3.6` と一致すること。ここでの `vehicleSpeed` は §8 の量子化後の値とする。

### 5.4 GPS

起点 `(35.681236, 139.767125)` からの決定的な相対計算のみで求める。**乱数を用いてはならない。**

## 6. シナリオ物理プロファイル

### cruise

直進 40km/h の定速走行。`yawRate = 0`。

### accel_decel

周期は `P = 20.0s`。サイクル内時刻は `t = videoTime_s % 20` とし、端数サイクルは duration で打ち切る。

| 区間 | 速度 | longAcc |
| --- | --- | --- |
| `0 <= t < 8` | `7.5 * t` km/h（0→60） | +0.21G |
| `8 <= t < 12` | 60 km/h | 0 |
| `12 <= t < 20` | `60 - 7.5*(t-12)` km/h | -0.21G |

- `yawRate = 0`。
- 既定の duration 60 秒でちょうど 3 サイクルになる。
- 減速時の `|longAcc|` は hard_brake の閾値 0.35G を超えない。

### hard_brake

制動開始は `D * 0.20`、`D * 0.45`、`D * 0.70` の 3 回。各イベントは次の相で構成する。ペダル値は、§7 の論理値に §8 のクランプを適用した**出力値**で示す。

| 相 | 速度 | longAcc | accelPedalPosition | brakePressure | brakeSwitch |
| --- | --- | --- | --- | --- | --- |
| (1) 制動前 | 60km/h 定速 | 0 | 40 | 0 | 0 |
| (2) 制動 3.0s | 60→10km/h 一定減速 | 平均 ≈ -0.47G（`<= -0.35G`） | 0 | 126（論理値 200 をクランプ） | 1 |
| (3) 回復 4.0s | 10→60km/h | ≈ +0.35G | 100（論理値 120 をクランプ） | 0 | 0 |
| (4) それ以外 | 60km/h 定速 | 0 | 40 | 0 | 0 |

ペダル値は §7 の共通規則からも導出され、上表と結果が一致しなければならない。

### sharp_curve

- 40km/h の定速走行。`yawRate(t) = A * sin(2π t / 8.0)` deg/s。
- 振幅は `A = (0.30 * 9.80665) / v * (180/π)`、`v = 40/3.6` m/s で決定的に算出する（≈15.2 deg/s）。
- `steeringAngle` は `yawRate` に比例し、ピークは `±180deg`。上限 1080 には掛からない。
- 受け入れ判定は、量子化後の `canData.latAcc` の最大値が `>= 0.30`、`canData.steeringAngle` のピークが `±180.0` であることとする。

### mixed

- duration `D` を 4 等分し、`cruise → accel_decel → hard_brake → sharp_curve` の順に各 `D/4` 秒を連結する。
- `videoTime` は `0..D*1000` ms の範囲で単調連続とする。
- 車速・heading・lat/lng は、区間境界で前区間の終端値を引き継ぎ、不連続にしない。

**注意（未確定）**：単体シナリオの定義をそのまま連結すると、区間境界で車速が不連続になる。

- 例：cruise 終端 40km/h → accel_decel 始端 0km/h
- 例：accel_decel 終端 37.5km/h → hard_brake 始端 60km/h
- 例：hard_brake 終端 60km/h → sharp_curve 始端 40km/h

また、区間長 D/4（既定 15s）の hard_brake に 3 イベント（各 7s）を `D/4 * (0.20, 0.45, 0.70)` で配置すると、イベント同士が重なる。

車速の引き継ぎ規則と区間内イベントの配置は未定義であり、§16 Q1 / Q2 で確定するまで該当テストは blocked 扱いとする。なお mixed の正準ファイルは既存 9 ファイルに含まれ、バイト列は不変である（§4）。

### steer_stable / steer_wobble_weak / steer_wobble_strong

- 正準セットには canConnected 版のみを含める（§4）。smartphoneOnly 版は生成可能だが commit しない。
- 物理プロファイル（舵角の揺らぎ振幅・周期・車速・duration など）は、本ノードに紐づく approved facts に記載がない（§16 Q8）。
- プロファイルが facts で確定するまでは、次の範囲で検証する。
  - 共通規則（スキーマ・量子化・ペダル・決定性・ゴールデン一致）を検証する。
  - プロファイル固有の値の検証は blocked とする。
- `Math.random` 禁止（§9）はこれらのシナリオにも適用する。揺らぎは決定的計算で生成しなければならない。

### hiyari_recording

ヒヤリ発生時の録画（2026 年度改修要求 ⑤）とヒヤリ判定を検証するための入力データである。

- 正準ファイルは canConnected、`--duration 90` で生成する。行数は `duration * 100` どおり **9000 行**。
- ヒヤリを発火させる時刻は **15 / 30 / 40 / 45 / 48 / 60 秒**の 6 点とする。
- 各発火点では、`longAcc` / `latAcc` に `|Jerk_LPF| > 0.4 G/s` を満たすプロファイルを置く。
- ヒヤリ以外の成分（速度・ウィンカ・舵角など）は、cruise の 40km/h 定速プロファイルを流用する。
- 全発火時刻は走行区間 **9.0〜64.8 秒**の内側に置く。評価窓 **68.5〜76.5 秒**には掛けない。
- ヒヤリ判定条件（1 次 IIR、T=0.05s、F=2Hz、発火後 1 秒抑止）は変更しない。
- 発火点の最小間隔は 3 秒（45→48 秒）であり、1 秒抑止より長い。このため各発火点は抑止に吸収されず、個別に検出されなければならない。
- ペダル値は §7 の共通規則に従う。そのため longAcc パルスの区間では、ペダル状態が加速側または減速側に切り替わり得る。

## 7. ペダル状態の共通規則

判定には **量子化前の `longAcc`** を用いる。規則は全シナリオ共通である。論理値を決めた後、§8 の値域でクランプした値を出力する。

| 条件 | accelPedalPosition（論理値 → 出力値） | brakePressure（論理値 → 出力値） | brakeSwitch |
| --- | --- | --- | --- |
| `longAcc > +0.02G` | 120 → **100** | 0 → 0 | 0 |
| `longAcc < -0.02G` | 0 → 0 | 200 → **126** | 1 |
| 上記以外 | 40 → 40 | 0 → 0 | 0 |

ペダル値は `canConnected` のときのみ `canData` に出力する。`smartphoneOnly` では `canData` キーを省略する。

## 8. canData 量子化（canConnected 時、出力直前に適用）

丸めは **`floor(x + 0.5)`** で行い、物理値域内に収める。刻みが 1 でないフィールドは、刻み単位に換算して丸める（`floor(v/step + 0.5) * step`）。この刻み単位換算は本仕様の解釈であり、§16 Q4' で確認する。

| フィールド | 量子化 | 値域 / 定数 |
| --- | --- | --- |
| vehicleSpeed | 整数 | [0, 255] |
| longAcc / latAcc | 0.01 刻み | [-1.28, 1.27] にクランプ |
| frontDistance | 0.5 刻み | [0, **127**]、定数 50.0 |
| lateralDistance | 0.5 刻み | [-64, 63.5]、定数 0.0 |
| steeringAngle | 0.1 刻み | [-1080, **1080**] にクランプ |
| accelPedalPosition | 整数 | [0, **100**] |
| brakePressure | 整数 | [0, **126**] |
| shiftIndication | — | 4 固定 |
| turnSignal | — | 0 固定 |
| repeat | — | 0 固定 |

旧版（#12）の上限 frontDistance 127.5 / steeringAngle 1471.5 / ペダル 255 は廃止した。

## 9. 決定性要件

- 生成に `Math.random` を使用してはならない。
- 同一の CLI 引数で 2 回生成した結果は、**常にバイト一致**する。
- ローカル TZ 設定（`TZ=UTC` / `TZ=Asia/Tokyo` など）を変えても、出力はバイト一致する。
- 既存の正準ファイルを再生成した結果が従前とバイト不一致になった場合、**そのファイルを上書きしてはならず、CI を fail させる**。
- 既存 9 ファイルのバイト列は、hiyari_recording 追加のためのスクリプト変更後も不変でなければならない。
- gzip 出力のバイト列は `pako` のバージョンに依存し得る。ゴールデン比較は、ロックファイルで固定された `pako` のもとで行う（§16 Q6）。

## 10. 生成後セルフチェック（必須）

生成直後に自前で ungzip と行 parse を行い、次を assert する。

- 行数 `= duration * 100`
- JSON パース失敗による skip 件数 `= 0`
- 必須キー欠落 `= 0`（`date` / `sensor` / `videoTime` / `geolocation` / `acceleration` / `gyroscope` / `magnetometer`）

いずれかが不成立なら非ゼロ終了する。skip 件数は 0 であってもレポートに明示出力する。

## 11. テストケース（4 層構成）

### 層 1：存在チェック（実装が不完全でも先に成立させる）

| ID | 内容 | 合格条件 |
| --- | --- | --- |
| TC-GEN-001 | `--scenario cruise --sensor-mode canConnected` を duration 既定で生成 | 終了コード 0、`sensor-log.cruise.canConnected.txt.gz` が 1 個生成される |
| TC-GEN-002 | 行数一致 | ungzip 後の行数が `duration*100`（既定 6000、hiyari_recording 正準は 9000） |
| TC-GEN-003 | parse skip | skip 件数が 0 |
| TC-GEN-004 | 必須キー | 全行に §10 の必須キーが揃う |
| TC-GEN-005 | 正準セット | `src/data/mock/` の正準モックが §4 の 10 ファイルと過不足なく一致する |
| TC-GEN-006 | 非 Base64 | 出力ファイルの先頭 2 バイトが gzip マジック `1f 8b` |
| TC-GEN-007 | 正準外非 commit | `steer_*` / `hiyari_recording` の smartphoneOnly 版が `src/data/mock/` に存在しない |

### 層 2：相互作用チェック（CLI 引数・モード差分）

| ID | 内容 | 合格条件 |
| --- | --- | --- |
| TC-CLI-001 | `--sensor-mode` 省略 | ファイルが生成されず、非ゼロ終了 |
| TC-CLI-002 | 未知の scenario を指定 | 非ゼロ終了 |
| TC-CLI-003 | `--duration 10` | 行数 1000 |
| TC-CLI-004 | `--base-time` 省略 | 先頭行の `date` が `2026-07-01 10:00:00.000` |
| TC-CLI-005 | `--base-time` 指定 | 先頭行の `date` が指定時刻の JST 表現に一致 |
| TC-CLI-006 | TZ 非依存 | `TZ=UTC` と `TZ=Asia/Tokyo` の出力がバイト一致 |
| TC-CLI-007 | 受理値 9 種 | §3 の 9 シナリオそれぞれを両 sensorMode で指定すると、終了コード 0 でファイルが生成される |
| TC-MODE-001 | smartphoneOnly | 全行に `sensor.canData` キーが存在しない |
| TC-MODE-002 | canConnected | 全行に §5.3 の 12 フィールドが揃う |

### 層 3：業務ルールチェック

| ID | 内容 | 合格条件 |
| --- | --- | --- |
| TC-TIME-001 | 等間隔性 | 隣接行の `timestamp` の差が常に 10 |
| TC-TIME-002 | date 整合 | 各行の `date` が、同じ行の `timestamp` を UTC+9 で整形した値と一致 |
| TC-HEAD-001 | 初期 heading | 先頭行の heading（`gyroscope.alpha`）が 0.0 |
| TC-HEAD-002 | 正規化 | 全行で `0 <= heading < 360` |
| TC-HEAD-003 | 直進シナリオ | cruise / accel_decel は全行で heading = 0.0 |
| TC-MAG-001 | 磁気整合 | 全行で magnetometer が §5.1 の式と heading から一致する |
| TC-PED-001 | 加速時 | 量子化前 `longAcc > +0.02G` の行は出力 100 / 0 / 0 |
| TC-PED-002 | 減速時 | 量子化前 `longAcc < -0.02G` の行は出力 0 / 126 / 1 |
| TC-PED-003 | 定常時 | `-0.02G <= longAcc <= +0.02G` の行は 40 / 0 / 0 |
| TC-QNT-001 | 値域 | 全行が §8 の値域・刻みを満たす（accelPedalPosition <= 100、brakePressure <= 126、`|steeringAngle|` <= 1080、frontDistance <= 127） |
| TC-QNT-002 | 固定値 | 全行で frontDistance=50.0 / lateralDistance=0.0 / shiftIndication=4 / turnSignal=0 |
| TC-QNT-003 | 丸め方式 | 量子化値が量子化前の値を `floor(x+0.5)` で丸めた値と一致する（量子化前の値を再計算できるシナリオに限る） |
| TC-CAN-001 | repeat | 全行で `repeat = 0`（`-1` を含まない） |
| TC-CAN-002 | 速度整合 | 全行で `geolocation.speed == canData.vehicleSpeed / 3.6`（量子化後の vehicleSpeed を使用） |
| TC-SCN-001 | hard_brake 回数 | `longAcc <= -0.35G` の制動イベントが 3 回検出される |
| TC-SCN-002 | sharp_curve ピーク | 量子化後の `latAcc` 最大値が `>= 0.30`、`steeringAngle` のピークが ±180.0 |
| TC-SCN-003 | accel_decel 周期 | 20s 周期で、既定 duration では 3 サイクル |
| TC-SCN-004a | mixed 連続性（時刻・姿勢・位置） | `videoTime` が単調連続で、区間境界で heading・lat/lng が不連続にならない |
| TC-SCN-004b | mixed 連続性（車速） | 区間境界で車速が不連続にならない。**§16 Q1 確定まで blocked** |
| TC-SCN-005 | hard_brake 相別ペダル | 制動相は 0/126/1、回復相は 100/0/0、定速相は 40/0/0（出力値） |
| TC-STR-001 | steer_* 共通規則 | steer_* 3 シナリオの canConnected 出力が TC-GEN-002〜004 / TC-MODE-002 / TC-QNT-001 / TC-CAN-001 / TC-PED-001〜003 を満たす |
| TC-STR-002 | steer_* プロファイル | 舵角の揺らぎ強度が stable < wobble_weak < wobble_strong の順になる等、プロファイル固有の期待値を満たす。**§16 Q8 確定まで blocked** |
| TC-HIY-001 | hiyari_recording 行数 | `--duration 90` の canConnected 出力が 9000 行 |
| TC-HIY-002 | 発火点 | ヒヤリ判定条件（1 次 IIR T=0.05s F=2Hz、発火後 1 秒抑止）を適用すると、15 / 30 / 40 / 45 / 48 / 60 秒の 6 点で発火が検出される（許容時刻誤差は §16 Q12） |
| TC-HIY-003 | 発火点以外 | 上記 6 点以外にヒヤリ発火が検出されない |
| TC-HIY-004 | 閾値 | 各発火点で `|Jerk_LPF| > 0.4 G/s` を満たす |
| TC-HIY-005 | 区間制約 | 全発火時刻が 9.0〜64.8 秒内にあり、68.5〜76.5 秒に発火が存在しない |
| TC-HIY-006 | ベース走行 | ヒヤリ発火点以外の成分が cruise 40km/h 定速と一致する（vehicleSpeed=40、turnSignal=0、舵角は cruise 同値） |
| TC-DET-001 | 決定性 | 同一引数で 2 回生成した結果がバイト一致 |
| TC-DET-002 | 乱数禁止 | スクリプトのソースに `Math.random` の呼び出しが存在しない |
| TC-REG-001 | ゴールデン（既存 9） | 既存 9 ファイルを再生成して `git diff` が空 |
| TC-REG-002 | ゴールデン（新規） | hiyari_recording の正準ファイルを再生成して `git diff` が空 |

### 層 4：統合（デモ再生）

| ID | 内容 | 合格条件 |
| --- | --- | --- |
| TC-DEMO-001 | 投入 | 編集画面から正準ファイルを投入すると `DemoData.getSensorLogDataSize() > 0` となり、デモ再生モードに切り替わる |
| TC-DEMO-002 | 閾値・経路不変 | `middleware.sensor.service` の切替判定ロジック、および `ui.edit.page` の `FileReader` Base64 → `pushSensorLogFile` 経路が変更されていない |
| TC-DEMO-003 | 閾値コメント一致 | `middleware.sensor.service` の切替箇所のコメントが「`<=0` 実センサー / `>0` デモ」と一致する |
| TC-DEMO-004 | smartphoneOnly 補充 | `cruise.smartphoneOnly` を投入したとき、`convertOldData` により canData がゼロ補充され、再生が停止しない |
| TC-DEMO-005 | 90 秒ログ再生 | `hiyari_recording.canConnected`（9000 行）を投入したとき、デモ再生が最後まで停止せずに完了する |

### 縮退モード検証

次の事項が未確定でも、層 1〜3 のうち下記の検証は独立に実施できる。これを最小合格ラインとする。

- 最小合格ラインに含める検証
  - 既承認プロファイルを持つ 5 シナリオ（cruise / accel_decel / hard_brake / sharp_curve / mixed）の単体検証
  - steer_* 3 シナリオの共通規則検証（TC-STR-001）
  - hiyari_recording の行数・区間制約・ベース走行検証（TC-HIY-001 / 005 / 006）
- 最小合格ラインの判定を妨げない未確定事項
  - steer_* のプロファイル定義
  - mixed の車速引き継ぎ規則
  - ヒヤリ判定オラクルの実装方法
  - BLE ペイロード変更

TC-SCN-004b / TC-STR-002 は blocked として別枠で報告し、最小合格ラインの判定には含めない。TC-HIY-002〜004 は判定オラクル（§16 Q12）が用意できない場合に blocked とする。

## 12. 失敗ゲート

以下のいずれかに該当したら FAIL とする。

- CLI の終了コードが非ゼロ
- セルフチェックの assert 失敗（行数不一致 / skip > 0 / 必須キー欠落）
- 正準 10 ファイルの再生成でバイト不一致（特に既存 9 ファイルのバイト列変化）
- `Math.random` の使用を検出
- `package.json` に新規依存が追加されている
- 変更禁止ファイル（§2）の差分を検出。ただし `middleware.sensor.service` の閾値コメント整合のみの修正は §16 Q7 の判断に従う
- canData が §8 の値域上限（accelPedalPosition 100 / brakePressure 126 / steeringAngle 1080 / frontDistance 127）を超える

## 13. 失敗時の証跡収集

CLI では screenshot や trace を取得できないため、次を収集する。

必須：

- `run_id`
- CLI 引数の全文
- stdout / stderr の全文
- 出力ファイルの SHA-256
- 出力ファイルの先頭 5 行・末尾 5 行のダンプ
- セルフチェックの assert 結果（行数 / skip 件数 / 欠落キー一覧）
- hiyari_recording の場合：検出した発火時刻の一覧と、各発火点の `|Jerk_LPF|` 値

任意：

- `git diff --stat`（ゴールデン不一致時）
- 不一致ファイルの旧版と新版でバイトが異なる位置
- Node / pako のバージョン

## 14. レポート形式

レポートは `qa_report.json` に記録する。

```
{
  "run_id": "...",
  "scenario": "hiyari_recording",
  "sensor_mode": "canConnected",
  "duration_sec": 90,
  "status": "PASS|FAIL",
  "row_count": 9000,
  "skip_count": 0,
  "missing_key_count": 0,
  "sha256": "...",
  "golden_match": true,
  "hiyari_detected_sec": [15, 30, 40, 45, 48, 60],
  "skipped_unapproved": [],
  "blocked_by_open_question": ["TC-SCN-004b", "TC-STR-002"],
  "fail_reason": null,
  "evidence_paths": ["..."],
  "reproduction_steps": ["node tools/gen-mock-sensorlog.mjs --scenario ... "]
}
```

`hiyari_detected_sec` は hiyari_recording のときのみ出力する。

## 15. 例外ルール

- 本ノードには 3rd party / 外部サービスへの依存がないため、allowlist は設けない。
- 未承認事項（LCG 乱数など §16 Q8 の残件）に対する検証は、仕様確定まで FAIL 判定の対象外（skip 扱い）とする。レポートには `skipped_unapproved` として明示する。
- approved facts 同士、または facts と単体シナリオ定義の間で定義不足・衝突があるテストは `blocked_by_open_question` として報告する。これは仕様未確定を理由とする扱いであり、FAIL とは区別する。

## 16. 未確定事項

| # | 事項 | 影響 | 判断ドメイン |
| --- | --- | --- | --- |
| Q1 | mixed の区間境界で車速を引き継ぐ規則（単体定義の始端速度と終端値が異なる） | TC-SCN-004b、mixed 正準ファイル内容（既存ファイルは不変） | design / middleware |
| Q2 | mixed 内 hard_brake 区間（D/4）での 3 イベント配置（重複する） | TC-SCN-001 を mixed に適用できるか、mixed の正準内容 | design |
| Q3 | smartphoneOnly 時の `geolocation.speed` と lat/lng 積分に使う速度（量子化前か後か） | TC-CAN-002 相当の検証をするか | design |
| Q4' | `floor(x+0.5)` を刻み単位（0.01 / 0.1 / 0.5）に換算して適用するか | TC-QNT-003 の期待値算出 | design |
| Q5 | `accelerationIncludingGravity` に使う latAcc/longAcc が量子化前か後か | 物理整合テスト、hiyari の Jerk 算出対象 | design |
| Q6 | pako バージョン固定の保証 | ゴールデン一致の安定性 | infra |
| Q7 | 閾値コメント整合のための修正が `src/data/src/app/**` 変更禁止とどう両立するか | 失敗ゲートの誤検知 | orchestrator / app |
| Q8 | steer_stable / steer_wobble_weak / steer_wobble_strong の物理プロファイル・duration（本ノードの approved facts に未記載）。LCG 乱数・duty 保持は引き続き未承認 | TC-STR-002 | design / middleware |
| Q9 | 2026 年度改修による CAN / BLE ペイロード長・割り当ての変更 | canData 構成、正準 10 ファイルの再生成 | middleware / BLE |
| Q10 | ペダル上限 100 / 126 の物理意味論（例：% / bar）と、論理値 120 / 200 を残す意図 | スコアロジック検証の期待値 | middleware |
| Q11 | 正準セット外の組合せを生成したときに警告を出すか | レポート表記 | QA / design |
| Q12 | ヒヤリ判定オラクルの実装（既存スコアロジックを読み取り専用で再利用するか、独立実装か）、判定入力が canData か acceleration か、T=0.05s と 10ms 刻みの関係、発火時刻の許容誤差 | TC-HIY-002〜004 | middleware / design |
| Q13 | hiyari_recording の latAcc パルスに yawRate / heading 変化を伴わせるか、および longAcc パルス中も車速を 40km/h 固定とするか | TC-HIY-006、TC-HEAD 系 | design |
| Q14 | hiyari_recording を 90 秒以外の duration で生成したときの扱い（発火点・区間の打ち切り、エラー化） | TC-CLI-007 の hiyari 期待値 | design |
| Q15 | 既存 9 ファイルが、新しい値域上限（100 / 126 / 1080 / 127）と floor 丸めで生成済みであるか | TC-REG-001 が PASS するか | design / QA |

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "正準コミットセットを 6 ファイルから 9 シナリオ 10 ファイルへ拡張し、steer_* と hiyari_recording は canConnected のみ commit、既存 9 ファイルのバイト列は不変と明記した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "--scenario の受理値を 9 種に拡張し、TC-CLI-007（9 種受理）と TC-GEN-007（正準外非 commit）を追加した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "canData 量子化を floor(x+0.5) 丸めに確定し、上限を accelPedalPosition=100 / brakePressure=126 / steeringAngle=1080 / frontDistance=127 に改訂して #12 の旧値域を置換した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "ペダル共通規則と hard_brake 相別ペダル値を論理値→クランプ後出力値（120→100、200→126）で記述し、TC-PED / TC-SCN-005 の期待値を更新した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "hiyari_recording シナリオ（duration 90・9000 行・15/30/40/45/48/60 秒発火・|Jerk_LPF|>0.4G/s・走行区間 9.0〜64.8 秒・評価窓 68.5〜76.5 秒除外・判定条件不変）を追加し TC-HIY-001〜006 を定義した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "steer_* 3 シナリオを共通規則検証（TC-STR-001）と、プロファイル未定義による blocked 検証（TC-STR-002）に分けて追加した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "ゴールデン比較を既存 9 ファイル（TC-REG-001）と新規 hiyari_recording（TC-REG-002）に分割し、失敗ゲートに値域上限超過を追加した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "§16 の Q4 を解消して Q4' に置換し、Q8 を steer_* のプロファイル未定義に縮小した。Q12〜Q15（ヒヤリ判定オラクル、hiyari の物理整合、duration 例外、既存ファイルの上限整合）を新設した"},
    {"node": "qa.mockdata.sensorlog.generator", "entrypoint": "spec/qa/mockdata-sensorlog-generator.md", "description": "qa_report.json に hiyari_detected_sec を追加し、失敗時の証跡に発火時刻一覧と |Jerk_LPF| 値を追加した"}
  ],
  "suggested_impacts": [
    {"domain": "design", "severity": "must", "reason": "steer_stable / steer_wobble_weak / steer_wobble_strong の物理プロファイルと duration が本ノードの approved facts に無く、TC-STR-002 を確定できない"},
    {"domain": "middleware", "severity": "must", "reason": "hiyari_recording の検証に使うヒヤリ判定オラクル（1 次 IIR T=0.05s F=2Hz・1 秒抑止）の再利用方法、判定入力信号、発火時刻の許容誤差の確定が必要"},
    {"domain": "design", "severity": "must", "reason": "mixed の区間境界で車速を引き継ぐ規則と、hard_brake 区間のイベント配置が未定義のままで、TC-SCN-004b が blocked"},
    {"domain": "design", "severity": "should", "reason": "既存 9 ファイルが新しい値域上限（100/126/1080/127）と floor(x+0.5) 丸めで生成済みかを確認しないと、TC-REG-001 が不一致になるおそれがある"},
    {"domain": "middleware", "severity": "should", "reason": "ペダル上限 100 / 126 の物理意味論と、BLE デコードスケールとの整合確認が必要"},
    {"domain": "middleware", "severity": "should", "reason": "2026 年度改修で CAN / BLE ペイロードの長さや割り当てが変わる場合、canData 構成と正準 10 ファイルの再生成が必要"},
    {"domain": "app", "severity": "should", "reason": "hiyari_recording は、30 秒以内の連続ヒヤリ（30/40/45/48 秒など）を含む 90 秒ログとして録画機能の検証入力に使えるため、録画側テストとの接続を検討してほしい"},
    {"domain": "infra", "severity": "should", "reason": "正準 10 ファイルのゴールデン比較を CI で行うため、Node 18.19.1 と pako バージョンの固定、および TZ を変えた 2 回実行が必要"}
  ],
  "requirements_context": "モックセンサログ生成器 src/data/tools/gen-mock-sensorlog.mjs は Node 18.19.1 単体で実行でき、新規 npm 依存を追加せず既存 pako のみを使う。CLI は node tools/gen-mock-sensorlog.mjs --scenario <cruise|accel_decel|hard_brake|sharp_curve|mixed|steer_stable|steer_wobble_weak|steer_wobble_strong|hiyari_recording> --sensor-mode <smartphoneOnly|canConnected> --duration <sec> --out <dir> [--base-time <ISO8601>]。--scenario は 9 種以外を指定すると非ゼロ終了、--sensor-mode は必須で未指定なら非ゼロ終了する。duration 既定 60 秒、刻み 10ms で行数 = duration*100。出力は <out>/sensor-log.<scenario>.<sensorMode>.txt.gz で、JSON Lines を pako.gzip したもの（Base64 しない）。正準 commit セットは src/data/mock/ の 9 シナリオ 10 ファイル：cruise×smartphoneOnly、cruise×canConnected、accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong / hiyari_recording の各 canConnected。steer_* と hiyari_recording の smartphoneOnly 版は生成可能だが commit しない。既存 9 ファイルのバイト列は変更しない。スクリプトと正準 10 ファイルを commit する。各行は JSON.stringify({date,sensor})。sensor.timestamp = baseMs + i*10、baseMs 既定は T0_MS = Date.parse('2026-07-01T10:00:00.000+09:00')。timestamp は参考値で、再生時は DemoData.getSensorLogData() が Date.now() で上書きする。date は常に JST で 'YYYY-MM-DD HH:mm:ss.SSS' に整形し、ローカル TZ に依存しない。videoTime / geolocation / acceleration / gyroscope / magnetometer は毎行必須。端末姿勢は画面上・水平固定（+y=前進、+x=右、+z=上）。accelerationIncludingGravity={x:latAcc*9.80665, y:longAcc*9.80665, z:9.80665}、rotationRate={0,0,alpha:yawRate}、interval=10、gyroscope.alpha=heading、magnetometer={x:-30.2*sin(h), y:30.2*cos(h), z:-34.7}、altitude=5.0 / altitudeAccuracy=3.0 / accuracy=5.0。初期 heading=0.0 で、yawRate*dt を積分し 0..360 に正規化する。シナリオ定義は次のとおり。cruise は 40km/h 直進。accel_decel は 20s 周期（0-8s 7.5*t km/h +0.21G、8-12s 60km/h、12-20s 減速 -0.21G）で 60 秒 3 サイクル。hard_brake は D*0.20/0.45/0.70 で 3 回、制動 3.0s 60→10km/h 平均 ≈-0.47G、回復 4.0s ≈+0.35G。sharp_curve は 40km/h・yawRate=A*sin(2πt/8)・A≈15.2deg/s・latAcc>=0.30G・steeringAngle ピーク ±180。mixed は D を 4 等分して cruise→accel_decel→hard_brake→sharp_curve を連結し、videoTime 連続・車速/heading/lat/lng 引き継ぎ（車速の引き継ぎ規則とイベント配置は未定義）。steer_* 3 シナリオは正準セットに含むがプロファイルは本ノードの facts に未定義。hiyari_recording は canConnected・--duration 90・9000 行、ヒヤリを 15/30/40/45/48/60 秒の 6 点で発火させ、longAcc/latAcc に |Jerk_LPF|>0.4G/s のプロファイルを置き、それ以外は cruise 40km/h 定速を流用する。全発火は走行区間 9.0〜64.8 秒内とし、評価窓 68.5〜76.5 秒に掛けない。ヒヤリ判定条件（1 次 IIR T=0.05s F=2Hz、発火後 1 秒抑止）は変更しない。ペダル状態は量子化前 longAcc で全シナリオ共通に判定する：>+0.02G は accelPedalPosition=120 を 100 にクランプ・brakePressure 0・brakeSwitch 0、<-0.02G は 0・brakePressure=200 を 126 にクランプ・1、それ以外は 40/0/0。canData は canConnected のときのみ 12 フィールドを全行に出力し、smartphoneOnly ではキーを省略して convertOldData のゼロ補充に委ねる。量子化は出力直前に floor(x+0.5) で行う：vehicleSpeed 整数[0,255]、longAcc/latAcc 0.01 刻み[-1.28,1.27]、frontDistance 0.5 刻み[0,127] 定数 50.0、lateralDistance 0.5 刻み[-64,63.5] 定数 0.0、steeringAngle 0.1 刻み[-1080,1080]、accelPedalPosition 整数[0,100]、brakePressure 整数[0,126]、shiftIndication=4、turnSignal=0、repeat=0（-1 禁止）。canConnected では geolocation.speed = 量子化後 vehicleSpeed/3.6。GPS は起点 (35.681236,139.767125) からの決定的計算とし、Math.random は禁止。セルフチェックは ungzip と parse で行数 = duration*100・skip 0・必須キー欠落 0 を assert し、不成立なら非ゼロ終了する。同一引数でバイト一致、TZ を変えてもバイト一致、正準 10 ファイル再生成で git diff 空（特に既存 9 ファイル不変）を最上位の受け入れ条件とし、不一致時は上書きせず CI を fail させる。変更禁止は scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE 符号化 / エミュレータ。DB シード・webm・infra.assets.geolocation は非対象。middleware.sensor.service の閾値 getSensorLogDataSize()>0（<=0 実センサー / >0 デモ）は判定を変えずにコメントを一致させる。ui.edit.page の FileReader Base64→pushSensorLogFile は現行どおり。テストは存在・相互作用・業務ルール・統合の 4 層で構成し、縮退モードの最小合格ラインは既承認プロファイル 5 シナリオの単体検証・steer_* 共通規則・hiyari の行数/区間/ベース走行とする。定義未確定のテストは blocked_by_open_question、未承認事項は skipped_unapproved として FAIL と区別する。失敗時の証跡は run_id、CLI 引数、stdout/stderr、SHA-256、先頭末尾 5 行、assert 結果、hiyari の検出発火時刻と |Jerk_LPF| とする。2026 年度改修の CAN / BLE ペイロード変更やスコア形式変更は、canData 構成と正準ファイルに影響し得るが未確定。",
  "fact_candidates": [
    {"type": "validation_rule", "title": "CLI は 9 シナリオのみを受理する", "statement": "--scenario に定義済み 9 種以外を指定すると CLI は非ゼロ終了する", "status": "candidate"},
    {"type": "qa_expectation", "title": "9 シナリオはすべて生成可能", "statement": "9 シナリオそれぞれを smartphoneOnly / canConnected で指定すると、終了コード 0 で出力ファイルが 1 個生成される", "status": "candidate"},
    {"type": "validation_rule", "title": "--sensor-mode 未指定は失敗", "statement": "--sensor-mode が未指定の場合、ファイルは生成されず CLI は非ゼロ終了する", "status": "candidate"},
    {"type": "qa_expectation", "title": "出力は gzip バイナリである", "statement": "出力ファイルの先頭 2 バイトは gzip マジック 1f 8b である", "status": "candidate"},
    {"type": "qa_expectation", "title": "正準セットは 10 ファイル", "statement": "src/data/mock/ の正準モックセンサログは §4 の 10 組合せと過不足なく一致する", "status": "candidate"},
    {"type": "qa_expectation", "title": "steer_* と hiyari の smartphoneOnly は commit されない", "statement": "src/data/mock/ に steer_* および hiyari_recording の smartphoneOnly 版ファイルは存在しない", "status": "candidate"},
    {"type": "qa_expectation", "title": "既存 9 ファイルは不変", "statement": "既存 9 正準ファイルを再生成した結果は従前のバイト列と一致する", "status": "candidate"},
    {"type": "qa_expectation", "title": "行数は duration*100", "statement": "ungzip 後の JSON Lines の行数は duration*100 に等しい", "status": "candidate"},
    {"type": "qa_expectation", "title": "parse skip は 0", "statement": "セルフチェックで JSON パース失敗により skip される行は 0 件である", "status": "candidate"},
    {"type": "qa_expectation", "title": "必須キー欠落は 0", "statement": "全行が date と sensor を持ち、sensor は videoTime/geolocation/acceleration/gyroscope/magnetometer を含む", "status": "candidate"},
    {"type": "data_semantics", "title": "timestamp は 10ms 等間隔", "statement": "隣接行の sensor.timestamp の差は常に 10 である", "status": "candidate"},
    {"type": "data_semantics", "title": "date は JST 固定", "statement": "各行の date は同じ行の timestamp を UTC+9 で整形した値で、実行環境の TZ に依存しない", "status": "candidate"},
    {"type": "data_semantics", "title": "既定基準時刻", "statement": "--base-time を省略した場合、先頭行の date は '2026-07-01 10:00:00.000' である", "status": "candidate"},
    {"type": "business_rule", "title": "初期 heading は 0.0", "statement": "全シナリオで先頭行の gyroscope.alpha は 0.0 である", "status": "candidate"},
    {"type": "business_rule", "title": "heading の値域", "statement": "全行で heading は 0 以上 360 未満である", "status": "candidate"},
    {"type": "constraint", "title": "量子化の丸めは floor(x+0.5)", "statement": "canData の量子化値は量子化前の値を floor(x+0.5) で丸めた値である", "status": "candidate"},
    {"type": "constraint", "title": "accelPedalPosition 上限 100", "statement": "canConnected の全行で canData.accelPedalPosition は 100 以下である", "status": "candidate"},
    {"type": "constraint", "title": "brakePressure 上限 126", "statement": "canConnected の全行で canData.brakePressure は 126 以下である", "status": "candidate"},
    {"type": "constraint", "title": "steeringAngle 上限 1080", "statement": "canConnected の全行で canData.steeringAngle の絶対値は 1080 以下である", "status": "candidate"},
    {"type": "constraint", "title": "frontDistance 上限 127", "statement": "canConnected の全行で canData.frontDistance は 127 以下である", "status": "candidate"},
    {"type": "business_rule", "title": "加速時ペダル出力値", "statement": "量子化前 longAcc > +0.02G の行は accelPedalPosition=100、brakePressure=0、brakeSwitch=0 で出力される", "status": "candidate"},
    {"type": "business_rule", "title": "減速時ペダル出力値", "statement": "量子化前 longAcc < -0.02G の行は accelPedalPosition=0、brakePressure=126、brakeSwitch=1 で出力される", "status": "candidate"},
    {"type": "business_rule", "title": "定常時ペダル出力値", "statement": "量子化前 longAcc が -0.02G 以上 +0.02G 以下の行は accelPedalPosition=40、brakePressure=0、brakeSwitch=0 である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hard_brake の制動イベントは 3 回", "statement": "hard_brake の canConnected 出力で longAcc <= -0.35G の制動イベントが 3 回検出される", "status": "candidate"},
    {"type": "qa_expectation", "title": "sharp_curve の横加速度ピーク", "statement": "sharp_curve の量子化後 canData.latAcc の最大値は 0.30 以上である", "status": "candidate"},
    {"type": "qa_expectation", "title": "sharp_curve の操舵ピーク", "statement": "sharp_curve の canData.steeringAngle のピークは ±180deg である", "status": "candidate"},
    {"type": "qa_expectation", "title": "accel_decel は 3 サイクル", "statement": "duration=60 の accel_decel には 20 秒周期がちょうど 3 サイクル含まれる", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recording は 9000 行", "statement": "hiyari_recording を --duration 90 で生成した出力は 9000 行である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recording の発火点は 6 点", "statement": "既存のヒヤリ判定条件を適用すると、hiyari_recording は 15/30/40/45/48/60 秒でヒヤリが発火する", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recording は指定点以外で発火しない", "statement": "hiyari_recording では指定 6 点以外にヒヤリ発火が検出されない", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari 発火点の Jerk 閾値", "statement": "hiyari_recording の各発火点で |Jerk_LPF| は 0.4 G/s を超える", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari 発火は走行区間内", "statement": "hiyari_recording の全ヒヤリ発火時刻は 9.0〜64.8 秒内にある", "status": "candidate"},
    {"type": "qa_expectation", "title": "評価窓に発火しない", "statement": "hiyari_recording の 68.5〜76.5 秒にヒヤリ発火は存在しない", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari のベース走行は cruise", "statement": "hiyari_recording のヒヤリ以外の成分は cruise 40km/h 定速プロファイルと一致する", "status": "candidate"},
    {"type": "constraint", "title": "ヒヤリ判定条件は不変", "statement": "ヒヤリ判定条件（1 次 IIR T=0.05s F=2Hz、発火後 1 秒抑止）は本ノードの作業で変更されない", "status": "candidate"},
    {"type": "data_semantics", "title": "smartphoneOnly は canData キーを持たない", "statement": "sensorMode=smartphoneOnly の出力は全行で sensor.canData キーを含まない", "status": "candidate"},
    {"type": "data_semantics", "title": "canConnected は canData 12 フィールドを持つ", "statement": "sensorMode=canConnected の出力は全行で canData の 12 フィールドを含む", "status": "candidate"},
    {"type": "data_semantics", "title": "repeat は 0 固定", "statement": "canConnected の全行で canData.repeat は 0 であり、-1 は現れない", "status": "candidate"},
    {"type": "data_semantics", "title": "GPS 速度と車速の整合", "statement": "canConnected の各行で geolocation.speed は量子化後 canData.vehicleSpeed/3.6 と一致する", "status": "candidate"},
    {"type": "constraint", "title": "乱数不使用", "statement": "生成スクリプトのソースに Math.random の呼び出しが存在しない", "status": "candidate"},
    {"type": "qa_expectation", "title": "生成の決定性", "statement": "同一 CLI 引数で 2 回生成した出力はバイト一致する", "status": "candidate"},
    {"type": "qa_expectation", "title": "TZ 非依存", "statement": "TZ=UTC と TZ=Asia/Tokyo で同一引数から生成した出力はバイト一致する", "status": "candidate"},
    {"type": "constraint", "title": "不一致時は上書きしない", "statement": "正準ファイル再生成でバイト不一致が生じた場合、そのファイルは上書きされず検証は失敗となる", "status": "candidate"},
    {"type": "qa_expectation", "title": "デモ再生への切替", "statement": "正準ファイルを編集画面から投入すると DemoData.getSensorLogDataSize()>0 となり、デモ再生モードに切り替わる", "status": "candidate"},
    {"type": "qa_expectation", "title": "閾値コメントの一致", "statement": "middleware.sensor.service の切替箇所のコメントは『<=0 実センサー / >0 デモ』と一致する", "status": "candidate"},
    {"type": "qa_expectation", "title": "失敗時証跡", "statement": "検証失敗時は run_id / CLI 引数 / stdout・stderr / SHA-256 / 先頭末尾 5 行 / assert 結果を収集する", "status": "candidate"}
  ],
  "open_questions": [
    "steer_stable / steer_wobble_weak / steer_wobble_strong は正準セットに含まれるが、物理プロファイルと duration が本ノードの approved facts に記載されていない。design / middleware の確定が必要で、TC-STR-002 が blocked となる。",
    "hiyari_recording の発火検証に使う判定オラクルが未確定。既存スコアロジックを読み取り専用で再利用するか独立実装するか、判定入力が canData か acceleration か、T=0.05s と 10ms 刻みの関係、発火時刻の許容誤差を middleware / design で確定する必要があり、TC-HIY-002〜004 に影響する。",
    "hiyari_recording の longAcc パルス中も vehicleSpeed を 40km/h 固定とするか、latAcc パルスに yawRate / heading 変化を伴わせるかが未規定。物理整合と TC-HIY-006 / TC-HEAD 系の期待値に影響する（design）。",
    "hiyari_recording を 90 秒以外の duration で生成した場合の扱い（打ち切り・エラー化）が未規定。CLI テストの期待値に影響する（design）。",
    "floor(x+0.5) を 0.01 / 0.1 / 0.5 刻みのフィールドで刻み単位に換算して適用するかが facts では明示されていない。TC-QNT-003 の期待値に影響する（design）。",
    "既存 9 ファイルが新しい値域上限（100/126/1080/127）と floor 丸めで既に生成されているかが未確認。旧 #12 の上限で生成されていれば、バイト不変要件と上限改訂が衝突し TC-REG-001 が FAIL する（design / QA）。",
    "mixed の区間境界で車速を引き継ぐ規則と、hard_brake 区間（D/4）での 3 イベント配置が未定義のまま。TC-SCN-004b が blocked（design）。",
    "smartphoneOnly 時の geolocation.speed と lat/lng 積分に量子化前・後どちらの速度を使うか、および accelerationIncludingGravity に使う latAcc/longAcc が量子化前か後かが未規定（design）。",
    "ゴールデン比較のため pako バージョンがロックファイルで固定されていることの確認が未了（infra）。",
    "middleware.sensor.service の閾値コメント修正が src/data/src/app/** 変更禁止と両立するかの判断が必要（orchestrator / app）。",
    "ペダル上限 100 / 126 の物理意味論と、論理値 120 / 200 を規則上に残す意図が不明。BLE デコードスケールとの整合確認が必要（middleware）。",
    "2026 年度改修で CAN / BLE ペイロード長・割り当てが変わる可能性がある。canData 構成と正準 10 ファイルの再生成が必要になり得る（middleware / BLE 確定待ち）。",
    "レーダーチャート 6 項目の採点データ形式は先方検討中で、スコアロジック凍結も未解除。モックログからのスコア期待値は固定できない。",
    "正準セット外の組合せを生成したときに警告を出すか未確定（QA / design）。"
  ],
  "rationale_notes": [
    "新しい approved fact（値域上限 100/126/1080/127、floor 丸め）は旧 #12 の値域表と矛盾するため、指示どおり facts を真として §8 を置換した。ペダル規則は論理値とクランプ後の出力値を併記し、テスト期待値を出力値で書くことで、旧記述との対応を追跡可能にした。",
    "『既存 9 ファイルのバイト列は変更しない』という fact は、steer_* 3 ファイルが既に commit 済みであることを示唆する。一方で、値域改訂の前後関係は facts から読み取れない。そのため断定せず Q15 として分離した。",
    "hiyari_recording の発火点の最小間隔は 3 秒（45→48 秒）で、1 秒抑止より長い。したがって 6 点すべてが個別に検出されることを合格条件にできる。",
    "hiyari_recording の 30/40/45/48 秒は 30 秒以内の連続ヒヤリを含む。共通 fact の『連続ヒヤリ時の動画生成は実装都合で選んでよいが、個別に確認できること』を録画側が検証する際の入力として有用と考え、App への suggested_impacts に記載した。",
    "steer_* は正準セットの構成要素としては approved だが、プロファイル定義が手元の facts に無い。推測で期待値を置かず、共通規則検証と blocked 検証に分けた。",
    "ヒヤリ判定条件はスコアロジック側の資産で変更禁止である。QA はそれを変更せずにオラクルとして適用する立場を明確にし、オラクルの実装方法は Q12 に分離した。",
    "本ノードは Node CLI で UI を持たないため、ui-runtime-validation 型ゲートは適用対象外とし、終了コード・セルフチェック・バイト一致を失敗ゲートとする方針を維持した。",
    "未承認事項は skipped_unapproved、facts の定義不足は blocked_by_open_question とし、FAIL と区別する方針を維持した。"
  ]
}
```