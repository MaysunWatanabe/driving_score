<!-- 作成: 2026-09-18 19:03:52 JST | 更新: 2026-09-29 15:11:46 JST -->

# spec/qa/mockdata-gps-feeder.md

## 1. 概要

対象ノード: `qa.mockdata.gps.feeder`
entrypoint: `spec/qa/mockdata-gps-feeder.md`
ユースケース: UC06 運転診断の実行 / UC11 センサーモード切替
対象ツール: `src/data/tools/mock-gps-feeder.py`

本仕様は、承認済みの business_rule / design_decision（node=`qa.mockdata.gps.feeder`）を真とします。本文と承認済みファクトが矛盾する場合は、ファクトを優先します。

### 目的

テスト用のモック位置を実機へ追加投入し、アプリの `lastGeolocation` が埋まって GPS ゲートが開くことを検証します。方式は **B案（gps テストプロバイダへの追加投入）** です。fused の登録・上書きや、アプリ改変によるゲート回避は、本ノードの合格手段にしません。

### 対象

- モックレコードから用いる値: `geolocation.latitude` / `geolocation.longitude` / `geolocation.accuracy` のみ
- テストプロバイダ: `gps` のみ
- 投入対象のセンサログ: 正準9ファイル、および hiyari_recording
  - 点数は対象ファイルのレコード数（duration）から導出する（§2.2）
- 実機確認: `lastGeolocation` の充填と GPS ゲートの開放

### 非対象（本決定の範囲外）

- `fused` に対する add-test-provider / set-test-provider-location / remove-test-provider
- `ble-can-emulator.py` の変更
- `sensor.service` の GPS ゲート実装、スコア、正準9ファイルの変更
- `altitude` / `heading` / `speed` などを投入値として扱うこと
- GMS FLP が mock を配信しない場合の代替手段（fused の追加、アプリ改変）
  - ゲートが開かない場合は STOP し、新規に propose する

---

## 2. 固定する投入契約

### 2.1 1点投入

1点投入は次の形に限ります。

- `adb shell cmd location providers set-test-provider-location gps --location {latitude},{longitude}`
- `accuracy` があるときだけ `--accuracy {accuracy}` を付ける
- `--altitude` / `--bearing` / `--heading` / `--speed` / `--time` と、未知のオプションは付けない

add-test-provider / set-test-provider-location / remove-test-provider の対象は `gps` のみです。`fused` は登録も上書きもしません。

モックレコードに `altitude` / `heading` / `speed` があっても無視します。読むキーは `geolocation.latitude` / `longitude` / `accuracy` のみです。

### 2.2 投入周期と点数（判定式からの導出）

投入点数は、**「センサログ 100 レコードごとに 1 点（1Hz）」** という判定式から導きます。点数は固定値ではなく、対象ファイルの duration（レコード数）によって決まります。

| 対象ファイル | レコード数 | 期待投入点数 | 周期 |
|---|---|---|---|
| 正準9ファイル | 6000 | 60 点 | 1Hz |
| hiyari_recording | 9000 | 90 点 | 1Hz |

- 本書に出てくる「60 点」（TC-GPS-007 / TC-GPS-013 など）は、正準9ファイルの場合の例示です。
- これらは「対象ファイルの duration に応じた点数」と読み替えます。
- hiyari_recording を対象にする場合、期待点数は 90 点です。

### 2.3 ライフサイクル

| 位置 | 実行内容 |
|---|---|
| 投入ループ前 | `adb shell appops set com.android.shell android:mock_location allow` |
| 終了時（1番目） | `adb shell cmd location providers remove-test-provider gps` |
| 終了時（2番目） | `adb shell appops set com.android.shell android:mock_location default` |

終了時処理は、正常終了・異常終了を問わず実行します。順序は上表のとおり、remove → appops default です。

---

## 3. レイヤ化した合格条件

実装が不完全でも、下位レイヤが成立していれば、その範囲は合格とします。上位レイヤだけを未実施または範囲外として扱います（degraded-mode）。

### 3.1 existence（存在）

| ID | 期待値 |
|---|---|
| TC-GPS-001 | フィーダが、gps テストプロバイダへ位置を投入する経路を持つ |
| TC-GPS-002 | 登録・投入・削除の対象プロバイダ名が `gps` である（`fused` ではない） |

### 3.2 interaction（操作）

| ID | 期待値 |
|---|---|
| TC-GPS-003 | 1点投入の位置指定が latitude と longitude である |
| TC-GPS-004 | accuracy があるレコードでは `--accuracy` が付き、無いレコードでは付かない |
| TC-GPS-005 | 投入ループ前に、`com.android.shell` の `android:mock_location` が allow になっている |
| TC-GPS-006 | 終了時（成功・失敗を問わず）に gps テストプロバイダが remove され、**その後に** `android:mock_location` が default に戻る（順序が逆でない） |
| TC-GPS-007 | 投入点数が「100 レコードごとに 1 点（1Hz）」の判定式から導かれた、対象ファイルの duration に応じた点数と一致する（正準9ファイル＝60 点、hiyari_recording＝90 点） |
| TC-GPS-010 | 投入コマンドに altitude / bearing / heading / speed / time と未知のオプションが含まれない |
| TC-GPS-011 | レコードに altitude / heading / speed があっても、投入値に反映されない |
| TC-GPS-012 | latitude または longitude が欠落したレコードに到達した時点で非ゼロ終了し、stderr にレコード index と欠落キーを出す |
| TC-GPS-013 | 欠落レコードがあるときに、判定式から導かれる点数（正準9ファイルでは 60 点、hiyari_recording では 90 点）を間引いて成功終了しない |
| TC-GPS-014 | 異常終了の経路でも、TC-GPS-006 のクリーンアップが実行される |

### 3.3 business rule（業務・ゲート）

| ID | 期待値 |
|---|---|
| TC-GPS-008 | 実機確認の合格条件は、`lastGeolocation` が埋まり、かつ GPS ゲートが開くことである |
| TC-GPS-009 | `lastGeolocation` が埋まらずゲートが開かない場合、fused の追加もアプリ改変も行わずに停止（STOP）し、新規に propose する |

---

## 4. 失敗とみなす条件

- latitude または longitude が欠落したレコードに到達しても処理を継続し、判定式から導かれる点数を黙って間引いた
- 欠落時に非ゼロ終了しない、または stderr にレコード index と欠落キーを出さない
- 投入点数が、対象ファイルの duration から判定式で導かれる点数と一致しない
  - 例: hiyari_recording に対して 60 点で打ち切った
- `fused` を登録・上書き・削除の対象にした
- 禁止オプション（altitude / bearing / heading / speed / time など）を付けた
- 終了時に `remove-test-provider gps` を行わない、またはその後 `mock_location` を default に戻さない
- クリーンアップ順序が remove → appops default になっていない
- `ble-can-emulator.py` / `sensor.service` の GPS ゲート / スコア / 正準9ファイルを本対応で変更した
- ゲートが開かないことを理由に、fused の追加またはアプリ改変で回避した

### 欠落レコードの受け入れ条件

- latitude または longitude が欠落した時点で非ゼロ終了する。
- stderr に、当該レコードの index と欠落キーを出す。
- 判定式から導かれる点数を黙って間引き、成功終了してはならない。

---

## 5. 劣化モード（degraded-mode）

GMS FLP が mock を配信するかどうかは、`lastGeolocation` の充填と GPS ゲートの開放だけで確認します。

- ゲートが開かないことは、フィーダ契約の失敗理由にしません。対象となるフィーダ契約は次のとおりです。
  - gps のみ
  - キー制約
  - 判定式どおりの点数
  - クリーンアップ
  - 欠落時の失敗
- ゲートが開かない場合は本決定の範囲外として STOP し、再 propose します。TC-GPS-008 は未達・範囲外として記録します。

TC-GPS-001〜007 と TC-GPS-010〜014 は、TC-GPS-008 の成否とは独立に、単独で合否を判定できます。

---

## 6. 変更禁止

本ノードの対応で、次のものを変更してはなりません。

- `ble-can-emulator.py`
- `sensor.service` の GPS ゲート
- スコア
- 正準9ファイル

---

## 7. 失敗時の証跡

必須の証跡は次のとおりです。

- `run_id`
- 対象ファイル名と、そのレコード数
- 判定式から導いた期待点数
- stderr（index と欠落キーを含む）
- 投入コマンドログ（全投入点分のオプション列を含む。正準9ファイルは 60 点分、hiyari_recording は 90 点分）
- 実投入点数
- 終了時の remove / appops の実行結果と実行順序
- アプリ側の `lastGeolocation` と GPS ゲートの状態

UI を同時に観測する場合は、screenshot / trace / console log / network log を追加します。

### レポート形式

`qa_report.json` のフィールドは次のとおりです。

- `run_id`
- `status`
- `fail_reason`
- `evidence_paths`
- `reproduction_steps`

---

## 8. 認証

本ノードは位置モック投入の CLI 検証であり、auth-real / auth-bypass の対象外とします。認証の失敗で本検証をブロックしません。

---

## 9. 2026 年度改修要求との関係（参考・非拘束）

2026 年度の改修要求は次の 5 本です。

1. 前回結果表示
2. タブ切り替え
3. レーダーチャート
4. BLE 安定化
5. 録画データサイズ改善

このうち、本ノードが直接の検証対象とするものはありません。ただし、次の点に留意します。

- **要求④との責務境界**
  - 本ノードは GPS 系のみを扱う。BLE 安定化（要求④）の検証は `qa.mockdata.ble.emulator` の責務である。
  - CAN ペイロード長の変更検討は、本ノードの投入契約に影響しない。
- **要求⑤との関係**
  - hiyari_recording（9000 レコード）も本フィーダの投入対象になり、その場合の期待点数は 90 点である。
  - ヒヤリ録画に関わる検証で位置を再現する際も、投入契約（gps のみ、キー制約、1Hz 判定式、クリーンアップ、欠落時の失敗）は変わらない。
- **期限**
  - 開発完了目標は 2026 年 11 月末（12 月から高齢者実験を開始）である。
  - 本ノードの検証は実機投入の前提条件であり、それ以前に成立している必要がある。

---

```json
{
  "required_changes": [
    {"node": "qa.mockdata.gps.feeder", "entrypoint": "spec/qa/mockdata-gps-feeder.md", "description": "投入点数を固定60点から『100レコードごと1点(1Hz)』の判定式による導出に改め、正準9ファイル(6000)=60点・hiyari_recording(9000)=90点の対応表を追加し、TC-GPS-007/013・失敗条件・証跡を duration 依存の点数として読み替える"}
  ],
  "suggested_impacts": [
    {"domain": "App-agent", "severity": "must", "reason": "実機合格判定は lastGeolocation 充填と GPS ゲート開放のみで行うため、その状態を外部から観測できる手段が必要"},
    {"domain": "Middleware-agent", "severity": "must", "reason": "sensor.service の GPS ゲートは変更禁止のまま、mock 由来 lastGeolocation でゲートが開く経路が既存実装と一致している必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "dev/test 実機で appops mock_location allow/default と gps テストプロバイダの add/set/remove が実行可能であり、hiyari_recording 投入時は 90 秒分の投入時間を見込む必要がある"},
    {"domain": "Data-agent", "severity": "should", "reason": "判定式の前提となる各センサログのレコード数（正準9ファイル6000・hiyari_recording 9000）とサンプリング対象レコードの定義を提供データ側で保証する必要がある"}
  ],
  "requirements_context": "# mock-gps-feeder（B案 GPS 追加投入）\n\n対象ノード: qa.mockdata.gps.feeder / entrypoint: spec/qa/mockdata-gps-feeder.md\nユースケース: UC06 運転診断の実行 / UC11 センサーモード切替\n対象ツール: src/data/tools/mock-gps-feeder.py\n\n本仕様は承認済み business_rule / design_decision（node=qa.mockdata.gps.feeder）を真とする。本文と承認済みファクトが矛盾する場合はファクトを優先する。\n\n## 目的\nテスト用モック位置を実機へ追加投入し、アプリの lastGeolocation が埋まり GPS ゲートが開くことを検証する。方式は B案（gps テストプロバイダへの追加投入）とする。fused の登録・上書きやアプリ改変によるゲート回避は本ノードの合格手段にしない。\n\n## 対象\n- モックレコードから用いる値: geolocation.latitude / geolocation.longitude / geolocation.accuracy のみ\n- テストプロバイダ: gps のみ\n- 投入対象センサログ: 正準9ファイル、hiyari_recording（点数は対象ファイルのレコード数＝duration から導出）\n- 実機確認: lastGeolocation の充填と GPS ゲート開放\n\n## 非対象\n- fused の add-test-provider / set-test-provider-location / remove-test-provider\n- ble-can-emulator.py の変更\n- sensor.service の GPS ゲート実装・スコア・正準9ファイルの変更\n- altitude / heading / speed 等を投入値として扱うこと\n- GMS FLP が mock を配信しない場合の代替（fused 追加・アプリ改変）。開かない場合は STOP し新規 propose する。\n\n## 投入契約\n1点投入は `adb shell cmd location providers set-test-provider-location gps --location {latitude},{longitude}` に限る。accuracy があるときだけ `--accuracy {accuracy}` を付ける。--altitude / --bearing / --heading / --speed / --time および未知オプションは付けない。add/set/remove-test-provider の対象は gps のみ、fused は登録・上書きしない。モックレコードの altitude / heading / speed は存在しても無視し、読むキーは geolocation.latitude / longitude / accuracy のみ。\n\n## 投入周期と点数\n投入点数は『センサログ 100 レコードごとに 1 点（1Hz）』の判定式から導く。正準9ファイル（6000 レコード）では 60 点、hiyari_recording（9000 レコード）では 90 点。TC-GPS-007 / TC-GPS-013 の『60 点』は対象ファイルの duration に応じた点数として読む。\n\n## ライフサイクル\n- 投入ループ前: `adb shell appops set com.android.shell android:mock_location allow`\n- 終了時（正常・異常問わず）: 先に `adb shell cmd location providers remove-test-provider gps`、続けて `adb shell appops set com.android.shell android:mock_location default`\n\n## レイヤ化した合格条件（degraded-mode: 下位が成立すれば上位のみ未実施/範囲外）\n### existence\n- TC-GPS-001: フィーダは gps テストプロバイダへ位置を投入する経路を持つ\n- TC-GPS-002: 登録・投入・削除の対象プロバイダ名は gps（fused ではない）\n### interaction\n- TC-GPS-003: 1点投入の位置指定は latitude と longitude\n- TC-GPS-004: accuracy があるレコードでは --accuracy 付与、無いレコードでは付けない\n- TC-GPS-005: 投入ループ前に com.android.shell の android:mock_location が allow\n- TC-GPS-006: 終了時（成功・失敗問わず）に gps テストプロバイダ remove、その後 android:mock_location default（順序が逆でない）\n- TC-GPS-007: 投入点数は 100 レコードごと 1 点（1Hz）の判定式から導かれる duration 依存の点数と一致する（正準9ファイル=60点、hiyari_recording=90点）\n- TC-GPS-010: 投入コマンドに altitude / bearing / heading / speed / time および未知オプションが含まれない\n- TC-GPS-011: レコードの altitude / heading / speed は投入値に反映されない\n- TC-GPS-012: latitude または longitude 欠落レコードに到達した時点で非ゼロ終了し、stderr にレコード index と欠落キーを出す\n- TC-GPS-013: 欠落レコードがあるときに判定式から導かれる点数（正準9ファイル60点／hiyari_recording 90点）を間引いて成功終了しない\n- TC-GPS-014: 異常終了経路でも TC-GPS-006 のクリーンアップが実行される\n### business rule\n- TC-GPS-008: 実機合格は lastGeolocation が埋まり、かつ GPS ゲートが開くこと\n- TC-GPS-009: 開かない場合は fused 追加もアプリ改変もせず STOP し、新規 propose する\n\n## 失敗とみなす条件\n- 欠落レコードに到達しても継続し、判定式から導かれる点数を黙って間引いた\n- 欠落時に非ゼロ終了しない、または stderr に index と欠落キーを出さない\n- 投入点数が対象ファイルの duration から導かれる点数と一致しない（例: hiyari_recording で 60 点打ち切り）\n- fused を登録・上書き・削除対象にした\n- 禁止オプションを付けた\n- 終了時に remove-test-provider gps を行わない、またはその後 mock_location を default に戻さない\n- クリーンアップ順序が remove → appops default でない\n- ble-can-emulator.py / sensor.service の GPS ゲート / スコア / 正準9ファイルを本対応で変更した\n- ゲートが開かないことを理由に fused 追加またはアプリ改変で回避した\n\n## 劣化モード\nGMS FLP が mock を配信するかは lastGeolocation 充填と GPS ゲート開放でのみ確認する。開かないことはフィーダ契約（gps のみ・キー制約・判定式どおりの点数・クリーンアップ・欠落失敗）の失敗理由にしない。開かない場合は範囲外として STOP・再 propose し、TC-GPS-008 を未達・範囲外として記録する。TC-GPS-001〜007 および 010〜014 は TC-GPS-008 と独立に合否判定できる。\n\n## 変更禁止\nble-can-emulator.py、sensor.service の GPS ゲート、スコア、正準9ファイル。\n\n## 失敗時の証跡\n必須: run_id、対象ファイル名とレコード数、判定式から導いた期待点数、stderr（index と欠落キー）、投入コマンドログ（全投入点分のオプション列）、実投入点数、終了時の remove/appops 実行結果と実行順序、アプリ側 lastGeolocation と GPS ゲート状態。UI 同時観測時は screenshot / trace / console log / network log を追加。\n\n## レポート形式\nqa_report.json: run_id / status / fail_reason / evidence_paths / reproduction_steps\n\n## 認証\nCLI 検証のため auth-real / auth-bypass の対象外。認証失敗で本検証をブロックしない。\n\n## 2026 年度改修要求との関係（参考・非拘束）\n5 本の要求（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE 安定化 ⑤録画データサイズ改善）のうち本ノードが直接検証するものはない。BLE 安定化および CAN ペイロード長変更の検証は qa.mockdata.ble.emulator の責務で、本ノードの投入契約に影響しない。hiyari_recording（9000 レコード）も投入対象となり得て、その場合 90 点。ヒヤリ録画関連の検証で位置を再現する場合も投入契約は不変。開発完了目標は 2026 年 11 月末（12 月から高齢者実験開始）で、本ノードの検証はそれ以前に成立している必要がある。",
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
      "type": "business_rule",
      "title": "投入点数は 100 レコードごと 1 点の判定式から導出する",
      "statement": "mock-gps-feeder の投入点数はセンサログ 100 レコードごとに 1 点（1Hz）の判定式から導かれ、固定値ではない",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "正準9ファイルの期待投入点数は 60 点",
      "statement": "正準9ファイル（6000 レコード）を対象とした場合、投入点数は 60 点である",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "hiyari_recording の期待投入点数は 90 点",
      "statement": "hiyari_recording（9000 レコード）を対象とした場合、投入点数は 90 点である",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "TC-GPS-007/013 の 60 点は duration 依存の点数として読む",
      "statement": "TC-GPS-007 および TC-GPS-013 の期待点数は対象ファイルの duration に応じて判定式から導かれる点数であり、60 点は正準9ファイルの場合の値である",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "欠落点を黙って間引かない",
      "statement": "緯度経度欠落があっても判定式から導かれる点数を間引いて成功終了してはならない",
      "status": "candidate"
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
      "title": "ゲート未開放時は STOP して新規 propose",
      "statement": "lastGeolocation が埋まらず GPS ゲートが開かない場合、fused 追加やアプリ改変をせず停止し、新規に propose する",
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
      "title": "点数不一致は失敗である",
      "statement": "実投入点数が対象ファイルの duration から判定式で導かれる点数と一致しない場合は失敗とする",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "フィーダ契約はゲート結果と独立に判定できる",
      "statement": "gps 限定・キー制約・判定式どおりの点数・欠落即失敗・クリーンアップの各検証は、GPS ゲートが開かない場合でも単独で合否判定できる",
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
    "レコード数が 100 の倍数でないセンサログに対する点数の丸め（切り捨て・切り上げ）が未確定である。判定式は正準9ファイル(6000)と hiyari_recording(9000) でしか例示されていないため。Data / QA 判断が必要で、決まらないと将来の任意長ファイルで TC-GPS-007 の期待点数が一意に定まらない。",
    "100 レコードごとのどのレコード（先頭 index 0,100,... か末尾か）を投入点として採用するかが本文に無い。approved fact は点数の導出のみを定めているため。Data / QA 確認が必要で、決まらないと投入座標の期待値と欠落検出対象レコードが揺れる。",
    "欠落即失敗の『到達』が、サンプリングで採用するレコードのみを指すのか、読み込む全レコードを指すのかが未確定である。採用されないレコードの欠落で失敗させるかどうかで挙動が変わるため。QA / Data 判断が必要で、決まらないと TC-GPS-012 の合否が実装解釈に依存する。",
    "GMS FLP が mock を配信しない場合の代替合格経路は未確定である（現状は STOP・新規 propose のみ）。App と QA の判断が必要で、決まらないと実機 E2E の最終合格手段が欠ける。",
    "実機の GPS 受信と gps テストプロバイダへの追加投入が競合したときの判定（lastGeolocation にどちらが残ればよいか、屋内外の条件）が未確定である。B案は追加投入として承認されたが観測基準が無いため。App / QA 判断が必要で、決まらないと競合時に誤合格・誤不合格になる。",
    "投入した latitude/longitude と lastGeolocation の一致許容（accuracy の扱い、何メートルまで一致とみなすか）が未記載である。App 側の位置正規化に依存するため。決まらないと業務レイヤの期待値を数値で固定できない。",
    "add-test-provider gps の事前状態（既存テストプロバイダの有無、remove の冪等性、再実行時の挙動）が本ノード本文で定義されていない。Infra / QA 確認が必要で、決まらないと再実行時の失敗条件が揺れる。",
    "プロセスの強制終了や adb 切断など、クリーンアップを実行できない異常終了ケースの扱いが未確定である。失敗とみなすか、次回実行時の事前 remove で救済するかが決まっていない。Infra / QA 判断が必要で、決まらないと TC-GPS-014 の合否基準が定まらない。",
    "hiyari_recording を投入対象とする場合、投入座標とヒヤリ発生地点・録画区間（録画時計 tVideo 基準）との整合をどこまで検証するかが未確定である。90 点の点数は確定したが、位置とヒヤリ区間の対応は本ノードの approved fact に無いため。App / QA 判断が必要で、決まらないとヒヤリ録画関連 E2E での位置の期待値が定まらない。"
  ],
  "rationale_notes": [
    "今回の主な改訂は、固定 60 点の記述を『100 レコードごと 1 点（1Hz）』の判定式による導出へ置き換えたことである。approved business_rule が正準9ファイル=60点、hiyari_recording=90点と明示し、TC-GPS-007/013 の 60 点を duration 依存と読むよう定めたため、facts を真として本文・TC・失敗条件・証跡を揃えた。",
    "TC 番号は既存のまま維持し、新規 TC は追加しなかった。fact が『TC-GPS-007 / TC-GPS-013 の 60 点を読み替える』と既存 ID を前提に書かれているため、ID を増やさず期待値の表現を duration 依存に改めた。",
    "証跡に『対象ファイル名とレコード数』『期待点数』『実投入点数』を追加したのは、点数が可変になったためである。期待値と実測を証跡で突き合わせられないと、点数不一致の再現ができない。",
    "本ノードは CLI による位置モック投入の検証であるため、UI runtime の pageerror / console.error ゲートや auth-real / auth-bypass は適用対象外とし、認証失敗で本検証をブロックしない。",
    "検証は existence → interaction → business の順に層別した。上位レイヤ（ゲート開放）が GMS FLP 依存で未達でも、下位のフィーダ契約は単独で合格判定できるようにしている。",
    "adb コマンド文字列と appops 手順は実装提案ではなく、node=qa.mockdata.gps.feeder の承認済み決定として仕様に固定している。",
    "節 9 の 2026 年度改修要求は拘束要件ではない。hiyari_recording が投入対象に加わったことで要求⑤周辺との接点が生じたため、投入契約は不変であることを明記し、位置とヒヤリ区間の整合は open_question に分離した。"
  ]
}
```