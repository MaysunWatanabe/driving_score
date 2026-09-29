<!-- 作成: 2026-09-25 11:00:35 JST | 更新: 2026-09-29 15:15:02 JST -->

# spec/qa/mockdata-sensorlog-scenarios.md

## 目的

本仕様は、UC12（編集とデモ再生）と UC06（運転診断の実行）を、実車を使わずに再現できる形で検証するためのものです。対象は正準モックセンサログ（`src/data/mock/*.txt.gz`）で、その内容・生成規則・受け入れ条件を定義します。
本仕様が規定するのは「どう生成するか」ではありません。**「何が成立していれば合格か」** を規定します。

本ノードは、2026 年度改修要求（レーダーチャート化・BLE 安定化・録画サイズ改善など）より前の実装を基準とする回帰基準です。改修要求の影響は §10 に保留事項としてまとめています。改修要求が確定するまで、正準モックと受入閾値は変更しません。

例外として、要求⑤（ヒヤリ録画）の E2E 検証用シナリオ `hiyari_recording` は正準セットに編入済みです（§3.7 / §5 L2・L5）。

---

## 1. 正準セット（9 シナリオ / 10 ファイル）

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

**全ファイル共通の判定式**
- 刻みは 10ms です。
- **レコード数 = duration × 100** です。受け入れはこの判定式だけを正とします。

**「60s / 6000 行 / 60 点」の扱い**
- この記述は、#1〜#9 の 9 ファイルについての記述として読み替えます。
- hiyari_recording は 90s / 9000 行 / GPS 90 点です。ただし **例外規定は設けません**。共通の判定式（行数 = duration × 100、GPS は 100 レコードごとに 1 点）がそのまま適用されます。

**commit 対象**
- steer_* と hiyari_recording は、canConnected 版だけを正準とします。
- steer_* の smartphoneOnly 版は生成できますが、commit しません。

**--loop の扱い**
- 正準生成で `--loop` を使用してはなりません（非推奨）。
- loop 機能自体はオミットして構いません。

---

## 2. 区間構成（出車 → 走行 → 駐車）

- 1 シナリオは「出車 → 走行 → 駐車」までを 1 本に含み、9 区間比で配分します。区間比の実値は、生成器 `src/data/tools/gen-mock-sensorlog.mjs` の定義を正とします。
- 特徴的走行（加減速・急制動・急旋回・舵角プロファイル）は、必ず **評価窓の外** に配置します。
- 評価窓は **D→R 遷移の直前 8 秒** です（parkingAction の判定区間）。
- 評価窓の直前は、全シナリオ共通の減速プロファイルとします。**40 km/h → 0 km/h、-0.21G** です。
- 後退（R）は **8 km/h、加減速 ±0.08G** とします。

**例外（出車・駐車を持たないシナリオ）**

| シナリオ | 構成 | 適用しない規則 |
|---|---|---|
| `cruise.smartphoneOnly` | 走行区間のみ | 9 区間比・D→R 遷移・評価窓・共通減速・後退 |
| `hiyari_recording` | 全区間 40 km/h 定速のみ（§3.7） | 同上 |

- 上記 2 本以外の全シナリオは、D→R 遷移を持ちます。

---

## 3. 走行プロファイル（シナリオ別）

### 3.1 cruise
- 走行区間は 40 km/h の定速とします。
- steer_* 系の基準プロファイルになります。

### 3.2 accel_decel
次の 20 秒周期を繰り返します。

| 時間 | 内容 |
|---|---|
| 8s | +0.21G で 0 → 60 km/h |
| 4s | 60 km/h 定速 |
| 8s | -0.21G で緩減速 |

### 3.3 hard_brake
走行区間 D の相対位置 0.20 / 0.45 / 0.70 の 3 点で制動します。
- 制動: 3.0s で 60 → 10 km/h（約 -0.47G）
- 再加速: 4.0s で 10 → 60 km/h（約 +0.35G）

### 3.4 sharp_curve
- 40 km/h の定速とします。
- yawRate = A × sin(2πt / 8.0)
- 横加速度（latAcc）のピークは **0.30G ちょうど** です。
- steeringAngle のピークは **±180 deg** です。

### 3.5 mixed
- 走行区間 D を 4 等分し、cruise → accel_decel → hard_brake → sharp_curve の順に連結します。
- 各境界で **車速・heading・lat/lng を引き継ぎます**。不連続を生じさせてはなりません。

### 3.6 steer_stable / steer_wobble_weak / steer_wobble_strong

**共通**
- 区間比と速度プロファイルは cruise と完全に同一とします（区間 3 は 40 km/h 定速）。**差し替えるのは舵角だけです**。
- `turnSignal = 0` に固定します。
- `|steeringAngle| <= 15` を守ります。
- 区間 3 の **37.2 秒** で 10 秒ゲートが成立しなければなりません。
- 生成後は、既存の物理値域制約と floor(x + 0.5) 量子化を通します。

**steer_stable**
- 乱数を使わない階段状の舵角とします。
- 4 秒ごとに 0° → +8° → -8° を巡回し、区間内は値を保持します。

**steer_wobble_***
- `Math.random` は禁止です。決定的な LCG を使います。
  1. シナリオ開始時に seed = 12345 にリセットする。
  2. seed = (seed × 1103515245 + 12345) & 0x7fffffff
  3. u = seed / 0x7fffffff、angle = (u × 2 - 1) × 2.0（±2°）
  4. 区間 3 の経過秒を t とする。(t % 4) / 4 < duty のときだけ新しい角度を採用し、それ以外は直前の値を保持する。
- duty は weak = 0.25、strong = 1.0 です。

### 3.7 hiyari_recording（ヒヤリ録画 E2E 用）

**基本条件**
- canConnected / `--duration 90` / 9000 レコード。

**走行構成**
- 出車・発進・減速・後退・駐車を **持ちません**。
- 全区間（0〜90 秒）を **40 km/h 定速走行** とし、`shiftIndication = 4` に固定します。
- したがって、次の規則はいずれも適用しません。
  - 9 区間比
  - D→R 遷移
  - 評価窓
  - 評価窓直前の共通減速
  - 後退
- 評価窓が存在しないため、TC-MOCK-014 / 015 / 016 は **対象外** です（TC-MOCK-019 も該当なし）。

**ヒヤリ配置の根拠**
- 確定版の根拠は **proposal #253 のみ** です。次の 2 案を、実装・検証の根拠にしてはなりません。
  - proposal #246: 出車・後退区間にヒヤリを置いていた。
  - proposal #252: 15/30/40/50/55/58 秒。連結が最後に来るため、連結後の復帰を検証できない。

**ヒヤリ発火時刻**
- **15 / 30 / 40 / 45 / 48 / 60 秒** の 6 点です（t_k, k = 1..6）。
- ユーザ指定の 15 / 30 / 40 秒は保持します。
- 連結ファイル（hiyari.04）の後に単独ファイル（hiyari.05）を置きます。これにより、連結状態から通常状態への復帰を検証できる並びにします。

**ヒヤリのパルス形状（proposal #259）**
各 t_k に、次のパルスを置きます。
1. t_k から 300ms、前後加速度 longAcc = **+0.20G**
2. 続く 300ms、longAcc = **-0.20G**

- 車速は積分で整合させます。**40 → 約 42 → 40 km/h** です（0.20G × 0.3s ≒ 2.1 km/h）。
- パルス以外の区間は 40 km/h 定速を維持します。
- パルス中のペダル値は、個別指定しません。longAcc ±0.02G を境とする共通規則（生成器定義）に従います。
- 1 パルスの長さは 600ms です。最短の発火間隔は 3 秒（45 → 48 秒）なので、パルス同士は重なりません。

**撤回済みの記述（根拠にしてはならない）**
- 「全発火時刻は走行区間 9.0〜64.8 秒内にあり、評価窓 68.5〜76.5 秒に掛からない」
- 「hiyari.05 の末尾 0.2 秒が減速区間に掛かる」

これらは、以前の出車・駐車付き構成（fact #4736 の走行区間制約）を前提とした記述です。全区間定速化にともない撤回しました。

---

## 4. GPS / 位置情報

- 起点は東京駅 **(35.681236, 139.767125)** です。以降の座標は、起点からの **相対計算** で求めます。
- GPS の生成に **乱数を用いてはなりません**。同一入力に対して、完全に同一の出力にします。
- `geolocation.speed = canData.vehicleSpeed / 3.6`（m/s）とします。

### 実機への GPS 投入
- 投入には `src/data/tools/mock-gps-feeder.py`（node: qa.mockdata.gps.feeder）を使います。
- 投入する項目は **latitude / longitude / accuracy のみ** です。
- 投入レートは **1Hz** で、センサログ **100 レコードごと** に 1 点です。
- 点数は **レコード数 / 100** で決まります（60s ファイルは 60 点、hiyari_recording は 90 点）。

---

## 5. 検証レイヤ

### L1: 存在チェック（実装が未完でも常に実行可能）

| TC | 合格条件 |
|---|---|
| TC-MOCK-001 | 正準 10 ファイルが `src/data/mock/` に存在する。 |
| TC-MOCK-002 | 各ファイルを ungzip でき、行単位に parse できる。 |
| TC-MOCK-003 | 各ファイルの行数が duration × 100 に一致する（#1〜#9 は 6000、hiyari_recording は 9000）。 |
| TC-MOCK-004 | 全レコードで、必須キーの欠落が 0 件である。 |

### L2: 構造・値域チェック（インタラクション相当）

| TC | 合格条件 |
|---|---|
| TC-MOCK-010 | steer_* 3 本の全レコードで `turnSignal = 0`。 |
| TC-MOCK-011 | steer_* 3 本の全レコードで `|steeringAngle| <= 15`。 |
| TC-MOCK-012 | 全シナリオで `geolocation.speed == canData.vehicleSpeed / 3.6`。 |
| TC-MOCK-013 | `cruise.smartphoneOnly` に出車・駐車区間（R レンジ）が存在しない。 |
| TC-MOCK-014 | `cruise.smartphoneOnly` と `hiyari_recording` 以外は D→R 遷移を含み、その直前 8 秒が評価窓として成立する。 |
| TC-MOCK-015 | 評価窓の直前が 40→0 km/h・-0.21G の共通減速である（hiyari_recording は対象外）。 |
| TC-MOCK-016 | 後退区間の車速が 8 km/h で、加減速が ±0.08G の範囲に収まる（hiyari_recording は対象外）。 |
| TC-MOCK-017 | sharp_curve の latAcc ピークが 0.30G ちょうど、steeringAngle ピークが ±180 deg である。 |
| TC-MOCK-018 | mixed の 4 区間境界で、車速・heading・lat/lng が連続している。 |
| TC-MOCK-019 | 特徴的走行が評価窓（D→R 直前 8 秒）に含まれない（評価窓を持たない cruise.smartphoneOnly / hiyari_recording は該当なし）。 |
| TC-MOCK-020 | steer_* の区間 3 において、37.2 秒で 10 秒ゲートが成立する。 |
| TC-MOCK-021 | hiyari_recording のヒヤリ用パルスが 15 / 30 / 40 / 45 / 48 / 60 秒の 6 点にだけ存在し、それ以外の時刻には存在しない。 |
| TC-MOCK-022 | hiyari_recording の全レコードで `shiftIndication = 4` であり、出車・発進・減速・後退・駐車の区間と D→R 遷移を含まない。 |
| TC-MOCK-023 | hiyari_recording で、各 t_k の直後 300ms が longAcc +0.20G、続く 300ms が -0.20G である。車速はパルスで 40 → 約 42 → 40 km/h と積分整合し、パルス以外では 40 km/h 定速である（量子化後の値で判定）。 |
| TC-MOCK-024 | hiyari_recording のパルス中のペダル値が、longAcc ±0.02G の共通規則と整合する。 |

### L3: 決定性・回帰チェック

| TC | 合格条件 |
|---|---|
| TC-MOCK-030 | 同一コマンドで再生成した 10 ファイルが、前回の生成物とバイト一致する（乱数に依存しない）。 |
| TC-MOCK-031 | 既存 6 ファイル（cruise×2 / accel_decel / hard_brake / sharp_curve / mixed）は、再生成してもバイト一致する。不一致の場合は既存ファイルを **上書きしてはならず**、FAIL 扱いとする。 |
| TC-MOCK-032 | 正準生成に `--loop` が使用されていない。 |
| TC-MOCK-033 | BLE notify ペイロードが **12 バイト固定長**（PAYLOAD_LEN = 12、offset 5-6 のみ u16 BE）であるという前提が維持されている。 |
| TC-MOCK-034 | 凍結対象に差分がない。凍結対象は `scoreLogicFunction.txt` / `scoreLogic.json` / `score-logic.ts` / `src/data/src/app/**` / BLE 符号化 / `ble-can-emulator`。 |

- TC-MOCK-033 の補足:
  - ペイロード長や割り当てが変わった場合、本ノードの正準モックと score2 受入は FAIL ではなく **要再ベースライン** として報告します。
  - 変更が承認されるまでは、正準を更新しません。

### L4: 業務ルール（score2 受入）

**判定経路**
- **実機 BLE 100ms 経路（repeat = 0）** で判定します。
- 10ms ログを 100ms 間隔（10 本に 1 本）に間引くか、`ble-can-emulator.py` の既定値 `--rate-ms 100` を使います。

| TC | 合格条件 | 参考実測 |
|---|---|---|
| TC-SCORE2-001 | steer_stable の score2 >= 80 | 87.2 |
| TC-SCORE2-002 | steer_wobble_weak の score2 が 40 以上 70 未満 | 57.1 |
| TC-SCORE2-003 | steer_wobble_strong の score2 < 20 | 7.4 |
| TC-SCORE2-004 | score2 の大小関係が stable > weak > strong を満たす | — |
| TC-SCORE2-005 | DemoData 10ms 全件経路で得た score2 は **合否判定に用いない**（参考値として記録するだけ） | — |

### L5: ヒヤリ録画 E2E（hiyari_recording 再生時の期待値）

**前提**
- `settingRecordingMargin = 5` で hiyari_recording を再生します。
- 区間とマーカーの秒数は、すべて **シナリオ開始からの経過秒** で表します。
- 録画ファイル内部のマーカー値は、ファイル先頭基準で記録されます（録画側ノードの定義）。比較するときは、ファイルの開始秒を加えて経過秒に換算します。

| TC | 合格条件 |
|---|---|
| TC-HIYARI-001 | 生成される録画ファイルは **5 ファイル**、ヒヤリマーカーは **6 個** である。 |
| TC-HIYARI-002 | hiyari.01 の区間が [10, 20] で、マーカー {15} を持つ。 |
| TC-HIYARI-003 | hiyari.02 の区間が [25, 35] で、マーカー {30} を持つ。 |
| TC-HIYARI-004 | hiyari.03 の区間が [35, 45] で、マーカー {40} を持つ。 |
| TC-HIYARI-005 | hiyari.02 と hiyari.03 はちょうど隣接し、重複はゼロである（別ファイルとして生成され、連結されない）。 |
| TC-HIYARI-006 | hiyari.04 の区間が [40, 53] で、マーカー {45, 48} を持つ。 |
| TC-HIYARI-007 | hiyari.04 は hiyari.03 と 5 秒重複する。48 秒の発火による連結で、終端が 50 → 53 へ延長される。 |
| TC-HIYARI-008 | hiyari.05 の区間が [55, 65] で、マーカー {60} を持つ。連結状態から通常状態へ復帰したうえで、単独ファイルとして生成される。 |

**録画側設計との整合（要確認）**
- 上記の期待値は、proposal #253 の連結方式を前提としています。
- 一方、録画側の承認済み設計には「ヒヤリごとに必ず新しい hiyari.NN.webm を開き、区間が重なる場合は複数区間を同時に開く」という決定があります。この設計のもとでは、ファイル数とマーカーの割り当てが上記と一致しない可能性があります。
- 整合が確定するまでの扱いは次のとおりです。
  - 生成結果が上表と一致しない場合、その差異が録画側の承認済み設計で説明できるときは `fail` ではなく `rebaseline_required` として報告します。
  - 説明できない差異は `fail` とします。

---

## 6. 変更禁止範囲（回帰ガード）

次の項目は本ノードの検証の前提です。変更されると、受入閾値が無効になります。
- `scoreLogicFunction.txt` / `scoreLogic.json` / `score-logic.ts`
- `src/data/src/app/**`
- BLE 符号化 / ble-can-emulator（**12 バイト固定長ペイロード前提**）
- 既存 6 モックファイルのプロファイルとバイト列

**スコアロジック凍結の状況**
- スコアロジックの凍結（打ち合わせ後まで変更しない）は、2026-09-17 時点で解除されていません。
- 2026 年度改修要求のうち、6 項目 5 段階のレーダーチャート化については、採点データ形式を先方が検討中です。形式が確定するまで、本ノードの score2 受入閾値は変更しません。

**変更を検出した場合**
- 上記のいずれかに変更を検出した場合は、score2 受入を再測定します。
- 閾値の妥当性を再確認するまでは、PASS としません。

---

## 7. 縮退モード検証

- **L1〜L3**: 実機や BLE が利用できない環境でも、必ず実行して合否を出します。
- **L4（score2）**: 実機経路が利用できない場合は `skipped` とし、`fail` にはしません。ただし、`skipped` を含むランを「正準更新の承認」に使うことはできません。
- **L5（ヒヤリ録画 E2E）**: アプリ実行環境（録画機能を含む）が利用できない場合は `skipped` とします。この場合でも、ヒヤリ配置・走行構成に関する TC-MOCK-021〜024 は、L2 としてログ単体で必ず検証します。
- **GPS フィーダが利用できない場合**: TC-MOCK-012 はログ内の整合だけで検証し、実機投入の検証は `skipped` とします。
- **テスト用ナビ端末**: 提供時期が未定です。端末が提供されるまでは L4 を `skipped` として運用し、L1〜L3 だけで回帰検出を続けます。

---

## 8. 失敗時の証跡（Artifact）

**必須**
- 生成コマンドと標準出力ログ
- 各 gz ファイルの SHA256
- parse 結果サマリ（行数・必須キー欠落件数・値域違反の行番号）
- hiyari_recording の場合: 各 t_k 前後の longAcc / vehicleSpeed / shiftIndication の抜粋
- score2 の実測値（経路種別・rate-ms・repeat を併記）
- BLE ペイロード長と、凍結対象ファイルの差分有無
- L5 実行時: settingRecordingMargin の値と、生成された録画ファイル一覧（各ファイルの開始秒・終了秒・マーカー秒。マーカーはファイル内の値と経過秒換算値を併記）
- run_id

**任意**
- 舵角 / 車速 / latAcc / longAcc の時系列プロット
- 実機診断画面のスクリーンショット
- L5 実行時の録画ファイル本体

---

## 9. レポート形式

ファイル名は `qa_report.json` です。

| field | 内容 |
|---|---|
| run_id | 実行 ID |
| scenario | シナリオ名 |
| sensor_mode | sensorMode |
| layer | L1 / L2 / L3 / L4 / L5 |
| status | pass / fail / skipped / rebaseline_required |
| fail_reason | 失敗理由 |
| measured | 実測値（score2 など。L5 では録画ファイル数・マーカー数・各ファイルの区間） |
| evidence_paths | 証跡のパス |
| reproduction_steps | 再現手順 |

---

## 10. 2026 年度改修要求による影響（保留事項）

2026 年度改修要求は、日産自動車から受領した資料 2 件に基づく 5 要求です。これらは本ノードの正準モックに、次の影響を持つ可能性があります。hiyari_recording の編入を除き、いずれも **確定するまで正準モックを変更しません**。

| 要求 | 本ノードへの想定影響 | 現時点の扱い |
|---|---|---|
| ③ 採点スコアのレーダーチャート表示（6 項目・1〜5 の 5 段階） | score2 など 0〜100 スケールの受入閾値が、意味を失う可能性がある。6 項目の採点データ形式は先方が検討中。 | 現行スコアロジックを前提に凍結する。形式が確定したら閾値を再ベースラインする。 |
| ④ BLE 通信の安定化（標識認識・先行車検知の追加を含む） | CAN ペイロードの長さや割り当てが 12 バイトから変わると、符号化規則とエミュレータの前提が崩れる。 | TC-MOCK-033 で前提の維持を監視する。変化した場合は `rebaseline_required` とする。 |
| ⑤ ヒヤリ発生時の録画データサイズ改善（前後 15 秒・連続ヒヤリ） | ヒヤリ録画 E2E 用に hiyari_recording（90s・全区間 40 km/h 定速・発火 6 点）を正準へ編入済み。L5 の期待値（5 ファイル・6 マーカー）は proposal #253 の連結方式が前提で、録画側の「ヒヤリごとに新規ファイル」設計との整合は未確定。 | L2（TC-MOCK-021〜024）と L5（TC-HIYARI-001〜008）で検証する。録画ファイル生成の仕様本体は他ノードの管轄。 |
| ① 診断開始前画面の前回結果表示（履歴平均） | 履歴平均の集計期間が未確定。モックログ 1 本だけでは、履歴平均の検証は成立しない。 | 複数ラン分のモックを投入するシナリオを別途定義する必要がある（未着手）。 |
| ② タブ切り替え / 8-1 サービス案表示 | 本ノードへの影響はない。 | 対象外。 |

スケジュールは、2026 年 11 月末に開発完了、12 月に実験開始です。これに照らし、L1〜L3 は実装状況にかかわらず常時グリーンを維持することを CI の前提とします。

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "§2の例外にhiyari_recordingを追加し、出車・駐車・D→R遷移・評価窓・共通減速・後退を持たないのはcruise.smartphoneOnlyとhiyari_recordingの2本とする"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "§3.7を改訂し、hiyari_recordingを全区間40km/h定速・shiftIndication=4固定・9区間比非適用とし、TC-MOCK-014/015/016を対象外と明記する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "§3.7にproposal #259のパルス（各t_kでlongAcc +0.20G 300ms→-0.20G 300ms、車速40→約42→40km/hの積分整合、ペダル値は±0.02G共通規則）を規定する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "走行区間9.0〜64.8秒・評価窓68.5〜76.5秒・hiyari.05末尾0.2秒減速重なりの記述（fact #4736）を撤回扱いとし、仕様本文とL5補足から削除する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "TC-MOCK-022/023を、shiftIndication=4固定・非定速区間なしの検証とパルス形状・車速積分整合の検証に置き換え、TC-MOCK-024（ペダル値の±0.02G規則整合）を追加し、TC-MOCK-014/015/016/019の対象からhiyari_recordingを除外する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "L5にマーカー秒の時間基準（経過秒表記、ファイル内は先頭基準）と、録画側の『ヒヤリごとに新規ファイル』設計との不整合時はrebaseline_requiredとする扱いを追記する"},
    {"node": "qa.mockdata.sensorlog.scenarios", "entrypoint": "spec/qa/mockdata-sensorlog-scenarios.md", "description": "縮退モードのログ単体必須範囲をTC-MOCK-021〜024に広げ、証跡にt_k前後のlongAcc/vehicleSpeed/shiftIndication抜粋とマーカーの経過秒換算値を追加する"}
  ],
  "suggested_impacts": [
    {"domain": "Middleware-agent", "severity": "must", "reason": "hiyari_recordingのパルス（±0.20G・各300ms）がヒヤリ判定閾値を超えて各t_kで1回だけ発火するか、また-0.20G相が別のヒヤリとして発火しないかを判定ロジック側で確認する必要がある"},
    {"domain": "App-agent", "severity": "must", "reason": "L5期待値（5ファイル・6マーカー、hiyari.04の連結延長）はproposal #253の連結方式が前提だが、録画側の承認済み設計は『ヒヤリごとに新規hiyari.NN.webmを開き重なり区間は同時オープン』であり、ファイル数とマーカー割り当ての整合確定が必要"},
    {"domain": "App-agent", "severity": "should", "reason": "録画ファイルの開始秒・終了秒と、ファイル先頭基準のマーカー秒をE2Eで観測できる出力（ファイル名・メタデータ）が必要"},
    {"domain": "Infra-agent", "severity": "must", "reason": "CIの存在・行数・バイト一致チェックの対象を10ファイル（hiyari_recordingは9000行）とし、TC-MOCK-014/015/016の対象からhiyari_recordingを除外する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "L5はsettingRecordingMargin=5の設定と録画ファイル一覧の証跡保存が必要であり、アプリ実行環境がない場合にskippedとする実行分岐が要る"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "レーダーチャート6項目5段階化で採点データ形式が変わるとscore2受入閾値（80/40-70/20）が無効になるため、形式確定時にQAへ再ベースラインを依頼する必要がある"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "標識認識・先行車検知の追加でBLEペイロードが12バイトから変わると、正準モックの符号化規則とエミュレータ前提が同時に崩れるため、事前通知が必要"},
    {"domain": "qa.mockdata.ble.emulator", "severity": "must", "reason": "12バイト固定長前提（short11/long13のinject-invalidを含む）は本ノードの回帰ガードと共通であり、hiyari_recordingの9000行再生にも適用されるため、変更時は同時改訂になる"},
    {"domain": "qa.mockdata.gps.feeder", "severity": "should", "reason": "GPS投入点数は固定60点ではなくレコード数/100で決まり、hiyari_recordingは全区間40km/h定速の90点となる"},
    {"domain": "DB-agent", "severity": "should", "reason": "1-2の前回結果が履歴平均になるため、複数ラン分のモック診断結果を投入するシナリオ定義が必要になる"}
  ],
  "requirements_context": "本ノード（qa.mockdata.sensorlog.scenarios）は、UC12（編集とデモ再生）とUC06（運転診断の実行）を実車なしで再現検証するための正準モックセンサログ（src/data/mock/*.txt.gz）について、内容・生成規則・受入条件を定義する。規定するのは『どう生成するか』ではなく『何が成立していれば合格か』である。2026年度改修要求より前の実装を基準とする回帰基準であり、hiyari_recordingの編入を除き、改修要求が確定するまで正準モックと受入閾値を変更しない。\n\n【正準セット】9シナリオ10ファイル。cruiseのみsmartphoneOnlyとcanConnectedの2本。accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong / hiyari_recording はcanConnectedのみ。刻みは10ms。レコード数=duration*100の判定式のみを正とする。#1〜#9は60s・6000行、hiyari_recordingは90s・9000行。『60s/6000行/60点』は正準9ファイルについての記述と読み替え、例外規定は設けない。ファイル名は sensor-log.<scenario>.<sensorMode>.txt.gz。steer_*のsmartphoneOnly版は生成できるがcommitしない。正準生成で--loopは使用しない（非推奨、loop機能はオミット可）。\n\n【区間構成】シナリオは出車→走行→駐車を1本に含み、9区間比で配分する（区間比の実値はgen-mock-sensorlog.mjsを正とする）。特徴的走行は評価窓（D→R遷移直前8秒＝parkingAction判定区間）の外に置く。評価窓直前は共通で40→0km/h・-0.21G。後退は8km/h・±0.08G。例外はcruise.smartphoneOnly（走行区間のみ）とhiyari_recording（全区間40km/h定速）の2本で、これらは9区間比・D→R遷移・評価窓・共通減速・後退を持たない。\n\n【走行プロファイル】cruise=40km/h定速。accel_decel=20秒周期（8s +0.21Gで0→60、4s 60定速、8s -0.21G緩減速）。hard_brake=走行区間Dの相対位置0.20/0.45/0.70で制動3.0s 60→10km/h（約-0.47G）、再加速4.0s 10→60km/h（約+0.35G）。sharp_curve=40km/h定速、yawRate=A*sin(2πt/8.0)、latAccピーク0.30Gちょうど、steeringAngleピーク±180deg。mixed=走行区間Dを4等分しcruise→accel_decel→hard_brake→sharp_curveを連結、境界で車速・heading・lat/lngを引き継ぐ。steer_*3本は区間比・速度をcruiseと完全同一（区間3は40km/h定速）とし舵角のみ差し替え、turnSignal=0固定、|steeringAngle|<=15、区間3の37.2秒で10秒ゲート成立。steer_stableは乱数なしの階段（4秒ごとに0°→+8°→-8°を巡回、区間内保持）。steer_wobble_*はMath.random禁止、seed=12345にリセット後 seed=(seed*1103515245+12345)&0x7fffffff、u=seed/0x7fffffff、angle=(u*2-1)*2.0（±2°）、(t%4)/4<dutyのときのみ新角度（weak=0.25 / strong=1.0）。生成後は物理値域制約とfloor(x+0.5)量子化を通す。\n\n【hiyari_recording】canConnected / --duration 90 / 9000レコード。出車・発進・減速・後退・駐車を持たず、全区間40km/h定速、shiftIndication=4固定。TC-MOCK-014/015/016は対象外（TC-MOCK-019も該当なし）。確定根拠はproposal #253のみで、proposal #246（出車・後退区間にヒヤリ）と#252（15/30/40/50/55/58秒、連結が最後で復帰検証不可）は根拠にしない。発火時刻は15/30/40/45/48/60秒（ユーザ指定15/30/40秒を保持し、連結ファイルの後に単独ファイル）。各t_kにproposal #259のパルス：longAcc +0.20Gを300ms、続けて-0.20Gを300ms、車速は積分で40→約42→40km/h、パルス以外は40km/h定速、ペダル値は±0.02G共通規則に任せる。走行区間9.0〜64.8秒・評価窓68.5〜76.5秒・hiyari.05末尾0.2秒の減速重なりの記述（fact #4736の走行区間制約）は撤回済み。settingRecordingMargin=5での期待値は5ファイル・6マーカー：hiyari.01=[10,20]{15}、hiyari.02=[25,35]{30}、hiyari.03=[35,45]{40}（02と隣接ちょうど・重複ゼロ）、hiyari.04=[40,53]{45,48}（03と5秒重複、48秒の連結で終端50→53へ延長）、hiyari.05=[55,65]{60}（連結状態から通常状態への復帰を検証）。秒数は経過秒で、ファイル内マーカーはファイル先頭基準（録画側定義）。録画側の承認済み設計『ヒヤリごとに新規hiyari.NN.webmを開き、重なり区間は同時オープンし全区間へappend』と上記期待値の整合は未確定で、差異が同設計で説明できる場合はrebaseline_requiredとする。\n\n【GPS】起点は東京駅(35.681236,139.767125)で以降は相対計算、乱数不使用。geolocation.speed=canData.vehicleSpeed/3.6。実機投入はmock-gps-feeder.pyでlatitude/longitude/accuracyのみ、1Hz、100レコードごとに1点（60sファイル=60点、hiyari_recording=90点）。\n\n【検証レイヤ】L1存在：10ファイル存在、ungzip+parse可、行数=duration*100、必須キー欠落0。L2構造・値域：steer_*のturnSignal=0と|steeringAngle|<=15、speed整合、smartphoneOnlyにRなし、D→R遷移と評価窓の成立（smartphoneOnly/hiyari_recording除く）、共通減速、後退8km/h±0.08G、sharp_curveピーク、mixed境界連続、特徴的走行が評価窓外、37.2秒ゲート、hiyariパルスが6点のみ（021）、shiftIndication=4固定で非定速区間なし（022）、パルス形状と車速積分整合（023）、ペダル値の±0.02G規則整合（024）。L3決定性・回帰：10ファイルの再生成バイト一致、既存6ファイルはバイト一致必須で不一致時は上書き禁止、--loop未使用、BLEペイロード12バイト固定長前提の維持、凍結対象の差分なし。L4 score2受入。L5ヒヤリ録画E2E（TC-HIYARI-001〜008）。\n\n【score2受入】判定経路は実機BLE 100ms（repeat=0）。10msログを10本に1本にするか、ble-can-emulator.py既定の--rate-ms 100を用いる。steer_stable>=80（参考87.2）、steer_wobble_weakは40以上70未満（参考57.1）、steer_wobble_strong<20（参考7.4）、かつstable>weak>strong。DemoData 10ms全件経路の値は判定に使わず、参考記録のみとする。\n\n【変更禁止範囲】scoreLogicFunction.txt / scoreLogic.json / score-logic.ts / src/data/src/app/** / BLE符号化（12バイト固定長、PAYLOAD_LEN=12、offset5-6のみu16 BE）/ ble-can-emulator / 既存6ファイルのプロファイルとバイト列。スコアロジック凍結は2026-09-17時点で未解除。変更を検出したらscore2を再測定し、閾値の妥当性を再確認するまでPASSとしない。\n\n【縮退モード】実機/BLEがなくてもL1〜L3は必ず実行する。L4は実機経路がなければskipped（failではない）とするが、skippedを含むランは正準更新の承認に使えない。L5はアプリ実行環境がなければskippedとし、TC-MOCK-021〜024はログ単体で必ず検証する。GPSフィーダがなければTC-MOCK-012はログ内整合のみ検証する。テスト用ナビ端末の未提供期間はL4 skippedで運用する。\n\n【証跡】必須：生成コマンドと標準出力、各gzのSHA256、parse結果サマリ（行数・欠落件数・値域違反行番号）、hiyari_recordingのt_k前後のlongAcc/vehicleSpeed/shiftIndication抜粋、score2実測値（経路種別・rate-ms・repeat併記）、BLEペイロード長と凍結対象の差分有無、L5実行時のsettingRecordingMarginと録画ファイル一覧（開始秒・終了秒・マーカー秒、ファイル内値と経過秒換算値を併記）、run_id。任意：時系列プロット、実機スクリーンショット、録画ファイル本体。レポートはqa_report.json（run_id / scenario / sensor_mode / layer(L1|L2|L3|L4|L5) / status(pass|fail|skipped|rebaseline_required) / fail_reason / measured / evidence_paths / reproduction_steps）。\n\n【2026年度改修要求の影響】①診断開始前画面の前回結果表示（前回=過去履歴の平均、記録がなければ線を描画しない）②タブ切り替え追加と8-1サービス案表示③採点スコアのレーダーチャート表示（筋力・柔軟性・空間把握・危険予測・視力・視野の6項目、1〜5の5段階、3が年齢平均、今回と過去平均の2系列）④BLE通信の安定化（標識認識・先行車検知の追加を含む。パラレル処理化は仮説で確定ではない）⑤ヒヤリ発生時の録画データサイズ改善。③は採点データ形式が先方検討中で、0〜100スケールのscore2閾値を無効化し得る。④はCANペイロード長・割り当てを12バイトから変える可能性があり、符号化規則とエミュレータ前提（short11/long13）が崩れる。⑤はhiyari_recording編入によりL2/L5で検証する（録画生成仕様本体は他ノード管轄）。①は履歴平均の検証に複数ラン投入が別途必要。前提の変化はrebaseline_requiredとして報告する。2026年11月末完了・12月実験開始のため、L1〜L3は常時グリーンを維持する。",
  "fact_candidates": [
    {"type": "data_semantics", "title": "正準モックは9シナリオ10ファイルで構成される", "statement": "正準モックセンサログは9シナリオ・10ファイルで構成され、cruiseのみsmartphoneOnlyとcanConnectedの2ファイルを持ち、他の8シナリオはcanConnectedのみである", "status": "candidate"},
    {"type": "validation_rule", "title": "レコード数はduration*100と一致する", "statement": "全正準モックファイルのレコード数はduration(秒)*100と厳密に一致しなければならない", "status": "candidate"},
    {"type": "data_semantics", "title": "hiyari_recordingは90秒9000行である", "statement": "hiyari_recordingはcanConnected・duration90秒・10ms刻み・9000レコードである", "status": "candidate"},
    {"type": "constraint", "title": "hiyari_recordingに行数の例外規定を設けない", "statement": "hiyari_recordingの行数・GPS点数は、行数=duration*100およびGPS=100レコードごと1点の共通判定式で合否を判定する", "status": "candidate"},
    {"type": "validation_rule", "title": "必須キーの欠落は0件でなければならない", "statement": "ungzip後にparseした全レコードで、必須キーの欠落件数は0でなければならない", "status": "candidate"},
    {"type": "business_rule", "title": "評価窓はD→R遷移の直前8秒である", "statement": "スコア評価窓はD→Rのシフト遷移の直前8秒区間である", "status": "candidate"},
    {"type": "constraint", "title": "特徴的走行は評価窓の外に配置される", "statement": "加減速・急制動・急旋回・舵角プロファイルなどの特徴的走行は、評価窓に含まれてはならない", "status": "candidate"},
    {"type": "business_rule", "title": "評価窓直前は共通減速プロファイルである", "statement": "評価窓を持つシナリオでは、評価窓の直前区間が40km/hから0km/hへ-0.21Gで減速する", "status": "candidate"},
    {"type": "business_rule", "title": "後退区間は8km/h・±0.08Gである", "statement": "後退（Rレンジ）区間の車速は8km/h、加減速は±0.08Gである", "status": "candidate"},
    {"type": "constraint", "title": "出車・駐車を持たないのはcruise.smartphoneOnlyとhiyari_recordingのみ", "statement": "出車・駐車区間とD→R遷移を持たない正準シナリオはcruise.smartphoneOnlyとhiyari_recordingの2本だけであり、他はD→R遷移を含む", "status": "candidate"},
    {"type": "data_semantics", "title": "hiyari_recordingは全区間40km/h定速である", "statement": "hiyari_recordingは出車・発進・減速・後退・駐車を持たず、全区間を40km/h定速で走行する", "status": "candidate"},
    {"type": "validation_rule", "title": "hiyari_recordingのshiftIndicationは4固定である", "statement": "hiyari_recordingの全レコードでshiftIndicationは4である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recordingはTC-MOCK-014/015/016の対象外である", "statement": "hiyari_recordingは評価窓・共通減速・後退を持たないため、TC-MOCK-014/015/016の合否判定対象に含めない", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recordingの走行区間制約は撤回済みである", "statement": "hiyari_recordingについて走行区間9.0〜64.8秒・評価窓68.5〜76.5秒に基づく判定を合否根拠にしてはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari_recordingの確定版はproposal #253のみ", "statement": "hiyari_recordingのヒヤリ配置の根拠はproposal #253のみであり、proposal #246および#252を根拠にしてはならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "ヒヤリ用パルスは6点のみに存在する", "statement": "hiyari_recordingのヒヤリ用パルスは15/30/40/45/48/60秒の6点にのみ存在し、それ以外の時刻には存在しない", "status": "candidate"},
    {"type": "data_semantics", "title": "ヒヤリパルスは+0.20G 300ms→-0.20G 300msである", "statement": "hiyari_recordingの各発火時刻t_kの直後300msはlongAcc +0.20G、続く300msはlongAcc -0.20Gである", "status": "candidate"},
    {"type": "validation_rule", "title": "ヒヤリパルス中の車速は40→約42→40km/hで積分整合する", "statement": "hiyari_recordingの各パルスで車速はlongAccの積分と整合して40km/hから約42km/hに上がり40km/hへ戻る", "status": "candidate"},
    {"type": "validation_rule", "title": "パルス以外の区間は40km/h定速である", "statement": "hiyari_recordingのパルス区間以外の車速は40km/hで一定である", "status": "candidate"},
    {"type": "validation_rule", "title": "パルス中のペダル値は±0.02G共通規則に整合する", "statement": "hiyari_recordingのパルス中のペダル値はlongAcc ±0.02Gを境とする共通規則と整合する", "status": "candidate"},
    {"type": "qa_expectation", "title": "マージン5秒で録画5ファイル・マーカー6個", "statement": "settingRecordingMargin=5でhiyari_recordingを再生すると、録画ファイルは5本、ヒヤリマーカーは6個生成される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.01は[10,20]でマーカー15", "statement": "hiyari.01の録画区間は経過10〜20秒で、マーカーは15秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.02は[25,35]でマーカー30", "statement": "hiyari.02の録画区間は経過25〜35秒で、マーカーは30秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.03は[35,45]でマーカー40", "statement": "hiyari.03の録画区間は経過35〜45秒で、マーカーは40秒の1点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.02と03は隣接し重複しない", "statement": "hiyari.02とhiyari.03は35秒でちょうど隣接し、重複はゼロで、別ファイルとして生成される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.04は[40,53]でマーカー45と48", "statement": "hiyari.04の録画区間は経過40〜53秒で、マーカーは45秒と48秒の2点である", "status": "candidate"},
    {"type": "qa_expectation", "title": "48秒の連結でhiyari.04の終端が53秒へ延長される", "statement": "hiyari.04はhiyari.03と5秒重複し、48秒の発火による連結で終端が50秒から53秒へ延長される", "status": "candidate"},
    {"type": "qa_expectation", "title": "hiyari.05は連結後に通常状態で生成される", "statement": "hiyari.05の録画区間は経過55〜65秒でマーカーは60秒の1点であり、連結状態から通常状態へ復帰した単独ファイルとして生成される", "status": "candidate"},
    {"type": "data_semantics", "title": "GPSは東京駅起点の相対計算で乱数を用いない", "statement": "GPS座標は東京駅(35.681236,139.767125)を起点とする相対計算で生成され、乱数を用いない", "status": "candidate"},
    {"type": "api_contract", "title": "geolocation.speedは車速のm/s換算である", "statement": "geolocation.speedはcanData.vehicleSpeed/3.6に一致する", "status": "candidate"},
    {"type": "external_integration_rule", "title": "実機GPS投入点数はレコード数/100である", "statement": "実機GPS投入はlatitude/longitude/accuracyのみを1Hz・100レコードごとに1点投入し、60秒ファイルは60点、hiyari_recordingは90点となる", "status": "candidate"},
    {"type": "qa_expectation", "title": "score2判定は実機BLE 100ms経路の値で行う", "statement": "score2の合否判定は実機BLE 100ms経路（repeat=0）の値を用い、DemoData 10ms全件経路の値は判定に使わない", "status": "candidate"},
    {"type": "qa_expectation", "title": "steer_*のscore2受入閾値", "statement": "score2はsteer_stable>=80、steer_wobble_weakが40以上70未満、steer_wobble_strong<20であり、stable>weak>strongを満たす", "status": "candidate"},
    {"type": "constraint", "title": "既存6ファイルのバイト列を変更しない", "statement": "既存6ファイル（cruise×2/accel_decel/hard_brake/sharp_curve/mixed）は再生成でバイト一致しなければならず、不一致時は上書きしない", "status": "candidate"},
    {"type": "validation_rule", "title": "10ファイルの再生成はバイト一致する", "statement": "同一コマンドで再生成した正準10ファイルは、前回生成物とバイト一致しなければならない", "status": "candidate"},
    {"type": "qa_expectation", "title": "前提変化時はrebaseline_requiredとする", "statement": "BLEペイロード12バイト固定長前提・スコアロジック・録画側設計の変化に起因する不一致はrebaseline_requiredとし、再測定と承認までPASSとしない", "status": "candidate"},
    {"type": "qa_expectation", "title": "実行環境不在時のL4/L5はskippedとする", "statement": "実機BLE経路またはアプリ実行環境が使えない場合、L4/L5はskippedとし失敗扱いにしないが、skippedを含むランは正準更新の承認に使えない", "status": "candidate"}
  ],
  "open_questions": [
    "hiyari_recordingのパルス（longAcc ±0.20G・各300ms）がアプリのヒヤリ判定閾値を超え、各t_kでちょうど1回だけ発火するかが未確認である。後続の-0.20G相が別のヒヤリとして検出されないかも未確認。Middleware/App（ヒヤリ判定ロジック）の確認が必要で、確定しないとL5の6マーカー期待値が成立するか判断できない。",
    "L5期待値（5ファイル・6マーカー、hiyari.04の連結延長50→53）はproposal #253の連結方式を前提とする。一方、録画側の承認済み設計は『ヒヤリごとに必ず新しいhiyari.NN.webmを開き、重なる区間は同時に開いて全区間へappend』であり、この場合ファイル数・区間・マーカー割り当てが異なる可能性がある。App（録画）とQAでどちらを正とするか確定が必要で、確定しないとTC-HIYARI-001/006/007の合否基準が定まらない。",
    "パルス中のペダル値が従う『±0.02G共通規則』の具体的な内容（アクセル/ブレーキ値の割り当て）が本ノードの事実からは読み取れない。生成器（Middleware/QA）での定義確認が必要で、確定しないとTC-MOCK-024を数値で判定できない。",
    "L5はsettingRecordingMargin=5で定義されているが、改修要求⑤は前後15秒の録画を想定している。15秒設定時の期待ファイル構成を別途定義するか、App/先方の確認が必要。確定しないと本番設定での回帰検証ができない。",
    "hiyari_recordingは評価窓を持たないため、score2などスコア値が未算出または非評価となる。この状態を合格扱いとするか、Middleware/QAでの確定が必要である。",
    "L5のマーカー比較で、ファイル内マーカー（ファイル先頭基準のfloor秒）と経過秒の換算時の丸め誤差（±1秒）の許容を明文化する必要がある。録画側ノードとの確認が必要。",
    "hiyari_recordingのファイル名 sensor-log.hiyari_recording.canConnected.txt.gz は命名規則に従ったものであり、生成器側の出力名として確定しているかは要確認である。",
    "9区間比の具体的な配分値が未明示である。生成器の実装値を正とするのか、仕様側で数値を固定するのかをQA/Middlewareで確定する必要がある。",
    "sharp_curveのyawRate振幅Aの具体値が未確定であり、TC-MOCK-017の許容誤差を定義できない。",
    "hard_brakeの相対位置0.20/0.45/0.70の基準となるD区間の起点・終点の定義が未確定である。",
    "『区間3の37.2秒で10秒ゲートが成立する』の37.2秒が、シナリオ全体の経過秒か区間3内の経過秒かが未確定である。",
    "既存6ファイルのバイト一致検証に用いる基準SHA256の管理場所（CI保持か、リポジトリ内のチェックサムファイルか）が未定である。",
    "採点が6項目・1〜5の5段階へ移行した場合に、score2受入閾値80/40-70/20をどう写像するかが未確定である。採点データ形式は先方で検討中。",
    "標識認識・先行車検知の追加でCANペイロードが12バイトから変わるかが未確定である。変わる場合は10ファイルの全再生成とscore2・L5の再測定が必要になる。",
    "履歴平均（1-2の前回結果）の集計期間がcapability_score_target_days（既定30日）の流用か別定義かが未確定であり、複数ラン投入シナリオの期間設計が決まらない。",
    "画面の縦横回転対応要求（現行はPORTRAIT固定）が、モック再生時のUI検証に追加ケースを要求するかが未確定である。"
  ],
  "rationale_notes": [
    "hiyari_recordingを全区間40km/h定速にしたのは、出車・後退・減速・評価窓との干渉を構造的に排除し、録画区間の境界条件だけを検証対象にするためである。これにより、以前の走行区間9.0〜64.8秒の制約やhiyari.05末尾の減速重なりの議論は不要になった。",
    "ヒヤリを+0.20G→-0.20Gの対称パルスにしたのは、車速を40km/hへ戻して定速前提を崩さず、GPSのspeed整合（TC-MOCK-012）とも両立させるためである。",
    "hiyari_recordingを例外扱いせず正準へ編入したのは、行数=duration*100・GPS=100レコードごと1点という判定式を唯一の基準にすれば、durationが異なるファイルも同じチェックで扱えるためである。",
    "発火時刻15/30/40/45/48/60秒は、ユーザ指定の15/30/40秒を保持しつつ、隣接（02/03）・重複連結（03/04、04内の延長）・連結後の通常復帰（05）を1本で網羅するための配置である。",
    "L5で録画側設計との差異をfailではなくrebaseline_requiredとする余地を残したのは、proposal #253の期待値と録画側の承認済み設計がどちらも承認済みで、どちらが正かQA単独では判断できないためである。",
    "score2の判定経路を実機BLE 100ms（repeat=0）に固定するのは、DemoData 10ms全件経路ではサンプリング密度が異なり指標値が分離しないためである。",
    "steer_*3本をcruiseと同一の区間比・速度で構成するのは、score2の差分要因を舵角だけに限定するためである。",
    "wobbleでMath.randomを禁止し固定seedのLCGを使い、GPSでも乱数を禁止するのは、生成物のバイト一致による回帰検出を成立させるためである。",
    "L5をL1〜L3と分離したのは、録画E2Eがアプリ実行環境に依存するためである。ヒヤリ配置と走行構成の正しさ（TC-MOCK-021〜024）はログ単体で常時検証できるよう、L2に残した。",
    "テスト用ナビ端末の提供時期未定を縮退運用条件として明記したのは、端末待ちで検証が完全に止まるのを避けるためである。",
    "BLEのパラレル処理化は先方の想定であって確定した対策ではないため、本ノードの検証条件には織り込まない。"
  ]
}
```