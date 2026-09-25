<!-- 作成: 2026-09-10 17:32:05 JST | 更新: 2026-09-18 18:59:29 JST -->

# DemoData（センサログ／デモ動画の再生サービス）

/ 対象ノード: `middleware.sensor.demoData`
/ 仕様書パス: `spec/middleware/sensor-demoData.md`

## 1. 目的と責務

`DemoData` は、記録済みのセンサログ（gzip + Base64 のテキスト）と走行動画（webm）を保持し、
実センサーの代わりに**センサ値を時系列で再生する**シングルトンサービスである。

責務は次の 2 点に限定する。

| 責務 | 内容 |
|---|---|
| 再生 | 追加されたログファイル群を時系列順に 1 走行として再生し、1 サンプルずつ払い出す |
| 互換変換 | 旧フォーマットのログを現行のセンサ値構造に変換する（`convertOldData`） |

次は本ノードの責務ではない（真実源は別ノード）。

- センサログの **schema 定義** → `qa.mockdata.sensorlog.schema`
- テスト用ログの **シナリオ定義・量子化・端末姿勢** → `qa.mockdata.sensorlog.scenarios`
- 正準モックログの **生成** → `qa.mockdata.sensorlog.generator`
- 実センサー／デモの**切替判定そのもの** → `middleware.sensor.service`

> 設計意図: ログの内容定義を DemoData 側に二重定義しないため、本ノードは QA 側モックデータ仕様を参照するに留める。

## 2. 利用ユースケース

| ユースケース | 用途 |
|---|---|
| UC12 編集とデモ再生 | `ui.edit.page` からアップロードされたログ／動画を保持し、再生位置を編集操作に追従させる |
| UC06 運転診断の実行 | 実センサーの代わりにログを払い出し、診断ロジックをデモ入力で駆動する |

## 3. 入力データ仕様

### 3.1 センサログ

- 形式: gzip 圧縮 + Base64 エンコードされたテキスト
- 展開後: **JSON Lines**（1 行 = 1 JSON オブジェクト）
- 1 行の構造: `{ date, sensor }`
  - `DemoData` が使用するのは **`sensor` 部分のみ**。`date` は再生に使用しない。

### 3.2 必須キーと skip 条件

`unzipped()` は、`sensor` が次のキーのいずれかを欠く行を**読み飛ばす（skip）**。

- `videoTime`
- `geolocation`
- `acceleration`
- `gyroscope`
- `magnetometer`

### 3.3 旧フォーマット互換（`convertOldData`）

- `sensor` に `canData` が存在しない場合、`convertOldData()` が**ゼロ値のダミー `canData` を補充**する。
- このゼロ補充ロジックは**本改修で変更してはならない（凍結）**。
  過去に取得した「スマホのみ」ログの再生互換が壊れるため。

### 3.4 動画

- 形式: webm。`ui.driving.page` が `movieFile` を参照して再生する。
- 動画とセンサログの同期は `videoTime` を基準に行う（`timestamp` は使用しない。§4.2 参照）。

## 4. 再生 API と挙動

### 4.1 ファイル追加と連結再生

| API | 挙動 |
|---|---|
| `pushSensorLogFile(file)` | `sensorLogFiles` にファイルを追加する。**最初のファイル追加時に `reset()` を呼び**、再生開始可能な状態にする |
| `reset()` | ファイルインデックス（`sensorLogFilesIndex`）と読み出し位置を先頭に戻す |

- 複数ファイルが追加された場合、`sensorLogFilesIndex` 順に**連結して 1 走行として再生**する。

### 4.2 サンプル払い出しと timestamp 上書き

- `getSensorLogData()` はサンプルを返す際、`sensor.timestamp` を**取り出し時点の `Date.now()` に置き換える**。
  - 意図: 実センサー経路と同じ「到着時刻」セマンティクスを保つため。
  - ログ内の相対時刻は `videoTime` が担い、上書きされない。

### 4.3 シーク

`seekSensorLogData(videoTime)` の手順:

1. `reset()` を実行する
2. `fileInfo.minVideoTime <= videoTime <= fileInfo.maxVideoTime` を満たすファイルまで移動する
3. `currentVideoTime >= videoTime` に達するまで **1 件ずつ前進**する

### 4.4 件数とデモ判定

- `getSensorLogDataSize()` はロード済みサンプル件数を返す。
- **閾値は 0**: `getSensorLogDataSize() > 0` の場合にデモ再生モードと判定する。
- この閾値 0 は `middleware.sensor.service` の実センサー／デモ切替判定と**一致していなければならない**。

> 注: 判定閾値が DemoData 側と `sensor.service` 側の 2 箇所に存在するため乖離リスクがある。値 0 の一致を仕様として明記する。

## 5. 正準モックログ

テスト用の正準モックは `qa.mockdata.sensorlog.generator` が生成する。

- 命名規則: `sensor-log.<scenario>.<sensorMode>.txt.gz`
- 構成: **計 9 ファイル**

| sensorMode | scenario |
|---|---|
| `smartphoneOnly` | `cruise` |
| `canConnected` | `cruise`, `accel_decel`, `hard_brake`, `sharp_curve`, `mixed`, `steer_stable`, `steer_wobble_weak`, `steer_wobble_strong` |

schema / シナリオ内容 / 量子化 / 端末姿勢は `qa.mockdata.sensorlog.schema` および
`qa.mockdata.sensorlog.scenarios` に従い、本ノードでは定義しない。

## 6. 既知の実装実態

- `smartphoneOnly` のログを再生した場合、`sensor.service` 側の `lastCanData` ゼロ埋めにより
  CAN 版スコアロジックが `null` を返し、**全項目 100** となる。
  - 原因の一部は §3.3 の `canData` ゼロ補充であるが、後方互換のため凍結する。

## 7. 2026 年度改修要求との関係

2026 年度改修要求（日産自動車提供の一次仕様 2026-08-04 / 要求仕様確認 2026-09-17、要求 5 本）のうち、
本ノードに関係するのは以下である。開発完了目標は **2026 年 11 月末**（12 月から高齢者実験開始）。

| 改修要求 | 本ノードへの影響 |
|---|---|
| ⑤ ヒヤリ発生時の録画データサイズ改善 | デモ再生対象となる動画がヒヤリ前後の**個別動画**になる場合、`movieFile` 単一動画前提の再生方式を見直す必要がある（**未確定**） |
| 連続ヒヤリの動画生成方式 | 30 秒以内に連続したヒヤリは 1 本にまとめても個別生成してもよい（実装都合で選択可）。いずれの方式でもデモ再生側が扱えることを確認する必要がある |
| ③ レーダーチャート表示 | スコアロジックの入力は本ノードが払い出すセンサ値であるため、入力仕様自体は変更なし。スコアロジックは打ち合わせ後まで凍結（現状維持） |

上記以外の改修要求（①前回結果表示、②タブ切り替え、④BLE 安定化）は本ノードの責務外である。
ただし④に関連して、CAN ペイロード長・割り当てが変更された場合は
モックログの `canData` 符号化規則に影響が及ぶため、QA 側と連動して確認する。

## 8. 制約一覧

1. `convertOldData()` の `canData` ゼロ補充は変更禁止。
2. デモ判定閾値は 0（`> 0` でデモ）とし、`middleware.sensor.service` と一致させる。
3. センサログの schema / シナリオを本ノードで定義してはならない（QA 側を参照する）。
4. `sensor.timestamp` は再生時に上書きするが、`videoTime` は元値を保持する。

## 9. 未確定事項

- 正準モック 9 ファイルの読み込み経路（assets 同梱か、`ui.edit.page` からの手動アップロードのみか）
- `steer_*` / `mixed` に `smartphoneOnly` 版が存在しない理由（意図的な非対応か未生成か）
- `timestamp` 上書きによりログ内相対時刻と実時刻がずれることのスコアロジックへの影響
- skip 発生時の `sensorLogDataSize` の意味（skip 後の実件数か行数か）
- `convertOldData` のゼロ補充 `canData` の完全なフィールド一覧と埋め値
- ヒヤリ個別動画化後の再生方式（マーカー対応づけ・前後ボタン挙動を含む）

```json
{
  "required_changes": [
    {"node": "middleware.sensor.demoData", "entrypoint": "spec/middleware/sensor-demoData.md", "description": "JSONのみだった前回出力をMarkdown仕様書本文として起こし、正準モック9ファイル・skip条件・canDataゼロ補充凍結・timestamp上書き・デモ判定閾値0を明文化する"},
    {"node": "middleware.sensor.demoData", "entrypoint": "spec/middleware/sensor-demoData.md", "description": "2026年度改修要求（ヒヤリ録画データサイズ改善・連続ヒヤリの動画生成方式）に伴う movieFile 単一動画前提の見直しを未確定事項として追記する"}
  ],
  "suggested_impacts": [
    {"domain": "qa", "severity": "must", "reason": "正準モック sensor-log.<scenario>.<sensorMode>.txt.gz 9ファイルの生成・schema・scenarios は qa.mockdata.sensorlog.* を真実源とするため整合確認が必要"},
    {"domain": "middleware", "severity": "must", "reason": "デモ判定閾値0（>0でデモ）は middleware.sensor.service の実センサー/デモ切替判定と一致させる必要がある"},
    {"domain": "middleware", "severity": "must", "reason": "ヒヤリ前後15秒の個別動画化により、録画生成側と demoData の動画再生前提（単一movieFile）が乖離する可能性がある"},
    {"domain": "ui", "severity": "should", "reason": "ui.edit.page のアップロードと ui.driving.page の movieFile 参照がデモ再生の前提であり、個別動画化時は再生方式の変更が必要"},
    {"domain": "qa", "severity": "should", "reason": "BLE の CAN ペイロード長・割り当てが変更された場合、モックログ内 canData の符号化規則に影響する"}
  ],
  "requirements_context": "DemoData は gzip+Base64 のセンサログ（JSON Lines、1行 = {date, sensor}）と webm 動画を再生するシングルトンで、責務は『再生』と『旧フォーマット互換変換』の2点に限定される。UC12（編集とデモ再生）・UC06（運転診断の実行）で使用。入力行のうち必須キー（videoTime/geolocation/acceleration/gyroscope/magnetometer）を欠く行は skip する。canData が欠落する旧スマホのみログでは convertOldData がゼロ値ダミーを補充し、このロジックは凍結（変更禁止）。getSensorLogData() は再生時に sensor.timestamp を Date.now() で上書きし、videoTime は元値を保持する。pushSensorLogFile() は初回追加時に reset() を呼び、複数ファイルは sensorLogFilesIndex 順に連結して1走行として再生する。seekSensorLogData(videoTime) は reset() 後に minVideoTime<=videoTime<=maxVideoTime のファイルまで移動し、currentVideoTime>=videoTime まで1件ずつ前進する。実センサーとデモの切替は getSensorLogDataSize() > 0 でデモとする閾値0とし、middleware.sensor.service の判定と一致させる。テスト用の正準モックは qa.mockdata.sensorlog.generator が生成する sensor-log.<scenario>.<sensorMode>.txt.gz の9ファイル（cruise × smartphoneOnly/canConnected、accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong × canConnected）。schema / scenarios / 量子化 / 端末姿勢は qa.mockdata.sensorlog.schema および qa.mockdata.sensorlog.scenarios を真実源とし DemoData 側で定義しない。smartphoneOnly ログでは sensor.service 側の lastCanData ゼロ埋めにより CAN 版スコアが未算出（全項目100）となる既知の実装実態がある。2026年度改修要求は日産自動車提供の2資料（一次仕様 2026-08-04、要求仕様確認 2026-09-17）に基づく5本（①前回結果表示 ②タブ切り替え ③レーダーチャート ④BLE安定化 ⑤ヒヤリ録画データサイズ改善）で、開発は2026年11月末完了目標（12月から高齢者実験開始）。本ノードに関係するのは⑤で、ヒヤリ前後15秒の個別動画化により movieFile 単一動画前提の再生方式の見直しが必要になる可能性がある。連続ヒヤリ（30秒以内）は1本録画でも個別生成でもよく実装都合で選べるため、いずれの方式でもデモ再生が成立することを確認する必要がある。③のスコアロジックは打ち合わせ後まで凍結されており本ノードの入力仕様は変更なし。④に関連して CAN ペイロード長・割り当てが変更された場合はモックログの canData 符号化規則に波及する。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "センサログ 1 行は {date, sensor} 形式である",
      "statement": "DemoData が読み込むセンサログの 1 行は JSON オブジェクト {date, sensor} であり、DemoData は sensor 部分のみを使用する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "必須キー欠落行はスキップされる",
      "statement": "unzipped() は videoTime / geolocation / acceleration / gyroscope / magnetometer のいずれかを欠く行を読み飛ばす",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "canData 欠落時はゼロ値で補充される",
      "statement": "convertOldData() は sensor に canData が存在しない場合にゼロ値のダミー canData を補充する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "convertOldData のゼロ補充ロジックは変更しない",
      "statement": "convertOldData() における canData ゼロ補充の実装は本改修で変更してはならない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "再生時に timestamp を Date.now() で上書きする",
      "statement": "getSensorLogData() はサンプルを返す際に sensor.timestamp を取り出し時点の Date.now() に置き換える",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "videoTime は再生時に上書きしない",
      "statement": "DemoData はサンプル払い出し時に videoTime の元値を保持し、ログ内相対時刻の基準として使用する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "DemoData 件数閾値は 0 でデモ判定",
      "statement": "getSensorLogDataSize() が 0 より大きい場合にデモ再生モードと判定する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "デモ判定閾値は sensor.service と一致させる",
      "statement": "DemoData の件数閾値 0（>0 でデモ）は middleware.sensor.service の実センサー/デモ切替判定と一致していなければならない",
      "status": "candidate"
    },
    {
      "type": "external_integration_rule",
      "title": "正準モックログは qa.mockdata.sensorlog.generator が生成する",
      "statement": "DemoData が読み込む正準モックログは qa.mockdata.sensorlog.generator が生成する sensor-log.<scenario>.<sensorMode>.txt.gz である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "正準モックログは 9 ファイル構成である",
      "statement": "正準モックログは cruise × smartphoneOnly/canConnected の 2 ファイルと、accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong × canConnected の 7 ファイルの計 9 ファイルである",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "ログの schema と scenarios の真実源は QA 側にある",
      "statement": "センサログの schema / scenarios / 量子化 / 端末姿勢の定義は qa.mockdata.sensorlog.schema および qa.mockdata.sensorlog.scenarios に従う",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "複数ログファイルを時系列で連結再生する",
      "statement": "DemoData は sensorLogFiles に追加された複数ファイルを sensorLogFilesIndex 順に連結して 1 走行として再生する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "seek は videoTime 範囲でファイルを特定してから前進する",
      "statement": "seekSensorLogData(videoTime) は reset() 後に fileInfo.minVideoTime <= videoTime <= fileInfo.maxVideoTime を満たすファイルまで移動し、currentVideoTime >= videoTime に達するまで 1 件ずつ進める",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "初回ファイル追加時に再生位置が初期化される",
      "statement": "pushSensorLogFile() は最初のファイル追加時に reset() を呼び、再生を開始可能な状態にする",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "smartphoneOnly ログでは CAN 版スコアが未算出になる",
      "statement": "smartphoneOnly のログ再生時は sensor.service の lastCanData ゼロ埋めにより CAN 版スコアロジックが null を返し全項目 100 となる（実装実態）",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "DemoData はログ内容定義の責務を持たない",
      "statement": "DemoData の責務は再生と旧フォーマット互換変換に限定され、ログの schema・シナリオ・量子化・端末姿勢を定義してはならない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "デモ動画は webm で movieFile として参照される",
      "statement": "DemoData が保持する走行動画は webm 形式であり、ui.driving.page が movieFile を参照して再生する",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "連続ヒヤリの動画生成方式に依存しない再生が必要",
      "statement": "30 秒以内に連続したヒヤリが 1 本に録画される場合とヒヤリポイントごとに個別生成される場合の双方で、DemoData の動画再生が成立しなければならない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "正準モック 9 ファイルをアプリ側のどこから読み込むか（assets 同梱か、ui.edit.page からの手動アップロードのみか）が未確定。QA/UI 判断が必要で、決まらないと UC06 の自動テスト手順が定まらない。",
    "steer_* / mixed など canConnected 専用シナリオに対応する smartphoneOnly 版が存在しない理由（意図的な非対応か未生成か）が未確定。QA 判断が必要で、決まらないとスマホのみモードのカバレッジ評価ができない。",
    "timestamp を Date.now() で上書きする一方 videoTime は元値を保持するため、ログ内相対時刻と実時刻がずれる。スコアロジックが timestamp 差分に依存する場合の影響が未検証で、middleware.score-logic 側の確認が必要。",
    "必須キー欠落行の skip が発生した件数を sensorLogDataSize に反映するか（skip 後の実件数か行数か）が仕様上明示されておらず、デモ判定閾値 0 の境界挙動に影響する。",
    "convertOldData のゼロ補充 canData がどのフィールドをどの値（0 / shiftIndication=0 等）で埋めるかの完全なリストが未確定。DB/QA と要確認。",
    "ヒヤリ前後 15 秒の個別動画化に伴い、DemoData が単一 movieFile を前提とした再生方式を維持できるかが未確定。UI/Middleware（録画側）判断が必要で、決まらないと UC12 のデモ再生とマーカー追尾の実装方針が定まらない。",
    "CAN の BLE ペイロード長・バイト割り当てが変更されるかが未確定。変更された場合、正準モックログの canData 符号化規則と DemoData が再生する canData の解釈に影響する。"
  ],
  "rationale_notes": [
    "DemoData は『再生と互換変換』の責務のみを持ち、ログの内容定義（schema・シナリオ・量子化・端末姿勢）は QA 側モックデータ仕様を真実源とする。二重定義を避けるため本ノードでは参照に留める。",
    "convertOldData のゼロ補充は旧スマホのみログとの後方互換のための措置であり、変更すると過去ログの再生互換が壊れるため凍結する。ただし smartphoneOnly で CAN 版スコアが全項目 100 になる既知事象の原因の一部でもある。",
    "timestamp の Date.now() 上書きは、実センサー経路と同じ『到着時刻』セマンティクスを保つための意図的な処理。ログ内の相対時刻は videoTime が担う。",
    "デモ判定閾値を DemoData 側と sensor.service 側の二箇所に持つ構造は乖離リスクがあるため、値 0 の一致を仕様として明記した。",
    "2026 年度改修要求 5 本のうち本ノードに直接関係するのは⑤（ヒヤリ録画データサイズ改善）のみであり、①②③④は責務外として明示した。ただし④は CAN ペイロード変更経由でモックログに波及しうるため参照関係として残した。",
    "スコアロジックは打ち合わせ後まで凍結されているため、レーダーチャート化（6 項目・5 段階）が本ノードの入力仕様に与える変更はないと整理した。",
    "開発完了目標が 2026 年 11 月末であるため、convertOldData など互換系の凍結は改修スコープ縮小の観点でも妥当と判断した。"
  ]
}
```