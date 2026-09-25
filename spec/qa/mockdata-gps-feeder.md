<!-- 作成: 2026-09-10 17:38:58 JST | 更新: 2026-09-18 19:03:52 JST -->

# spec/qa/mockdata-gps-feeder.md

## 1. 概要

対象ノード: `qa.mockdata.gps.feeder`
entrypoint: `spec/qa/mockdata-gps-feeder.md`
ユースケース: UC06 運転診断の実行 / UC11 センサーモード切替
対象ツール: `src/data/tools/mock-gps-feeder.py`

本仕様は承認済み design_decision（node=`qa.mockdata.gps.feeder`）を真とする。本文と承認済みファクトが矛盾する場合はファクトを優先する。

### 目的

テスト用モック位置を実機へ追加投入し、アプリの `lastGeolocation` が埋まり GPS ゲートが開くことを検証する。方式は **B案（gps テストプロバイダへの追加投入）** とする。fused の登録・上書きやアプリ改変によるゲート回避は本ノードの合格手段にしない。

### 対象

- モックレコードから用いる値: `geolocation.latitude` / `geolocation.longitude` / `geolocation.accuracy` のみ
- テストプロバイダ: `gps` のみ
- 実機確認: `lastGeolocation` の充填と GPS ゲート開放

### 非対象（本決定の範囲外）

- `fused` の add-test-provider / set-test-provider-location / remove-test-provider
- `ble-can-emulator.py` の変更
- `sensor.service` の GPS ゲート実装・スコア・正準9ファイルの変更
- `altitude` / `heading` / `speed` 等を投入値として扱うこと
- GMS FLP が mock を配信しない場合の代替（fused 追加・アプリ改変）。開かない場合は STOP し新規 propose する。

---

## 2. 固定する投入契約

1点投入は次に限る。

- `adb shell cmd location providers set-test-provider-location gps --location {latitude},{longitude}`
- `accuracy` があるときだけ `--accuracy {accuracy}` を付ける
- `--altitude` / `--bearing` / `--heading` / `--speed` / `--time` および未知オプションは付けない

add-test-provider / set-test-provider-location / remove-test-provider の対象は `gps` のみとする。`fused` を登録・上書きしない。

モックレコードに `altitude` / `heading` / `speed` があっても無視する。読むキーは `geolocation.latitude` / `longitude` / `accuracy` のみ。

### ライフサイクル

| 位置 | 実行内容 |
|---|---|
| 投入ループ前 | `adb shell appops set com.android.shell android:mock_location allow` |
| 終了時（1番目） | `adb shell cmd location providers remove-test-provider gps` |
| 終了時（2番目） | `adb shell appops set com.android.shell android:mock_location default` |

終了時処理は正常終了・異常終了を問わず実行し、順序は上表のとおり（remove → appops default）とする。

周期・点数は既存 #74 のまま（100レコードごと = 1Hz、60点）。

---

## 3. レイヤ化した合格条件

実装が不完全でも、下位レイヤが成立していればその範囲は合格とし、上位レイヤだけを未実施/範囲外にする（degraded-mode）。

### 3.1 existence（存在）

| ID | 期待値 |
|---|---|
| TC-GPS-001 | フィーダは gps テストプロバイダへ位置を投入する経路を持つ |
| TC-GPS-002 | 登録・投入・削除の対象プロバイダ名は `gps` である（`fused` ではない） |

### 3.2 interaction（操作）

| ID | 期待値 |
|---|---|
| TC-GPS-003 | 1点投入の位置指定は latitude と longitude である |
| TC-GPS-004 | accuracy があるレコードでは `--accuracy` が付与され、無いレコードでは付かない |
| TC-GPS-005 | 投入ループ前に `com.android.shell` の `android:mock_location` が allow である |
| TC-GPS-006 | 終了時（成功・失敗問わず）に gps テストプロバイダが remove され、**その後に** `android:mock_location` が default に戻る（順序が逆でない） |
| TC-GPS-007 | 投入は 60 点、100レコードごと = 1Hz である |
| TC-GPS-010 | 投入コマンドに altitude / bearing / heading / speed / time および未知オプションが含まれない |
| TC-GPS-011 | レコードに altitude / heading / speed があっても投入値に反映されない |
| TC-GPS-012 | latitude または longitude が欠落したレコードに到達した時点で非ゼロ終了し、stderr にレコード index と欠落キーを出す |
| TC-GPS-013 | 欠落レコードがあるときに 60 点を間引いて成功終了しない |
| TC-GPS-014 | 異常終了経路でも TC-GPS-006 のクリーンアップが実行される |

### 3.3 business rule（業務・ゲート）

| ID | 期待値 |
|---|---|
| TC-GPS-008 | 実機確認の合格は `lastGeolocation` が埋まり、かつ GPS ゲートが開くことである |
| TC-GPS-009 | `lastGeolocation` が埋まらずゲートが開かない場合、fused 追加もアプリ改変も行わず停止する |

---

## 4. 失敗とみなす条件

- latitude または longitude が欠落したレコードに到達しても継続し、60点を黙って間引いた
- 欠落時に非ゼロ終了しない、または stderr にレコード index と欠落キーを出さない
- `fused` を登録・上書き・削除対象にした
- 禁止オプション（altitude / bearing / heading / speed / time 等）を付けた
- 終了時に `remove-test-provider gps` を行わない、またはその後 `mock_location` を default に戻さない
- クリーンアップ順序が remove → appops default になっていない
- `ble-can-emulator.py` / `sensor.service` の GPS ゲート / スコア / 正準9ファイルを本対応で変更した
- ゲートが開かないことを理由に fused 追加またはアプリ改変で回避した

### 欠落レコードの受け入れ条件

latitude または longitude が欠落した時点で非ゼロ終了する。stderr に当該レコードの index と欠落キーを出す。60点を黙って間引いて成功終了してはならない。

---

## 5. 劣化モード（degraded-mode）

GMS FLP が mock を配信するかは `lastGeolocation` 充填と GPS ゲート開放でのみ確認する。開かないことはフィーダ契約（gps のみ・キー制約・クリーンアップ・欠落失敗）の失敗理由にしない。その場合は本決定の範囲外として再 propose し、TC-GPS-008 を未達・範囲外として記録する。

TC-GPS-001〜007 および 010〜014 は、TC-GPS-008 の成否と独立に単独で合否判定できる。

---

## 6. 変更禁止

本ノードの対応で次を変更してはならない。

- `ble-can-emulator.py`
- `sensor.service` の GPS ゲート
- スコア
- 正準9ファイル

---

## 7. 失敗時の証跡

必須:

- `run_id`
- stderr（index と欠落キーを含む）
- 投入コマンドログ（全 60 点分のオプション列を含む）
- 終了時の remove / appops 実行結果と実行順序
- アプリ側 `lastGeolocation` と GPS ゲート状態

UI を同時観測する場合は screenshot / trace / console log / network log を追加する。

### レポート形式

`qa_report.json`: `run_id` / `status` / `fail_reason` / `evidence_paths` / `reproduction_steps`

---

## 8. 認証

本ノードは位置モック投入の CLI 検証であり、auth-real / auth-bypass の対象外とする。認証失敗で本検証をブロックしない。

---

## 9. 2026 年度改修要求との関係（参考・非拘束）

2026 年度改修要求 5 本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE 安定化 ⑤録画データサイズ改善）のうち、本ノードが直接の検証対象とするものはない。ただし次の点に留意する。

- 本ノードは GPS 系のみを扱い、BLE 安定化（要求④）の検証は `qa.mockdata.ble.emulator` の責務である。CAN ペイロード長の変更検討は本ノードの投入契約に影響しない。
- 開発完了目標は 2026 年 11 月末（12 月から高齢者実験開始）であり、本ノードの検証は実機投入の前提条件として、その前に成立している必要がある。

---

```json
{
  "required_changes": [
    {"node": "qa.mockdata.gps.feeder", "entrypoint": "spec/qa/mockdata-gps-feeder.md", "description": "承認済み design_decision(1)〜(6) を仕様本文に確定反映し、ライフサイクルとテストケースを表形式で整理、2026年度改修要求との関係（非拘束）を追記する"}
  ],
  "suggested_impacts": [
    {"domain": "App-agent", "severity": "must", "reason": "実機合格判定は lastGeolocation 充填と GPS ゲート開放のみで行うため、その状態を外部から観測できる手段が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "sensor.service の GPS ゲートは変更禁止のまま、mock 由来 lastGeolocation でゲートが開く経路が既存実装と一致している必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "dev/test 実機で appops mock_location allow/default と gps テストプロバイダの add/set/remove が実行可能である必要がある"}
  ],
  "requirements_context": "# mock-gps-feeder（B案 GPS 追加投入）\n\n対象ノード: qa.mockdata.gps.feeder / entrypoint: spec/qa/mockdata-gps-feeder.md\nユースケース: UC06 運転診断の実行 / UC11 センサーモード切替\n対象ツール: src/data/tools/mock-gps-feeder.py\n\n本仕様は承認済み design_decision（node=qa.mockdata.gps.feeder）を真とする。本文と承認済みファクトが矛盾する場合はファクトを優先する。\n\n## 目的\nテスト用モック位置を実機へ追加投入し、アプリの lastGeolocation が埋まり GPS ゲートが開くことを検証する。方式は B案（gps テストプロバイダへの追加投入）とする。fused の登録・上書きやアプリ改変によるゲート回避は本ノードの合格手段にしない。\n\n## 対象\n- モックレコードから用いる値: geolocation.latitude / geolocation.longitude / geolocation.accuracy のみ\n- テストプロバイダ: gps のみ\n- 実機確認: lastGeolocation の充填と GPS ゲート開放\n\n## 非対象（本決定の範囲外）\n- fused の add-test-provider / set-test-provider-location / remove-test-provider\n- ble-can-emulator.py の変更\n- sensor.service の GPS ゲート実装・スコア・正準9ファイルの変更\n- altitude / heading / speed 等を投入値として扱うこと\n- GMS FLP が mock を配信しない場合の代替（fused 追加・アプリ改変）。開かない場合は STOP し新規 propose する。\n\n## 固定する投入契約\n1点投入は次に限る。\n- `adb shell cmd location providers set-test-provider-location gps --location {latitude},{longitude}`\n- accuracy があるときだけ `--accuracy {accuracy}` を付ける\n- `--altitude` / `--bearing` / `--heading` / `--speed` / `--time` および未知オプションは付けない\n\nadd-test-provider / set-test-provider-location / remove-test-provider の対象は gps のみとする。fused を登録・上書きしない。\n\nモックレコードに altitude / heading / speed があっても無視する。読むキーは geolocation.latitude / longitude / accuracy のみ。\n\n## ライフサイクル\n- 投入ループ前: `adb shell appops set com.android.shell android:mock_location allow`\n- 正常終了・異常終了を問わず終了時は先に `adb shell cmd location providers remove-test-provider gps`、続けて `adb shell appops set com.android.shell android:mock_location default`\n- 周期・点数は既存 #74 のまま（100レコードごと = 1Hz、60点）\n\n## レイヤ化した合格条件\n実装が不完全でも、下位レイヤが成立していればその範囲は合格とし、上位レイヤだけを未実施/範囲外にする（degraded-mode）。\n\n### existence（存在）\n- TC-GPS-001: フィーダは gps テストプロバイダへ位置を投入する経路を持つ\n- TC-GPS-002: 登録・投入・削除の対象プロバイダ名は gps である（fused ではない）\n\n### interaction（操作）\n- TC-GPS-003: 1点投入の位置指定は latitude と longitude である\n- TC-GPS-004: accuracy があるレコードでは accuracy が付与され、無いレコードでは accuracy を付けない\n- TC-GPS-005: 投入ループ前に com.android.shell の android:mock_location が allow である\n- TC-GPS-006: 終了時（成功・失敗問わず）に gps テストプロバイダが remove され、その後に android:mock_location が default に戻る（順序が逆でない）\n- TC-GPS-007: 投入は 60 点、100レコードごと = 1Hz である\n- TC-GPS-010: 投入コマンドに altitude / bearing / heading / speed / time および未知オプションが含まれない\n- TC-GPS-011: レコードに altitude / heading / speed があっても投入値に反映されない\n- TC-GPS-012: latitude または longitude が欠落したレコードに到達した時点で非ゼロ終了し、stderr にレコード index と欠落キーを出す\n- TC-GPS-013: 欠落レコードがあるときに 60 点を間引いて成功終了しない\n- TC-GPS-014: 異常終了経路でも TC-GPS-006 のクリーンアップが実行される\n\n### business rule（業務・ゲート）\n- TC-GPS-008: 実機確認の合格は lastGeolocation が埋まり、かつ GPS ゲートが開くことである\n- TC-GPS-009: lastGeolocation が埋まらずゲートが開かない場合、fused 追加もアプリ改変も行わず停止する\n\n## 失敗とみなす条件\n- latitude または longitude が欠落したレコードに到達しても継続し、60点を黙って間引いた\n- 欠落時に非ゼロ終了しない、または stderr にレコード index と欠落キーを出さない\n- fused を登録・上書き・削除対象にした\n- 禁止オプション（altitude / bearing / heading / speed / time 等）を付けた\n- 終了時に remove-test-provider gps を行わない、またはその後 mock_location を default に戻さない\n- クリーンアップ順序が remove → appops default になっていない\n- ble-can-emulator.py / sensor.service の GPS ゲート / スコア / 正準9ファイルを本対応で変更した\n- ゲートが開かないことを理由に fused 追加またはアプリ改変で回避した\n\n## 欠落レコードの受け入れ条件\nlatitude または longitude が欠落した時点で非ゼロ終了する。stderr に当該レコードの index と欠落キーを出す。60点を黙って間引いて成功終了してはならない。\n\n## 劣化モード\nGMS FLP が mock を配信するかは lastGeolocation 充填と GPS ゲート開放でのみ確認する。開かないことはフィーダ契約（gps のみ・キー制約・クリーンアップ・欠落失敗）の失敗理由にしない。その場合は本決定の範囲外として再 propose し、TC-GPS-008 を未達・範囲外として記録する。TC-GPS-001〜007 および 010〜014 は単独で合否判定できる。\n\n## 変更禁止\n本ノードの対応で次を変更してはならない。\n- ble-can-emulator.py\n- sensor.service の GPS ゲート\n- スコア\n- 正準9ファイル\n\n## 失敗時の証跡\n必須: run_id、stderr（index と欠落キーを含む）、投入コマンドログ（全 60 点分のオプション列を含む）、終了時の remove/appops 実行結果と実行順序、アプリ側 lastGeolocation と GPS ゲート状態。\nUI を同時観測する場合は screenshot / trace / console log / network log を追加する。\n\n## レポート形式\nqa_report.json: run_id / status / fail_reason / evidence_paths / reproduction_steps\n\n## 認証\n本ノードは位置モック投入の検証であり、auth-real / auth-bypass の対象外とする。認証失敗で本検証をブロックしない。\n\n## 2026 年度改修要求との関係（参考・非拘束）\n2026 年度改修要求 5 本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE 安定化 ⑤録画データサイズ改善）のうち本ノードが直接検証するものはない。BLE 安定化（要求④）および CAN ペイロード長変更の検証は qa.mockdata.ble.emulator の責務であり、本ノードの GPS 投入契約には影響しない。開発完了目標は 2026 年 11 月末（12 月から高齢者実験開始）であり、本ノードの検証はそれ以前に成立している必要がある。",
  "fact_candidates": [
    {
      "type": "qa_expectation",
      "title": "B案は gps への追加投入である",
      "statement": "位置モックは fused 置換ではなく gps テストプロバイダへの追加投入として成立する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "投入値は lat/lng/accuracy に限定される",
      "statement": "mock-gps-feeder が投入してよい値は latitude と longitude、および存在するときだけの accuracy である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "禁止の位置オプションを付けない",
      "statement": "投入コマンドに altitude / bearing / heading / speed / time および未知オプションを付けてはならない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "レコードから読むキーは geolocation の lat/lng/accuracy のみ",
      "statement": "モックレコードから採用するキーは geolocation.latitude / geolocation.longitude / geolocation.accuracy のみであり、altitude / heading / speed は存在しても無視する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "緯度経度欠落は即失敗する",
      "statement": "latitude または longitude が欠落したレコードに到達した時点で非ゼロ終了し、stderr にレコード index と欠落キーを出す",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "欠落点を黙って間引かない",
      "statement": "緯度経度欠落があっても 60 点を間引いて成功終了してはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "テストプロバイダは gps のみ",
      "statement": "add-test-provider / set-test-provider-location / remove-test-provider の対象は gps のみであり fused を登録・上書きしてはならない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "投入前は MOCK_LOCATION allow",
      "statement": "投入ループ開始前に com.android.shell の android:mock_location は allow でなければならない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "終了時は gps プロバイダ除去の後 MOCK_LOCATION default",
      "statement": "正常終了・異常終了を問わず、終了時は先に gps テストプロバイダを remove し、続けて com.android.shell の android:mock_location を default に戻す",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "投入周期と点数",
      "statement": "投入は 100 レコードごと = 1Hz で 60 点である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "関連成果物を変更しない",
      "statement": "本対応で ble-can-emulator.py、sensor.service の GPS ゲート、スコア、正準9ファイルを変更してはならない",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "実機合格は lastGeolocation 充填かつゲート開放",
      "statement": "実機確認の合格条件は lastGeolocation が埋まり、かつ GPS ゲートが開くことである",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ゲート未開放時は STOP",
      "statement": "lastGeolocation が埋まらず GPS ゲートが開かない場合、fused 追加やアプリ改変をせず停止し、本決定の範囲外として再提案する",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "クリーンアップは順序も検証対象である",
      "statement": "終了時処理は remove-test-provider gps を先に、android:mock_location を default に戻すのを後に実行した場合のみ合格とする",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "フィーダ契約はゲート結果と独立に判定できる",
      "statement": "gps 限定・キー制約・欠落即失敗・クリーンアップの各検証は、GPS ゲートが開かない場合でも単独で合否判定できる",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "本ノードは 2026 年度改修要求の直接の検証対象を持たない",
      "statement": "2026 年度改修要求 5 本のうち本ノードが直接検証する項目はなく、BLE 安定化および CAN ペイロード長変更の検証は qa.mockdata.ble.emulator の責務である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "本ノードの検証は 2026 年 11 月末までに成立している必要がある",
      "statement": "アプリ開発完了目標が 2026 年 11 月末（12 月から高齢者実験開始）であるため、実機投入の前提となる本ノードの検証はそれ以前に成立していなければならない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "GMS FLP が mock を配信するかは lastGeolocation 充填と GPS ゲート開放でのみ確認すると定められているが、開かない場合の代替合格経路は未確定である。App と QA の判断が必要で、決まらないと実機 E2E の最終合格手段が欠ける。",
    "実機 GPS 受信と gps テストプロバイダ追加投入が競合したときの判定（どちらが lastGeolocation に残ればよいか、屋内外条件）が未確定である。B案は追加投入可と承認されたが観測基準が無い。App / QA 判断が必要で、決まらないと競合時に誤合格・誤不合格になる。",
    "投入した latitude/longitude と lastGeolocation の一致許容（accuracy をどう見るか、何メートルまで一致とみなすか）が未記載である。App の位置正規化に依存し、決まらないと業務レイヤの期待値を数値で固定できない。",
    "add-test-provider gps の事前状態（既存テストプロバイダの有無、remove の冪等性、再実行時の挙動）は #74 参照のみで本ノード本文に無い。Infra / QA 確認が必要で、決まらないと再実行時の失敗条件が揺れる。",
    "異常終了経路（プロセス強制終了・adb 切断）でクリーンアップが実行できないケースを失敗とみなすか、次回実行時の事前 remove で救済するかが未確定である。Infra / QA 判断が必要で、決まらないと TC-GPS-014 の合否基準が定まらない。",
    "2026 年度改修要求でヒヤリ録画がヒヤリ前後 15 秒の個別動画になる場合、ヒヤリ地点の位置情報をモック GPS で再現する必要が生じるかが未確定である。App / QA 判断が必要で、決まらないと本ノードの 60 点・1Hz という投入契約が録画検証の要件を満たすか判断できない。"
  ],
  "rationale_notes": [
    "本ノードは CLI による位置モック投入の検証のため、UI runtime の pageerror/console.error ゲートや auth-real/auth-bypass は適用対象外とし、認証失敗で本検証をブロックしない。",
    "検証は existence（gps のみ存在する投入経路）→ interaction（allow / 投入 / 60点 / 禁止オプション / 欠落即失敗 / クリーンアップ）→ business（lastGeolocation とゲート）の順に層別し、上位が未達でも下位契約は単独で合格判定できるようにする。",
    "禁止オプションと欠落即失敗は失敗条件の記述だけでは実行証跡が残らないため、TC-GPS-010〜014 として独立テストケース化した。",
    "adb コマンド文字列と appops 手順は実装提案ではなく node=qa.mockdata.gps.feeder の approved design_decision として仕様に固定した。旧記述が facts と矛盾する場合は facts を優先する。",
    "失敗時は screenshot より run_id・stderr・投入コマンドログ・クリーンアップ実行順序・ゲート状態の方が再現に直結する。UI を同時観測する場合のみ screenshot/trace を追加する。",
    "ライフサイクルとテストケースを表形式に整理したのは、クリーンアップ順序（remove → appops default）が合否条件そのものであり、箇条書きより順序が視認しやすいためである。仕様内容は変更していない。",
    "2026 年度改修要求（節 9）は本ノードの拘束要件ではないが、要求④ BLE 安定化との責務境界（qa.mockdata.ble.emulator 側）と 11 月末の期限制約を明記し、本ノードの検証が後続作業のブロッカーにならないようにした。"
  ]
}
```