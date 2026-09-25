<!-- 作成: 2026-09-18 19:12:52 JST | 更新: 2026-09-25 11:00:35 JST -->

# spec/qa/mockdata-sensorlog-scenarios.md

## 目的

UC12（編集とデモ再生）と UC06（運転診断の実行）を、実車を使わずに再現可能な形で検証する。そのための正準モックセンサログ（`src/data/mock/*.txt.gz`）について、内容・生成規則・受け入れ条件を定義する。
本仕様が規定するのは「どう生成するか」ではなく、**「何が成立していれば合格か」** である。

本ノードは、2026 年度改修要求（レーダーチャート化・BLE 安定化・録画サイズ改善など）に先行する回帰基準である。改修要求の影響は §10 に保留事項としてまとめ、確定するまで正準モックと受入閾値を変更しない。ただし要求⑤（ヒヤリ録画）については、E2E 検証用シナリオ `hiyari_recording` を正準セットに編入済みである（§3.7 / §5 L2・L5）。

---

## 1. 正準セット（9シナリオ / 10ファイル）

| # | scenario | sensorMode | duration | レコード数 | ファイル |
|---|---|---|---|---|---|
| 1 | cruise | smartphoneOnly | 60s | 6000 | sensor-log.cruise.smartphoneOnly.txt.gz |
| 2 | cruise | canConnected | 60s | 6000 | sensor-log.cruise.canConnected.txt.gz |
| 3 | accel_decel | canConnected | 60s | 6000 | sensor-log.accel_decel.canConnected.txt.gz |
| 4 | hard_brake | canConnected | 60s | 6000 | sensor-log.hard_brake.canConnected.txt.gz |
| 5 | sharp_curve | canConnected | 60s | 6000 | sensor-log.sharp_curve.canConnected.txt.gz |
| 6 | mixed | canConnected | 60s | 6000 | sensor-log.mixed.canConnected.txt.gz |
| 7 | steer_stable | canConnected | 60s | 6000 | sensor-log.steer_stable.canConnected.txt.gz |
| 8 | steer_wobble_weak | canConnected | 60s | 6000 | sensor-log.steer_wobble_weak.canConnected.txt.gz |
| 9 | steer_wobble_strong | canConnected | 60s | 6000 | sensor-log.steer_wobble_strong.canConnected.txt.gz |
| 10 | hiyari_recording | canConnected | 90s | 9000 | sensor-log.hiyari_recording.canConnected.txt.gz |

- 全ファイル共通: 刻み = 10ms、**レコード数 = duration * 100**。受け入れはこの判定式だけを正とする。
- 「60s / 6000 行 / 60 点」という記述は、#1〜#9 の 9 ファイルについての記述として読み替える。hiyari_recording は 90s / 9000 行 / GPS 90 点となるが、**例外規定は設けない**。判定式（行数 = duration*100、GPS は 100 レコードごとに 1 点）がそのまま適用される。
- steer_* と hiyari_recording は canConnected のみを正準とする。steer_* の smartphoneOnly 版は生成できるが commit しない。
- 正準生成では `--loop` を使用してはならない（非推奨）。loop 機能はオミットしてよい。

---

## 2. 区間構成（出車 → 走行 → 駐車）

- 1 シナリオは「出車 → 走行 → 駐車」までを 1 本に含み、9 区間比で配分する。区間比の実値は生成器 `src/data/tools/gen-mock-sensorlog.mjs` の定義を正とする。
- 特徴的走行（加減速・急制動・急旋回・舵角プロファイル・ヒヤリ発火）は、必ず **評価窓の外** に配置する。
- 評価窓は **D→R 遷移の直前 8 秒**（parkingAction 判定区間）である。
- 評価窓の直前は、全シナリオ共通の減速プロファイルとする: **40 km/h → 0 km/h、-0.21G**。
- 後退（R）は **8 km/h、加減速 ±0.08G**。
- 出車・駐車を含まないのは `cruise.smartphoneOnly` のみで、走行区間だけで構成する。hiyari_recording を含むそれ以外の全シナリオは、D→R 遷移を持つ。

---

## 3. 走行プロファイル（シナリオ別）

### 3.1 cruise
- 走行区間は 40 km/h 定速とする。steer_* 系の基準プロファイルとなる。

### 3.2 accel_decel
- 20 秒周期で次を繰り返す。
  - 8s: +0.21G で 0 → 60 km/h
  - 4s: 60 km/h 定速
  - 8s: -0.21G で緩減速

### 3.3 hard_brake
- 走行区間 D の相対位置 (0.20, 0.45, 0.70) の 3 点で制動する。
  - 制動: 3.0s で 60 → 10 km/h（約 -0.47G）
  - 再加速: 4.0s で 10 → 60 km/h（約 +0.35G）

### 3.4 sharp_curve
- 40 km/h 定速。
- yawRate = A * sin(2πt / 8.0)
- 横加速度（latAcc）のピークは **0.30G ちょうど**。
- steeringAngle のピークは **±180 deg**。

### 3.5 mixed
- 走行区間 D を 4 等分し、cruise → accel_decel → hard_brake → sharp_curve の順に連結する。
- 各境界で **車速・heading・lat/lng を引き継ぐ**（不連続を生じさせない）。

### 3.6 steer_stable / steer_wobble_weak / steer_wobble_strong
- 区間比と速度プロファイルは cruise と完全に同一とする（区間 3 は 40 km/h 定速）。**差し替えるのは舵角のみ**。
- 共通制約: `turnSignal = 0` 固定、`|steeringAngle| <= 15`。
- 区間 3 の **37.2 秒** で 10 秒ゲートが成立すること。
- steer_stable: 乱数を使わない階段状の舵角。4 秒ごとに 0° → +8° → -8° を巡回し、区間内は値を保持する。
- steer_wobble_*: `Math.random` は禁止。決定的 LCG を使用する。
  - シナリオ開始時に seed = 12345 にリセットする
  - seed = (seed * 1103515245 + 12345) & 0x7fffffff
  - u = seed / 0x7fffffff、angle = (u * 2 - 1) * 2.0（±2°）
  - 区間 3 の経過秒 t について、(t % 4) / 4 < duty のときだけ新角度を採用し、それ以外は直前値を保持する
  - duty: weak = 0.25、strong = 1.0
- 生成後は、既存の物理値域制約と floor(x + 0.5) 量子化を通す。

### 3.7 hiyari_recording（ヒヤリ録画 E2E 用）
- canConnected / `--duration 90` / 9000 レコード。
- 確定版の根拠は **proposal #253 のみ** とする。次の 2 案を実装・検証の根拠にしてはならない。
  - proposal #246: 出車・後退区間にヒヤリを置いていた
  - proposal #252: 15/30/40/50/55/58 秒。連結が最後に来るため、連結後の復帰を検証できない
- ヒヤリ発火時刻は **15 / 30 / 40 / 45 / 48 / 60 秒** の 6 点とする。
  - ユーザ指定の 15 / 30 / 40 秒は保持する。
  - 連結ファイル（hiyari.04）の後に単独ファイル（hiyari.05）を置き、連結状態から通常状態への復帰を検証できる並びにする。
- 走行区間は **9.0〜64.8 秒**、評価窓は **68.5〜76.5 秒** とする。6 点の発火時刻はすべて走行区間内にあり、評価窓には掛からない。
- 共通減速・後退・評価窓の規則（§2）は hiyari_recording にも適用する。

---

## 4. GPS / 位置情報

- 起点は東京駅 **(35.681236, 139.767125)** とし、以降は起点からの **相対計算** で算出する。
- GPS 生成に **乱数を用いてはならない**。同一入力に対して完全に同一の出力になること。
- `geolocation.speed = canData.vehicleSpeed / 3.6`（m/s）。

### 実機への GPS 投入
- 実機への GPS 投入は `src/data/tools/mock-gps-feeder.py`（node: qa.mockdata.gps.feeder）で行う。
- 投入項目は **latitude / longitude / accuracy のみ**。
- 投入レートは **1Hz** で、センサログ **100 レコードごと** に 1 点とする。点数は **レコード数 / 100** で決まる（60s ファイルは 60 点、hiyari_recording は 90 点）。

---

## 5. 検証レイヤ

### L1: 存在チェック（実装が未完でも常に実行可能）
- TC-MOCK-001: 正準 10 ファイルが `src/data/mock/` に存在する。
- TC-MOCK-002: 各ファイルが ungzip でき、行単位に parse できる。
- TC-MOCK-003: 各ファイルの行数が duration * 100 に一致する（#1〜#9 は 6000、hiyari_recording は 9000）。
- TC-MOCK-004: 全レコードで必須キーの欠落が 0 件である。

### L2: 構造・値域チェック（インタラクション相当）
- TC-MOCK-010: steer_* 3 本の全レコードで `turnSignal = 0`。
- TC-MOCK-011: steer_* 3 本の全レコードで `|steeringAngle| <= 15`。
- TC-MOCK-012: 全シナリオで `geolocation.speed == canData.vehicleSpeed / 3.6`。
- TC-MOCK-013: `cruise.smartphoneOnly` に出車・駐車区間（R レンジ）が存在しない。
- TC-MOCK-014: `cruise.smartphoneOnly` 以外は D→R 遷移を含み、その直前 8 秒が評価窓として成立する。
- TC-MOCK-015: 評価窓の直前が 40→0 km/h・-0.21G の共通減速である。
- TC-MOCK-016: 後退区間の車速が 8 km/h で、加減速が ±0.08G の範囲に収まる。
- TC-MOCK-017: sharp_curve の latAcc ピークが 0.30G ちょうど、steeringAngle ピークが ±180 deg である。
- TC-MOCK-018: mixed の 4 区間境界で、車速・heading・lat/lng が連続している。
- TC-MOCK-019: 特徴的走行（ヒヤリ発火を含む）が評価窓（D→R 直前 8 秒）に含まれない。
- TC-MOCK-020: steer_* の区間 3 において、37.2 秒で 10 秒ゲートが成立する。
- TC-MOCK-021: hiyari_recording のヒヤリ発火時刻が 15 / 30 / 40 / 45 / 48 / 60 秒の 6 点であり、それ以外の時刻に発火しない。
- TC-MOCK-022: hiyari_recording の全発火時刻が走行区間 9.0〜64.8 秒内にある（出車・後退区間には置かない）。
- TC-MOCK-023: hiyari_recording の全発火時刻が評価窓 68.5〜76.5 秒に掛からない。

### L3: 決定性・回帰チェック
- TC-MOCK-030: 同一コマンドで再生成した 10 ファイルが、前回の生成物とバイト一致する（乱数に依存しない）。
- TC-MOCK-031: 既存 6 ファイル（cruise×2 / accel_decel / hard_brake / sharp_curve / mixed）は、再生成してもバイト一致する。不一致の場合は既存ファイルを **上書きしてはならない**（FAIL 扱い）。
- TC-MOCK-032: 正準生成に `--loop` が使用されていない。
- TC-MOCK-033: BLE notify ペイロードが **12 バイト固定長**（PAYLOAD_LEN = 12、offset 5-6 のみ u16 BE）であるという前提が維持されている。
  - ペイロード長や割り当てが変化した場合、本ノードの正準モックと score2 受入は FAIL ではなく **要再ベースライン** として報告する。
  - 変更が承認されるまでは正準を更新しない。
- TC-MOCK-034: 次の凍結対象に差分がない（凍結状態の確認）: `scoreLogicFunction.txt` / `scoreLogic.json` / `score-logic.ts` / `src/data/src/app/**` / BLE 符号化 / `ble-can-emulator`。

### L4: 業務ルール（score2 受入）
- 判定経路は **実機 BLE 100ms 経路（repeat = 0）** とする。10ms ログを 100ms 間隔（10 本に 1 本）に間引くか、`ble-can-emulator.py` の既定値 `--rate-ms 100` を用いる。
- TC-SCORE2-001: steer_stable の score2 >= 80（参考実測 87.2）。
- TC-SCORE2-002: steer_wobble_weak の score2 が 40 以上 70 未満（参考実測 57.1）。
- TC-SCORE2-003: steer_wobble_strong の score2 < 20（参考実測 7.4）。
- TC-SCORE2-004: score2 の大小関係が stable > weak > strong を満たす。
- TC-SCORE2-005: DemoData 10ms 全件経路で得た score2 は **合否判定に用いない**（参考値としてのみ記録する）。

### L5: ヒヤリ録画 E2E（hiyari_recording 再生時の期待値）
前提: `settingRecordingMargin = 5` で hiyari_recording を再生する。

- TC-HIYARI-001: 生成される録画ファイルは **5 ファイル**、ヒヤリマーカーは **6 個** である。
- TC-HIYARI-002: hiyari.01 の区間が [10, 20] で、マーカー {15} を持つ。
- TC-HIYARI-003: hiyari.02 の区間が [25, 35] で、マーカー {30} を持つ。
- TC-HIYARI-004: hiyari.03 の区間が [35, 45] で、マーカー {40} を持つ。
- TC-HIYARI-005: hiyari.02 と hiyari.03 はちょうど隣接し、重複はゼロである（別ファイルとして生成され、連結されない）。
- TC-HIYARI-006: hiyari.04 の区間が [40, 53] で、マーカー {45, 48} を持つ。
- TC-HIYARI-007: hiyari.04 は hiyari.03 と 5 秒重複する。48 秒の発火による連結で、終端が 50 → 53 へ延長される。
- TC-HIYARI-008: hiyari.05 の区間が [55, 65] で、マーカー {60} を持つ。連結状態から通常状態へ復帰したうえで、単独ファイルとして生成される。
- 補足: hiyari.05 の末尾 0.2 秒は減速区間に掛かるが、TC-MOCK-015 / 016 / 019 には影響しない。

---

## 6. 変更禁止範囲（回帰ガード）

次の項目は本ノードの検証前提である。変更されると受入閾値が無効になる。
- `scoreLogicFunction.txt` / `scoreLogic.json` / `score-logic.ts`
- `src/data/src/app/**`
- BLE 符号化 / ble-can-emulator（**12 バイト固定長ペイロード前提**）
- 既存 6 モックファイルのプロファイルとバイト列

スコアロジックの凍結（打ち合わせ後まで変更しない）は、2026-09-17 時点で解除されていない。2026 年度改修要求のうち 6 項目 5 段階のレーダーチャート化は、採点データ形式が先方で検討中である。形式が確定するまで、本ノードの score2 受入閾値は変更しない。

上記のいずれかに変更が検出された場合は score2 受入を再測定し、閾値の妥当性を再確認するまで PASS としない。

---

## 7. 縮退モード検証

- 実機や BLE が利用できない環境でも、L1〜L3（存在・構造・決定性）は必ず実行して合否を出す。
- L4（score2）は、実機経路が利用できない場合 `skipped` とし、`fail` にはしない。ただし `skipped` を含むランは「正準更新の承認」には使用できない。
- L5（ヒヤリ録画 E2E）は、アプリ実行環境（録画機能を含む）が利用できない場合 `skipped` とする。この場合でも、ヒヤリ配置に関する TC-MOCK-021〜023 は L2 としてログ単体で必ず検証する。
- GPS フィーダが利用できない場合、TC-MOCK-012 はログ内の整合のみで検証し、実機投入の検証は `skipped` とする。
- テスト用ナビ端末の提供時期が未定のため、端末が提供されるまでの期間は L4 を `skipped` として運用し、L1〜L3 のみで回帰検出を継続する。

---

## 8. 失敗時の証跡（Artifact）

必須:
- 生成コマンドと標準出力ログ
- 各 gz ファイルの SHA256
- parse 結果サマリ（行数・必須キー欠落件数・値域違反行番号）
- score2 実測値（経路種別・rate-ms・repeat を併記）
- BLE ペイロード長と、凍結対象ファイルの差分有無
- L5 実行時: settingRecordingMargin の値、生成された録画ファイル一覧（各ファイルの開始秒・終了秒・マーカー秒）
- run_id

任意:
- 舵角 / 車速 / latAcc の時系列プロット
- 実機診断画面のスクリーンショット
- L5 実行時の録画ファイル本体

---

## 9. レポート形式

`qa_report.json`

fields:
- run_id
- scenario
- sensor_mode
- layer (L1|L2|L3|L4|L5)
- status (pass|fail|skipped|rebaseline_required)
- fail_reason
- measured（score2 などの実測値。L5 では録画ファイル数・マーカー数・各ファイル区間）
- evidence_paths
- reproduction_steps

---

## 10. 2026 年度改修要求による影響（保留事項）

2026 年度改修要求（日産自動車から受領した資料 2 件に基づく 5 要求）は、本ノードの正準モックに次の影響を持ち得る。hiyari_recording の編入を除き、いずれも **確定するまで正準モックを変更しない**。

| 要求 | 本ノードへの想定影響 | 現時点の扱い |
|---|---|---|
| ③ 採点スコアのレーダーチャート表示（6 項目・1〜5 の 5 段階） | score2 など 0〜100 スケールの受入閾値が意味を失う可能性がある。6 項目の採点データ形式は先方で検討中。 | 現行スコアロジックを前提に凍結する。形式確定後に閾値を再ベースラインする。 |
| ④ BLE 通信の安定化（標識認識・先行車検知の追加を含む） | CAN ペイロード長や割り当てが 12 バイトから変われば、符号化規則とエミュレータの前提が崩れる。 | TC-MOCK-033 で前提の維持を監視する。変化時は `rebaseline_required` とする。 |
| ⑤ ヒヤリ発生時の録画データサイズ改善（前後 15 秒・連続ヒヤリ） | ヒヤリ録画 E2E 用に hiyari_recording（90s / 発火 6 点）を正準へ編入済み。連続ヒヤリの録画方式は実装都合で選んでよいとされており、L5 の期待値（5 ファイル・6 マーカー）は proposal #253 の連結方式を前提とする。 | L2（TC-MOCK-021〜023）と L5（TC-HIYARI-001〜008）で検証する。録画ファイル生成の仕様本体は他ノードの管轄。 |
| ① 診断開始前画面の前回結果表示（履歴平均） | 履歴平均の集計期間が未確定。モックログ 1 本だけでは履歴平均の検証は成立しない。 | 複数ラン分のモックを投入するシナリオは別途定義が必要（未着手）。 |
| ② タブ切り替え / 8-1 サービス案表示 | 本ノードへの影響なし。 | 対象外。 |

スケジュール（2026 年 11 月末完了 / 12 月実験開始）に照らし、L1〜L3 は実装状況にかかわらず常時グリーンを維持することを CI の前提とする。

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "正準セットを8シナリオ9ファイルから、hiyari_recording（canConnected/90s/9000行）を編入した9シナリオ10ファイルへ改訂する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "『全ファイル60s/6000行/60点』の記述を#1〜#9の9ファイル限定に読み替え、行数=duration*100とGPS=100レコードごと1点の判定式のみを正とする（例外規定なし）"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "§3.7を新設し、hiyari_recordingの確定構成（proposal #253のみ準拠、発火15/30/40/45/48/60秒、走行区間9.0〜64.8秒、評価窓68.5〜76.5秒、proposal #246/#252の参照禁止）を規定する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "L2にTC-MOCK-021〜023（発火時刻6点・走行区間内・評価窓外）を追加し、TC-MOCK-001/003/030/019をhiyari_recording込みに改訂する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "L5（ヒヤリ録画E2E）を新設し、settingRecordingMargin=5で5ファイル・6マーカー、hiyari.01〜05の区間とマーカー、02/03の隣接重複ゼロ、04の連結延長50→53、05の通常状態復帰をTC-HIYARI-001〜008として定義する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "縮退モード・証跡・qa_report.jsonにL5を追加し、§10の要求⑤の扱いを『本ノード対象外』からhiyari_recording編入済みに改訂する"}
  ],
  "suggested_impacts": [
    {"domain": "Infra-agent", "severity": "must", "reason": "CIの存在・行数・バイト一致チェック対象を10ファイル（hiyari_recordingは9000行）へ拡張し、行数期待値をduration*100の判定式で算出する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "L5ヒヤリ録画E2EはsettingRecordingMargin=5の設定と録画ファイル一覧の証跡保存が必要で、アプリ実行環境がない場合はskippedとする実行プロファイル分岐が要る"},
    {"domain": "App-agent", "severity": "must", "reason": "L5期待値（5ファイル・6マーカー、hiyari.04の連結延長）はproposal #253の連結方式を前提とするため、実装がヒヤリ個別生成方式を選ぶ場合は期待値の再定義が必要"},
    {"domain": "App-agent", "severity": "should", "reason": "録画ファイルの開始秒・終了秒・マーカー秒をE2Eで観測可能にする出力（ファイル名・メタデータ）が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目5段階化で採点データ形式が変わるとscore2受入閾値（80/40-70/20）が無効化されるため、形式確定時にQAへ再ベースライン依頼が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "標識認識・先行車検知の追加でBLEペイロードが12バイトから変わると、正準モックの符号化規則とエミュレータ前提が同時に崩れるため事前通知が必要"},
    {"domain": "qa.mockdata.ble.emulator", "severity": "must", "reason": "12バイト固定長前提（short11/long13のinject-invalidを含む）は本ノードの回帰ガードと共通前提であり、hiyari_recordingの9000行再生にも適用されるため変更時は同時改訂となる"},
    {"domain": "qa.mockdata.gps.feeder", "severity": "must", "reason": "GPS投入点数は固定60点ではなくレコード数/100で決まり、hiyari_recordingでは90点となるためフィーダ側の点数前提を判定式に合わせる必要がある"},
    {"domain": "DB-agent", "severity": "should", "reason": "1-2の前回結果が履歴平均になるため、履歴平均検証用に複数ラン分のモック診断結果を投入するシナリオ定義が必要になる"}
  ],
  "requirements_context": "本ノード（qa.mockdata.sensorlog.scenarios）は、UC12（編集とデモ再生）とUC06（運転診断の実行）を実車なしで再現検証するための正準モックセンサログ（src/data/mock/*.txt.gz）について、内容・生成規則・受入条件を定義する。規定するのは『どう生成するか』ではなく『何が成立していれば合格か』である。2026年度改修要求に先行する回帰基準であり、hiyari_recordingの編入を除き、改修要求が確定するまで正準モックと受入閾値を変更しない。\n\n【正準セット】9シナリオ10ファイル。cruiseのみsmartphoneOnlyとcanConnectedの2本。accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong / hiyari_recording はcanConnectedのみ。刻みは10ms。レコード数=duration*100の判定式のみを正とする。#1〜#9は60s・6000行、hiyari_recordingは90s・9000行。『60s/6000行/60点』は正準9ファイルについての記述と読み替え、例外規定は設けない。ファイル名は sensor-log.<scenario>.<sensorMode>.txt.gz。steer_*のsmartphoneOnly版は生成できるがcommitしない。正準生成で--loopは使用しない（loop機能はオミット可）。\n\n【区間構成】1シナリオは出車→走行→駐車を1本に含み、9区間比で配分する（区間比の実値はgen-mock-sensorlog.mjsを正とする）。特徴的走行（加減速・急制動・急旋回・舵角・ヒヤリ発火）は評価窓（D→R遷移直前8秒＝parkingAction判定区間）の外に置く。評価窓直前は全シナリオ共通で40→0km/h・-0.21G。後退は8km/h・±0.08G。出車・駐車を含まないのはcruise.smartphoneOnlyのみ。\n\n【走行プロファイル】cruise=40km/h定速。accel_decel=20秒周期（8s +0.21Gで0→60、4s 60定速、8s -0.21G緩減速）。hard_brake=走行区間Dの相対位置0.20/0.45/0.70で制動3.0s 60→10km/h（約-0.47G）、再加速4.0s 10→60km/h（約+0.35G）。sharp_curve=40km/h定速、yawRate=A*sin(2πt/8.0)、latAccピーク0.30Gちょうど、steeringAngleピーク±180deg。mixed=走行区間Dを4等分しcruise→accel_decel→hard_brake→sharp_curveを連結、境界で車速・heading・lat/lngを引き継ぐ。steer_*3本は区間比・速度をcruiseと完全同一（区間3は40km/h定速）とし舵角のみ差し替え、turnSignal=0固定、|steeringAngle|<=15、区間3の37.2秒で10秒ゲート成立。steer_stableは乱数なしの階段（4秒ごとに0°→+8°→-8°巡回、区間内保持）。steer_wobble_*はMath.random禁止、seed=12345にリセット後 seed=(seed*1103515245+12345)&0x7fffffff、u=seed/0x7fffffff、angle=(u*2-1)*2.0（±2°）、(t%4)/4<dutyのときのみ新角度を採用（weak=0.25 / strong=1.0）。生成後は既存の物理値域制約とfloor(x+0.5)量子化を通す。\n\n【hiyari_recording】canConnected / --duration 90 / 9000レコード。確定版の根拠はproposal #253のみ。proposal #246（出車・後退区間にヒヤリ）とproposal #252（15/30/40/50/55/58秒、連結が最後で復帰検証不可）は実装・検証の根拠にしてはならない。ヒヤリ発火時刻は15/30/40/45/48/60秒（ユーザ指定の15/30/40秒を保持し、連結ファイルの後に単独ファイルを置く）。全発火は走行区間9.0〜64.8秒内にあり、評価窓68.5〜76.5秒には掛からない。settingRecordingMargin=5での期待値は5ファイル・6マーカー: hiyari.01=[10,20]{15}、hiyari.02=[25,35]{30}、hiyari.03=[35,45]{40}（02と隣接ちょうど・重複ゼロ）、hiyari.04=[40,53]{45,48}（03と5秒重複、48秒の連結で終端50→53へ延長）、hiyari.05=[55,65]{60}（連結状態から通常状態への復帰を検証）。hiyari.05の末尾0.2秒は減速区間に掛かるが、TC-MOCK-015/016/019には影響しない。連続ヒヤリ（30秒以内）の録画方式は1本継続でも個別生成でも可とされており、上記期待値はproposal #253の連結方式を前提とする。\n\n【GPS】起点は東京駅(35.681236,139.767125)で以降は相対計算、乱数不使用。geolocation.speed=canData.vehicleSpeed/3.6。実機投入はmock-gps-feeder.pyでlatitude/longitude/accuracyのみ、1Hz、センサログ100レコードごとに1点（60sファイル=60点、hiyari_recording=90点）。\n\n【検証レイヤ】L1存在: 10ファイルの存在、ungzip+parse可、行数=duration*100、必須キー欠落0。L2構造・値域: steer_*のturnSignal=0と|steeringAngle|<=15、speed整合、smartphoneOnlyにRレンジなし、D→R遷移と評価窓の成立、共通減速、後退8km/h±0.08G、sharp_curveのピーク、mixed境界の連続、特徴的走行（ヒヤリ含む）が評価窓外、37.2秒ゲート、hiyari発火6点・走行区間内・評価窓外（TC-MOCK-021〜023）。L3決定性・回帰: 10ファイルの再生成バイト一致、既存6ファイルはバイト一致必須で不一致時は上書き禁止、--loop未使用、BLEペイロード12バイト固定長前提の維持、凍結対象の差分なし。L4 score2受入。L5ヒヤリ録画E2E（TC-HIYARI-001〜008）。\n\n【score2受入】判定経路は実機BLE 100ms（repeat=0）。10msログを10本に1本とするか、ble-can-emulator.py既定の--rate-ms 100を用いる。steer_stable>=80（参考87.2）、steer_wobble_weakは40以上70未満（参考57.1）、steer_wobble_strong<20（参考7.4）、かつstable>weak>strong。DemoData 10ms全件経路の値は判定に用いず参考記録のみとする。\n\n【変更禁止範囲】scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE符号化（12バイト固定長、PAYLOAD_LEN=12、offset5-6のみu16 BE）/ ble-can-emulator / 既存6ファイルのプロファイルとバイト列。スコアロジック凍結は2026-09-17時点で未解除。変更検出時はscore2を再測定し、閾値の妥当性を再確認するまでPASSとしない。\n\n【縮退モード】実機/BLEが使えなくてもL1〜L3は必ず実行して合否を出す。L4は実機経路が使えなければskipped（failではない）とするが、skippedを含むランは正準更新の承認に使えない。L5はアプリ実行環境がなければskippedとし、TC-MOCK-021〜023はログ単体で必ず検証する。GPSフィーダが使えない場合、TC-MOCK-012はログ内整合のみ検証する。テスト用ナビ端末の提供時期が未定のため、未提供期間はL4 skippedで運用する。\n\n【証跡】必須: 生成コマンドと標準出力ログ、各gzのSHA256、parse結果サマリ（行数・必須キー欠落件数・値域違反行番号）、score2実測値（経路種別・rate-ms・repeat併記）、BLEペイロード長と凍結対象の差分有無、L5実行時のsettingRecordingMarginと録画ファイル一覧（開始秒・終了秒・マーカー秒）、run_id。任意: 時系列プロット、実機スクリーンショット、録画ファイル本体。レポートはqa_report.json（run_id / scenario / sensor_mode / layer(L1|L2|L3|L4|L5) / status(pass|fail|skipped|rebaseline_required) / fail_reason / measured / evidence_paths / reproduction_steps）。\n\n【2026年度改修要求の影響】要求は①診断開始前画面の前回結果表示（前回=過去履歴の平均、記録なしなら線を描画しない）②タブ切り替え追加と8-1サービス案表示③採点スコアのレーダーチャート表示（筋力・柔軟性・空間把握・危険予測・視力・視野の6項目、1〜5の5段階、3が年齢平均、今回と過去平均の2系列）④BLE通信の安定化（標識認識・先行車検知の追加を含む）⑤ヒヤリ発生時の録画データサイズ改善（前後15秒、30秒以内の連続ヒヤリは1本でも個別でも可）。③は採点データ形式が先方で検討中で、score2の0〜100スケール受入閾値を無効化し得る。④はCANペイロード長・割り当てを12バイトから変える可能性があり、符号化規則とエミュレータ前提（short11/long13）が崩れる。⑤はhiyari_recording編入によりL2/L5で検証する（録画生成仕様本体は他ノード管轄）。①は履歴平均検証のために複数ラン分のモック投入が別途必要。前提の変化はrebaseline_requiredとして報告する。開発は2026年11月末完了・12月実験開始のため、L1〜L3は実装状況に関わらず常時グリーンを維持する。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "正準モックは9シナリオ10ファイルで構成される", "statement": "正準モックセンサログは9シナリオ・10ファイルで構成され、cruiseのみsmartphoneOnlyとcanConnectedの2ファイルを持ち、他8シナリオはcanConnectedのみである", "status": "candidate"},
    {"type": "validation_rule", "title": "レコード数はduration*100と一致する", "statement": "全正準モックファイルのレコード数はduration(秒)*100と厳密に一致しなければならない", "status": "candidate"},
    {"type": "data_semantics", "title": "hiyari_recording以外の9ファイルは60秒6000行である", "statement": "hiyari_recordingを除く正準9ファイルはduration60秒・10ms刻み・6000行である", "status": "candidate"},
    {"type": "data_semantics", "title": "hiyari_recordingは90秒9000行である", "statement": "hiyari_recordingはcanConnected・duration90秒・10ms刻み・9000レコードである", "status": "candidate"},
    {"type": "constraint", "title": "hiyari_recordingに行数の例外規定を設けない", "statement": "hiyari_recordingの行数・GPS点数は例外規定ではなく、行数=duration*100およびGPS=100レコードごと1点の共通判定式で合否を判定する", "status": "candidate"},
    {"type": "validation_rule", "title": "必須キーの欠落は0件でなければならない", "statement": "ungzip後にparseした全レコードで必須キーの欠落件数が0でなければ不合格とする", "status": "candidate"},
    {"type": "business_rule", "title": "評価窓はD→R遷移の直前8秒である", "statement": "スコア評価窓はD→Rのシフト遷移の直前8秒区間である", "status": "candidate"},
    {"type": "constraint", "title": "特徴的走行は評価窓の外に配置される", "statement": "加減速・急制動・急旋回・舵角プロファイル・ヒヤリ発火などの特徴的走行は評価窓に含まれてはならない", "status": "candidate"},
    {"type": "business_rule", "title": "評価窓直前は共通減速プロファイルである", "statement": "評価窓の直前区間は全シナリオ共通で40km/hから0km/hへ-0.21Gで減速する", "status": "candidate"},
    {"type": "business_rule", "title": "後退区間は8km/h・±0.08Gである", "statement": "後退（Rレンジ）区間の車速は8km/h、加減速は±0.08Gである", "status": "candidate"},
    {"type": "constraint", "title": "cruise.smartphoneOnlyのみ出車・駐車を含まない", "statement": "出車区間と駐車区間を含まないシナリオはcruise.smartphoneOnlyのみであり、他はD→R遷移を含む", "status": "candidate"},
    {"type": "constraint", "title": "正準生成で--loopを使用しない", "statement": "正準モックの生成において--loopオプションは使用してはならない", "status": "candidate"},
    {"type": "business_rule", "title": "sharp_curveのピーク値", "statement": "sharp_curveは40km/h定速でlatAccピークが0.30Gちょうど、steeringAngleピークが±180degである", "status": "candidate"},
    {"type": "business_rule", "title": "mixedは境界で車速・heading・位置を引き継ぐ", "statement": "mixedはcruise→accel_decel→hard_brake→sharp_curveを連結し、各境界で車速・heading・lat/lngが連続する", "status": "candidate"},
    {"type": "validation_rule", "title": "steer_*はturnSignal=0かつ|steeringAngle|<=15である", "statement": "steer_*3本の全レコードでturnSignal=0かつ|steeringAngle|<=15が維持されなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "steer_*の区間3で10秒ゲートが37.2秒で成立する", "statement": "steer_*の区間3において37.2秒の時点で10秒ゲートが成立していること", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recordingの確定版はproposal #253のみ", "statement": "hiyari_recordingの実装・検証の根拠はproposal #253のみであり、proposal #246および#252を根拠にしてはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "ヒヤリ発火時刻は6点である", "statement": "hiyari_recordingのヒヤリ発火時刻は15/30/40/45/48/60秒の6点であり、それ以外の時刻に発火しない", "status": "candidate"},
    {"type": "constraint", "title": "ヒヤリ発火は走行区間内に限られる", "statement": "hiyari_recordingの全発火時刻は走行区間9.0〜64.8秒内にあり、出車・後退区間には置かれない", "status": "candidate"},
    {"type": "constraint", "title": "ヒヤリ発火は評価窓に掛からない", "statement": "hiyari_recordingの全発火時刻は評価窓68.5〜76.5秒に掛からない", "status": "candidate"},
    {"type": "qa_expectation", "title": "マージン5秒で録画5ファイル・マーカー6個", "statement": "settingRecordingMargin=5でhiyari_recordingを再生すると、録画ファイルは5本、ヒヤリマーカーは6個生成される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.01は[10,20]でマーカー15", "statement": "hiyari.01の録画区間は10〜20秒でマーカーは15秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.02は[25,35]でマーカー30", "statement": "hiyari.02の録画区間は25〜35秒でマーカーは30秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.03は[35,45]でマーカー40", "statement": "hiyari.03の録画区間は35〜45秒でマーカーは40秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.02と03は隣接し重複しない", "statement": "hiyari.02とhiyari.03は35秒でちょうど隣接し、重複はゼロで別ファイルとして生成される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.04は[40,53]でマーカー45と48", "statement": "hiyari.04の録画区間は40〜53秒でマーカーは45秒と48秒の2点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "48秒の連結でhiyari.04の終端が53秒へ延長される", "statement": "hiyari.04はhiyari.03と5秒重複し、48秒の発火による連結で終端が50秒から53秒へ延長される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.05は連結後に通常状態で生成される", "statement": "hiyari.05の録画区間は55〜65秒でマーカーは60秒の1点であり、連結状態から通常状態へ復帰した単独ファイルとして生成される", "status": "candidate"},
    {"type": "data_semantics", "title": "GPSは東京駅起点の相対計算で乱数を用いない", "statement": "GPS座標は東京駅(35.681236,139.767125)を起点とする相対計算で生成され、乱数を用いない", "status": "candidate"},
    {"type": "api_contract", "title": "geolocation.speedは車速のm/s換算である", "statement": "geolocation.speedはcanData.vehicleSpeed/3.6に一致する", "status": "candidate"},
    {"type": "external_integration_rule", "title": "実機GPS投入点数はレコード数/100である", "statement": "実機GPS投入はlatitude/longitude/accuracyのみを1Hz・センサログ100レコードごとに1点投入し、60秒ファイルは60点、hiyari_recordingは90点となる", "status": "candidate"},
    {"type": "qa_expectation", "title": "score2判定は実機BLE 100ms経路の値で行う", "statement": "score2の合否判定は実機BLE 100ms経路（repeat=0）で得た値を用い、DemoData 10ms全件経路の値は判定に使わない", "status": "candidate"},
    {"type": "qa_expectation", "title": "steer_*のscore2受入閾値", "statement": "score2はsteer_stable>=80、steer_wobble_weakが40以上70未満、steer_wobble_strong<20であり、stable>weak>strongを満たすこと", "status": "candidate"},
    {"type": "constraint", "title": "既存6ファイルのバイト列を変更しない", "statement": "既存6ファイル（cruise×2/accel_decel/hard_brake/sharp_curve/mixed）は再生成でバイト一致しなければならず、不一致時は上書きしない", "status": "candidate"},
    {"type": "validation_rule", "title": "10ファイルの再生成はバイト一致する", "statement": "同一コマンドによる正準10ファイルの再生成結果は前回生成物とバイト一致しなければならない", "status": "candidate"},
    {"type": "constraint", "title": "スコアロジックとBLE符号化は変更禁止である", "statement": "scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE符号化 / ble-can-emulatorは変更してはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "BLEペイロード前提変化時はrebaseline_requiredとする", "statement": "BLEペイロード12バイト固定長前提やスコアロジックの変化を検出した場合、statusをrebaseline_requiredとし、再測定と承認までPASSとしない", "status": "candidate"},
    {"type": "qa_expectation", "title": "実行環境不在時のL4/L5はskippedとする", "statement": "実機BLE経路またはアプリ実行環境が使えない場合、L4/L5はskippedとして失敗扱いにしないが、skippedを含むランは正準更新の承認に使えない", "status": "candidate"},
    {"type": "constraint", "title": "L1〜L3は常時グリーンを維持する", "statement": "2026年11月末完了・12月実験開始に対し、L1〜L3は実装の完成度に関わらず常時PASSを維持することをCIの前提とする", "status": "candidate"}
  ],
  "open_questions": [
    "hiyari_recordingでヒヤリ発火をセンサログ上でどう表現するか（どの信号・閾値でヒヤリ判定を成立させるか）が本ノードの事実からは確定できない。Middleware/App（ヒヤリ判定ロジック）の確認が必要。確定しないとTC-MOCK-021の『それ以外の時刻に発火しない』をログ単体で判定する方法が定まらない。",
    "L5期待値（5ファイル・6マーカー、hiyari.04の連結延長）はproposal #253の連結方式を前提とする。一方、承認済み事実では30秒以内の連続ヒヤリは1本継続でも個別生成でもよいとされる。実装が個別生成方式を選ぶ場合の期待値をどう扱うか、App/QAで確定が必要。",
    "L5はsettingRecordingMargin=5で定義されているが、改修要求⑤は前後15秒の録画を想定している。15秒設定時の期待ファイル構成を別途定義するか、App/先方確認が必要。確定しないと本番設定での回帰検証ができない。",
    "hiyari_recordingの走行区間終端64.8秒と評価窓開始68.5秒の間隔は3.7秒で、40→0km/h・-0.21Gの減速に要する約5.4秒より短い。評価窓と共通減速区間の重なりをTC-MOCK-015でどう判定するか、生成器の実値を含めてQA/Middlewareで確認が必要。",
    "hiyari_recordingのファイル名 sensor-log.hiyari_recording.canConnected.txt.gz は既存の命名規則に従ったものであり、生成器側の出力名として確定しているかは要確認。",
    "hiyari_recordingについて、score2等のスコア期待値を受入対象にするかが未定義。現状はL5の録画期待値のみを受入とする想定だが、Middlewareに確認が必要。",
    "9区間比の具体的な配分値が未明示。生成器の実装値を正とするのか、仕様側で数値を固定するのかをQA/Middlewareで確定する必要がある。確定しないとTC-MOCK-014〜019を数値で書けない。",
    "sharp_curveのyawRate振幅Aの具体値が未確定。確定しないとTC-MOCK-017の許容誤差を定義できない。",
    "hard_brakeの相対位置0.20/0.45/0.70の基準となるD区間の起点・終点の定義が未確定。",
    "『区間3の37.2秒で10秒ゲートが成立する』の37.2秒がシナリオ全体の経過秒か、区間3内の経過秒かが未確定。",
    "既存6ファイルのバイト一致検証に用いる基準SHA256の管理場所（CI保持かリポジトリ内チェックサムファイルか）が未定。",
    "cruise.smartphoneOnlyは評価窓が成立しないため、全項目未算出となる状態を合格扱いにするか、Middleware/QAで確定が必要。",
    "採点が6項目・1〜5の5段階へ移行した場合に、score2受入閾値80/40-70/20をどう写像するかが未確定。採点データ形式は先方検討中。",
    "標識認識・先行車検知の追加でCANペイロードが12バイトから変わるかが未確定。変わる場合は10ファイル全再生成とscore2・L5の再測定が必要になる。",
    "履歴平均（1-2の前回結果）の集計期間がcapability_score_target_days（既定30日）の流用か、別定義かが未確定。複数ラン投入シナリオの期間設計が決まらない。",
    "画面の縦横回転対応要求（現行はPORTRAIT固定）がモック再生時のUI検証に追加ケースを要求するかが未確定。"
  ],
  "rationale_notes": [
    "hiyari_recordingを例外扱いにせず正準へ編入したのは、行数=duration*100・GPS=100レコードごと1点という判定式を唯一の基準にすれば、duration違いのファイルも同一のチェックで扱えるため。『60s/6000行/60点』は9ファイルの結果値にすぎない。",
    "発火時刻を15/30/40/45/48/60秒としたのは、ユーザ指定の15/30/40秒を保持しつつ、隣接（02/03）・重複連結（03/04、04内の延長）・連結後の通常復帰（05）という録画境界条件を1本で網羅するため。proposal #252は連結が最後に来るため復帰を検証できず、不採用となった。",
    "ヒヤリを走行区間内・評価窓外に置くのは、ヒヤリ発火がparkingAction評価に混入しないようにするためであり、他の特徴的走行と同じ設計原則である。",
    "score2の判定経路を実機BLE 100ms（repeat=0）に固定するのは、DemoData 10ms全件経路ではサンプリング密度が異なり、指標値が分離しないため。参考実測87.2/57.1/7.4はこの経路で得た値である。",
    "steer_*3本をcruiseと同一の区間比・速度で構成するのは、score2の差分要因を舵角だけに限定するため。",
    "wobbleでMath.randomを禁止して固定seedのLCGを使い、GPSでも乱数を禁止するのは、生成物のバイト一致による回帰検出を成立させるため。",
    "既存6ファイルのバイト不変を必須にするのは、取得済みの回帰基準値を維持するため。不一致は生成器の意図しない挙動変化のシグナルとして扱う。",
    "L5をL1〜L3と分離したのは、録画E2Eがアプリ実行環境に依存するためである。ヒヤリ配置の正しさ（TC-MOCK-021〜023）はログ単体のL2で常時検証できるように残した。",
    "前提変更をfailではなくrebaseline_requiredとするのは、仕様変更由来の不一致と実装バグ由来の不一致を区別し、承認フローに乗せるため。",
    "テスト用ナビ端末の提供時期未定を縮退運用条件として明記したのは、端末待ちで検証が完全に停止するのを避けるため。",
    "BLEのパラレル処理化は先方の想定であって確定した対策ではないため、本ノードの検証条件には織り込まない。"
  ]
}
```