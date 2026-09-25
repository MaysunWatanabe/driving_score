<!-- 作成: 2026-09-10 17:38:36 JST | 更新: 2026-09-18 19:06:08 JST -->

# spec/qa/mockdata-sensorlog-aggregation.md

## 目的
10ms 周期相当で採取されたセンサログを BLE notify フレームへ集約する規則が、仕様どおりに成立していることを検証する。対象ユースケースは UC06（運転診断の実行）と UC12（編集とデモ再生）。

## 対象
- センサログ（入力レコード列）→ 集約 → 12バイト notify フレーム列 の変換
- 既定（集約あり）モードと --raw（集約なし）モード
- 平均後の量子化（qa.mockdata.sensorlog.schema）および 12バイト符号化との接続

## 対象外（変更しないこと＝回帰確認の対象）
- 12バイト符号化仕様
- ble.ts
- スコアロジック（scoreLogicFunction.txt / score-logic.ts 等）

## 前提と根拠
本ノードの集約規則は、以下の承認済み設計判断に基づく。

- 出力レコードを秒間 40 から秒間 4（10 回に 1 回）へ落とす。その他は B 案を採用する。
- steeringAngle は区間平均、accelPedalPosition / brakePressure は区間先頭値とする。
- 平均後に量子化を floor(x + 0.5) で適用し、その結果を 12 バイト符号化する。
- レコード数が 10 で割り切れない端数区間は切り捨てず、残り全レコードで平均する。

> 注意（前提の可変性）: 12 バイト固定長ペイロードは現行実装（PAYLOAD_LEN=12、offset 5-6 のみ u16 BE）に基づく前提である。標識認識・先行車検知の追加により CAN ペイロード長・バイト割り当てが変更されうることは未確定事項として残っている。変更された場合、本仕様の「12 バイト」を前提とする受入条件（TC-AGG-002 / TC-AGG-010 / 失敗条件のペイロード長）は改訂対象となる。

## 用語
- 区間: 集約対象となる連続レコード群（既定 10 レコード）
- 端数区間: レコード総数が 10 で割り切れないときに末尾に残る 1〜9 レコードの区間
- 先頭値: 区間内で時刻が最も早いレコードの値

---

## 集約規則（合格基準の定義）

### レート
- 既定は 10 レコード集約で 1 フレームを送出する（出力は入力の 1/10：秒間 40 相当 → 秒間 4 相当）。
- 単純間引き（デシメーション）は採用しない。区間内のピークが出力に寄与すること。
- --raw 等の集約無効指定では 1 レコード = 1 notify とする。

### フィールド別集約方式

| フィールド | 集約方式 |
| --- | --- |
| vehicleSpeed | 区間平均 |
| longAcc | 区間平均 |
| latAcc | 区間平均 |
| frontDistance | 区間平均 |
| lateralDistance | 区間平均 |
| steeringAngle | 区間平均 |
| brakeSwitch | 区間先頭値 |
| shiftIndication | 区間先頭値 |
| turnSignal | 区間先頭値 |
| accelPedalPosition | 区間先頭値 |
| brakePressure | 区間先頭値 |

### 適用順序
1. 区間平均（または先頭値抽出）
2. qa.mockdata.sensorlog.schema の量子化を floor(x + 0.5) で適用
3. 12バイト符号化

### 端数区間
- 切り捨てず、残り全レコードで平均する（除数は実レコード数）。
- 送出フレーム数は ceil(N / 10)（N = 入力レコード総数）。

---

## 失敗条件（ゲート）
以下のいずれかが観測された場合 FAIL とする。

- 出力フレーム数が ceil(N/10) と一致しない
- 端数区間が破棄される、または端数区間の除数が 10 固定になっている
- 平均対象フィールドが先頭値／末尾値になっている（逆も同様）
- 量子化が平均より先に適用されている（適用順序違反）
- 量子化が floor(x + 0.5) 以外の丸め（切り捨て・銀行丸め等）で行われている
- notify ペイロード長が規定長（現行 12 バイト）以外、またはフィールド順が集約有無で変化する
- 単純間引きにより区間内ピークが出力に一切寄与しない
- 12バイト符号化仕様 / ble.ts / スコアロジックのコードに差分がある
- pageerror / console.error（allowlist 期限付きを除く）
- 集約処理中の未捕捉例外、NaN / undefined を含むフレーム送出

---

## テストケース

### レイヤ1: 存在確認（実装未完でも成立させる層）
- TC-AGG-001: 既定モードで N=100 レコードのログを入力すると 10 フレームが送出される
- TC-AGG-002: 送出された各フレームのペイロード長が規定長（現行 12 バイト）である
- TC-AGG-010: 集約あり／--raw のどちらでもフレーム長とフィールド順が同一である

### レイヤ2: 相互作用確認
- TC-AGG-009: --raw 指定時は 1 レコード = 1 notify となり、集約が行われない
- TC-AGG-011: N=1005 の入力に対し送出フレーム数が 101（= ceil(1005/10)）である
- TC-AGG-013: 出力フレームレートが入力レコードレートの 1/10（秒間 40 相当入力に対し秒間 4 相当出力）である
- TC-LOG-001: センサログの生成は診断中のみであり、診断外では集約入力が発生しない

### レイヤ3: 業務ルール確認
- TC-AGG-003: 既知値列（例: vehicleSpeed = 0..9）を入力すると、当該区間の出力が算術平均 4.5 に対する量子化結果と一致する
- TC-AGG-004: 区間内で brakeSwitch が 0→1 に変化しても、出力は先頭値 0 である（shiftIndication / turnSignal / accelPedalPosition / brakePressure も同様）
- TC-AGG-005: 平均値が非整数となる入力で、出力が floor(平均 + 0.5) を符号化した値と一致する（平均→量子化の順序確認）
- TC-AGG-006: 負値の境界（例: longAcc の平均が -1.5）で floor(-1.5 + 0.5) = -1 となる
- TC-AGG-007: N=105 のとき最終フレームが末尾 5 レコードのみの平均（除数 5）である
- TC-AGG-008: 区間内 1 レコードのみにピーク（例: longAcc の急減速）を持つ入力で、出力が先頭値と一致せずピークの寄与を含む
- TC-AGG-012: steeringAngle は区間平均であり、区間先頭値／最大値と一致しない入力で平均値が得られる
- TC-AGG-014: accelPedalPosition / brakePressure は区間内で値が増減しても出力が先頭値と一致する

### 回帰
- TC-REG-001: 12バイト符号化仕様、ble.ts、スコアロジック関連アセットに差分がないこと（ファイル差分ゼロ）
- TC-REG-002: --raw モードでのフレーム列が集約導入前の出力と完全一致する（バイト列比較）

---

## 縮退モード検証（degraded-mode）
- BLE 実機／ペリフェラルが未接続でも、集約ユニット（ログ列 → フレーム列）の単体検証は成立させる。フレーム列は dump で比較する。
- 認証やスコア算出が未完でも、集約層の TC-AGG-001〜014 は独立に実行可能とする。
- 認証が必要な導線は auth-real と auth-bypass の 2 系統を用意し、認証失敗が集約検証をブロックしないこと。auth-bypass は dev/test のみ有効、production では無効。
- BLE 受信安定化（パラレル処理化）は未確定の仮説であり、本ノードの合否条件には含めない。集約によるフレーム数削減が受信安定性に寄与するかは実機確認領域として扱う。

## テストデータ / seed
- ランプ列（0..9 反復）: 平均値の期待値が決定的になる
- 単発ピーク列: デシメーション不採用の検出用
- 離散値遷移列（brakeSwitch / shiftIndication / turnSignal の区間内変化）: 先頭値採用の検出用
- ペダル／踏力遷移列（accelPedalPosition / brakePressure の区間内単調増加）: 先頭値採用の検出用
- 端数長ログ: N = 105、N = 1005、N = 9（端数のみ）、N = 0
- 負値境界ログ: longAcc / latAcc / steeringAngle の平均が ±x.5 となる列

## Artifact（失敗時に必須収集）
- run_id
- 入力センサログ（CSV / 生ログ）
- 出力フレーム dump（hex, 規定長単位）
- 集約レポート（区間ごとの入力レコード数・平均値・量子化後値）
- console log
- network log（notify 経路を含む場合）
- screenshot / trace（UI 経由検証時）

## セレクタ方針
UI 経由の検証では data-testid 等の安定した test id を用い、CSS クラスや DOM 階層に依存しない。

## レポート形式
qa_report.json

fields
- run_id
- status
- fail_reason
- evidence_paths
- reproduction_steps

## 例外ルール
3rd party 起因のエラーは期限付き allowlist とする。

## 未確定事項
本仕様の受入判定に影響する未確定点は open_questions を参照（CAN ペイロード長・割り当ての変更可能性、フレーム送出間隔と入力周期の整合、端数区間のフラッシュ契機、欠損値の平均扱い、時刻ジッタ許容、集約によるスコア値変動の許容範囲など）。

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.aggregation", "entrypoint": "spec/qa/mockdata-sensorlog-aggregation.md", "description": "承認済み設計判断（秒間40→4・B案、steeringAngle平均/accelPedalPosition・brakePressure先頭値、平均→floor(x+0.5)量子化→12バイト符号化、端数区間は残り全部で平均）を前提として明記し、レート検証TC-AGG-013・踏力系先頭値検証TC-AGG-014を追加、ペイロード長を『規定長（現行12バイト）』として可変前提に改訂"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "入力レコード周期（10ms=100rec/s か 25ms=40rec/s）と10レコード集約後の送出間隔の整合を実装側で確定しないとレート系受入条件の期待値が定まらない"},
    {"domain": "middleware", "severity": "must", "reason": "端数区間のフラッシュ契機（ログ終端／診断終了／タイムアウト）と欠損値・センチネル値の平均扱いを確定する必要がある"},
    {"domain": "middleware", "severity": "should", "reason": "標識認識・先行車検知の追加でCANペイロード長・割り当てが変わる場合、集約後フレームの符号化とQAの規定長前提を同時に改訂する必要がある"},
    {"domain": "infra", "severity": "should", "reason": "--raw 等の集約無効フラグの提供手段と有効環境、入力ログ／出力フレームdump・集約レポートのアーティファクト保存が必要"},
    {"domain": "db", "severity": "could", "reason": "集約後フレームを永続化する場合、入力レコード数Nと保存フレーム数ceil(N/10)の対応をデータ意味論として揃える必要がある"},
    {"domain": "app", "severity": "could", "reason": "デモ再生（UC12）でのフレーム供給レートが秒間4相当に変わるため表示更新周期に影響する可能性がある"}
  ],
  "requirements_context": "# spec/qa/mockdata-sensorlog-aggregation.md\n\n## 目的\n10ms 周期相当で採取されたセンサログを BLE notify フレームへ集約する規則が、仕様どおりに成立していることを検証する。対象ユースケースは UC06（運転診断の実行）と UC12（編集とデモ再生）。\n\n## 対象\n- センサログ（入力レコード列）→ 集約 → 12バイト notify フレーム列 の変換\n- 既定（集約あり）モードと --raw（集約なし）モード\n- 平均後の量子化（qa.mockdata.sensorlog.schema）および 12バイト符号化との接続\n\n## 対象外（変更しないこと＝回帰確認の対象）\n- 12バイト符号化仕様\n- ble.ts\n- スコアロジック（scoreLogicFunction.txt / score-logic.ts 等）\n\n## 前提と根拠（承認済み設計判断）\n- 出力レコードを秒間 40 から秒間 4（10 回に 1 回）へ落とす。その他は B 案を採用する。\n- steeringAngle は区間平均、accelPedalPosition / brakePressure は区間先頭値とする。\n- 平均後に量子化を floor(x + 0.5) で適用し、その結果を 12 バイト符号化する。\n- レコード数が 10 で割り切れない端数区間は切り捨てず、残り全レコードで平均する。\n- 12 バイト固定長は現行実装（PAYLOAD_LEN=12、offset 5-6 のみ u16 BE）前提。標識認識・先行車検知追加によるペイロード長変更は未確定であり、変更時は規定長前提の受入条件を改訂する。\n\n## 用語\n- 区間: 集約対象となる連続レコード群（既定 10 レコード）\n- 端数区間: レコード総数が 10 で割り切れないときに末尾に残る 1〜9 レコードの区間\n- 先頭値: 区間内で時刻が最も早いレコードの値\n\n## 集約規則（合格基準の定義）\n### レート\n- 既定は 10 レコード集約で 1 フレームを送出する（出力は入力の 1/10：秒間 40 相当 → 秒間 4 相当）。\n- 単純間引き（デシメーション）は採用しない。区間内のピークが出力に寄与すること。\n- --raw 等の集約無効指定では 1 レコード = 1 notify とする。\n\n### フィールド別集約方式\n| フィールド | 集約方式 |\n| --- | --- |\n| vehicleSpeed | 区間平均 |\n| longAcc | 区間平均 |\n| latAcc | 区間平均 |\n| frontDistance | 区間平均 |\n| lateralDistance | 区間平均 |\n| steeringAngle | 区間平均 |\n| brakeSwitch | 区間先頭値 |\n| shiftIndication | 区間先頭値 |\n| turnSignal | 区間先頭値 |\n| accelPedalPosition | 区間先頭値 |\n| brakePressure | 区間先頭値 |\n\n### 適用順序\n1. 区間平均（または先頭値抽出）\n2. 量子化 floor(x + 0.5)\n3. 12バイト符号化\n\n### 端数区間\n- 切り捨てず、残り全レコードで平均する（除数は実レコード数）。\n- 送出フレーム数は ceil(N / 10)。\n\n## 失敗条件（ゲート）\n- 出力フレーム数が ceil(N/10) と一致しない\n- 端数区間が破棄される、または端数区間の除数が 10 固定\n- 平均対象フィールドが先頭値／末尾値になっている（逆も同様）\n- 量子化が平均より先に適用されている\n- 量子化が floor(x + 0.5) 以外の丸め\n- notify ペイロード長が規定長（現行 12 バイト）以外、またはフィールド順が集約有無で変化する\n- 単純間引きにより区間内ピークが出力に一切寄与しない\n- 12バイト符号化仕様 / ble.ts / スコアロジックのコードに差分がある\n- pageerror / console.error（期限付き allowlist を除く）\n- 未捕捉例外、NaN / undefined を含むフレーム送出\n\n## テストケース\n### レイヤ1: 存在確認\n- TC-AGG-001: N=100 で 10 フレーム送出\n- TC-AGG-002: 各フレームのペイロード長が規定長（現行 12 バイト）\n- TC-AGG-010: 集約あり／--raw でフレーム長とフィールド順が同一\n\n### レイヤ2: 相互作用確認\n- TC-AGG-009: --raw で 1 レコード = 1 notify\n- TC-AGG-011: N=1005 で 101 フレーム\n- TC-AGG-013: 出力フレームレートが入力レコードレートの 1/10（秒間 40 相当→秒間 4 相当）\n- TC-LOG-001: センサログ生成は診断中のみ、診断外では集約入力が発生しない\n\n### レイヤ3: 業務ルール確認\n- TC-AGG-003: vehicleSpeed = 0..9 で平均 4.5 の量子化結果と一致\n- TC-AGG-004: 区間内 brakeSwitch 0→1 でも出力は先頭値 0（shiftIndication / turnSignal / accelPedalPosition / brakePressure 同様）\n- TC-AGG-005: 非整数平均で floor(平均 + 0.5) の符号化値と一致（順序確認）\n- TC-AGG-006: 平均 -1.5 で floor(-1.5 + 0.5) = -1\n- TC-AGG-007: N=105 で最終フレームは末尾 5 レコードの平均（除数 5）\n- TC-AGG-008: 単発ピーク入力で出力が先頭値と一致せずピークの寄与を含む\n- TC-AGG-012: steeringAngle が区間平均である（先頭値／最大値と不一致な入力で確認）\n- TC-AGG-014: accelPedalPosition / brakePressure は区間内増減に関わらず先頭値と一致\n\n### 回帰\n- TC-REG-001: 12バイト符号化仕様 / ble.ts / スコアロジックの差分ゼロ\n- TC-REG-002: --raw のフレーム列が集約導入前と完全一致（バイト列比較）\n\n## 縮退モード検証\n- BLE 未接続でも入力ログ列 → 出力フレーム dump の比較で集約検証は成立する。\n- 認証・スコア算出未完でも TC-AGG-001〜014 は独立実行可能。\n- auth-real / auth-bypass の 2 系統を用意し、認証失敗が集約検証をブロックしない。auth-bypass は dev/test のみ有効、production では無効。\n- BLE のパラレル処理化は未確定の仮説であり、本ノードの合否条件には含めない。\n\n## テストデータ / seed\n- ランプ列（0..9 反復）\n- 単発ピーク列\n- 離散値遷移列（brakeSwitch / shiftIndication / turnSignal）\n- ペダル／踏力遷移列（accelPedalPosition / brakePressure 単調増加）\n- 端数長ログ: N = 105 / 1005 / 9 / 0\n- 負値境界ログ（平均が ±x.5）\n\n## Artifact（失敗時に必須収集）\n- run_id / 入力センサログ / 出力フレーム dump（hex, 規定長単位） / 区間別集約レポート / console log / network log / screenshot・trace（UI 経由時）\n\n## セレクタ方針\nUI 経由検証では data-testid 等の安定した test id を用い、CSS クラス・DOM 階層に依存しない。\n\n## レポート形式\nqa_report.json（run_id, status, fail_reason, evidence_paths, reproduction_steps）\n\n## 例外ルール\n3rd party 起因のエラーは期限付き allowlist とする。\n\n## 未確定事項\nCAN ペイロード長・割り当ての変更可能性、入力周期と送出間隔の整合、端数区間のフラッシュ契機、欠損値の平均扱い、ジッタ許容、集約によるスコア値変動の許容範囲。\n",
  "fact_candidates": [
    {
      "type": "qa_expectation",
      "title": "既定モードでは10レコードにつき1フレームが送出される",
      "statement": "既定の集約モードでは、入力センサログ10レコードに対して1つの notify フレームが送出される",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "出力フレーム数は ceil(N/10) に一致する",
      "statement": "入力レコード総数を N とすると、送出フレーム数は ceil(N/10) と一致する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "出力レートは入力レコードレートの1/10になる",
      "statement": "集約後の送出レートは入力レコードレートの1/10（秒間40レコード相当に対し秒間4フレーム相当）となる",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "単純間引きによる実装は不合格とする",
      "statement": "区間内の単一レコードにのみピークを持つ入力で、出力値が区間先頭値と一致しピークの寄与を含まない場合は不合格とする",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "連続量6フィールドは区間平均になる",
      "statement": "vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance / steeringAngle の出力値は区間内レコードの算術平均に基づく",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "離散・踏力5フィールドは区間先頭値になる",
      "statement": "brakeSwitch / shiftIndication / turnSignal / accelPedalPosition / brakePressure の出力値は区間内で最も早い時刻のレコードの値と一致する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "区間内で離散値が変化しても出力は先頭値である",
      "statement": "区間内で brakeSwitch / shiftIndication / turnSignal が変化した場合でも、出力フレームの値は区間先頭値のままである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "区間内でペダル・踏力が変化しても出力は先頭値である",
      "statement": "区間内で accelPedalPosition / brakePressure が増減した場合でも、出力フレームの値は区間先頭値と一致する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "量子化は平均後に適用される",
      "statement": "量子化は区間平均を算出した後に適用され、レコード単位の量子化値を平均した結果とは区別される",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "量子化は floor(x+0.5) で行われる",
      "statement": "平均値の量子化は floor(x + 0.5) と一致し、他の丸め方式（切り捨て・偶数丸め等）は不合格とする",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "負値の半端値は floor(x+0.5) の結果に従う",
      "statement": "平均が -1.5 の場合の量子化結果は floor(-1.5 + 0.5) = -1 である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "端数区間は破棄されず残りレコード数で平均される",
      "statement": "レコード総数が10で割り切れない場合、末尾の端数区間は破棄されず、残りレコード数を除数として平均された1フレームが送出される",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "--raw では 1レコード=1notify となる",
      "statement": "--raw 等の集約無効指定時は、1レコードにつき1つの notify フレームが送出され集約は行われない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "フレーム長は集約有無に依らず規定長で一定である",
      "statement": "集約あり・--raw のいずれの場合も notify ペイロード長は規定長（現行12バイト）であり、フィールド順も同一である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "12バイト符号化仕様・ble.ts・スコアロジックのコードは無変更である",
      "statement": "集約導入の前後で、12バイト符号化仕様・ble.ts・スコアロジック関連アセットにコード差分が存在しない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "--raw 出力は集約導入前と完全一致する",
      "statement": "--raw モードで生成されるフレームのバイト列は、集約導入前の出力と完全一致する",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "NaN/undefined を含むフレーム送出は不合格",
      "statement": "集約結果に NaN / undefined を含むフレームが送出された場合、または集約処理で未捕捉例外が発生した場合は不合格とする",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "集約入力は診断中のログのみである",
      "statement": "センサログは診断中のみ生成されるため、診断外では集約対象の入力レコードが発生しない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "集約層はBLE未接続でも単体検証可能である",
      "statement": "BLE ペリフェラル未接続の縮退状態でも、入力ログ列から出力フレーム dump を得る形で集約規則の検証が成立する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "認証失敗は集約検証をブロックしない",
      "statement": "認証が失敗しても auth-bypass 経路により集約検証テストは実行可能であり、auth-bypass は dev/test のみ有効で production では無効である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "失敗時は再現可能な証跡が収集される",
      "statement": "集約検証の失敗時には run_id・入力センサログ・出力フレーム dump・区間別集約レポート・console log が収集される",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "BLE のパラレル処理化は集約検証の合否条件に含めない",
      "statement": "BLE 受信安定化のためのパラレル処理化は未確定の仮説であるため、集約規則の合否判定条件には含めない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "CAN ペイロードの長さ・バイト割り当てが標識認識・先行車検知の追加で変更されるかが未確定。現行は12バイト固定長（PAYLOAD_LEN=12、offset 5-6 のみ u16 BE）だが、変更されると本ノードの『規定長12バイト』前提の受入条件（TC-AGG-002 / 010、失敗条件のペイロード長）と集約後符号化の期待値がすべて改訂対象になる。middleware/CAN仕様側の判断が必要。",
    "フレーム送出間隔が『100msに1フレーム』なのか『秒間4フレーム（=250ms間隔）』なのかが未確定。入力が10ms周期(100レコード/秒)なら10レコード集約は100ms間隔だが、承認済み判断は『秒間40→4』であり25ms周期を前提とする。middleware（センサログ採取周期の実装実態）の判断が必要で、決まらないとレート系テスト（TC-AGG-001/011/013）の期待値とタイミング許容が定まらない。",
    "端数区間（1〜9レコード）のフラッシュ契機が未確定。ログ終端／診断終了／タイムアウトのいずれで送出するかは middleware の実装判断が必要で、決まらないと最終フレームの有無を判定するテストが安定しない。",
    "入力レコードに欠損値・センサ未通知のセンチネル値が含まれる場合の平均の扱い（除外して平均するか、そのまま数値として平均するか）が未確定。middleware と sensorlog.schema の判断が必要で、決まらないと異常系テストの合格条件が定義できない。",
    "平均は単純算術平均か、レコード間隔が不均一な場合の時間重み付き平均かが未確定。middleware の判断が必要で、決まらないと期待値算出式が一意にならない。",
    "notify 送出間隔のジッタ許容値（±何ms／何%まで合格とするか）が未確定。infra/middleware の性能前提が必要で、決まらないとレート検証がフレーキーになる。",
    "集約無効指定の指定手段（--raw CLI フラグ／設定値／ビルド種別）とその有効環境（dev/test 限定か本番でも可か）が未確定。infra の判断が必要で、決まらないと TC-AGG-009 / TC-REG-002 の実行手順を確定できない。",
    "steeringAngle の平均に符号反転や角度ラップアラウンド（±180度跨ぎ）の考慮が必要かが未確定。middleware/schema の値域定義が必要で、決まらないと境界テストの期待値が決まらない。",
    "集約によって入力粒度が 1/10 になることでスコア算出結果が変化しうるが、スコア値の回帰許容範囲（完全一致を要求しない／差分許容幅）が未確定。スコアロジック自体は打ち合わせ後まで凍結中であり、middleware（スコアロジック）の判断が必要で、決まらないと UC06 のエンドツーエンド合否を判定できない。"
  ],
  "rationale_notes": [
    "本ノードの QA 責務は『どう集約するか』ではなく『集約結果が何を満たしていれば合格か』を固定することにある。実装方式（バッファ構造・タイマ）には踏み込まない。",
    "集約規則は承認済み設計判断（秒間40→4、その他B案、steeringAngle平均、accelPedalPosition/brakePressure先頭値、平均→floor(x+0.5)量子化→12バイト符号化、端数区間は残り全部で平均）に完全に従う。QA 仕様側で規則を再解釈しない。",
    "平均対象と先頭値対象を分けた設計意図は、連続量はピーク取りこぼしを避けるため平均、離散/イベント性および踏力系の値は平均で無意味な中間値が生じるため先頭値、という判断に基づく。QA は『先頭値であること』を確定条件として検証する（TC-AGG-004 / 014）。",
    "brakeSwitch などの先頭値採用により、区間内で立ち上がった短パルスは出力に現れない。これは承認済みの設計判断であり、QA としては欠陥ではなく期待挙動として扱う。ただしイベント取りこぼしのリスクは残るため運用上の注意点として記録する。",
    "量子化順序（平均→量子化）はテストで区別可能にする必要があるため、レコード単位量子化後平均とは結果が異なる入力（非整数平均になるランプ列）を必ずテストデータに含める。",
    "ペイロード長は現行12バイトだが、CAN仕様変更の未確定事項があるため本文では『規定長（現行12バイト）』と表記し、長さ変更時に改訂すべき箇所を局所化した。",
    "回帰確認（12バイト符号化仕様 / ble.ts / スコアロジック無変更）はコード差分ゼロで判定する。集約導入により入力粒度が変わるためスコア出力値の一致は保証されず、コード無変更とスコア値不変を混同しない。",
    "BLE 受信の不安定さに対するパラレル処理化は先方指摘に基づく仮説であり確定した対策ではないため、集約検証のゲート条件には入れず実機確認領域として切り離した。",
    "縮退モード検証を明記した理由は、BLE 実機やスコア算出が未完でも集約規則そのものは入力ログ→フレーム dump の比較で検証可能であり、実装進行を止めないためである。"
  ]
}
```