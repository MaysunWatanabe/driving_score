<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:32:04 JST -->

```json
{
  "required_changes": [
    {"node": "middleware.sensor.demoData", "entrypoint": "spec/middleware/sensor-demoData.md", "description": "正準モックログ 9 ファイルの命名規則・入力スキーマ前提・skip 条件・canData ゼロ補充・timestamp 上書き・DemoData 件数閾値0を明記する"}
  ],
  "suggested_impacts": [
    {"domain": "qa", "severity": "must", "reason": "正準モック sensor-log.<scenario>.<sensorMode>.txt.gz 9ファイルの生成・schema・scenarios は qa.mockdata.sensorlog.* を真実源とするため整合確認が必要"},
    {"domain": "middleware", "severity": "must", "reason": "DemoData 件数閾値0（>0でデモ）の判定は middleware.sensor.service 側の実センサー/デモ切替と一致させる必要がある"},
    {"domain": "ui", "severity": "should", "reason": "ui.edit.page のアップロード、ui.driving.page の movieFile 参照がデモ再生の前提となる"}
  ],
  "requirements_context": "DemoData は gzip+Base64 のセンサログ（JSON Lines、1行 = {date, sensor}）と webm 動画を再生するシングルトン。UC12（編集とデモ再生）・UC06（運転診断の実行）で使用。入力行のうち必須キー（videoTime/geolocation/acceleration/gyroscope/magnetometer）を欠く行は skip する。canData が欠落する旧スマホのみログでは convertOldData がゼロ値ダミーを補充する（このロジックは変更しない）。getSensorLogData() は再生時に sensor.timestamp を Date.now() で上書きする。テスト用の正準モックは qa.mockdata.sensorlog.generator が生成する sensor-log.<scenario>.<sensorMode>.txt.gz の 9 ファイル（cruise × smartphoneOnly/canConnected、accel_decel / hard_brake / sharp_curve / mixed / steer_stable / steer_wobble_weak / steer_wobble_strong × canConnected）。ログの schema / scenarios / 量子化 / 端末姿勢は qa.mockdata.sensorlog.schema および qa.mockdata.sensorlog.scenarios に従い、DemoData 側で定義しない。実センサーとデモの切替は getSensorLogDataSize() > 0 でデモとする閾値 0 とし、middleware.sensor.service の判定と一致させる。smartphoneOnly のログでは sensor.service 側の lastCanData ゼロ埋めにより CAN 版スコアが未算出（全項目100）となる既知の実装実態がある。",
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
    }
  ],
  "open_questions": [
    "正準モック 9 ファイルをアプリ側のどこから読み込むか（assets 同梱か、ui.edit.page からの手動アップロードのみか）が未確定。QA/UI 判断が必要で、決まらないと UC06 の自動テスト手順が定まらない。",
    "steer_* / mixed など canConnected 専用シナリオに対応する smartphoneOnly 版が存在しない理由（意図的な非対応か未生成か）が未確定。QA 判断が必要で、決まらないとスマホのみモードのカバレッジ評価ができない。",
    "timestamp を Date.now() で上書きする一方 videoTime は元値を保持するため、ログ内相対時刻と実時刻がずれる。スコアロジックが timestamp 差分に依存する場合の影響が未検証で、middleware.score-logic 側の確認が必要。",
    "必須キー欠落行の skip が発生した件数を sensorLogDataSize に反映するか（skip 後の実件数か行数か）が仕様上明示されておらず、デモ判定閾値 0 の境界挙動に影響する。",
    "convertOldData のゼロ補充 canData がどのフィールドをどの値（0 / shiftIndication=0 等）で埋めるかの完全なリストが未確定。DB/QA と要確認。"
  ],
  "rationale_notes": [
    "DemoData は『再生と互換変換』の責務のみを持ち、ログの内容定義（schema・シナリオ・量子化・端末姿勢）は QA 側モックデータ仕様を真実源とする。二重定義を避けるため本ノードでは参照に留める。",
    "convertOldData のゼロ補充は旧スマホのみログとの後方互換のための措置であり、変更すると過去ログの再生互換が壊れるため凍結する。ただし smartphoneOnly で CAN 版スコアが全項目 100 になる既知事象の原因の一部でもある。",
    "timestamp の Date.now() 上書きは、実センサー経路と同じ『到着時刻』セマンティクスを保つための意図的な処理。ログ内の相対時刻は videoTime が担う。",
    "デモ判定閾値を DemoData 側と sensor.service 側で二箇所に持つ構造は乖離リスクがあるため、値 0 の一致を仕様として明記した。"
  ]
}
```