<!-- 作成: 2026-09-29 15:10:06 JST -->

# MediaRecorder 計測プローブ（qa.mediarecorder.probe）

- entrypoint: `spec/qa/mediarecorder-probe.md`
- 担当: QA-agent
- 関連要求: 2026 年度改修要求 ⑤「ヒヤリ発生時の録画データサイズ改善」
- 関連 proposal: #239（standalone-probe）

---

## 1. 目的

ヒヤリ区間録画（`hiyari.NN.webm`）の設計は、MediaRecorder が出力するチャンクの実挙動を前提にしています。前提となる主な設計判断は次のとおりです。

- 録画時計 tVideo によるチャンク選択
- Cluster Timecode の t0 基準への振り直し
- 末尾 32B の繰り越し
- Duration をファイルに書かず、再生側のシークで実長を確定する方式

本プローブは、この前提を**実機（SH-M29 / Android 15）で計測して裏付ける**ための単体計測ツールと、その合否基準を定めます。

本プローブは**アプリ本体を変更しません**。計測はアプリの外で完結させます。

---

## 2. 配置と計測経路

| 項目 | 内容 |
|---|---|
| 配置 | `src/tools/mediarecorder-probe/` に単体の HTML + JS を置く |
| 実行ブラウザ | 端末（SH-M29）の Chrome |
| 接続経路 | `adb reverse` 経由でホストの配信ページを端末 Chrome から開く |
| アプリ本体 | 変更しない（計測コード・フラグ・ビルド設定のいずれも追加しない） |

---

## 3. 計測制約（アプリと同一であること）

プローブは、アプリの録画と**同一の制約**で MediaRecorder を動かします。制約が 1 つでも異なる計測結果は、アプリの代理データとして扱いません。

| 制約 | 値 |
|---|---|
| 解像度 | 1280x720 |
| 音声 | `audio: true` |
| コンテナ / MIME | `video/webm` |
| ビットレート | 指定しない（`videoBitsPerSecond` / `audioBitsPerSecond` / `bitsPerSecond` を渡さない） |
| timeslice | `start(1000)` |

- アプリ側の録画制約が変わった場合は、プローブも同じ値に追従させます。
- 制約が乖離した状態での計測結果は無効とします。
- 要求値と実際に適用された値（`getSettings()` 相当の実効値）の両方を記録します。実効値が要求値と異なる場合は、結果に `constraint_mismatch` を付けます。

---

## 4. 計測環境と代理妥当性

| 対象 | バージョン |
|---|---|
| 端末 | SH-M29 / Android 15 |
| Android System WebView（Capacitor が使用） | 153.0.8010.36 |
| Chrome | 153.0.8010.52 |

- 両者は同一ビルド系列（153.0.8010）で、パッチ番号だけが異なります。このため、端末 Chrome での standalone-probe は Capacitor WebView の**代理として妥当**とします。
- ただし同一プロセスではありません。**アプリ内 WebView での確認は別途必要**です。プローブの結果だけで、アプリ内挙動を確定扱いにしてはなりません。
- 計測のたびに、実行時の UA 文字列と Chrome バージョンをレポートに記録します。WebView / Chrome のどちらかが更新されてビルド系列がずれた場合は、代理妥当性を再評価します。

---

## 5. 計測観点

計測観点は「存在 → 操作 → 業務前提」の 3 層に分けます。下位層が失敗しても、上位層の観点のうち実行できるものは実行し、結果を残します（degraded-mode）。

### 5.1 存在チェック（Existence）

| ID | 合格条件 |
|---|---|
| TC-PROBE-001 | `adb reverse` 経由で端末 Chrome からプローブページが表示され、ルート要素（`data-testid="probe-root"`）が一定時間内に描画される |
| TC-PROBE-002 | 実行環境情報（UA、Chrome バージョン、画面情報）がページ上とレポートに出力される |
| TC-PROBE-003 | `MediaRecorder.isTypeSupported('video/webm')` の結果が記録される |

### 5.2 操作チェック（Interaction）

| ID | 合格条件 |
|---|---|
| TC-PROBE-010 | 第 3 章の制約で `getUserMedia` が成功し、映像トラック 1 本・音声トラック 1 本が取得できる |
| TC-PROBE-011 | 映像トラックの実効解像度が記録され、1280x720 と一致する（不一致なら `constraint_mismatch`） |
| TC-PROBE-012 | ビットレート未指定・`start(1000)` で録画を開始でき、`dataavailable` が発生する |
| TC-PROBE-013 | 停止操作で録画が停止し、最終チャンクが `dataavailable` として受け取れる |
| TC-PROBE-014 | 録画中・停止時に pageerror と console.error が 0 件である |

### 5.3 業務前提チェック（録画設計の前提検証）

ここでは「どうなるべきか」ではなく「**実測値が何であったか**」を記録することが主目的です。記録そのものが欠落した場合を FAIL とします。設計前提と矛盾する実測値が出た場合は、`design_assumption_violation` として報告し、設計側（App-agent）へ差し戻します。

| ID | 記録対象 / 合格条件 |
|---|---|
| TC-PROBE-020 | 各チャンクの受信時刻（`Date.now()`）、録画開始からの経過時間、バイトサイズが全チャンク分記録される |
| TC-PROBE-021 | チャンク受信間隔の分布（最小 / 最大 / 平均）が記録される |
| TC-PROBE-022 | ビットレート未指定時の実効データレート（bytes/sec、1 分あたりサイズ）が記録される |
| TC-PROBE-023 | 先頭チャンクに EBML ヘッダ / Segment / Tracks が含まれるかが記録される |
| TC-PROBE-024 | 2 番目以降の各チャンクについて、先頭が Cluster 境界と一致するか、要素の途中で分割されているかが記録される（末尾 32B 繰り越し設計の前提） |
| TC-PROBE-025 | 各 Cluster の Timecode 値と、その単調増加性が記録される（t0 基準振り直し設計の前提） |
| TC-PROBE-026 | Cluster Timecode のバイト長が記録される（同一バイト長での振り直し設計の前提） |
| TC-PROBE-027 | 出力ファイルの SegmentInfo に Duration 要素が含まれるかが記録される（Duration 非書き込み方式の前提） |
| TC-PROBE-028 | 録画開始時刻と先頭 Cluster Timecode の関係が記録される（tVideo = `Date.now() - videoStartTimestamp` との対応づけの前提） |

---

## 6. 失敗条件（ゲート）

計測ラン全体を FAIL とする条件は次のとおりです。

- pageerror が 1 件でも発生した
- console.error が 1 件でも発生した（allowlist は期限付きでのみ許可）
- `getUserMedia` または MediaRecorder の開始に失敗した
- `dataavailable` が一度も発生しなかった
- 第 5.3 節の記録項目が欠落した
- 第 3 章の制約と異なる設定で計測した（ビットレートを指定した、timeslice が 1000 でない、など）

次の場合は FAIL にせず、フラグを付けて報告します。

- `constraint_mismatch`: 実効解像度などが要求値と異なる
- `design_assumption_violation`: 実測値が録画設計の前提と矛盾する
- `proxy_version_drift`: WebView と Chrome のビルド系列がずれている

---

## 7. Artifact（失敗時・成功時とも収集）

| 種別 | 必須 / 任意 |
|---|---|
| `probe_report.json`（第 8 章） | 必須 |
| 生チャンク（連番バイナリ）と結合済み `.webm` | 必須 |
| console log | 必須 |
| 実行時スクリーンショット | 必須 |
| run_id | 必須 |
| network log / trace | 任意 |

- 生チャンクは、分割位置の解析（TC-PROBE-024〜026）を再現できる形で、チャンク単位のまま保存します。
- 回収先はホスト側とします。回収方式は未確定です（open_questions 参照）。

---

## 8. レポート形式

`probe_report.json`

| field | 内容 |
|---|---|
| run_id | 計測ラン ID |
| status | PASS / FAIL |
| fail_reason | FAIL 理由 |
| flags | `constraint_mismatch` / `design_assumption_violation` / `proxy_version_drift` |
| device | 端末名・OS バージョン |
| user_agent / chrome_version | 実行環境 |
| requested_constraints | 第 3 章の要求値 |
| effective_settings | 実効値 |
| is_type_supported | `video/webm` の可否 |
| chunks[] | index / received_at / elapsed_ms / size_bytes / starts_at_cluster / cluster_timecodes[] |
| stats | 受信間隔統計・実効データレート |
| header_info | EBML / Segment / Tracks の有無、Duration の有無 |
| evidence_paths | Artifact の保存先 |
| reproduction_steps | 再現手順 |

---

## 9. 例外ルール

- 3rd party 起因の console.error は allowlist に登録できます。登録には期限が必要です。
- `adb reverse` が使えない場合など計測経路に問題があるときは、ページ表示・環境情報（5.1）までの結果を残し、ランを FAIL として理由を記録します。

---

## 10. 前提と制約

- 本プローブの結果は、要求 ⑤（録画データサイズ改善）の設計判断の裏付けに使います。確定判断にはアプリ内 WebView での確認を併せて必要とします。
- 開発完了目標は 2026 年 11 月末です（12 月から高齢者実験開始）。アプリ内確認を含む計測は、この日程に間に合う時期に実施する必要があります。

```json
{
  "required_changes": [
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "src/tools/mediarecorder-probe/ の単体 HTML+JS を adb reverse 経由で端末 Chrome から実行し、アプリと同一制約（1280x720 / audio:true / video/webm / ビットレート未指定 / start(1000)）で計測する仕様として新規作成する"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "SH-M29 の WebView 153.0.8010.36 と Chrome 153.0.8010.52 が同一ビルド系列である点を代理妥当性の根拠として明記し、アプリ内 WebView 確認を別途必須とする"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "チャンク時刻・サイズ・Cluster 境界・Cluster Timecode 値とバイト長・Duration 有無を録画設計（t0 振り直し、末尾32B繰り越し、Duration 非書き込み）の前提検証項目として定義する"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "失敗条件ゲート、constraint_mismatch / design_assumption_violation / proxy_version_drift フラグ、Artifact、probe_report.json 形式を定義する"}
  ],
  "suggested_impacts": [
    {"domain": "App-agent", "severity": "must", "reason": "プローブ実測値が Cluster 境界・Timecode バイト長・Duration 有無について録画設計前提と矛盾した場合、hiyari.NN.webm の書き込み設計の見直しが必要になる"},
    {"domain": "App-agent", "severity": "should", "reason": "プローブがアプリと同一制約で動くよう、アプリ側の録画制約（解像度・audio・MIME・timeslice・ビットレート未指定）の定義箇所を単一の参照元として示す必要がある"},
    {"domain": "App-agent", "severity": "should", "reason": "アプリ内 WebView での確認が別途必要であり、アプリ本体を変更せずに確認する手段（例: デバッグビルドでのリモートデバッグ可否）を決める必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "adb reverse 経由のプローブ配信と、生チャンク・probe_report.json をホスト側に回収する経路が必要"}
  ],
  "requirements_context": "要求⑤（ヒヤリ発生時の録画データサイズ改善）に関連し、MediaRecorder の実挙動を実機で計測するための QA 用プローブを定義する。配置は src/tools/mediarecorder-probe/ の単体 HTML + JS。adb reverse 経由で端末（SH-M29 / Android 15）の Chrome から実行する。制約はアプリと同一（1280x720 / audio:true / video/webm / ビットレート指定なし / start(1000)）とし、アプリ本体は変更しない。制約が乖離した計測結果は無効とし、要求値と実効値の両方を記録する。WebView 153.0.8010.36 と Chrome 153.0.8010.52 は同一ビルド系列（153.0.8010）のパッチ違いであるため、proposal #239 の standalone-probe は Capacitor WebView の代理として妥当とする。ただし同一プロセスではないため、アプリ内 WebView での確認は別途必要である。計測観点は存在（ページ描画・環境情報・isTypeSupported）、操作（getUserMedia 成功・実効解像度・録画開始/停止・pageerror/console.error 0 件）、業務前提（チャンク受信時刻・サイズ・受信間隔・実効データレート・先頭チャンクのヘッダ構成・Cluster 境界とチャンク分割位置・Cluster Timecode 値と単調性とバイト長・Duration 有無・録画開始時刻と先頭 Timecode の関係）の 3 層とする。業務前提層は、録画設計の前提を検証するためのものである。その前提は、tVideo による単一時計でのチャンク選択と区間判定、先頭 Cluster を t0 とした同一バイト長での Timecode 振り直し、末尾 32B 繰り越し、追記のみで Duration を書かず再生側の currentTime=1e101 シークで実長確定、ヒヤリごとの新規 hiyari.NN.webm と重なり区間への同時 append である。失敗ゲートは次のとおり: pageerror、console.error（期限付き allowlist 可）、getUserMedia/開始失敗、dataavailable 未発生、記録欠落、制約違反。フラグは constraint_mismatch / design_assumption_violation / proxy_version_drift。Artifact は probe_report.json、生チャンク、結合 webm、console log、スクリーンショット、run_id を必須とする。開発完了目標は 2026 年 11 月末（12 月実験開始）。",
  "fact_candidates": [
    {"type": "qa_expectation", "title": "プローブはアプリと同一制約で計測する", "statement": "プローブの MediaRecorder は 1280x720 / audio:true / video/webm / ビットレート指定なし / start(1000) の制約で動作していなければならない", "status": "candidate"},
    {"type": "constraint", "title": "プローブ導入でアプリ本体は変更されない", "statement": "mediarecorder-probe の追加によってアプリ本体のコード・ビルド設定に変更が生じていないこと", "status": "candidate"},
    {"type": "qa_expectation", "title": "制約乖離時の計測結果は無効", "statement": "アプリと異なる録画制約で取得した計測結果はアプリの代理データとして採用されない", "status": "candidate"},
    {"type": "qa_expectation", "title": "要求値と実効値の両方が記録される", "statement": "probe_report.json に要求制約と実効設定値の両方が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "実効解像度不一致は constraint_mismatch として報告される", "statement": "映像トラックの実効解像度が 1280x720 と異なる場合、レポートに constraint_mismatch が付与されること", "status": "candidate"},
    {"type": "qa_expectation", "title": "プローブ結果のみでアプリ内挙動を確定しない", "statement": "アプリ内 WebView での確認が完了するまで、プローブ結果はアプリ内挙動の確定根拠として扱われない", "status": "candidate"},
    {"type": "qa_expectation", "title": "全チャンクの受信時刻とサイズが記録される", "statement": "録画中に受信した全チャンクについて受信時刻・録画開始からの経過時間・バイトサイズが欠落なく記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "チャンク分割位置が記録される", "statement": "2 番目以降の各チャンクについて、先頭が Cluster 境界と一致するか否かが記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "Cluster Timecode の値とバイト長が記録される", "statement": "各 Cluster の Timecode 値とそのバイト長が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "出力ファイルの Duration 有無が記録される", "statement": "MediaRecorder 出力の SegmentInfo に Duration 要素が含まれるか否かが記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "ビットレート未指定時の実効データレートが記録される", "statement": "ビットレート未指定で録画した際の bytes/sec と 1 分あたりサイズが記録されていること", "status": "candidate"},
    {"type": "validation_rule", "title": "pageerror / console.error 発生で計測ラン FAIL", "statement": "計測中に pageerror または allowlist 外の console.error が 1 件でも発生した場合、計測ランは FAIL と判定される", "status": "candidate"},
    {"type": "validation_rule", "title": "dataavailable 未発生で FAIL", "statement": "録画開始後に dataavailable が一度も発生しなかった場合、計測ランは FAIL と判定される", "status": "candidate"},
    {"type": "qa_expectation", "title": "設計前提との矛盾はフラグ付きで報告される", "statement": "実測値が録画設計の前提と矛盾した場合、レポートに design_assumption_violation が付与され差し戻し対象となること", "status": "candidate"},
    {"type": "qa_expectation", "title": "実行環境バージョンが毎回記録される", "statement": "各計測ランで UA 文字列と Chrome バージョンが probe_report.json に記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "生チャンクがチャンク単位で保存される", "statement": "計測で得た生チャンクがチャンク単位のまま、run_id と対応づけて保存されていること", "status": "candidate"}
  ],
  "open_questions": [
    "アプリ内 WebView での確認手段が未確定: 同一プロセスでないため別途確認が必要だが、アプリ本体を変更しない制約下でどう計測するか（デバッグビルドのリモートデバッグ可否など）が決まっていない。App-agent / Infra-agent の判断が必要で、決まらないと要求⑤の設計確定が遅れる",
    "生チャンクと probe_report.json のホスト回収方式が未確定: 端末からダウンロードするか、adb reverse 経由でホストへアップロードするかが決まっていない。Infra-agent の判断が必要で、決まらないと TC-PROBE-024〜026 の解析を再現できない",
    "アプリ側録画制約の参照元が未確定: プローブの制約をアプリと同一に保つための正準定義の所在が示されていない。App-agent の確認が必要で、決まらないと制約乖離を検出できない",
    "設計前提との合否判定基準が未確定: チャンク受信間隔の許容幅や、Cluster 境界不一致の頻度をどこから設計前提違反とみなすかが決まっていない。App-agent と QA の合意が必要で、決まらないと design_assumption_violation の判定が恣意的になる",
    "計測時間と試行回数が未確定: 1 ランあたりの録画時間と繰り返し回数が決まっていない。実効データレートやヒヤリ区間長の想定は App-agent の設計に依存し、決まらないと統計の信頼性が担保できない",
    "WebView / Chrome 更新時の再計測トリガーが未確定: ビルド系列がずれた際に再計測を必須とするかが決まっていない。代理妥当性の維持に影響する"
  ],
  "rationale_notes": [
    "アプリ本体を変更しない方針は、計測のために実験前のアプリへリスクを持ち込まないためである。そのため単体プローブとして src/tools 配下に隔離した",
    "adb reverse を使うのは、端末 Chrome から localhost としてページを開くことで getUserMedia が要求する secure context を満たしやすいためと考えられる",
    "業務前提層で『期待値』ではなく『実測値の記録』を合否の主軸にしたのは、Cluster 分割位置や Timecode バイト長がブラウザ実装依存であり、正解を事前に断定できないためである",
    "Duration の書き込み方式は、SegmentInfo 書き込み → プレースホルダ上書き → 非書き込み（再生側シーク）と変遷した。TC-PROBE-027 は最終方式の前提（MediaRecorder 出力に Duration が無いこと）を確認する意図で置いている",
    "3 層構造にしたのは、カメラ権限や adb 接続が不安定でも、環境情報など取得できた範囲の証跡を残して調査を前進させるためである"
  ]
}
```