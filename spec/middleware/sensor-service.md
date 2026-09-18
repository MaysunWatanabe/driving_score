<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-10 17:32:25 JST -->

```json
{
  "required_changes": [
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "デモ/実機の切替条件を『非Android判定』ではなく DemoData.getSensorLogDataSize()>0 に統一して記述し、実装とコメントの不一致を解消する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "infra.assets.geolocation(geolocation.json) を依存ではなく『未参照の死にアセット』として注記に降格する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "10ms集約の処理順序を『モード別ゲート評価 → ゼロ値補完 → repeat++ 等インクリメント → キャリブレーション → コールバック』として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "モード別必須センサー（全モードGPS必須、canDataOnly=GPS+canData、smartphoneOnly=GPS+加速度+方位+磁力計、combination=両方）を明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "ゲート対象外センサーへの構造化ゼロ値（acceleration/gyroscope/magnetometer/canData）と repeat=-1、interval=10 の固定値を仕様として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "acceleration.interval を 0 にしてはならない制約（calibrationTotalTime が 1100 に到達せず calibration が永久 false になる）を制約として明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "geolocation は全モード必須のためゼロ埋め対象外である旨を明記する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "smartphoneOnly の lastCanData ゼロ埋め(sensor.service.ts:463-466)により CAN 版指標が未発火となり全項目 100 の未算出となる実装実態を、是正是非を書かずに記録する"},
    {"node": "middleware.sensor.service", "entrypoint": "spec/middleware/sensor-service.md", "description": "BLE 受信コールバック直後（現行 L394）の logService.debug を毎回・無条件に出力する仕様として明記する（ble.ts・送信側・エミュレータは対象外）"}
  ],
  "suggested_impacts": [
    {"domain": "infra-agent", "severity": "should", "reason": "infra.assets.geolocation(geolocation.json) が現状どのモジュールからもロードされない死にアセットである点を infra 側仕様でも整合させる必要がある"},
    {"domain": "middleware-agent", "severity": "must", "reason": "モード別必須センサー定義は middleware.sensor.manager #28 のゲート条件と同一である必要があり、両ノードの記述を一致させる必要がある"},
    {"domain": "qa-agent", "severity": "must", "reason": "BLE 受信ごとの無条件 debug ログにより 10ms オーダーでログ量が増加し、デバッグログ書き出し（externalRootDirectory/Documents/driving-score/debug-log）の容量・フラッシュ挙動の確認が必要"},
    {"domain": "qa-agent", "severity": "should", "reason": "smartphoneOnly では CAN 版指標が未発火で全項目 100 の未算出となるため、期待値としてのスコア確認手順が影響を受ける"},
    {"domain": "ui-agent", "severity": "could", "reason": "smartphoneOnly 実行時の診断結果が全項目 100（未算出）で表示される実装実態があり、結果画面の解釈に影響する"}
  ],
  "requirements_context": "【SensorService の責務】SensorService は GPS(geolocation)/加速度(acceleration)/ジャイロ・方位(gyroscope)/磁力計(magnetometer)/BLE 経由 CAN(canData) を購読し、10ms 周期で最新値(lastXxx)を集約し、キャリブレーション処理を経て上位（診断・スコアロジック）のコールバックへ渡す。UC06(運転診断の実行)、UC11(センサーモード切替)、UC12(編集とデモ再生)から利用される。\n\n【データソース切替（デモ/実機）】デモ再生と実センサー購読の切替判定は DemoData.getSensorLogDataSize() の戻り値で行う。1 件以上（>0）のときは DemoData のセンサログを再生し、0 件のときは実センサーを購読する。判定は Android/非 Android のプラットフォーム判定ではなくデータ件数を正とし、非 Android 環境でも同じ条件で DemoData 再生が行われる。実装とソースコメントの記述はこの条件に一致させる（過去の『非 Android 時のみデモ再生』というコメント表現は誤りとして正す）。非 Android 時、DemoData.getSensorLogData() の geolocation は Ionic Storage の geolocation-last-pos-key に保存される。\n\n【geolocation.json（infra.assets.geolocation）】geolocation.json は現状どのモジュールからもロードされない死にアセットであり、SensorService も直接参照しない。デモ再生時の位置情報ソースは DemoData であって geolocation.json ではない。依存関係としては扱わず、注記として残す。\n\n【10ms 集約の処理順序】(1) モード別ゲート（middleware.sensor.manager #28）を最初に評価する。(2) ゲート成功後、かつ lastGeolocation.repeat++ 等のインクリメント処理より前に、ゲート対象外かつ null/undefined の lastXxx へ構造化ゼロ値を代入する。(3) その後にインクリメント、キャリブレーション、コールバック呼び出しを行う。ゲート評価前にゼロ値を代入してはならない（必須センサーの null を隠蔽してしまうため）。\n\n【モード別必須センサー（ゲート条件）】全モードで GPS(geolocation) が必須。canDataOnly は GPS + canData。smartphoneOnly は GPS + 加速度 + 方位(gyroscope) + 磁力計。combination は上記両方（GPS + 加速度 + 方位 + 磁力計 + canData）。必須センサーが非 null であることをゲートで確認する。\n\n【ゼロ値補完対象】canDataOnly では lastAcceleration / lastGyroscope / lastMagnetometer を補完する。smartphoneOnly では lastCanData を補完する。combination では補完しない。geolocation は全モード必須のためゼロ埋めしない。\n\n【構造化ゼロ値の定義】acceleration = {accelerationIncludingGravity:{x:0,y:0,z:0}, rotationRate:{beta:0,gamma:0,alpha:0}, interval:10, repeat:-1}、gyroscope = {beta:0,gamma:0,alpha:0,repeat:-1}、magnetometer = {x:0,y:0,z:0,repeat:-1}、canData = {vehicleSpeed:0,longAcc:0,latAcc:0,frontDistance:0,lateralDistance:0,steeringAngle:0,accelPedalPosition:0,brakePressure:0,brakeSwitch:0,shiftIndication:0,turnSignal:0,repeat:-1}。repeat は補完値であることを示すため -1 とする。acceleration.interval は 10 を用い、0 にしてはならない（interval=0 では calibrationTotalTime が 1100 に到達せず calibration が永久に false となり診断が開始しない）。\n\n【smartphoneOnly の未算出実装実態】sensor.service.ts:463-466 の smartphoneOnly における lastCanData ゼロ埋め（shiftIndication=0 等）により、CAN 版スコアロジックの全指標が発火しない。結果として scoreLogicFunction.txt L871-874 が null を返し、scoreList が空となり、全項目 100 の未算出状態となる。本仕様書ではこれを実装実態として記録するのみで、是正の是非は記述しない。\n\n【BLE 受信ログ】BLE 受信コールバック直後（現行 sensor.service.ts L394）の self.logService.debug('[DrivingScore][SensorService]', self.lastCanData) を毎回・無条件に有効化する（コメントアウトを外す）。サンプリング・条件分岐は設けない。ble.ts、送信側、LogService 本体、エミュレータ A/B は変更しない。デバッグログの書き出し先は {externalRootDirectory}/Documents/driving-score/debug-log/ 配下（既存仕様のまま）。\n\n【非変更範囲】ゲート条件そのもの、センサーリスナーの購読処理、score-logic、DemoData.convertOldData、正準モック 6 ファイル、センサーモード分岐の 3 種類（smartphoneOnly/canDataOnly/combination）構成、10ms 周期そのものは変更しない。",
  "fact_candidates": [
    {
      "type": "business_rule",
      "title": "デモ再生の判定は DemoData.getSensorLogDataSize()>0 である",
      "statement": "SensorService は DemoData.getSensorLogDataSize() が 1 以上のときデモセンサログを再生する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "センサログ 0 件のときは実センサーを購読する",
      "statement": "SensorService は DemoData.getSensorLogDataSize() が 0 のとき実センサーを購読する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "デモ/実機切替はプラットフォーム判定に依存しない",
      "statement": "SensorService のデモ/実機切替判定は Android/非 Android のプラットフォーム判定を条件に含めない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "非 Android でも DemoData 再生が行われる",
      "statement": "非 Android 環境においても DemoData.getSensorLogDataSize()>0 であれば DemoData のセンサログが再生される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "実装とコメントの記述を一致させる",
      "statement": "sensor.service.ts のデモ/実機切替に関するコメントは DemoData.getSensorLogDataSize()>0 という実装条件と一致した記述にする",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "geolocation.json はどのモジュールからもロードされない",
      "statement": "infra.assets.geolocation(geolocation.json) は現状どのモジュールからもロードされておらず死にアセットである",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "SensorService は geolocation.json を直接参照しない",
      "statement": "SensorService はデモ再生において geolocation.json を直接ロードせず DemoData 経由のデータのみを用いる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "非 Android 時に geolocation を Ionic Storage へ保存する",
      "statement": "SensorService は非 Android 時に DemoData.getSensorLogData() の geolocation を Ionic Storage の geolocation-last-pos-key に保存する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "10ms 周期でセンサー値を集約する",
      "statement": "SensorService は 10ms 周期で lastXxx のセンサー値を集約しキャリブレーション後にコールバックへ渡す",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "モード別ゲートを最初に評価する",
      "statement": "SensorService の 10ms 集約コールバックはモード別ゲート（必須センサーが非 null）を最初に評価する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "全モードで GPS が必須である",
      "statement": "SensorService のモード別ゲートは全センサーモードで geolocation を必須センサーとする",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "canDataOnly の必須センサーは GPS と canData である",
      "statement": "canDataOnly モードのゲートは geolocation と canData が非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "smartphoneOnly の必須センサーは GPS/加速度/方位/磁力計である",
      "statement": "smartphoneOnly モードのゲートは geolocation・acceleration・gyroscope(方位)・magnetometer が非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "validation_rule",
      "title": "combination の必須センサーは両系統すべてである",
      "statement": "combination モードのゲートは geolocation・acceleration・gyroscope・magnetometer・canData のすべてが非 null であることを要求する",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "ゼロ値補完はゲート成功後に行う",
      "statement": "ゲート対象外センサーへのゼロ値代入はモード別ゲートが成功した後に実行する",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "ゼロ値補完は repeat インクリメントより前に行う",
      "statement": "ゲート対象外センサーへのゼロ値代入は lastGeolocation.repeat++ 等のインクリメント処理より前に実行する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ゲート前にゼロ値を代入してはならない",
      "statement": "モード別ゲート評価より前にゲート対象外センサーへゼロ値を代入してはならない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "ゼロ値補完対象は null/undefined のみである",
      "statement": "ゼロ値代入はゲート対象外かつ値が null または undefined の lastXxx に対してのみ行う",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "canDataOnly では加速度/ジャイロ/磁力計をゼロ値で埋める",
      "statement": "canDataOnly モードでは lastAcceleration・lastGyroscope・lastMagnetometer にゼロ値を代入する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "smartphoneOnly では canData をゼロ値で埋める",
      "statement": "smartphoneOnly モードでは lastCanData にゼロ値を代入する",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "combination ではゼロ値補完を行わない",
      "statement": "combination モードではゲート対象外センサーが存在しないためゼロ値代入を行わない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "geolocation はゼロ埋めしない",
      "statement": "geolocation は全モードで必須センサーであるためゼロ値代入の対象外とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "acceleration のゼロ値定義",
      "statement": "acceleration のゼロ値は {accelerationIncludingGravity:{x:0,y:0,z:0}, rotationRate:{beta:0,gamma:0,alpha:0}, interval:10, repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "gyroscope のゼロ値定義",
      "statement": "gyroscope のゼロ値は {beta:0,gamma:0,alpha:0,repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "magnetometer のゼロ値定義",
      "statement": "magnetometer のゼロ値は {x:0,y:0,z:0,repeat:-1} とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "canData のゼロ値定義",
      "statement": "canData のゼロ値は vehicleSpeed/longAcc/latAcc/frontDistance/lateralDistance/steeringAngle/accelPedalPosition/brakePressure/brakeSwitch/shiftIndication/turnSignal をすべて 0、repeat を -1 とする",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "ゼロ値の repeat は -1 である",
      "statement": "ゼロ値代入された各センサー値の repeat は -1 とする",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "acceleration.interval を 0 にしてはならない",
      "statement": "ゼロ値の acceleration.interval は 10 とし 0 にしてはならない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "interval が 0 だとキャリブレーションが完了しない",
      "statement": "acceleration.interval が 0 の場合 calibrationTotalTime が 1100 に到達せず calibration が永久に false となる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "smartphoneOnly の lastCanData ゼロ埋め箇所",
      "statement": "sensor.service.ts:463-466 において smartphoneOnly 時に lastCanData が shiftIndication=0 等のゼロ値で埋められる",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "ゼロ埋めにより CAN 版指標が発火しない",
      "statement": "lastCanData のゼロ値により CAN 版スコアロジックの全指標が発火しない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "指標未発火時 scoreLogicFunction は null を返す",
      "statement": "指標が発火しない場合 scoreLogicFunction.txt L871-874 は null を返す",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "scoreList 空により全項目 100 の未算出となる",
      "statement": "scoreList が空の場合スコアは全項目 100 の未算出状態となる",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "未算出 100 の是正是非は本仕様に記述しない",
      "statement": "smartphoneOnly の未算出 100 は実装実態として記録し是正の是非は本仕様書に記述しない",
      "status": "approved"
    },
    {
      "type": "business_rule",
      "title": "BLE 受信直後の debug ログを無条件で出力する",
      "statement": "sensor.service.ts の BLE 受信コールバック直後（現行 L394）で logService.debug('[DrivingScore][SensorService]', lastCanData) を毎回・無条件に出力する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "BLE ログ有効化に伴う他モジュール変更は行わない",
      "statement": "BLE 受信ログの有効化に際し ble.ts・送信側・LogService 本体・エミュレータは変更しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "本変更でゲート条件・購読処理・score-logic は変更しない",
      "statement": "ゲート条件・センサーリスナー購読・score-logic・DemoData.convertOldData・正準モック 6 ファイルは変更しない",
      "status": "approved"
    },
    {
      "type": "state_rule",
      "title": "センサーモードは 3 種類である",
      "statement": "SensorService が扱うセンサーモードは smartphoneOnly / canDataOnly / combination の 3 種類である",
      "status": "approved"
    }
  ],
  "open_questions": [
    "Android 実機かつ DemoData.getSensorLogDataSize()>0 の場合にデモ再生が優先される挙動が意図どおりか未確定。実装条件を正とすると実機でセンサログが残存している間は実センサーが使われないため、UC06(運転診断)の実機動作に影響する。middleware/UI(設定・編集画面)側のデータクリア責務と併せて判断が必要",
    "DemoData のセンサログ件数が診断中に 0 から 1 以上へ変化した場合（記録中の追記）に切替判定を再評価するのか、開始時点の一度のみ評価するのかが未確定。センサー購読のライフサイクル仕様に影響する",
    "geolocation.json を今後利用予定があるのか（削除対象か将来接続予定か）は infra ドメインの判断が必要。放置すると死にアセットの扱いが宙ぶらりんになる",
    "smartphoneOnly の必須センサーに挙げられた『方位』が gyroscope（deviceorientation 由来）と magnetometer のどちらを指すか、命名レベルで曖昧。ゲート条件の一致確認のため middleware.sensor.manager #28 の定義との突合が必要",
    "BLE 受信ごとの無条件 debug ログにより debug-log の出力量が増大するが、許容上限・ローテーション有無が未確定。infra(ファイル書き出し)/QA(採取手順)の判断が必要",
    "smartphoneOnly で全項目 100 が返る未算出状態を UI がどう表示・区別するか（未算出であることの表現）は UI ドメインの判断が必要。是正是非は本ノードでは扱わない"
  ],
  "rationale_notes": [
    "デモ/実機の切替をデータ件数（getSensorLogDataSize()>0）で判定する構造は、プラットフォーム判定に依存しないため PC ブラウザ・エミュレータ・実機で同一コードパスを検証できる利点がある。一方で実機にログが残っている場合の優先順位という副作用があるため open_question として残す",
    "ゼロ値補完をゲート成功後に限定するのは、必須センサーの欠落（null）をゼロ値で隠蔽して診断が誤って成立することを防ぐため。ゲート＝入力妥当性検証、ゼロ値補完＝下流ロジックの null 安全化という責務分離である",
    "repeat=-1 は『実測値ではなく補完値である』ことを下流に伝えるためのセンチネル。score-logic が repeat を進行判定に使う箇所で補完値を実測と誤認しないための設計意図",
    "acceleration.interval のみ 0 を許さないのは、キャリブレーション経過時間を interval の積算で計測しているため。ゼロ値であっても時間軸に寄与する値は実効値（10ms）を保持する必要がある",
    "geolocation を全モード必須としているため、ゼロ値定義に geolocation を含めない。含めると『GPS 未取得でも診断が進む』という仕様矛盾が生じる",
    "smartphoneOnly の未算出 100 は、ゼロ値補完（null 安全化）とスコアロジック側の発火条件（CAN 値の変化を前提）が噛み合っていないことに起因する。本仕様書は実装実態の記録に留め、評価モデルの是非は score-logic ドメインおよび打ち合わせ判断に委ねる",
    "BLE ログを条件付き・サンプリングにせず毎回無条件としたのは、受信欠落・順序異常の解析にはサンプリングしたログでは不十分であるという判断（例外的な許可）。本番リリース時の扱いは別途判断が必要",
    "infra.assets.geolocation は依存グラフ上『依存』として残すと参照実態があるかのように読めるため、注記へ降格する。非 Android 時の geolocation は DemoData 由来であり geolocation.json 由来ではないため、Ionic Storage への保存事実と矛盾しない"
  ]
}
```