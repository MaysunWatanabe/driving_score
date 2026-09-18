<!-- 作成: 2026-09-10 17:38:35 JST -->

```json
{
  "required_changes": [
    {"node": "qa.mockdata.sensorlog.aggregation", "entrypoint": "spec/qa/mockdata-sensorlog-aggregation.md", "description": "10msセンサログ→BLE notifyフレーム集約（10レコード=1フレーム、平均/先頭値、floor(x+0.5)量子化、端数区間、--raw）の受入条件・失敗条件・検証テストケースを定義"}
  ],
  "suggested_impacts": [
    {"domain": "middleware", "severity": "must", "reason": "集約器の平均/先頭値の適用フィールド分担と平均→量子化→12バイト符号化の順序、端数区間フラッシュ契機を実装側で明示する必要がある"},
    {"domain": "infra", "severity": "should", "reason": "--raw 等の集約無効フラグの提供方法と、集約検証用の入力ログ／出力フレームdumpのアーティファクト保存が必要"},
    {"domain": "db", "severity": "could", "reason": "集約後フレームを永続化する場合、レコード数とフレーム数（ceil(N/10)）の対応をデータ意味論として揃える必要がある"},
    {"domain": "app", "severity": "could", "reason": "デモ再生（UC12）でのフレーム供給レート変更が表示更新周期に影響する可能性がある"}
  ],
  "requirements_context": "# spec/qa/mockdata-sensorlog-aggregation.md\n\n## 目的\n10ms 周期で採取されたセンサログを BLE notify フレームへ集約する規則が、仕様どおりに成立していることを検証する。対象ユースケースは UC06（運転診断の実行）と UC12（編集とデモ再生）。\n\n## 対象\n- センサログ（入力レコード列）→ 集約 → 12バイト notify フレーム列 の変換\n- 既定（集約あり）モードと --raw（集約なし）モード\n- 平均後の量子化（qa.mockdata.sensorlog.schema）および 12バイト符号化との接続\n\n## 対象外（変更しないこと＝回帰確認の対象）\n- 12バイト符号化仕様\n- ble.ts\n- スコアロジック（scoreLogicFunction.txt / score-logic.ts 等）\n\n## 用語\n- 区間: 集約対象となる連続レコード群（既定 10 レコード）\n- 端数区間: レコード総数が 10 で割り切れないときに末尾に残る 1〜9 レコードの区間\n- 先頭値: 区間内で時刻が最も早いレコードの値\n\n---\n\n## 集約規則（合格基準の定義）\n\n### レート\n- 既定は 10 レコード集約で 1 フレームを送出する（出力レコード相当は入力の 1/10：秒間 40 相当 → 秒間 4 相当）。\n- 単純間引き（デシメーション）は採用しない。区間内のピークが出力に寄与すること。\n- --raw 等の集約無効指定では 1 レコード = 1 notify とする。\n\n### フィールド別集約方式\n\n| フィールド | 集約方式 |\n| --- | --- |\n| vehicleSpeed | 区間平均 |\n| longAcc | 区間平均 |\n| latAcc | 区間平均 |\n| frontDistance | 区間平均 |\n| lateralDistance | 区間平均 |\n| steeringAngle | 区間平均 |\n| brakeSwitch | 区間先頭値 |\n| shiftIndication | 区間先頭値 |\n| turnSignal | 区間先頭値 |\n| accelPedalPosition | 区間先頭値 |\n| brakePressure | 区間先頭値 |\n\n### 適用順序\n1. 区間平均（または先頭値抽出）\n2. qa.mockdata.sensorlog.schema の量子化を floor(x + 0.5) で適用\n3. 12バイト符号化\n\n### 端数区間\n- 切り捨てず、残り全レコードで平均する（除数は実レコード数）。\n- 送出フレーム数は ceil(N / 10)（N = 入力レコード総数）。\n\n---\n\n## 失敗条件（ゲート）\n以下のいずれかが観測された場合 FAIL とする。\n- 出力フレーム数が ceil(N/10) と一致しない\n- 端数区間が破棄される、または端数区間の除数が 10 固定になっている\n- 平均対象フィールドが先頭値／末尾値になっている（逆も同様）\n- 量子化が平均より先に適用されている（適用順序違反）\n- 量子化が floor(x + 0.5) 以外の丸め（切り捨て・銀行丸め等）で行われている\n- notify ペイロード長が 12 バイト以外、またはフィールド順が集約有無で変化する\n- 単純間引きにより区間内ピークが出力に一切寄与しない\n- 12バイト符号化仕様 / ble.ts / スコアロジックのコードに差分がある\n- pageerror / console.error（allowlist 期限付きを除く）\n- 集約処理中の未捕捉例外、NaN / undefined を含むフレーム送出\n\n---\n\n## テストケース\n\n### レイヤ1: 存在確認（実装未完でも成立させる層）\n- TC-AGG-001: 既定モードで N=100 レコードのログを入力すると 10 フレームが送出される\n- TC-AGG-002: 送出された各フレームのペイロード長が 12 バイトである\n- TC-AGG-010: 集約あり／--raw のどちらでもフレーム長とフィールド順が同一である\n\n### レイヤ2: 相互作用確認\n- TC-AGG-009: --raw 指定時は 1 レコード = 1 notify となり、集約が行われない\n- TC-AGG-011: N=1005 の入力に対し送出フレーム数が 101（= ceil(1005/10)）である\n- TC-LOG-001: センサログの生成は診断中のみであり、診断外では集約入力が発生しない\n\n### レイヤ3: 業務ルール確認\n- TC-AGG-003: 既知値列（例: vehicleSpeed = 0..9）を入力すると、当該区間の出力が算術平均 4.5 に対する量子化結果と一致する\n- TC-AGG-004: 区間内で brakeSwitch が 0→1 に変化しても、出力は先頭値 0 である（shiftIndication / turnSignal / accelPedalPosition / brakePressure も同様）\n- TC-AGG-005: 平均値が非整数となる入力で、出力が floor(平均 + 0.5) を符号化した値と一致する（平均→量子化の順序確認）\n- TC-AGG-006: 負値の境界（例: longAcc の平均が -1.5）で floor(-1.5 + 0.5) = -1 となる\n- TC-AGG-007: N=105 のとき最終フレームが末尾 5 レコードのみの平均（除数 5）である\n- TC-AGG-008: 区間内 1 レコードのみにピーク（例: longAcc の急減速）を持つ入力で、出力が先頭値と一致せずピークの寄与を含む\n- TC-AGG-012: steeringAngle は区間平均であり、区間先頭値／最大値と一致しない入力で平均値が得られる\n\n### 回帰\n- TC-REG-001: 12バイト符号化仕様、ble.ts、スコアロジック関連アセットに差分がないこと（ファイル差分ゼロ）\n- TC-REG-002: --raw モードでのフレーム列が集約導入前の出力と完全一致する（バイト列比較）\n\n---\n\n## 縮退モード検証（degraded-mode）\n- BLE 実機／ペリフェラルが未接続でも、集約ユニット（ログ列 → フレーム列）の単体検証は成立させる。フレーム列は dump で比較する。\n- 認証やスコア算出が未完でも、集約層の TC-AGG-001〜012 は独立に実行可能とする。\n- 認証が必要な導線は auth-real と auth-bypass の 2 系統を用意し、認証失敗が集約検証をブロックしないこと。auth-bypass は dev/test のみ有効、production では無効。\n\n## テストデータ / seed\n- ランプ列（0..9 反復）: 平均値の期待値が決定的になる\n- 単発ピーク列: デシメーション不採用の検出用\n- 離散値遷移列（brakeSwitch / shiftIndication / turnSignal の区間内変化）: 先頭値採用の検出用\n- 端数長ログ: N = 105、N = 1005、N = 9（端数のみ）、N = 0\n- 負値境界ログ: longAcc / latAcc / steeringAngle の平均が ±x.5 となる列\n\n## Artifact（失敗時に必須収集）\n- run_id\n- 入力センサログ（CSV / 生ログ）\n- 出力フレーム dump（hex, 12バイト単位）\n- 集約レポート（区間ごとの入力レコード数・平均値・量子化後値）\n- console log\n- network log（notify 経路を含む場合）\n- screenshot / trace（UI 経由検証時）\n\n## セレクタ方針\nUI 経由の検証では data-testid 等の安定した test id を用い、CSS クラスや DOM 階層に依存しない。\n\n## レポート形式\nqa_report.json\n\nfields\n- run_id\n- status\n- fail_reason\n- evidence_paths\n- reproduction_steps\n\n## 例外ルール\n3rd party 起因のエラーは期限付き allowlist とする。\n\n## 未確定事項\n本仕様の受入判定に影響する未確定点は open_questions を参照（フレーム送出間隔 100ms と秒間4フレームの整合、端数区間のフラッシュ契機、欠損値の平均扱い、時刻ジッタ許容など）。\n",
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
      "title": "フレーム長は集約有無に依らず12バイトである",
      "statement": "集約あり・--raw のいずれの場合も notify ペイロードは12バイトであり、フィールド順も同一である",
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
    }
  ],
  "open_questions": [
    "フレーム送出間隔が『100msに1フレーム』なのか『秒間4フレーム（=250ms間隔）』なのかが未確定。入力が10ms周期(100レコード/秒)なら10レコード集約は100ms間隔だが、承認済みファクトは『秒間40→4』であり25ms周期を前提とする。どちらを正とするかは middleware（センサログ採取周期の実装実態）の判断が必要で、決まらないとレート系テスト（TC-AGG-001/011）の期待値とタイミング許容が定まらない。",
    "端数区間（1〜9レコード）のフラッシュ契機が未確定。ログ終端／診断終了／タイムアウトのいずれで送出するかは middleware の実装判断が必要で、決まらないと最終フレームの有無を判定するテストが安定しない。",
    "入力レコードに欠損値・センサ未通知のセンチネル値（例: 不定値）が含まれる場合の平均の扱い（除外して平均するか、そのまま数値として平均するか）が未確定。middleware と sensorlog.schema の判断が必要で、決まらないと異常系テストの合格条件が定義できない。",
    "平均は単純算術平均か、レコード間隔が不均一な場合の時間重み付き平均かが未確定。middleware の判断が必要で、決まらないと期待値算出式が一意にならない。",
    "notify 送出間隔のジッタ許容値（±何ms／何%まで合格とするか）が未確定。infra/middleware の性能前提が必要で、決まらないとレート検証がフレーキーになる。",
    "集約無効指定の指定手段（--raw CLI フラグ／設定値／ビルド種別）とその有効環境（dev/test 限定か本番でも可か）が未確定。infra の判断が必要で、決まらないと TC-AGG-009/REG-002 の実行手順を確定できない。",
    "steeringAngle の平均に符号反転や角度ラップアラウンド（±180度跨ぎ）の考慮が必要かが未確定。middleware/schema の値域定義が必要で、決まらないと境界テストの期待値が決まらない。",
    "集約によって入力粒度が 1/10 になることでスコア算出結果が変化しうるが、スコア値の回帰許容範囲（完全一致を要求しない／差分許容幅）が未確定。middleware（スコアロジック）の判断が必要で、決まらないと UC06 のエンドツーエンド合否を判定できない。"
  ],
  "rationale_notes": [
    "本ノードの QA 責務は『どう集約するか』ではなく『集約結果が何を満たしていれば合格か』を固定することにある。実装方式（バッファ構造・タイマ）には踏み込まない。",
    "平均対象と先頭値対象を分けた設計意図は、連続量はピーク取りこぼしを避けるため平均、離散/イベント性の値は平均で無意味な中間値が生じるため先頭値、という判断に基づく。QA は『先頭値であること』を確定条件として検証する。",
    "brakeSwitch などの先頭値採用により、区間内で立ち上がった短パルスは出力に現れない。これは承認済みの設計判断であり、QA としては欠陥ではなく期待挙動として扱う（TC-AGG-004）。ただしイベント取りこぼしのリスクは残るため、運用上の注意点として記録する。",
    "量子化順序（平均→量子化）はテストで区別可能にする必要があるため、レコード単位量子化後平均とは結果が異なる入力（非整数平均になるランプ列）を必ずテストデータに含める。",
    "回帰確認（12バイト符号化仕様 / ble.ts / スコアロジック無変更）はコード差分ゼロで判定する。集約導入により入力粒度が変わるためスコア出力値の一致は保証されず、コード無変更とスコア値不変を混同しない。",
    "縮退モード検証を明記した理由は、BLE 実機やスコア算出が未完でも集約規則そのものは入力ログ→フレーム dump の比較で検証可能であり、実装進行を止めないためである。"
  ]
}
```