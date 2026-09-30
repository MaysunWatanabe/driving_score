<!-- 作成: 2026-09-29 15:10:07 JST | 更新: 2026-09-30 17:55:12 JST -->

# MediaRecorder 計測プローブ（qa.mediarecorder.probe）

- entrypoint: `spec/qa/mediarecorder-probe.md`
- 担当: QA-agent
- 関連要求: 2026 年度改修要求 ⑤「ヒヤリ発生時の録画データサイズ改善」
- 関連 proposal: #239（standalone-probe）

---

## 1. 目的

ヒヤリ区間録画（`hiyari.NN.webm`）の設計は、MediaRecorder が出力するチャンクの実挙動を前提にしています。本プローブは、その前提を**実機（SH-M29 / Android 15）で計測して裏付ける**ための単体計測ツールと、その合否基準を定めます。

裏付けの対象となる録画設計の判断は、第 1.1 節に示します。

本プローブは**アプリ本体を変更しません**。計測はアプリの外で完結させます。

### 1.1 本プローブが裏付ける録画設計の前提

| # | 設計判断 | 関連する計測観点 |
|---|---|---|
| D-1 | 録画時計 tVideo（`Date.now() - videoStartTimestamp`）を単一の時計として、チャンク選択と区間判定を行う | TC-PROBE-020 / 028 / 032 |
| D-2 | ヒヤリごとに必ず新しい `hiyari.NN.webm` を開く | TC-PROBE-023 / 030 |
| D-3 | 区間が重なる場合は複数区間を同時に開き、届いたチャンクを開いている全区間へ append する | TC-PROBE-020 / 021 / 022 |
| D-4 | 区間状態・t0・末尾 32B の繰り越しは区間ごとの配列で持つ。書き込みキューは 1 本のまま直列化する | TC-PROBE-021 / 022 / 024 |
| D-5 | 区間の先頭 Cluster を t0 とし、全 Cluster Timecode を**同じバイト長のまま** `(元値 - t0)` に振り直す | TC-PROBE-025 / 026 / 031 / 033 |
| D-6 | SegmentInfo に Duration を書き込む | TC-PROBE-027 / 029 / 030 / 033 |
| D-7 | `markersVideoTime` は `floor((tVideo - segmentFrom) / 1000)` とし、ファイル先頭を基準にする | TC-PROBE-028 / 031 / 032 |

> **設計前提の変更について**
> D-5〜D-7 の判断により、fact #4709 / #4705 と #4742 の一部が撤回されました。
> 本仕様の旧版は「Duration をファイルに書かず、再生側のシークで実長を確定する方式」を前提にしていましたが、この方式は採りません。現在は **SegmentInfo に Duration を書き込む方式**を前提とします。
> TC-PROBE-027 の検証意図も、これに合わせて改めています。

---

## 2. 配置と計測経路

| 項目 | 内容 |
|---|---|
| 配置 | `src/tools/mediarecorder-probe/` に単体の HTML + JS を置く |
| 実行ブラウザ | 端末（SH-M29）の Chrome |
| 接続経路 | `adb reverse` 経由で、ホストの配信ページを端末 Chrome から開く |
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
- 制約が乖離した状態で得た計測結果は無効とします。
- 要求値と、実際に適用された値（`getSettings()` 相当の実効値）の両方を記録します。
- 実効値が要求値と異なる場合は、結果に `constraint_mismatch` を付けます。

---

## 4. 計測環境と代理妥当性

| 対象 | バージョン |
|---|---|
| 端末 | SH-M29 / Android 15 |
| Android System WebView（Capacitor が使用） | 153.0.8010.36 |
| Chrome | 153.0.8010.52 |

- 両者は同一ビルド系列（153.0.8010）で、パッチ番号だけが異なります。このため、端末 Chrome での standalone-probe は Capacitor WebView の**代理として妥当**とします。
- ただし、両者は同一プロセスではありません。**アプリ内 WebView での確認は別途必要**です。プローブの結果だけで、アプリ内の挙動を確定扱いにしてはなりません。
- 計測のたびに、実行時の UA 文字列と Chrome バージョンをレポートに記録します。
- WebView と Chrome のどちらかが更新されてビルド系列がずれた場合は、代理妥当性を再評価します。

---

## 5. 計測観点

計測観点は「存在 → 操作 → 業務前提」の 3 層に分けます。

下位層が失敗しても、上位層の観点のうち実行できるものは実行し、結果を残します（degraded-mode）。たとえば `getUserMedia` が失敗した場合でも、5.1 の環境情報と `isTypeSupported` の結果はレポートに残します。

### 5.1 存在チェック（Existence）

| ID | 合格条件 |
|---|---|
| TC-PROBE-001 | `adb reverse` 経由で端末 Chrome からプローブページが表示され、ルート要素（`data-testid="probe-root"`）が一定時間内に描画される |
| TC-PROBE-002 | 実行環境情報（UA、Chrome バージョン、画面情報）が、ページ上とレポートに出力される |
| TC-PROBE-003 | `MediaRecorder.isTypeSupported('video/webm')` の結果が記録される |

### 5.2 操作チェック（Interaction）

| ID | 合格条件 |
|---|---|
| TC-PROBE-010 | 第 3 章の制約で `getUserMedia` が成功し、映像トラック 1 本・音声トラック 1 本が取得できる |
| TC-PROBE-011 | 映像トラックの実効解像度が記録され、1280x720 と一致する（不一致なら `constraint_mismatch`） |
| TC-PROBE-012 | ビットレート未指定・`start(1000)` で録画を開始でき、`dataavailable` が発生する |
| TC-PROBE-013 | 停止操作で録画が停止し、最終チャンクが `dataavailable` として受け取れる |
| TC-PROBE-014 | 録画中・停止時に、pageerror と console.error が 0 件である |

### 5.3 業務前提チェック（録画設計の前提検証）

この層の主目的は、「どうなるべきか」ではなく「**実測値が何であったか**」を記録することです。

- 記録そのものが欠落した場合は FAIL とします。
- 第 1.1 節の設計前提と矛盾する実測値が出た場合は、`design_assumption_violation` として報告し、設計側（App-agent）へ差し戻します。その際、どの設計判断（D-1〜D-7）と矛盾したかを明記します。

#### 5.3.1 チャンクと時刻

| ID | 記録対象 / 合格条件 | 対応前提 |
|---|---|---|
| TC-PROBE-020 | 各チャンクについて、次の値が全チャンク分記録される: 受信時刻（`Date.now()`）、録画開始からの経過時間、その時点の tVideo、バイトサイズ | D-1 / D-3 |
| TC-PROBE-021 | チャンク受信間隔の分布（最小 / 最大 / 平均）が記録される | D-3 / D-4 |
| TC-PROBE-022 | ビットレート未指定時の実効データレート（bytes/sec、1 分あたりサイズ）と、チャンクサイズの最大値が記録される | D-3 / D-4 |
| TC-PROBE-028 | 録画開始時刻（`videoStartTimestamp`）と先頭 Cluster Timecode の関係が記録される | D-1 / D-7 |
| TC-PROBE-032 | 各チャンクについて、受信時点の tVideo と、そのチャンクに含まれる Cluster Timecode との差（オフセット）が記録される | D-1 / D-7 |

TC-PROBE-022 のチャンクサイズ最大値は、重なり区間で同一チャンクを複数ファイルへ append する際の、書き込み負荷の見積もりに使います。

TC-PROBE-032 のオフセットは、次の 2 つの基準が一致するかを判断する材料です。

- tVideo 基準で算出する `markersVideoTime`
- Cluster Timecode 基準で決まるファイル内の再生位置

#### 5.3.2 ファイル構造（ヘッダ・Cluster）

| ID | 記録対象 / 合格条件 | 対応前提 |
|---|---|---|
| TC-PROBE-023 | 先頭チャンクに EBML ヘッダ / Segment / Tracks が含まれるかが記録される | D-2 |
| TC-PROBE-024 | 2 番目以降の各チャンクについて、先頭が Cluster 境界と一致するか、要素の途中で分割されているかが記録される | D-4（末尾 32B 繰り越し） |
| TC-PROBE-025 | 各 Cluster の Timecode 値と、その単調増加性が記録される | D-5 |
| TC-PROBE-026 | 各 Cluster Timecode 要素のバイト長（サイズ記述子と値の長さ）が記録される | D-5（同一バイト長での振り直し） |
| TC-PROBE-031 | 連続する Cluster 間の Timecode 差（Cluster の時間粒度）の分布が記録される | D-5 / D-7 |
| TC-PROBE-033 | 各 Cluster 内の SimpleBlock 相対 Timecode の最小値と最大値が記録される | D-5 / D-6 |

TC-PROBE-031 の時間粒度は、区間の先頭 Cluster（t0）と `segmentFrom` がどの程度ずれうるかを判断する材料です。

TC-PROBE-033 は、次の 2 点を確認するための記録です。

- Cluster 単位の振り直しで、SimpleBlock 側の変更が不要であること
- Duration を算出するための末尾ブロック時刻が得られること

#### 5.3.3 SegmentInfo と Duration 書き込みの前提

| ID | 記録対象 / 合格条件 | 対応前提 |
|---|---|---|
| TC-PROBE-027 | MediaRecorder 出力の SegmentInfo に Duration 要素が含まれるかが記録される。含まれる場合は、その値とバイト長も記録される | D-6 |
| TC-PROBE-029 | SegmentInfo の TimecodeScale の値が記録される | D-6 / D-7 |
| TC-PROBE-030 | 次の構造情報が記録される: Segment のサイズ（unknown-size か否か）、SegmentInfo の開始オフセットとバイトサイズ、Void / SeekHead / Cues 要素の有無 | D-2 / D-6 |

TC-PROBE-027 は、Duration を書き込む際の方式を決める前提です。既存要素を上書きするのか、要素を新たに挿入するのかは、この記録で判断します。

TC-PROBE-029 の TimecodeScale は、Duration の単位と、Cluster Timecode（ms 換算）との対応を決める前提です。

TC-PROBE-030 は、Duration の挿入・上書きによって後続要素のオフセットがずれる影響を評価するための記録です。

---

## 6. 失敗条件（ゲート）

次のいずれかに該当した場合、計測ラン全体を FAIL とします。

- pageerror が 1 件でも発生した
- console.error が 1 件でも発生した（allowlist は期限付きでのみ許可）
- `getUserMedia` または MediaRecorder の開始に失敗した
- `dataavailable` が一度も発生しなかった
- 第 5.3 節の記録項目が欠落した
- 第 3 章の制約と異なる設定で計測した（ビットレートを指定した、timeslice が 1000 でない、など）

次の場合は FAIL にせず、フラグを付けて報告します。

| フラグ | 付与条件 |
|---|---|
| `constraint_mismatch` | 実効解像度などが要求値と異なる |
| `design_assumption_violation` | 実測値が録画設計の前提（D-1〜D-7）と矛盾する。どの前提と矛盾したかを併記する |
| `proxy_version_drift` | WebView と Chrome のビルド系列がずれている |

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

- 生チャンクは、分割位置と構造の解析（TC-PROBE-024〜027、029〜031、033）を再現できるよう、チャンク単位のまま保存します。
- 回収先はホスト側とします。回収方式は未確定です（open_questions 参照）。

---

## 8. レポート形式

ファイル名: `probe_report.json`

| field | 内容 |
|---|---|
| run_id | 計測ラン ID |
| status | PASS / FAIL |
| fail_reason | FAIL の理由 |
| flags | `constraint_mismatch` / `design_assumption_violation`（矛盾した前提 ID を併記）/ `proxy_version_drift` |
| device | 端末名・OS バージョン |
| user_agent / chrome_version | 実行環境 |
| requested_constraints | 第 3 章の要求値 |
| effective_settings | 実効値 |
| is_type_supported | `video/webm` の可否 |
| video_start_timestamp | 録画開始時刻（tVideo の基準） |
| chunks[] | 下記「chunks[] の項目」を参照 |
| stats | 受信間隔統計、実効データレート、チャンクサイズ最大値、Cluster 時間粒度の分布 |
| header_info | 下記「header_info の項目」を参照 |
| evidence_paths | Artifact の保存先 |
| reproduction_steps | 再現手順 |

**chunks[] の項目**

| 項目 | 内容 |
|---|---|
| index | チャンク番号 |
| received_at | 受信時刻 |
| elapsed_ms | 録画開始からの経過時間 |
| tvideo_ms | 受信時点の tVideo |
| size_bytes | バイトサイズ |
| starts_at_cluster | 先頭が Cluster 境界と一致するか |
| cluster_timecodes[] | 値 / バイト長 / SimpleBlock 相対 Timecode の最小・最大 |
| tvideo_cluster_offset_ms | tVideo と Cluster Timecode の差 |

**header_info の項目**

| 項目 | 内容 |
|---|---|
| ebml / segment / tracks | 各要素の有無 |
| segment_size_unknown | Segment が unknown-size か |
| segmentinfo_offset / segmentinfo_size | SegmentInfo の開始オフセットとバイトサイズ |
| timecode_scale | TimecodeScale の値 |
| duration_present / duration_value / duration_bytes | Duration 要素の有無・値・バイト長 |
| void / seekhead / cues | 各要素の有無 |

---

## 9. 例外ルール

- 3rd party 起因の console.error は allowlist に登録できます。登録には期限が必要です。
- `adb reverse` が使えないなど計測経路に問題があるときは、ページ表示と環境情報（5.1）までの結果を残します。そのうえでランを FAIL とし、理由を記録します。

---

## 10. 前提と制約

- 本プローブの結果は、要求 ⑤（録画データサイズ改善）の設計判断を裏付けるために使います。確定判断には、アプリ内 WebView での確認を併せて行う必要があります。
- 本プローブが検証する録画設計の前提は、第 1.1 節の D-1〜D-7 です。これらは approved の設計判断に基づきます。Duration 非書き込み方式（再生側のシークで実長を確定する方式）を前提とした旧版の記述は撤回済みです。
- 開発完了目標は 2026 年 11 月末です（12 月から高齢者を招いた実験が開始されるため）。アプリ内確認を含む計測は、この日程に間に合う時期に実施する必要があります。

```json
{
  "required_changes": [
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "目的の設計前提から Duration 非書き込み方式を撤回し、D-1〜D-7（tVideo 単一時計、ヒヤリごとの新規 hiyari.NN.webm、重なり区間への同時 append、区間ごとの状態配列と直列書き込みキュー、同一バイト長の t0 振り直し、SegmentInfo への Duration 書き込み、ファイル先頭基準の markersVideoTime）として再定義する"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "TC-PROBE-027 の意図を Duration 非存在の確認から、Duration 書き込み時の上書き/挿入判断の前提（有無・値・バイト長の記録）に改める"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "TC-PROBE-029〜033 を追加する（TimecodeScale、Segment/SegmentInfo/Void/SeekHead/Cues 構造、Cluster 時間粒度、tVideo と Cluster Timecode のオフセット、SimpleBlock 相対 Timecode 範囲）"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "TC-PROBE-020 に tVideo を、TC-PROBE-022 にチャンクサイズ最大値を追加し、重なり区間への同時 append と直列書き込みキューの負荷見積もりの前提とする"},
    {"node": "qa.mediarecorder.probe", "entrypoint": "spec/qa/mediarecorder-probe.md", "description": "probe_report.json の chunks[] / header_info / stats に追加記録項目を反映し、design_assumption_violation に矛盾した前提 ID を併記する"}
  ],
  "suggested_impacts": [
    {"domain": "App-agent", "severity": "must", "reason": "Duration を SegmentInfo に書き込む方式に変わったため、MediaRecorder 出力に Duration が無い場合に挿入が必要となり、後続要素のオフセットがずれる影響を TC-PROBE-027/030 の実測で確認し、書き込み処理に反映する必要がある"},
    {"domain": "App-agent", "severity": "must", "reason": "markersVideoTime を floor((tVideo - segmentFrom)/1000) のファイル先頭基準に変えたため、tVideo と Cluster Timecode のオフセット（TC-PROBE-032）や Cluster 粒度（TC-PROBE-031）が大きい場合にマーカー位置がずれる可能性がある"},
    {"domain": "App-agent", "severity": "should", "reason": "重なり区間で同一チャンクを複数ファイルへ append し、書き込みキューを 1 本で直列化するため、チャンクサイズ最大値と受信間隔の実測値に対して書き込みが間に合うかの評価が必要"},
    {"domain": "App-agent", "severity": "should", "reason": "プローブがアプリと同一制約で動くよう、アプリ側の録画制約（解像度・audio・MIME・timeslice・ビットレート未指定）の定義箇所を単一の参照元として示す必要がある"},
    {"domain": "App-agent", "severity": "should", "reason": "アプリ内 WebView での確認が別途必要であり、アプリ本体を変更せずに確認する手段を決める必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "adb reverse 経由のプローブ配信と、生チャンク・probe_report.json をホスト側に回収する経路が必要"}
  ],
  "requirements_context": "要求⑤（ヒヤリ発生時の録画データサイズ改善）に関連し、MediaRecorder の実挙動を実機で計測するための QA 用プローブを定義する。配置は src/tools/mediarecorder-probe/ の単体 HTML + JS で、adb reverse 経由で端末（SH-M29 / Android 15）の Chrome から実行する。制約はアプリと同一（1280x720 / audio:true / video/webm / ビットレート指定なし / start(1000)）とし、アプリ本体は変更しない。制約が乖離した計測結果は無効とし、要求値と実効値の両方を記録し、実効値が異なれば constraint_mismatch を付ける。WebView 153.0.8010.36 と Chrome 153.0.8010.52 は同一ビルド系列（153.0.8010）のパッチ違いであるため、proposal #239 の standalone-probe は Capacitor WebView の代理として妥当とする。ただし同一プロセスではないため、アプリ内 WebView での確認は別途必要であり、プローブ結果のみでアプリ内挙動を確定しない。ビルド系列がずれた場合は代理妥当性を再評価する（proxy_version_drift）。裏付け対象の録画設計前提は D-1〜D-7 の 7 点である。D-1: tVideo（Date.now() - videoStartTimestamp）を単一時計としたチャンク選択と区間判定。D-2: ヒヤリごとに必ず新しい hiyari.NN.webm を開く。D-3: 区間が重なる場合は複数区間を同時に開き、届いたチャンクを開いている全区間へ append する。D-4: 区間状態・t0・末尾 32B の繰り越しを区間ごとの配列で持ち、書き込みキューは 1 本のまま直列化する。D-5: 区間の先頭 Cluster を t0 とし、全 Cluster Timecode を同じバイト長のまま (元値 - t0) に振り直す。D-6: SegmentInfo に Duration を書き込む。D-7: markersVideoTime を floor((tVideo - segmentFrom)/1000) のファイル先頭基準とする。これにより fact #4709 / #4705 と #4742 の一部は撤回され、Duration 非書き込み（再生側シークで実長確定）方式は採らない。計測観点は存在・操作・業務前提の 3 層で、degraded-mode として下位層の失敗時も取得可能な結果を残す。存在層はページ描画（data-testid=probe-root）、環境情報、isTypeSupported。操作層は getUserMedia 成功、実効解像度、録画開始/停止、pageerror/console.error 0 件。業務前提層は次の実測値を記録する: チャンク受信時刻・経過時間・tVideo・サイズ、受信間隔分布、実効データレートとチャンクサイズ最大値、先頭チャンクの EBML/Segment/Tracks 有無、チャンク先頭の Cluster 境界一致、Cluster Timecode 値と単調性とバイト長、Cluster 時間粒度、SimpleBlock 相対 Timecode 範囲、Duration 有無・値・バイト長、TimecodeScale、Segment unknown-size・SegmentInfo オフセット/サイズ・Void/SeekHead/Cues 有無、録画開始時刻と先頭 Cluster Timecode の関係、tVideo と Cluster Timecode のオフセット。前提と矛盾すれば design_assumption_violation に前提 ID を併記して App-agent へ差し戻す。失敗ゲートは pageerror、console.error（期限付き allowlist 可）、getUserMedia/開始失敗、dataavailable 未発生、記録欠落、制約違反。Artifact は probe_report.json、チャンク単位の生チャンク、結合 webm、console log、スクリーンショット、run_id を必須とし、network log / trace は任意、回収先はホスト側とする。開発完了目標は 2026 年 11 月末（12 月に高齢者実験開始）。",
  "fact_candidates": [
    {"type": "qa_expectation", "title": "プローブはアプリと同一制約で計測する", "statement": "プローブの MediaRecorder は 1280x720 / audio:true / video/webm / ビットレート指定なし / start(1000) の制約で動作していなければならない", "status": "candidate"},
    {"type": "constraint", "title": "プローブ導入でアプリ本体は変更されない", "statement": "mediarecorder-probe の追加によってアプリ本体のコード・ビルド設定に変更が生じていないこと", "status": "candidate"},
    {"type": "qa_expectation", "title": "制約乖離時の計測結果は無効", "statement": "アプリと異なる録画制約で取得した計測結果はアプリの代理データとして採用されない", "status": "candidate"},
    {"type": "qa_expectation", "title": "要求値と実効値の両方が記録される", "statement": "probe_report.json に要求制約と実効設定値の両方が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "実効解像度不一致は constraint_mismatch として報告される", "statement": "映像トラックの実効解像度が 1280x720 と異なる場合、レポートに constraint_mismatch が付与されること", "status": "candidate"},
    {"type": "qa_expectation", "title": "プローブ結果のみでアプリ内挙動を確定しない", "statement": "アプリ内 WebView での確認が完了するまで、プローブ結果はアプリ内挙動の確定根拠として扱われない", "status": "candidate"},
    {"type": "qa_expectation", "title": "全チャンクの受信時刻・tVideo・サイズが記録される", "statement": "録画中に受信した全チャンクについて、受信時刻・録画開始からの経過時間・受信時点の tVideo・バイトサイズが欠落なく記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "チャンクサイズ最大値が記録される", "statement": "計測ランにおけるチャンクサイズの最大値が probe_report.json の stats に記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "チャンク分割位置が記録される", "statement": "2 番目以降の各チャンクについて、先頭が Cluster 境界と一致するか否かが記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "Cluster Timecode の値とバイト長が記録される", "statement": "各 Cluster の Timecode 値とそのバイト長が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "Cluster 時間粒度が記録される", "statement": "連続する Cluster 間の Timecode 差の分布が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "SimpleBlock 相対 Timecode の範囲が記録される", "statement": "各 Cluster 内の SimpleBlock 相対 Timecode の最小値と最大値が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "MediaRecorder 出力の Duration 有無・値・バイト長が記録される", "statement": "MediaRecorder 出力の SegmentInfo に Duration 要素が含まれるか否かと、含まれる場合の値とバイト長が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "TimecodeScale が記録される", "statement": "MediaRecorder 出力の SegmentInfo における TimecodeScale の値が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "Segment / SegmentInfo の構造情報が記録される", "statement": "Segment の unknown-size 有無、SegmentInfo の開始オフセットとバイトサイズ、Void / SeekHead / Cues 要素の有無が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "tVideo と Cluster Timecode のオフセットが記録される", "statement": "各チャンクについて受信時点の tVideo と含まれる Cluster Timecode との差が記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "ビットレート未指定時の実効データレートが記録される", "statement": "ビットレート未指定で録画した際の bytes/sec と 1 分あたりサイズが記録されていること", "status": "candidate"},
    {"type": "validation_rule", "title": "pageerror / console.error 発生で計測ラン FAIL", "statement": "計測中に pageerror または allowlist 外の console.error が 1 件でも発生した場合、計測ランは FAIL と判定される", "status": "candidate"},
    {"type": "validation_rule", "title": "dataavailable 未発生で FAIL", "statement": "録画開始後に dataavailable が一度も発生しなかった場合、計測ランは FAIL と判定される", "status": "candidate"},
    {"type": "validation_rule", "title": "業務前提層の記録欠落で FAIL", "statement": "第 5.3 節の記録項目のいずれかが欠落した場合、計測ランは FAIL と判定される", "status": "candidate"},
    {"type": "qa_expectation", "title": "設計前提との矛盾は前提 ID 付きで報告される", "statement": "実測値が録画設計の前提 D-1〜D-7 と矛盾した場合、レポートに design_assumption_violation と矛盾した前提 ID が付与され差し戻し対象となること", "status": "candidate"},
    {"type": "qa_expectation", "title": "実行環境バージョンが毎回記録される", "statement": "各計測ランで UA 文字列と Chrome バージョンが probe_report.json に記録されていること", "status": "candidate"},
    {"type": "qa_expectation", "title": "生チャンクがチャンク単位で保存される", "statement": "計測で得た生チャンクがチャンク単位のまま run_id と対応づけて保存されていること", "status": "candidate"}
  ],
  "open_questions": [
    "Duration 書き込み時の挿入方式が未確定: MediaRecorder 出力に Duration が無い場合、SegmentInfo へ要素を挿入するとサイズと後続オフセットが変わる。Void の利用やヘッダ再構成の方法が決まっていない。App-agent の判断が必要で、決まらないと TC-PROBE-027/030 の実測結果を design_assumption_violation と判定する基準が定まらない",
    "書き込む Duration 値の定義が未確定: 最終 Cluster Timecode + 最終 SimpleBlock 相対 Timecode (+ フレーム長) - t0 とするかなど、算出式が facts に明示されていない。App-agent の確認が必要で、決まらないと TC-PROBE-033 の記録から期待 Duration を検証できない",
    "markersVideoTime の許容誤差が未確定: floor による 1 秒粒度と、Cluster 時間粒度（TC-PROBE-031）・tVideo と Cluster Timecode のオフセット（TC-PROBE-032）の合計でマーカー位置がどこまでずれてよいかが決まっていない。App-agent と QA の合意が必要で、決まらないとマーカー整合の合否判定ができない",
    "重なり区間での直列書き込みキューの性能基準が未確定: 同時に開く区間数の上限と、チャンク受信間隔（約 1 秒）内に全区間への append が完了すべきかが決まっていない。App-agent の判断が必要で、決まらないと TC-PROBE-021/022 の実測値で負荷評価ができない",
    "再構成済みファイルの検証をプローブの範囲に含めるかが未確定: プローブで得た生チャンクに D-5/D-6 の処理を適用し、Timecode が 0 起点であることと Duration が正しく書き込まれ再生できることをオフラインで確認するかが決まっていない。アプリ本体を変更しない制約との整合を含め、QA と App-agent の判断が必要",
    "アプリ内 WebView での確認手段が未確定: 同一プロセスでないため別途確認が必要だが、アプリ本体を変更しない制約下でどう計測するか（デバッグビルドのリモートデバッグ可否など）が決まっていない。App-agent / Infra-agent の判断が必要で、決まらないと要求⑤の設計確定が遅れる",
    "生チャンクと probe_report.json のホスト回収方式が未確定: 端末からダウンロードするか、adb reverse 経由でホストへアップロードするかが決まっていない。Infra-agent の判断が必要で、決まらないと構造解析を再現できない",
    "アプリ側録画制約の参照元が未確定: プローブの制約をアプリと同一に保つための正準定義の所在が示されていない。App-agent の確認が必要で、決まらないと制約乖離を検出できない",
    "設計前提との合否判定基準が未確定: チャンク受信間隔の許容幅や、Cluster 境界不一致の頻度をどこから設計前提違反とみなすかが決まっていない。App-agent と QA の合意が必要で、決まらないと design_assumption_violation の判定が恣意的になる",
    "計測時間と試行回数が未確定: 1 ランあたりの録画時間と繰り返し回数が決まっていない。ヒヤリ区間長の想定は App-agent の設計に依存し、決まらないと統計の信頼性が担保できない",
    "WebView / Chrome 更新時の再計測トリガーが未確定: ビルド系列がずれた際に再計測を必須とするかが決まっていない。代理妥当性の維持に影響する"
  ],
  "rationale_notes": [
    "アプリ本体を変更しない方針は、計測のために実験前のアプリへリスクを持ち込まないためである。そのため単体プローブとして src/tools 配下に隔離した",
    "adb reverse を使うのは、端末 Chrome から localhost としてページを開くことで、getUserMedia が要求する secure context を満たしやすいためと考えられる",
    "業務前提層で期待値ではなく実測値の記録を合否の主軸にしたのは、Cluster 分割位置・Timecode バイト長・Duration の有無がブラウザ実装に依存し、正解を事前に断定できないためである",
    "Duration の扱いは、SegmentInfo 書き込み → プレースホルダ上書き → 非書き込み（再生側シーク）→ SegmentInfo への書き込みと変遷した。最新の approved 判断で fact #4709 / #4705 と #4742 の一部が撤回されたため、TC-PROBE-027 は Duration 非存在の確認から、書き込み方式（上書きか挿入か）を決める前提の記録へ意図を改めた",
    "t0 振り直しを同じバイト長のまま行う設計は、Cluster の要素サイズと後続オフセットを変えずに済ませるためと読める。そのため TC-PROBE-026 で Timecode 要素のバイト長を、TC-PROBE-033 で SimpleBlock 相対値（振り直し不要の前提）を記録する",
    "markersVideoTime は tVideo 基準、ファイル内の再生位置は Cluster Timecode 基準で決まる。そのため両者のオフセット（TC-PROBE-032）と Cluster 粒度（TC-PROBE-031）を記録対象に加えた",
    "3 層構造にしたのは、カメラ権限や adb 接続が不安定でも、環境情報など取得できた範囲の証跡を残して調査を前進させるためである"
  ]
}
```