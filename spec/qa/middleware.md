# QA Test Specification — middleware

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: middleware / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 8
- **coverage_notes**: middleware ドメインの 9 ノード (log.service / login.service / map.service / score.logic / score.logicCan / score.logicSimple / sensor.demoData / sensor.manager / sensor.service) すべてに対して既存 QA が 0 本。特に検証必須の以下が未カバー: (1) login.service の autoLogin 3日(72h)境界・login/logout・lastLoginUserId 保持ルール、(2) score.logic の testScoreLogic 保存前検証・calculator 平均再計算・clearOldData 60s 削除、(3) sensor.service の repeat 属性・キャリブレーション 100ms-1100ms・センサーモード別 BLE 分岐・DemoData 終端異常通知、(4) sensor.manager の getRotationMatrix 自由落下失敗・roll>=45 横向き分岐、(5) log.service の 非Android no-op・3MB/5MB フラッシュ閾値・saveDefaultLogPath ではセンサログ書かない、(6) demoData の旧スキーマ互換変換 (msec→videoTime, gyroscope xyz→beta/gamma/alpha)・seekSensorLogData。middleware は UI を持たないサービス層のため、検証は『サービス API 呼び出し → 内部状態 / Storage / DB / コールバック引数』の観点で組む必要がある。
- **quality_notes**: 既存 QA が存在しないため API-only への偏りは現時点で無いが、middleware はサービス層でありユーザー DOM 操作は伴わない。verification は『呼び出し元 Page からの操作起点 → サービス state / Ionic Storage / SQLite への反映 → 再取得での再確認』を通すこと。単なる戻り値 true/false チェックで終わらせず、Storage キー (loginKey, lastLoginUserId, scoreLogicKey, settingSelectedSensorMode 等) や DB レコードの実状態まで確認する。
- **drift_notes**: 既存 QA が 0 本のため spec との drift 検出対象なし。ただし spec 内に unknowns 参照 (自動ログイン 3日 vs 72h の表記ゆれは同義と明記済 / 判定2 の10秒ハードコード / 能力指標 scoreA/B/C のダミー実装 / ログ保持期間ポリシー) があり、これらは fact 未確定のため QA priority を保留・低めに設定する。

---

## 検証シナリオ（追加）



### QA-MW-LOGIN-001 — 自動ログイン 3日(72時間)境界の成否

- **node_id**: `middleware.login.service`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: login-service.md の autoLogin: 'Date.now() - (1000*60*60*24*3) <= loginData.timestamp' が non-negotiable な境界条件。定数化されておらず回帰しやすいため境界テスト必須。

**検証手順**:

1. 前提: Storage loginKey.timestamp を『現在-72h+1分』(境界内) に設定し UC1263 の autoLogin() を呼ぶ

1. 期待 state: loginStatus=true / db.selectUser で userId !== '' が確認できる / 戻り値 true

1. 前提2: loginKey.timestamp を『現在-72h-1分』(境界外) に設定して autoLogin() を再実行

1. 期待 state2: loginStatus=false / 戻り値 false / DB 照合は走らない

1. 再確認: 既に loginStatus=true の状態で autoLogin() を呼ぶと即 false (再ログインしない)



### QA-MW-LOGIN-002 — logout 時 lastLoginUserId を保持し loginKey のみ削除する

- **node_id**: `middleware.login.service`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: login-service.md の logout: 'lastLoginUserId は削除しない' が明示的業務ルール。次回ログイン画面の userId 初期値に影響する重要な非削除保証。

**検証手順**:

1. 前提: login() 成功後 Storage に loginKey と lastLoginUserId が保存されている

1. 操作: UC1262/UC1263 の logout() を呼ぶ

1. 期待 state: loginUser が new User() / loginStatus=false / scoreId=-1

1. 期待 Storage: loginKey が削除されている / lastLoginUserId は残っている

1. 再確認: getLastLoginUserId() が logout 前の userId を返す



### QA-MW-LOGIN-003 — insert/update/delete が必ず先に logout を実行する

- **node_id**: `middleware.login.service`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: login-service.md 業務ルール『ユーザー操作前に必ず logout() を実行する運用（重要）』。UC1264/UC1265/UC1266 の副作用として実装依存が強く、抜けると認証状態が不整合になる。

**検証手順**:

1. 前提: login() でログイン済み (loginStatus=true) 状態

1. 操作: UC1264 insert(user) を呼ぶ

1. 期待 state: DB 操作前に loginStatus=false / loginKey 削除が行われている / insert 後 user.userId !== '' で戻り値 true

1. 操作2: UC1266 delete(userId) を呼ぶ

1. 期待 state2: logout 実行 → storage.remove(lastLoginUserId) → db.deleteUser(userId) の順で user/score/score_history/capability_score のユーザー単位レコードが削除される

1. 再確認: 削除後に同 userId で login() すると失敗する



### QA-MW-LOGIN-004 — 非Android環境での settings 強制上書き

- **node_id**: `middleware.login.service`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: login-service.md initialize step4: 'Android 以外では recording=false, gpsDemo=true, logStorage=false, sensorLogStorage=false を強制'。ブラウザ検証(UC1273)時の挙動保証に不可欠。

**検証手順**:

1. 前提: 非Android(ブラウザ)環境で Storage に settingRecording=true 等が保存されている

1. 操作: initialize() を実行

1. 期待 state: settings.recording=false / gpsDemo=true / logStorage=false / sensorLogStorage=false に強制される (Storage 値を無視)

1. 再確認: initialize 後に settings を read しても強制値のまま



### QA-MW-LOGIN-005 — initialize での scoreLogicJson 設定展開と null スキップ

- **node_id**: `middleware.login.service`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: login-service.md initialize step5: scoreLogicJsonKey を parse し orderOfMessage / label.* / scoreLogicInterval / capabilityScoreTargetDays / scoreShowStar を上書き、null なら以降スキップ。設定 drift の起点になる。

**検証手順**:

1. 前提: Storage scoreLogicJsonKey に settings を含む有効 JSON を保存

1. 操作: initialize() を実行

1. 期待 state: settings.orderOfMessage / label.label1..labelC / scoreLogicInterval / capabilityScoreTargetDays / scoreShowStar.area1/2/3 が JSON 値で上書きされる

1. 前提2: scoreLogicJsonKey が null または settings 無しの JSON の場合

1. 期待 state2: 既定値 (orderOfMessage=0, scoreLogicInterval=300, capabilityScoreTargetDays=30 等) が保持される



### QA-MW-SCORE-001 — testScoreLogic による保存前検証の成功/失敗

- **node_id**: `middleware.score.logic`
- **priority**: `must`
- **applicable_roles**: operator, developer
- **rationale**: score-logic.md static testScoreLogic は UC1271/UC1273 の保存前検証の中核。成功時 true / 失敗時スタックトレース文字列、http://localhost→scoreLogic 置換が non-negotiable。

**検証手順**:

1. 操作: UC1273 で構文的に正しい ScoreLogic テキストを testScoreLogic() に渡す

1. 期待 戻り値: true (けいゆう病院前交差点のダミーセンサーで1回実行され例外なし)

1. 操作2: 実行時例外を起こすロジックを渡す

1. 期待 戻り値2: スタックトレース文字列が返り、http://localhost… が 'scoreLogic' に置換されている

1. 後続: UC1271 で true のときのみ Storage(scoreLogicKey) が更新され、失敗時は Storage が更新されないことを再取得で確認



### QA-MW-SCORE-002 — clearOldData が 60秒より古いサンプルを全リストから削除

- **node_id**: `middleware.score.logic`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: score-logic.md clearOldData: environment.sensorStockTime=60000ms より古いサンプルを geolocation/acceleration/gyroscope/magnetometer/canData の 5 リストからまとめて削除。メモリリークと診断精度に直結する境界条件。

**検証手順**:

1. 前提: start() 後、各リストに timestamp が『現在-61秒』と『現在-59秒』のサンプルを混在させる

1. 操作: setInterval 1 tick (clearOldData) を実行

1. 期待 state: 5 リストすべてから 61秒前サンプルが先頭削除され、59秒前サンプルは残る

1. 再確認: リスト長が期待どおり減っている



### QA-MW-SCORE-003 — calculator の走行内平均再計算 (initialize=false と -1 のスキップ)

- **node_id**: `middleware.score.logic`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: score-logic.md calculator: scoreList 全走査で平均再計算、initialize=false と値-1 はスキップ、0件フィールドは前回値(既定100)保持。UC1267 の走行結果の正しさに直結。

**検証手順**:

1. 前提: scoreList に overAll={90, -1, 80(initialize=false)} のスコアを積む

1. 操作: calculator() を呼ぶ

1. 期待 state: overAll 平均が有効値(90)のみで算出される (-1 と initialize=false は除外)

1. 前提2: 全スコアが -1 のフィールド

1. 期待 state2: 該当フィールドは前回値(既定100)を保持



### QA-MW-SCORE-004 — start() 直後に空 Score を即通知する

- **node_id**: `middleware.score.logic`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: score-logic.md start step4: setTimeout(0) で new Score(null, Date.now()) を即座に func に渡す。UC1267 の診断開始時の初期表示挙動に必要。

**検証手順**:

1. 操作: UC1267 の診断開始で start(interval, func) を呼ぶ

1. 期待コールバック: setInterval の初回 tick を待たず func に空 Score (data=null) が1回渡される

1. 期待 state: isStart=true / isPause=false / scoreOverAll=score1..4=100 に初期化



### QA-MW-SCORE-005 — pushSensorData が calibration 未完了サンプルを push しない

- **node_id**: `middleware.score.logic`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: score-logic.md pushSensorData: isStart=false なら return / calibration=true のときのみ各リストに push。キャリブレーション中サンプル混入を防ぐ non-negotiable 条件。

**検証手順**:

1. 前提: isStart=false でpushSensorData を呼ぶ

1. 期待: 何もリストに追加されない (早期return)

1. 前提2: isStart=true, sensorData.calibration=false のサンプル

1. 期待2: log.service.sensor() へは流すが 各リストへは push しない

1. 前提3: calibration=true のサンプル

1. 期待3: geolocation/acceleration/gyroscope/magnetometer/canData に timestamp 付きで push される



### QA-MW-SENSOR-001 — センサーモード別 BLE 接続分岐

- **node_id**: `middleware.sensor.service`
- **priority**: `should`
- **applicable_roles**: operator, driver
- **rationale**: sensor-service.md 業務ルール: smartphoneOnly は BLE スキップ・CAN空、canDataOnly/combination は BLE 接続。UC1272 の設定切替がセンサー集約に正しく反映されるか。

**検証手順**:

1. 前提: UC1272 で settings.selectedSensorMode='smartphoneOnly' を設定

1. 操作: start(listener) を呼ぶ

1. 期待: bleDevice.start が呼ばれない / lastCanData がフォールバック {repeat:-1} のまま集約される

1. 前提2: selectedSensorMode='combination' に切替

1. 期待2: bleDevice.start(cb) が購読され、12バイト buffer デコード結果が lastCanData に反映される



### QA-MW-SENSOR-002 — 10ms タイマの repeat カウントと初期化未完了時の集約スキップ

- **node_id**: `middleware.sensor.service`
- **priority**: `must`
- **applicable_roles**: driver
- **rationale**: sensor-service.md startSensorTimer: runScoreLogic=false なら return、実センサで last* のいずれか null なら return、各 repeat++ (0=新規有効, 1以上=使い回し)。score.logicCan の searchIndex が repeat==0 のみ有効とするため相互依存の要。

**検証手順**:

1. 前提: runScoreLogic=true だが lastAcceleration=null

1. 操作: sensorTimer 1 tick

1. 期待: sensorListenerFunc が診断用(flag=false)で呼ばれない (初期化未完で return)

1. 前提2: 全 last* が揃った状態で連続 2 tick

1. 期待2: 1tick目で repeat=0 のサンプル、次tickで新値なければ同サンプルが repeat=1 で渡る

1. 再確認: lastCanData=null のとき {repeat:-1} フォールバックで集約される



### QA-MW-SENSOR-003 — DemoData 終端到達時の異常終了通知

- **node_id**: `middleware.sensor.service`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: sensor-service.md startSensorTimer(Demo): getSensorLogData()=undefined なら sensorListenerFunc('Geolocation', null, false) で異常終了通知。UC1273 デモ再生の終端ハンドリングに不可欠。

**検証手順**:

1. 前提: UC1273 でセンサログを全件消費した状態 (getSensorLogData が undefined を返す)

1. 操作: sensorTimer 1 tick

1. 期待コールバック: sensorListenerFunc('Geolocation', null, false) が呼ばれ、呼び出し元(driving/edit)が診断終了を検知する

1. 期待副作用: 10回に1度の地図更新通知(flag=true)は発火しない



### QA-MW-SENSOR-004 — getLastLatLng 未取得時の横浜みなとみらいフォールバック

- **node_id**: `middleware.sensor.service`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: sensor-service.md getLastLatLng: 未取得なら {lat:35.46360426879202, lng:139.62615701335773} を返す。UC1267 診断開始時の地図初期中心に影響する定数値保証。

**検証手順**:

1. 前提: Ionic Storage の geolocation-last-pos-key が未保存

1. 操作: getLastLatLng() を呼ぶ

1. 期待戻り値: {lat:35.46360426879202, lng:139.62615701335773}

1. 前提2: GPS 取得成功後に Storage が更新済み

1. 期待戻り値2: 保存された最新 lat/lng が返る



### QA-MW-SENSORMGR-001 — キャリブレーション期間 (100ms〜1100ms) の完了判定

- **node_id**: `middleware.sensor.manager`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: sensor-manager.md: SKIP=100ms 破棄 + SET=1000ms 収集で 1100ms 完了、calculateCalibrationOffset が完了で true/収集中 false。診断開始ごとに再キャリブレーションされる境界条件。

**検証手順**:

1. 前提: initializeCalibration() でオフセット全0リセット

1. 操作: totalTime 0〜100ms のサンプルを calibration() に投入

1. 期待: SKIP期間はサンプル蓄積されず calibration=false

1. 操作2: totalTime 100〜1100ms のサンプルを投入

1. 期待2: calibrationSensorData に蓄積 / 1100ms 到達で平均オフセット算出 → calibration=true

1. 再確認: 完了後 sensorData.offset/orientation が calibrationOffset の値で書き込まれる



### QA-MW-SENSORMGR-002 — getRotationMatrix が自由落下相当で失敗を返す

- **node_id**: `middleware.sensor.manager`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: sensor-manager.md: getRotationMatrix は normsqA < 0.01*9.81² なら false を返す。キャリブレーション失敗ハンドリングの fail 条件。

**検証手順**:

1. 操作: 加速度ノルム² が 0.01*9.81² 未満のサンプルで getRotationMatrix を呼ぶ

1. 期待戻り値: false (回転行列算出失敗)

1. 後続: calibration() が該当サンプルで完了扱いにならず、有効サンプルまで収集を継続する



### QA-MW-SENSORMGR-003 — roll>=45度での横向き座標補正分岐

- **node_id**: `middleware.sensor.manager`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: sensor-manager.md rotateVector: |roll| >= 45 で端末横向きと判定し x/y 反転、roll符号で pitch補正切替。端末向き別の座標変換の分岐カバレッジ。

**検証手順**:

1. 前提: orientation.roll=44度 のサンプル

1. 操作: rotateVector([x,y,z]) を実行

1. 期待: 縦向き補正 (x/y 非反転) が適用される

1. 前提2: roll=46度 / roll=-46度

1. 期待2: 横向き補正で x/y 反転、roll符号に応じた pitch補正が適用され rotate.{x,y,z} が縦向き時と異なる



### QA-MW-LOG-001 — 非Android環境で LogService が完全 no-op

- **node_id**: `middleware.log.service`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: log-service.md: 非Android は initialize が即 return し、debug/error/sensor は console のみでファイル書き出ししない。UC1273 ブラウザ検証で誤ってファイル操作が走らない保証。

**検証手順**:

1. 前提: 非Android環境で initialize(file) を呼ぶ

1. 期待: 即 return / createDir が呼ばれない / saveDefaultLogPath 未設定

1. 操作: debug()/error()/sensor() を呼ぶ

1. 期待: console.log/console.error にのみ出力 / file.writeFile が一切呼ばれない



### QA-MW-LOG-002 — ログ書き出し閾値 (通常3MB / センサ5MB) とファイル名形式

- **node_id**: `middleware.log.service`
- **priority**: `should`
- **applicable_roles**: operator
- **rationale**: log-service.md: stockLogLength>=3,000,000 でフラッシュ log.YYYYMMDD-HHMMSS.txt.gz、sensor は 5,000,000 で sensor-log.… 。gzip は pako、replace:true。閾値回帰しやすい境界。

**検証手順**:

1. 前提: Android実機 + hasLogStorage=true。バッファ長 2,999,999 で debug() を呼ぶ

1. 期待: フラッシュされず writeFile 未実行

1. 操作: 3,000,000 到達で debug() を呼ぶ

1. 期待: pako.gzip でファイル名 log.YYYYMMDD-HHMMSS.txt.gz が {replace:true} で書き込まれ、stockLog がクリアされる

1. 再確認: センサログは 5,000,000 閾値で sensor-log.… に書き込まれる



### QA-MW-LOG-003 — saveDefaultLogPath ではセンサログを書かず、診断中パスへ切替後に書く

- **node_id**: `middleware.log.service`
- **priority**: `should`
- **applicable_roles**: driver, operator
- **rationale**: log-service.md sensor(): saveLogPath===saveDefaultLogPath なら早期return。setLogDir/resetLogDir が force フラッシュしてパス切替。UC1267 診断中のみセンサログ保存する non-negotiable 条件。

**検証手順**:

1. 前提: saveLogPath=saveDefaultLogPath(debug-log) のまま sensor(data) を呼ぶ

1. 期待: 早期return でセンサバッファに追記されない

1. 操作: setLogDir('data.<日時>') でパス切替 (切替時に既存バッファを force フラッシュ)

1. 期待: 以降 sensor(data) がバッファに追記される

1. 再確認: resetLogDir() で saveDefaultLogPath に戻ると再びセンサログが書かれない



### QA-MW-DEMO-001 — 旧ログスキーマの互換変換 (msec→videoTime / gyroscope xyz→beta/gamma/alpha)

- **node_id**: `middleware.sensor.demoData`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: sensor-demoData.md unzipped/convertOldData: 旧スキーマの msec→videoTime、gyroscope.{x,y,z}→{beta,gamma,alpha}、acceleration.gravity_xyz→accelerationIncludingGravity 変換と必須フィールド欠落行スキップ。UC1273 の過去ログ再生互換に必須。

**検証手順**:

1. 前提: UC1273 で旧スキーマ(msec / gyroscope.x,y,z)を含む gzip+Base64 ログをアップロード

1. 操作: pushSensorLogFile() → getSensorLogData()

1. 期待: 取り出したサンプルが videoTime / gyroscope.{beta,gamma,alpha} に正規化されている

1. 期待2: videoTime/geolocation/acceleration/gyroscope/magnetometer が欠ける行はスキップされ件数に含まれない

1. 期待3: canData 無しの旧ログはゼロ値ダミーが補充される

1. 再確認: sensor.timestamp が取り出し時点の Date.now() に置換されている



### QA-MW-DEMO-002 — 複数ファイル連結再生と seekSensorLogData による videoTime シーク

- **node_id**: `middleware.sensor.demoData`
- **priority**: `should`
- **applicable_roles**: driver, developer
- **rationale**: sensor-demoData.md: 1走行=複数ファイルを時系列連結、getSensorLogData 末尾で次ファイル load、seekSensorLogData は minVideoTime<=t<=maxVideoTime のファイルまで移動。UC1269 ヒヤリ地点の動画同期再生に不可欠。

**検証手順**:

1. 前提: 2 ファイル分のログを pushSensorLogFile で追加 (初回追加で reset→即再生開始)

1. 操作: getSensorLogData() を全件連続取得

1. 期待: ファイル1終端で自動的にファイル2へ load され連結再生、全件消費後 undefined

1. 操作2: UC1269 で seekSensorLogData(videoTime) を呼ぶ

1. 期待2: 該当 fileInfo(minVideoTime<=t<=maxVideoTime)まで移動し currentVideoTime>=videoTime のサンプルで停止

1. 再確認: getSensorLogDataSize() が全ファイル合計件数を返す



### QA-MW-MAP-001 — 軌跡円マーカーの距離しきい値スキップと1000個上限

- **node_id**: `middleware.map.service`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: map-service.md drawCircleMarker: 直前とのユークリッド距離(deg) <0.0006 ならスキップ、1000個超で先頭削除。UC1267/UC1269 の軌跡描画のメモリ/描画負荷を保証する境界条件。

**検証手順**:

1. 前提: createMap 済みで直前軌跡点が存在

1. 操作: 直前から距離 0.0005deg の点を drawCircleMarker

1. 期待: circleMarkers に追加されない (スキップ)

1. 操作2: 距離 0.0007deg の点を追加

1. 期待2: circleMarkers に追加される

1. 操作3: 1001個目を追加

1. 期待3: 先頭の円マーカーが setMap(null)+配列先頭削除され上限1000が維持される



### QA-MW-MAP-002 — シングルトン共有によるマーカー永続と removeAll/clearMarker の呼び分け

- **node_id**: `middleware.map.service`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: map-service.md: providedIn:root のシングルトンでマーカー配列が持続、removeAll(map=null含む) と clearMarker(配列のみ) の呼び分けが必要。UC1268→UC1269 のページ遷移でヒヤリマーカーが誤って残る/消えるリスクの回帰。

**検証手順**:

1. 前提: opening→driving でヒヤリマーカーを drawMarker で複数描画

1. 操作: badspot ページへ遷移し createMap を再実行

1. 期待: 既存 markers/circleMarkers/S/E/car が新 map に再アタッチされる (シングルトン共有)

1. 操作2: clearMarker() を呼ぶ

1. 期待2: ヒヤリ/軌跡円/S/E がすべて setMap(null) され配列が空、map インスタンスは残る

1. 操作3: removeAll() を呼ぶ

1. 期待3: stop()+clearMarker()+clearCarMarker() 実行後 map=null になる



### QA-MW-MAP-003 — setBigMarkerIcon による選択ヒヤリマーカーの拡大排他表示

- **node_id**: `middleware.map.service`
- **priority**: `nice`
- **applicable_roles**: driver
- **rationale**: map-service.md setBigMarkerIcon: 指定posのみ hiyar_big.png(60x60)、他は hiyari.png(40x40) にリセット。UC1269 で1点ずつヒヤリ地点を確認する際の視覚フィードバック保証。

**検証手順**:

1. 前提: 複数のヒヤリマーカーが描画済み

1. 操作: UC1269 で setBigMarkerIcon(2) を呼ぶ

1. 期待: index2 が 60x60 に、他は 40x40 にリセットされる (排他)

1. 操作2: setSelectMarkerPos(2) と連動し getSelectMarkerPos() が 2 を返す

1. 操作3: resetMarkerIcon()

1. 期待3: すべて 40x40 に戻る



### QA-MW-SCORE-LOGIC-001 — スコアロジック本体の selectedSensorMode 別切替 (simple/can) - spec gap

- **node_id**: `middleware.score.logic`
- **priority**: `should`
- **applicable_roles**: operator, driver
- **rationale**: spec gap: score-logic.md/score-logicSimple.md/score-logicCan.md に『Storage テキスト差し替えで切替』とあるが、UC1272 のセンサーモード切替と実際にどのロジック本体(simple/can)が Storage に書かれるかの結線が spec 未記載。UC1272→UC1267 で smartphoneOnly なら simple、combination/canDataOnly なら can が動作するか要検証。

**検証手順**:

1. 前提: UC1272 で smartphoneOnly を選択

1. 操作: UC1267 で診断開始し score.logic の scoreLogicFunction を実行

1. 期待(推定): simple ロジック(加速度z<=-1.8, |gamma|>=35 減点方式)が動作

1. 前提2: combination を選択

1. 期待2(推定): can ロジック(shiftIndication/vehicleSpeed 判定)が動作

1. 再確認: 切替が Storage 上のどのキーで永続化されるか (spec 補強が必要)





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `QA-MW-LOGIN-001` → **must** : autoLogin 3日境界は認証セキュリティの核。定数化されておらず回帰しやすい

- `QA-MW-LOGIN-002` → **must** : lastLoginUserId 非削除は明示的業務ルールで UX に直結

- `QA-MW-LOGIN-003` → **must** : insert/update/delete 前 logout は『重要』明記の non-negotiable

- `QA-MW-SCORE-001` → **must** : testScoreLogic は不正ロジック保存を防ぐ保存前検証の中核

- `QA-MW-SENSOR-002` → **must** : repeat カウントは score.logicCan の searchIndex と相互依存し診断精度を左右

- `QA-MW-LOGIN-004` → **should** : 非Android強制上書きだがブラウザ検証限定

- `QA-MW-SCORE-002` → **should** : 60s 削除はメモリ/精度に影響するが結果表示より内部処理寄り

- `QA-MW-SENSORMGR-002` → **nice** : 自由落下 fail 分岐はレアケース

- `QA-MW-SENSORMGR-003` → **nice** : 横向き座標補正は分岐カバレッジ目的で優先度低

- `QA-MW-SENSOR-004` → **nice** : 地図初期中心のフォールバック定数、UX 影響小

- `QA-MW-MAP-003` → **nice** : 視覚フィードバックで機能破綻には至らない

- `QA-MW-SCORE-LOGIC-001` → **should** : spec gap のため確定前は must にしない



---

## Open Questions



### センサーモード切替とスコアロジック本体差し替えの結線

- **質問**: UC1272 のセンサーモード(smartphoneOnly/canDataOnly/combination)切替時に、Storage の scoreLogicKey へ scoreLogicFunction_simple.txt / scoreLogicFunction.txt のどちらを書き込むか、その永続化キーと自動差し替えのトリガが spec に未記載。sensor.service は selectedSensorMode で BLE 接続を分岐するが、score.logic 側のロジック本体差し替え主体(UI/service どちら)が不明。
- **保留中の判断**: QA-MW-SCORE-LOGIC-001


### ログ/センサログの保持期間ポリシー

- **質問**: log-service.md 業務ルールで『ログは PII を含む可能性があり infra.file.storage の保持期間ポリシーは spec/unknowns.md を参照』とある。Documents/driving-score/ 配下の gz ファイルの削除タイミング・上限容量が未確定のため、蓄積上限/ローテーション/削除の QA を追加できない。
- **保留中の判断**: (なし)


### score.logicSimple の能力指標ダミー実装の扱い

- **質問**: score-logicSimple.md の scoreA/B/C は 1% 確率で Math.random()*100 を返すダミーで医学的意味を持たない。この値を UC1270 の能力指標タブ(過去N日平均)にどう表示/非表示するかが未確定で、能力指標の検証観点(期待値)を確定できない。
- **保留中の判断**: (なし)


### 判定2 の中高速直進 10秒継続のハードコード閾値

- **質問**: score-logicCan.md 判定2 の『10秒継続』はハードコードで spec/unknowns.md に運用ルール確認事項として記載。閾値の可変性/検証時の許容誤差が未確定のため、判定2 発火条件の QA を確定できない。
- **保留中の判断**: (なし)




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/middleware-login.md`

- `spec/qa/middleware-score.md`

- `spec/qa/middleware-sensor.md`

- `spec/qa/middleware-log.md`

- `spec/qa/middleware-demoData.md`

- `spec/qa/middleware-map.md`


