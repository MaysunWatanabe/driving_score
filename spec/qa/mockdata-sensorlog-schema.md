<!-- 作成: 2026-09-10 17:39:40 JST -->

以下を `spec/qa/mockdata-sensorlog-schema.md` として生成（新規）します。

---

# spec/qa/mockdata-sensorlog-schema.md

## 1. 目的

デモ再生（UC12:編集とデモ再生）および運転診断（UC06:運転診断の実行）の検証で使用する
**合成センサログ（モックデータ）の 1 レコード正準スキーマ**と、
その**受け入れ条件（合格条件）／失敗条件**を定義する。

本仕様は「どう生成するか」ではなく
**「どの形になっていれば検証データとして合格か」** を規定する。

対象:

- 合成センサログの 1 行スキーマ
- 単位・座標系・派生式
- canData のモード差（smartphoneOnly / canConnected）
- 量子化（物理値域）
- 出力コンテナ（JSON Lines / gzip / Base64）
- スキーマ検証（VR-xxx）と E2E 検証（TC-xxx）

対象外:

- 実車採取ログの取得手順
- スコアロジックの評価モデルそのものの妥当性
- 書き出しディレクトリ規約（別ノード）

---

## 2. 正準スキーマ（1 レコード = 1 行）

### 2.1 行の形

1 行は **改行を含まない `JSON.stringify({ date, sensor })` の結果** であること。

```
{"date":"2025-01-15 09:00:00.000","sensor":{ ... }}
```

合格条件:

- トップレベルのキーは `date` と `sensor` の 2 つのみ
- 1 行に 2 つ以上の JSON オブジェクトを含まない
- 行内に生の改行・タブを含まない

### 2.2 `date`

- 書式: `YYYY-MM-DD HH:mm:ss.SSS`
- **JST 固定整形**（+09:00 相当の壁時計表記）
- 実行環境のローカルタイムゾーンに依存して値が変化してはならない
  （TZ=UTC / TZ=Asia/Tokyo / TZ=America/Los_Angeles で同一ファイルが生成される）
- ミリ秒は常に 3 桁ゼロ埋め
- ファイル内で **単調非減少**

### 2.3 `sensor` 必須キー

以下 5 キーは **常に存在**すること。

| キー | 内容 |
|---|---|
| `videoTime` | デモ再生用の動画同期時刻 |
| `geolocation` | W3C Geolocation `coords` 相当 |
| `acceleration` | W3C DeviceMotionEvent 相当 |
| `gyroscope` | 方位系（下記 2.6） |
| `magnetometer` | 地磁気（µT） |

`canData` は **モード依存キー**であり、必須キーには含めない（第 4 章）。

---

## 3. 端末姿勢と座標系（合成の前提）

合成データは以下の**固定姿勢**を前提とする。

- 端末は画面を上に向け、水平なダッシュボード上に固定
- `+y` = 車両前進方向
- `+x` = 車両右方向
- `+z` = 鉛直上方向

この前提により、静止時の重力は `z = +9.80665` に現れ、
`x` / `y` は車両加速度のみを反映する。

---

## 4. `canData` のモード差

### 4.1 smartphoneOnly

- `canData` **キー自体を省略**する（`null` / `{}` / 空文字を置かない）
- ゼロ補充は `convertOldData` 側の責務に委譲する
- 実装実態として、smartphoneOnly では `lastCanData` がゼロ埋めされ
  CAN 依存指標が発火しないため、**診断結果は全項目 100（未算出）となる**
  （spec/middleware/sensor-service.md、spec/middleware/score-logicCan.md の実装実態と整合）

### 4.2 canConnected

`canData` の**全フィールドを明示**する（欠落キー禁止）。

```
vehicleSpeed, longAcc, latAcc, frontDistance, lateralDistance,
steeringAngle, accelPedalPosition, brakePressure, brakeSwitch,
shiftIndication, turnSignal, repeat
```

### 4.3 `repeat`

- 合成データでは **常に `0`**
- `-1` を出力してはならない（`-1` は評価対象外を意味するため、合成データでは診断が空回りする）

---

## 5. 派生式（合成値の正準定義）

`h` = 進行方位（heading）、`yawRate` = ヨーレート。

### 5.1 `acceleration`

| フィールド | 値 |
|---|---|
| `accelerationIncludingGravity.x` | `latAcc * 9.80665` |
| `accelerationIncludingGravity.y` | `longAcc * 9.80665` |
| `accelerationIncludingGravity.z` | `9.80665`（固定） |
| `rotationRate.alpha` | `yawRate` |
| `rotationRate.beta` | `0`（固定） |
| `rotationRate.gamma` | `0`（固定） |
| `interval` | `10`（固定） |

### 5.2 `gyroscope`

- `{ 0, 0, h }`（第 3 成分に方位を格納）

### 5.3 `magnetometer`（µT）

| フィールド | 値 |
|---|---|
| `x` | `-30.2 * sin(h)` |
| `y` | `30.2 * cos(h)` |
| `z` | `-34.7`（固定） |

水平成分のノルムは常に `≈ 30.2`。

### 5.4 `geolocation`

| フィールド | 値 |
|---|---|
| `altitude` | `5.0`（固定） |
| `altitudeAccuracy` | `3.0`（固定） |
| `accuracy` | `5.0`（固定） |
| `latitude` / `longitude` | 走行軌跡に沿った値 |

単位は W3C Geolocation に準拠（緯度経度: 度、altitude/accuracy: m）。

---

## 6. `canData` 量子化（物理値域）

合成値は BLE デコードスケールと同一の量子化格子に載っていること。
**値 ÷ 刻み が整数**であり、かつ範囲内であること。

| フィールド | 刻み | 範囲 | 合成時の扱い |
|---|---|---|---|
| `vehicleSpeed` | 1（整数） | `0 .. 255` | 走行値 |
| `longAcc` | 0.01 | `-1.28 .. 1.27` | 走行値（G） |
| `latAcc` | 0.01 | `-1.28 .. 1.27` | 走行値（G） |
| `frontDistance` | 0.5 | `0 .. 127` | 定数 `50.0` |
| `lateralDistance` | 0.5 | `-64 .. 63.5` | 定数 `0.0` |
| `steeringAngle` | 0.1 | 上限 `1080` | 走行値（deg） |
| `accelPedalPosition` | — | 上限 `100` | 走行値（%） |
| `brakePressure` | — | 上限 `126` | 走行値 |
| `brakeSwitch` | — | 列挙 | 制動状態 |
| `shiftIndication` | — | 列挙値 | シフト遷移の再現に使用 |
| `turnSignal` | — | 列挙値 | 走行値 |
| `repeat` | — | `0` 固定 | 第 4.3 章 |

物理値域外・格子外の値は **不正データ**として扱う。

---

## 7. 出力コンテナ

- 論理形式: **JSON Lines**（1 レコード 1 行、改行区切り）
- 物理形式: JSON Lines を **`pako.gzip` した `.txt.gz`**
- `pako.ungzip` → UTF-8 デコード → 行分割で、全行が第 2 章スキーマとして解釈できること
- **Base64 化は `ui.edit.page` へ投入するときのみ**の変換であり、
  ファイル配布形式は Base64 ではない

---

## 8. Validation Rules（失敗条件ゲート）

いずれかに違反した場合 **FAIL**。

| ID | ルール |
|---|---|
| VR-001 | 全行が `JSON.parse` 可能で、トップレベルキーが `date` / `sensor` のみ |
| VR-002 | `date` が `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$` に一致 |
| VR-003 | TZ を変えて生成しても `date` 列が完全一致（JST 固定整形） |
| VR-004 | `date` が単調非減少 |
| VR-005 | `videoTime` / `geolocation` / `acceleration` / `gyroscope` / `magnetometer` が全行に存在 |
| VR-006 | 全数値が有限（`NaN` / `Infinity` / `null` / 文字列数値 を含まない） |
| VR-007 | `accelerationIncludingGravity.z == 9.80665` |
| VR-008 | `rotationRate.beta == 0` かつ `rotationRate.gamma == 0` |
| VR-009 | `acceleration.interval == 10` |
| VR-010 | `magnetometer.z == -34.7` かつ `hypot(x, y) ≈ 30.2`（許容 1e-3） |
| VR-011 | `geolocation.altitude == 5.0` / `altitudeAccuracy == 3.0` / `accuracy == 5.0` |
| VR-012 | smartphoneOnly: `canData` キーが 1 行も存在しない |
| VR-013 | canConnected: 全行に `canData` が存在し、12 フィールドすべてが揃う |
| VR-014 | canConnected: `canData` 各値が第 6 章の刻み・範囲を満たす |
| VR-015 | canConnected: `repeat == 0`（`-1` が 1 件でもあれば FAIL） |
| VR-016 | canConnected: `accelerationIncludingGravity.x ≈ latAcc*9.80665`、`y ≈ longAcc*9.80665`（許容 1e-6） |
| VR-017 | canConnected: `frontDistance == 50.0`、`lateralDistance == 0.0` |
| VR-018 | 配布物が `.txt.gz` で、`pako.ungzip` に成功する（Base64 二重化されていない） |
| VR-019 | 解凍後の末尾改行を除き空行が存在しない |

---

## 9. テストケース

検証は **存在確認 → 相互作用 → 業務ルール** の 3 層に分ける。
上位層が未実装・不安定でも下位層は独立して合否判定できること。

### 9.1 Layer 1: 存在確認（スキーマ単体、UI 不要）

| ID | 内容 | 合格条件 |
|---|---|---|
| TC-MOCK-001 | smartphoneOnly データのスキーマ検証 | VR-001〜012、018、019 を満たす |
| TC-MOCK-002 | canConnected データのスキーマ検証 | VR-001〜011、013〜019 を満たす |
| TC-MOCK-003 | TZ 非依存性 | `TZ=UTC` / `TZ=Asia/Tokyo` / `TZ=America/Los_Angeles` で生成物のバイト列（または `date` 列）が一致 |
| TC-MOCK-004 | 座標系整合 | 静止区間で `x≈0, y≈0, z=9.80665`、前進加速区間で `y>0` |
| TC-MOCK-005 | 量子化格子 | `canData` の全数値が刻みの整数倍かつ範囲内 |
| TC-MOCK-006 | 異常値検出（ネガティブ） | `repeat=-1` を含む不正ファイルを与えると検証器が FAIL を返す |

### 9.2 Layer 2: 相互作用（UI 投入・デモ再生）

`data-testid` ベースのセレクタで確認する。CSS クラス・DOM 階層に依存しない。

| ID | 内容 | 合格条件 |
|---|---|---|
| TC-DEMO-001 | `ui.edit.page` へ Base64 投入 | 投入後に `pageerror` / `console.error` が 0 件、データ読込完了状態が表示される |
| TC-DEMO-002 | デモ再生開始 | 再生時刻が `videoTime` に同期して進行し、停止・再開が可能 |
| TC-DEMO-003 | 生 `.txt.gz` の直接投入 | Base64 前提の経路に生 gz を渡した場合、クラッシュせず入力エラーとして扱われる |

### 9.3 Layer 3: 業務ルール（UC06 診断）

| ID | 内容 | 合格条件 |
|---|---|---|
| TC-DIAG-001 | canConnected データで診断実行 | 診断が完走し、`score1` / `score2` / `scoreA` / `scoreB` / `overAll` が設定される |
| TC-DIAG-002 | 未設定スコアの扱い | `score3` / `score4` / `scoreC` は未設定のままであり、UI ラベル（label3/label4/labelC が空）と整合する |
| TC-DIAG-003 | smartphoneOnly データで診断実行 | CAN 依存指標が発火せず、**全項目 100（未算出）** となる（実装実態） |
| TC-DIAG-004 | 初回 100 混入 | 平均値が `(評価窓合計 + 100) / (窓数 + 1)` と一致する（実装実態としての期待値） |
| TC-DIAG-005 | シフト遷移シナリオ | `shiftIndication` の `D→R`（直前 8 秒）→ 切り返し → `P` を含むデータで `score1` が確定する |
| TC-DIAG-006 | ヒヤリ | ヒヤリ条件を含むデータで `hiyari=true` とメッセージが出るが、**スコア値は変化しない**（実装実態） |

---

## 10. Degraded-mode Validation

サブシステムが未完成でも検証を止めないため、以下の縮退運転を許容する。

- CAN / BLE 実機が無い場合: canConnected 合成データで代替し、Layer 1・Layer 3 を実行する
- 診断ロジックが不安定な場合: Layer 1・Layer 2 のみで合否判定し、Layer 3 は `skipped` として報告する（`passed` 扱いにしない）
- 認証が失敗する場合: `auth-bypass`（dev/test 限定）で Layer 2 を継続し、認証系は `auth-real` 側で別管理する
- 外部依存（地図・通信）は dev/test でモック／バイパス可能。ただし allowlist は期限付きとする

---

## 11. Artifact / レポート

失敗時に必ず収集する。

- screenshot
- trace
- console log
- network log
- 検証対象ファイルの SHA-256 と先頭 3 行 / 末尾 3 行（解凍後）
- 違反した VR-ID と違反行番号

`qa_report.json`

- `run_id`
- `status`（passed / failed / skipped）
- `fail_reason`（VR-ID を含む）
- `evidence_paths`
- `reproduction_steps`（データ生成パラメータ、TZ、モード）

---

## 12. 未解決事項

第 12 章の内容は `open_questions` と同期する（下記 JSON 参照）。
確定するまで、該当項目は検証器の **警告（warn）** とし FAIL 条件に含めない。

---

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "1レコード正準スキーマ（date/sensor、必須5キー、派生式、量子化、gzip出力）とVR-001〜019の失敗条件を新規定義"},
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "検証を存在確認/相互作用/業務ルールの3層に分離し、Layer3未完でもLayer1-2で合否判定できる縮退運転を定義"},
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "smartphoneOnlyはcanDataキー省略・canConnectedは12フィールド全明示というモード差を受入条件として明記"},
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "JST固定整形のTZ非依存性テスト（TZ=UTC/Asia/Tokyo/America/Los_Angelesで生成物一致）を必須化"},
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "smartphoneOnlyでは全項目100（未算出）、平均に初回100が混入するという実装実態を期待値として固定"},
    {"node": "qa.mockdata.sensorlog.schema", "entrypoint": "spec/qa/mockdata-sensorlog-schema.md", "description": "失敗時アーティファクトに解凍後の先頭/末尾3行・SHA-256・違反VR-IDと行番号を追加"}
  ],
  "suggested_impacts": [
    {"domain": "app", "severity": "must", "reason": "ui.edit.page のデータ投入完了状態と再生制御に data-testid が必要（Layer2 の TC-DEMO-001/002 が固定セレクタで判定できない）"},
    {"domain": "middleware", "severity": "must", "reason": "convertOldData のゼロ補充仕様（canData 省略時の既定値）が正準として文書化されないと VR-012 の妥当性を担保できない"},
    {"domain": "middleware", "severity": "should", "reason": "shiftIndication / turnSignal / brakeSwitch の列挙値定義と accelPedalPosition / brakePressure の量子化刻みの確定が必要"},
    {"domain": "infra", "severity": "should", "reason": "モックデータ生成器と VR 検証器を CI ゲート化し、TZ 3種のマトリクス実行と .txt.gz アーティファクト保存が必要"},
    {"domain": "app", "severity": "should", "reason": "生 .txt.gz を Base64 前提経路に渡した場合の入力エラー表示（TC-DEMO-003）の挙動定義が必要"},
    {"domain": "middleware", "severity": "could", "reason": "acceleration.acceleration（重力除去成分）を合成データに含めるか否かの判断があるとスキーマが完全に閉じる"}
  ],
  "requirements_context": "【対象】UC12（編集とデモ再生）およびUC06（運転診断の実行）で使用する合成センサログの1レコード正準スキーマと、その受け入れ条件・失敗条件をQA観点で定義する。【行形式】1行=改行を含まないJSON.stringify({date, sensor})。トップレベルキーはdateとsensorのみ。【date】書式 YYYY-MM-DD HH:mm:ss.SSS、JST固定整形でありローカルTZに依存して値が変化してはならない。ミリ秒3桁ゼロ埋め、ファイル内で単調非減少。【必須キー】sensor直下に videoTime / geolocation / acceleration / gyroscope / magnetometer が常に存在する。canDataはモード依存キーであり必須キーに含めない。【単位】W3C DeviceMotion / W3C Geolocation および既存BLEデコードスケールに準拠。【端末姿勢】画面上向き・水平ダッシュボード固定、+y=前進 / +x=右 / +z=鉛直上。静止時の重力はz=+9.80665に現れる。【派生式】accelerationIncludingGravity={x: latAcc*9.80665, y: longAcc*9.80665, z: 9.80665}、rotationRate={alpha: yawRate, beta: 0, gamma: 0}、interval=10、gyroscope={0,0,heading}、magnetometer={x: -30.2*sin(h), y: 30.2*cos(h), z: -34.7}（水平成分ノルム≈30.2）、geolocation.altitude=5.0 / altitudeAccuracy=3.0 / accuracy=5.0。【モード差】smartphoneOnlyはcanDataキー自体を省略しゼロ補充をconvertOldDataに委譲する（null/{}/空文字を置かない）。canConnectedは vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance / steeringAngle / accelPedalPosition / brakePressure / brakeSwitch / shiftIndication / turnSignal / repeat の全12フィールドを明示する。【repeat】合成時は全0固定、-1は禁止（-1は評価対象外を意味し診断が空回りする）。【量子化】値÷刻みが整数かつ物理値域内であること。vehicleSpeed=整数0..255、longAcc/latAcc=0.01刻み-1.28..1.27、frontDistance=0.5刻み0..127で定数50.0、lateralDistance=0.5刻み-64..63.5で定数0.0、steeringAngle=0.1刻み上限1080、accelPedalPosition上限100、brakePressure上限126、shiftIndication/turnSignalは列挙値。【出力】論理形式はJSON Lines、物理形式はpako.gzipした.txt.gz。pako.ungzip→UTF-8デコード→行分割で全行がスキーマとして解釈できること。Base64化はui.edit.pageへの投入時のみの変換で、配布形式ではない。【検証ゲート】VR-001〜019（JSON妥当性、date書式、TZ非依存、単調非減少、必須キー、有限数、z=9.80665、beta/gamma=0、interval=10、magnetometer定数、geolocation定数、モード別canData存在/非存在、量子化格子、repeat=0、加速度とcanDataの整合、frontDistance/lateralDistance定数、gz妥当性、空行なし）に1件でも違反したらFAIL。【テスト層】Layer1=スキーマ単体（UI不要）、Layer2=ui.edit.page投入とデモ再生（data-testidベース、pageerror/console.error 0件）、Layer3=UC06診断（score1/score2/scoreA/scoreB/overAllが設定され、score3/score4/scoreCは未設定のまま）。【実装実態との整合】smartphoneOnlyではlastCanDataのゼロ埋めによりCAN依存指標が発火せず診断結果は全項目100（未算出）となる。平均値は(評価窓合計+100)/(窓数+1)であり初回100が1件混入する。ヒヤリはhiyari=trueとメッセージのみでスコア値を変えない。score1はparkingActionのシフト遷移（D→R直前8秒、R→D切り返し、Pで確定、複数回は平均）のみで決まる。これらはコード変更禁止の前提で期待値として固定する。【縮退運転】CAN実機不在時はcanConnected合成データで代替、診断不安定時はLayer3をskipped（passed扱い禁止）、認証失敗時はauth-bypass（dev/test限定）でLayer2を継続、外部依存は期限付きallowlistでモック可。【証跡】失敗時はscreenshot / trace / console log / network log / run_id に加え、対象ファイルのSHA-256、解凍後の先頭3行・末尾3行、違反VR-IDと行番号を収集し、qa_report.json（run_id / status / fail_reason / evidence_paths / reproduction_steps）に記録する。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "合成センサログの1行はdateとsensorのみを持つJSONオブジェクト", "statement": "合成センサログの1行は JSON.stringify({date, sensor}) の結果であり、トップレベルキーは date と sensor の2つのみである", "status": "candidate"},
    {"type": "validation_rule", "title": "dateはYYYY-MM-DD HH:mm:ss.SSS書式である", "statement": "date は YYYY-MM-DD HH:mm:ss.SSS 書式（ミリ秒3桁ゼロ埋め）に一致しなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "dateはローカルTZに依存せず同一値になる", "statement": "同一入力から生成したログの date 列は、実行環境のタイムゾーン設定を変えても一致しなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "dateはファイル内で単調非減少である", "statement": "ファイル内の date は行順に単調非減少でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "sensorの必須5キーは全行に存在する", "statement": "sensor 直下の videoTime / geolocation / acceleration / gyroscope / magnetometer は全行に存在しなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "数値フィールドは有限数である", "statement": "センサログ中の数値フィールドに NaN / Infinity / null / 文字列数値が含まれてはならない", "status": "candidate"},
    {"type": "constraint", "title": "端末姿勢は画面上向き水平ダッシュボード固定である", "statement": "合成データは端末を画面上向き・水平ダッシュボード固定（+y=前進、+x=右、+z=鉛直上）とした姿勢を前提とする", "status": "candidate"},
    {"type": "validation_rule", "title": "重力込み加速度のz成分は9.80665固定である", "statement": "acceleration.accelerationIncludingGravity.z は 9.80665 でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "rotationRateのbetaとgammaは0固定である", "statement": "acceleration.rotationRate.beta および gamma は 0 でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "acceleration.intervalは10固定である", "statement": "acceleration.interval は 10 でなければならない", "status": "candidate"},
    {"type": "data_semantics", "title": "rotationRate.alphaはヨーレートを表す", "statement": "acceleration.rotationRate.alpha にはヨーレートが格納される", "status": "candidate"},
    {"type": "validation_rule", "title": "magnetometerは水平ノルム30.2かつz=-34.7である", "statement": "magnetometer は z = -34.7 であり、x と y の水平成分ノルムが約 30.2 でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "geolocationの精度系3値は定数である", "statement": "geolocation.altitude は 5.0、altitudeAccuracy は 3.0、accuracy は 5.0 でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "smartphoneOnlyではcanDataキーが存在しない", "statement": "smartphoneOnly の合成データは canData キー自体を省略し、null や空オブジェクトを置いてはならない", "status": "candidate"},
    {"type": "validation_rule", "title": "canConnectedではcanDataの12フィールドが全て存在する", "statement": "canConnected の合成データは canData に vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance / steeringAngle / accelPedalPosition / brakePressure / brakeSwitch / shiftIndication / turnSignal / repeat の全フィールドを持たなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "合成データのrepeatは常に0である", "statement": "合成データの canData.repeat は常に 0 であり、-1 を含んではならない", "status": "candidate"},
    {"type": "validation_rule", "title": "canDataの数値は量子化格子と物理値域を満たす", "statement": "canData の各数値は規定の刻み（vehicleSpeed 整数、longAcc/latAcc 0.01、frontDistance/lateralDistance 0.5、steeringAngle 0.1）の整数倍であり、かつ規定範囲（vehicleSpeed 0..255、longAcc/latAcc -1.28..1.27、frontDistance 0..127、lateralDistance -64..63.5、steeringAngle 上限1080、accelPedalPosition 上限100、brakePressure 上限126）内でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "frontDistanceとlateralDistanceは定数である", "statement": "合成データの canData.frontDistance は 50.0、canData.lateralDistance は 0.0 でなければならない", "status": "candidate"},
    {"type": "validation_rule", "title": "加速度はcanDataの加速度から一意に導出される", "statement": "canConnected では accelerationIncludingGravity.x は latAcc*9.80665、y は longAcc*9.80665 と一致しなければならない", "status": "candidate"},
    {"type": "data_semantics", "title": "gyroscopeの第3成分は方位を保持する", "statement": "gyroscope は {0, 0, heading} の形で第3成分に進行方位を保持する", "status": "candidate"},
    {"type": "constraint", "title": "配布形式はJSON Linesをgzipした.txt.gzである", "statement": "合成センサログの配布形式は JSON Lines を pako.gzip した .txt.gz であり、Base64 化は ui.edit.page への投入時のみの変換である", "status": "candidate"},
    {"type": "qa_expectation", "title": ".txt.gzは解凍して全行がスキーマとして解釈できる", "statement": ".txt.gz は pako.ungzip と UTF-8 デコードに成功し、末尾改行を除く全行が1レコードスキーマとして解釈できなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "ui.edit.pageへの投入でランタイムエラーが出ない", "statement": "合成データを ui.edit.page に投入した際、pageerror および console.error が1件も発生してはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "デモ再生はvideoTimeに同期して進行する", "statement": "デモ再生時、再生位置はレコードの videoTime に同期して進行し、停止と再開が可能でなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "canConnectedデータでは5つのスコアが設定される", "statement": "canConnected 合成データで診断を実行すると score1 / score2 / scoreA / scoreB / overAll が設定される", "status": "candidate"},
    {"type": "qa_expectation", "title": "score3/score4/scoreCは未設定のままである", "statement": "診断実行後も score3 / score4 / scoreC は設定されず、UI ラベル label3 / label4 / labelC が空であることと整合する", "status": "candidate"},
    {"type": "qa_expectation", "title": "smartphoneOnlyデータでは全項目100の未算出になる", "statement": "smartphoneOnly 合成データで診断を実行すると CAN 依存指標が発火せず、診断結果は全項目 100（未算出）となる", "status": "candidate"},
    {"type": "qa_expectation", "title": "スコア平均には初回100が1件混入する", "statement": "スコア平均は（評価窓合計 + 100）/（窓数 + 1）と一致し、初期値100が1件混入した値になる", "status": "candidate"},
    {"type": "qa_expectation", "title": "ヒヤリ検出はスコア値を変更しない", "statement": "ヒヤリ条件を含むデータでは hiyari=true とメッセージが出力されるが、スコア値は変化しない", "status": "candidate"},
    {"type": "qa_expectation", "title": "score1はシフト遷移シナリオでのみ確定する", "statement": "score1 は D→R（直前8秒）、R→D 切り返し、P による確定というシフト遷移を含むデータでのみ確定する", "status": "candidate"},
    {"type": "qa_expectation", "title": "不正な合成データは検証器がFAILとして検出する", "statement": "repeat=-1 や量子化格子外の値を含む不正データを与えた場合、検証器は違反した検証ルールIDと行番号を伴って FAIL を返さなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "診断層が未完でもスキーマ層と再生層で合否判定できる", "statement": "診断ロジックが未完成・不安定な場合でもスキーマ検証と再生検証で合否判定でき、診断層は skipped として報告され passed 扱いにしてはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "失敗時に再現可能な証跡を収集する", "statement": "検証失敗時は screenshot / trace / console log / network log / run_id に加え、対象ファイルの SHA-256、解凍後の先頭3行と末尾3行、違反ルールIDと行番号を収集する", "status": "candidate"},
    {"type": "qa_expectation", "title": "認証失敗は非認証系UI検証を阻害しない", "statement": "認証が失敗する状況でも auth-bypass 経路（dev/test 環境限定）でデモ再生検証を継続できなければならない", "status": "candidate"},
    {"type": "assumption", "title": "検証セレクタは安定したtest idに依存する", "statement": "デモ再生・データ投入の検証セレクタは data-testid を用い、CSS クラスや DOM 階層に依存しない", "status": "assumption"},
    {"type": "assumption", "title": "brakeSwitchは制動有無を示す2値である", "statement": "canData.brakeSwitch は制動の有無を示す2値（0/1）として扱う", "status": "assumption"}
  ],
  "open_questions": [
    "videoTime の単位と基準（秒かミリ秒か、動画先頭起点か録画開始時刻起点か）が未確定。Middleware/App のデモ再生実装で定義される値であり、確定しないと再生同期の期待値（TC-DEMO-002）と単調増加検証を FAIL 条件にできない。",
    "gyroscope の3成分のキー名（x/y/z か alpha/beta/gamma か配列か）が未確定。既存デコード実装の確認が必要（Middleware判断）。確定しないと VR の必須キー検証を厳格化できない。",
    "magnetometer の式 -30.2*sin(h) / 30.2*cos(h) における h の単位（度かラジアンか）と、heading の基準（真北基準・時計回り正か）が未確定。Middleware の合成実装依存で、確定しないと VR-010 の水平成分方向の検証ができず値の符号を保証できない。",
    "steeringAngle の下限（-1080 か 0 か）と符号規約（右切り正か左切り正か）が未確定。BLE デコードスケール定義（Middleware）に依存し、確定しないと量子化検証（VR-014）の範囲判定が閉じない。",
    "accelPedalPosition と brakePressure の量子化刻みと下限が未確定（上限のみ既知）。BLE デコードスケール定義（Middleware）が必要で、確定しないと格子外値を FAIL にできない。",
    "shiftIndication / turnSignal の列挙値と数値マッピング（例: P/R/N/D の対応値）が未確定。Middleware のスコアロジックが D→R 遷移を判定するため、確定しないと TC-DIAG-005 のシナリオデータを正しく合成できない。",
    "brakeSwitch の値域（0/1 か列挙か）が未確定。Middleware 判断が必要で、確定しないと VR で値域検証ができない。",
    "geolocation の speed / heading を出力するか、また vehicleSpeed から導出するのか独立値なのかが未確定。Middleware/App のどちらが利用するかに依存し、確定しないと必須キー集合と整合検証の範囲が定まらない。",
    "acceleration.acceleration（重力除去成分）を合成データに含めるか否かが未確定。DeviceMotion 準拠なら存在しうるが必須キー定義に含まれていない。App/Middleware の利用有無で決まり、欠落を FAIL にするか warn にするか決められない。",
    "レコード間の時刻間隔と acceleration.interval=10 の関係（10ms 間隔で行を出すのか、interval は固定メタ値なのか）が未確定。Middleware のサンプリング仕様に依存し、確定しないと date 間隔の検証ルールを定義できない。",
    ".txt.gz のファイル名規約とディレクトリ配置（既存の driving-score/{debug-log | data.YYYYMMDD-HHMMSS}/ 規約に合わせるか、モックは別命名か）が未確定。Infra 判断が必要で、確定しないと CI のアーティファクト収集パスを固定できない。",
    "smartphoneOnly で診断が全項目 100（未算出）になる挙動を『正しい仕様』として受け入れるか『既知の欠陥』として扱うかが未確定。Middleware の設計意図判断（proposal #62 関連）が必要で、TC-DIAG-003 を passed とするか known-issue とするかが決まらない。",
    "初回 100 が平均に混入する挙動を期待値として固定するか修正対象とするかが未確定。コード変更禁止の前提により現状は実装実態として記録しているが、修正されると TC-DIAG-004 の期待式が変わる。",
    "生 .txt.gz を Base64 前提の ui.edit.page 投入経路に渡した場合の期待挙動（入力エラー表示か自動判別か）が未確定。App 判断が必要で、TC-DEMO-003 の合格条件が定義できない。",
    "convertOldData が canData 省略時に埋める既定値の正準定義（shiftIndication=0 等）が仕様として確定していない。Middleware 判断が必要で、確定しないと smartphoneOnly データの診断期待値を厳密に固定できない。"
  ],
  "rationale_notes": [
    "本ノードは『何を検証すれば合格か』を定義する層であり、生成器の実装方法やテストランナーの選定は Infra 側に委ねる。",
    "smartphoneOnly で canData キーを省略するのは convertOldData のゼロ補充経路そのものを検証対象に含めるためであり、テスト用に空オブジェクトを置くと補充経路がバイパスされて検証価値が失われる。",
    "repeat=-1 を禁止するのは、-1 が評価対象外として平均計算から除外されるため、合成データで診断が空回りし『テストは通るが何も評価していない』状態を作るリスクがあるため。",
    "date を JST 固定整形とし TZ 非依存性を独立テストにしているのは、CI ランナーの TZ が UTC であることが多く、ローカル整形実装だと開発端末と CI で生成物が変わり回帰検出が壊れるため。",
    "検証を3層（存在確認/相互作用/業務ルール）に分けたのは、診断ロジックが未配線・不安定な現状でもスキーマとデモ再生の回帰は独立に守れるようにするため。",
    "実装実態（smartphoneOnly=全100、初回100混入、score3/4/C未設定、ヒヤリはスコア不変）を期待値として明文化しているのは、既存承認ファクトでコード変更が禁止されているため。テストが『理想の仕様』を期待して常時 FAIL する状態を避け、将来修正時に期待値を意図的に更新する運用とする。",
    "量子化検証を『値÷刻みが整数』という形で定義したのは、BLE デコード後の値と合成値が同一格子に載っていることを担保し、実車ログとモックログでスコアロジックの挙動が乖離しないようにするため。",
    "加速度と canData の整合検証（x=latAcc*9.80665 等）を入れているのは、合成器が両者を独立に生成して矛盾したデータを作る事故を検出するため。",
    "Layer3 を skipped と passed で区別するのは、未実装をグリーン扱いして品質状況を誤認させないため。",
    "Base64 を配布形式に含めないことを明記したのは、Base64 二重化された .txt.gz が流通して解凍失敗の原因になるのを防ぐため（VR-018 で検出する）。"
  ]
}
```