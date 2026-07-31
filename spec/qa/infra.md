# QA Test Specification — infra

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: infra / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 8
- **coverage_notes**: 既存 QA が 0 件のため infra ドメインのほぼ全ノードが未検証。特に infra.ble.device（3秒スキャン後の 0/1/複数件分岐・エラーダイアログ・リトライ）、infra.file.storage（設定 ON/OFF による no-op、既定パス時のセンサログ抑止、3MB/5MB フラッシュ閾値、force フラッシュ）、infra.cordova.sensors（起動時パーミッション順次要求、runScoreLogic フラグによる早期リターン差分、GPS はフラグ非依存で保存）、infra.assets.scoreLogicJson（version 比較による上書き規則・parse 例外時の据え置き）、infra.google.maps（1回だけロード・isInitialize 再ロード防止）が一切カバーされていない。infra.assets.geolocation は設計意図と実装が未接続のため QA 対象は限定的だが drift 記録が必要。
- **quality_notes**: 既存 QA が存在しないため API smoke 偏りの評価は不可。infra は UI を伴わない基盤挙動が多いため、ユーザー操作起点（診断開始・設定変更・アップロード）から Storage/外部ストレージ/BLE 接続状態までを通した業務シナリオで検証すべき。単なる関数呼び出し確認ではなく、設定 ON/OFF・端末状態（Bluetooth 無効等）の分岐を通す必要がある。
- **drift_notes**: 1) infra.assets.geolocation: gpsDemo=true 時に geolocation.json を再生する設計意図があるが middleware.sensor.service は未接続（設計と実装の齟齬、spec/unknowns.md 記録済）。QA では『現状は再生されない』ことを負の確認として固定すべき。2) infra.cordova.sensors: WRITE_EXTERNAL_STORAGE が Manifest 未宣言だが requestPermission() は呼ばれる。3) infra.google.maps: API キーが environment.ts と AndroidManifest.xml の2箇所で異なる平文値で管理されている（ガバナンス懸念、spec/unknowns.md）。4) sqlite-porter は依存追加のみでコード呼び出しなし。既存 QA が無いため厳密な drift ではないが、これらは QA で挙動固定すべき箇所。

---

## 検証シナリオ（追加）



### TC-INFRA-BLE-001 — BLE スキャン結果件数による接続分岐（0/1/複数）

- **node_id**: `infra.ble.device`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: spec/infra/ble-device.md の scanStart() non-negotiable: 3秒後に件数で 0→showConnectFailedDialog / 1→自動 connect / 複数→ラジオ選択ダイアログ。既存 QA が 0 件で最重要の分岐が未検証。

**検証手順**:

1. ユーザー操作: canDataOnly / combination モードで運転診断を開始し BLE 接続を発火させる

1. 期待挙動(0件): 3秒経過後に stopLEScan が呼ばれ、'Bluetooth接続に失敗しました。' ダイアログが表示される

1. 期待挙動(1件): scanDeviceIds[0] に対して connect(deviceId) が自動実行され、通知購読が開始する

1. 期待挙動(複数件): showConnectDialog がラジオ選択（先頭 checked=true）で表示され、無条件に先頭選択はしない。OK 押下で選択 deviceId へ connect

1. 期待状態: connect 成功後 connectDevices に接続情報が push され startNotification が呼ばれる



### TC-INFRA-BLE-002 — Bluetooth 無効・接続失敗時のエラーダイアログとリトライ

- **node_id**: `infra.ble.device`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: spec/infra/ble-device.md: start() 失敗時 showStartErrorDialog を表示し false を返す。showConnectFailedDialog のリトライで scanStart() を再実行する fail 経路。エラーパス検証が未整備。

**検証手順**:

1. ユーザー操作: 端末 Bluetooth を無効化した状態で診断（CAN 系モード）を開始

1. 期待 DOM 反映: 'Bluetoothが無効になっています…' ダイアログが表示され、start() が false を返す

1. 期待 DOM 反映(接続失敗): showConnectFailedDialog のリトライ押下で scanStart() が再度実行される

1. 期待状態: 失敗時にセンサーサービス側が接続確立していないこと（通知購読が張られていない）を確認



### TC-INFRA-BLE-003 — BLE stop() による通知購読・接続の完全解除

- **node_id**: `infra.ble.device`
- **priority**: `must`
- **applicable_roles**: user
- **rationale**: spec/infra/ble-device.md stop(): bluetoothFunc=null / clearInterval / stopLEScan / 全接続デバイスへ stopNotifications→disconnect。UC1267 の診断終了→他ページ遷移で解除されるかの検証がない。リソースリーク防止の必須挙動。

**検証手順**:

1. ユーザー操作: CAN 系モードで診断中にドライビング画面から離脱（stop 発火）

1. 期待状態: connectDevices の全デバイスに対し stopNotifications と disconnect が呼ばれる

1. 期待状態: timer が clearInterval され、以降 CAN パケットの受信ハンドラが呼ばれない

1. 再確認: 再度診断開始時に scanStart から再接続でき、二重購読が発生しない



### TC-INFRA-BLE-004 — smartphoneOnly モードでの BLE スキップ

- **node_id**: `infra.ble.device`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/ble-device.md 業務ルール: smartphoneOnly のとき呼び出し元でスキップ。UC1272 のモード切替と UC1267 の診断の分岐。

**検証手順**:

1. ユーザー操作: UC1272 で smartphoneOnly を選択・永続化した後、UC1267 の診断開始

1. 期待状態: BLEDevice.start() / scanStart() が呼ばれず、BLE 接続ダイアログ類が一切表示されない

1. 期待状態: スマホセンサーのみで診断が成立し結果が SQLite に保存される（詳細は middleware/db 側だが infra としては BLE 未起動を確認）



### TC-INFRA-BLE-005 — 12バイト CAN パケットのバイト割当デコード整合

- **node_id**: `infra.ble.device`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/ble-device.md のバイト割当表（offset/型/スケール）は non-negotiable。steeringAngle は u16 BE ×0.1 −1080、各種オフセット付きスケールの誤りは診断結果を破壊する。デコードは middleware.sensor.service 実装だが、パケット→物理値の契約は infra が定義しており infra 境界内で固定すべき。

**検証手順**:

1. ユーザー操作: 既知の 12 バイトパケット（例: 各 offset に境界値を設定）を valueCb に注入

1. 期待状態: vehicleSpeed=byte0, longAcc=byte1×0.01−1.28, latAcc=byte2×0.01−1.28, frontDistance=byte3×0.5, lateralDistance=byte4×0.5−64

1. 期待状態: steeringAngle=u16(byte5-6 BE)×0.1−1080, accelPedalPosition=byte7, brakePressure=byte8

1. 期待状態: brakeSwitch=byte9, shiftIndication=byte10, turnSignal=byte11 が生値で渡る

1. 境界確認: byte 各値が 0 / 255（u16 は 0 / 65535）のときの復号値が仕様範囲内



### TC-INFRA-STORAGE-001 — 外部ストレージ書き込みの設定 ON/OFF ゲーティング（no-op 保証）

- **node_id**: `infra.file.storage`
- **priority**: `must`
- **applicable_roles**: user, admin
- **rationale**: spec/infra/file-storage.md 業務ルール: 保存は Android 実機かつ設定 ON のときのみ。OFF 時は完全 no-op でメモリバッファも都度リセット。UC1272 のログ保存/センサログ保存フラグに直結する fail 条件。

**検証手順**:

1. ユーザー操作: UC1272 でログ保存/センサログ保存フラグを OFF に設定して UC1267 診断を実行

1. 期待状態: Documents/driving-score 配下に log/sensor-log/movie が一切生成されない

1. 期待状態: メモリバッファが都度リセットされ蓄積されない

1. 対照: フラグ ON では debug-log/*.txt.gz および data.<日時>/ が生成される

1. 再確認: 端末ファイラ or file.checkDir で生成有無を確認



### TC-INFRA-STORAGE-002 — センサログ既定パス時の書き込み抑止と診断中パス切替

- **node_id**: `infra.file.storage`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/file-storage.md: saveLogPath==saveDefaultLogPath（既定パス）ではセンサログを書き込まない。診断中のみ setLogDir('data.<日時>') に切替えて有効化。歯抜けになりやすい状態依存分岐。

**検証手順**:

1. ユーザー操作: 診断外（オープニング等）でセンサログ保存が有効でも書き込みが発生しないことを確認

1. 期待状態: 既定パスのままではセンサログファイルが作られない

1. ユーザー操作: UC1267 診断開始で setLogDir('data.<日時>') に切替

1. 期待状態: data.<日時>/sensor-log.YYYYMMDD-HHMMSS.txt.gz が生成される



### TC-INFRA-STORAGE-003 — ログバッファのサイズ閾値フラッシュと force フラッシュ

- **node_id**: `infra.file.storage`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/file-storage.md: ログ 3MB / センサログ 5MB でオート フラッシュ、force=true で残バッファをフラッシュ。境界条件（閾値到達・診断終了時の残バッファ）が未検証。

**検証手順**:

1. ユーザー操作: 長時間診断でログが 3MB / センサログが 5MB を超過するまで蓄積

1. 期待状態: 閾値到達時に pako.gzip 圧縮された .txt.gz へ自動フラッシュされる

1. ユーザー操作: 診断終了（force=true フラッシュ）

1. 期待状態: 閾値未満の残バッファも最終ファイルに書き出される

1. 境界確認: ゼロ件（バッファ空）で force フラッシュしても空ファイル生成や例外が起きない



### TC-INFRA-STORAGE-004 — ブラウザ実行時の Blob ダウンロード保存フォールバック

- **node_id**: `infra.file.storage`
- **priority**: `should`
- **applicable_roles**: admin, user
- **rationale**: spec/infra/file-storage.md: ブラウザ実行時は Blob→<a download> で保存。UC1273（/edit）や UC1271 の書き出しが実機以外でも成立する経路。プラットフォーム分岐の検証がない。

**検証手順**:

1. ユーザー操作: ブラウザで UC1271 の scoreLogic 書き出し、または UC1273 のデモ保存を実行

1. 期待 DOM 反映: Blob URL を用いた <a download> によるダウンロードがトリガされる

1. 期待状態: cordova file API（externalRootDirectory）が呼ばれず、ブラウザ経路のみ通る

1. 再確認: ダウンロードされたファイルが命名規約 YYYYMMDD-HHMMSS に沿う



### TC-INFRA-SENSOR-001 — 起動時ランタイムパーミッションの順次要求（Android）

- **node_id**: `infra.cordova.sensors`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/cordova-sensors.md: checkPermission() が INTERNET/位置情報/CAMERA/RECORD_AUDIO/…/BLUETOOTH_* を順次要求（Android のみ）。UC1262/UC1263 のオープニング初期化に直結。WRITE_EXTERNAL_STORAGE は Manifest 未宣言だが requestPermission は呼ばれる drift を固定。

**検証手順**:

1. ユーザー操作: Android 実機でアプリ起動（UC1262/UC1263 のオープニング初期化）

1. 期待挙動: 列挙された全パーミッションが順次 requestPermission される

1. 期待挙動: WRITE_EXTERNAL_STORAGE は Manifest 未宣言でも requestPermission が呼ばれ、Android 12+ では自動許可扱いとなる

1. 対照: ブラウザ実行時は checkPermission() が実行されない

1. エラーパス: 位置情報/カメラを拒否した場合の後続挙動（診断/録画の可否）を確認



### TC-INFRA-SENSOR-002 — runScoreLogic フラグによるセンサー受信ハンドラの早期リターン差分

- **node_id**: `infra.cordova.sensors`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/cordova-sensors.md: runScoreLogic=false のとき devicemotion / deviceorientationabsolute / magnetometer ハンドラは早期リターンし last* を更新しない。GPS watchPosition はフラグ非依存で lastGeolocation と Storage の geolocation-last-pos-key を更新。境界差分の重要ルール。

**検証手順**:

1. ユーザー操作: 診断開始前（runScoreLogic=false）でセンサー購読が動作している状態

1. 期待状態: lastAcceleration / lastGyroscope / lastMagnetometer が更新されない

1. 期待状態: GPS の lastGeolocation と Ionic Storage の geolocation-last-pos-key はフラグに関わらず更新される

1. ユーザー操作: 診断開始（runScoreLogic=true）

1. 期待状態: motion/orientation/magnetometer の last* が更新されスコアロジックへ供給される



### TC-INFRA-SENSOR-003 — センサー購読ライフサイクル（driving 画面限定・離脱で全解除）

- **node_id**: `infra.cordova.sensors`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/cordova-sensors.md: 購読は driving 画面起動中のみ（start→10ms 周期タイマ）、他ページ復帰で stop() 全解除。insomnia.keepAwake は driving のみ。UC1267 のライフサイクル整合。

**検証手順**:

1. ユーザー操作: UC1267 で driving 画面へ遷移

1. 期待状態: sensor.service.start() で 10ms 周期タイマと各センサー購読、screenOrientation.lock('portrait')、insomnia.keepAwake() が起動

1. ユーザー操作: driving 画面から離脱（オープニングへ戻る）

1. 期待状態: sensor.service.stop() で全購読解除、insomnia.allowSleepAgain()、screenOrientation.unlock()

1. 再確認: 再入場で二重購読・タイマ多重起動が発生しない



### TC-INFRA-SLJSON-001 — scoreLogic.json の version 比較による Storage 上書き規則

- **node_id**: `infra.assets.scoreLogicJson`
- **priority**: `must`
- **applicable_roles**: user, admin
- **rationale**: spec/infra/assets-scoreLogicJson.md 起動時更新ルール: oldJson.version 未定義または newJson.version >= oldJson.version なら 'score-logic-json' に上書き、parse 例外は無視して据え置き。UC1262/UC1263 の起動時 saveDefaultScoreLogicJson() の non-negotiable。

**検証手順**:

1. ユーザー操作: 端末 Storage に古い version の JSON がある状態でアプリ起動

1. 期待状態(new>=old): score-logic-json が新 JSON に上書きされる

1. 期待状態(old が未定義): 無条件に上書きされる

1. 期待状態(new<old): 上書きされず既存が維持される

1. エラーパス: Storage の既存 JSON が parse 例外 → 例外を無視して既存のまま維持し、起動が継続する

1. 再確認: 再起動後も Storage キー 'score-logic-json' の内容が保持される



### TC-INFRA-SLJSON-002 — メッセージ選定ロジック（スコア範囲・custom 絞り込み・%プレースホルダ置換）

- **node_id**: `infra.assets.scoreLogicJson`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/assets-scoreLogicJson.md メッセージ選定: inclusive_min<=score<exclusive_max、custom 指定時は custom 一致のみ候補、%COUNT=同一 id 出現回数、%INTERSECTION=交差点名（履歴では空文字）。UC1268/UC1270 の表示品質に直結。

**検証手順**:

1. ユーザー操作: UC1268 でアドバイス表示（直近走行の over_all/score1..4）

1. 期待状態: score が inclusive_min<=score<exclusive_max の範囲メッセージのみ候補になる（境界: exclusive_max 値ちょうどは選ばれない）

1. 期待状態: custom 指定メッセージは custom 値一致時のみ候補

1. 期待 DOM 反映: %COUNT が同一 id の出現回数、%INTERSECTION が交差点名で置換される

1. 境界(履歴): UC1270 の履歴表示では %INTERSECTION が空文字に置換される



### TC-INFRA-SLJSON-003 — 設定画面からの scoreLogic.json アップロードと testScoreLogic 検証後の Storage 更新

- **node_id**: `infra.assets.scoreLogicJson`
- **priority**: `should`
- **applicable_roles**: admin
- **rationale**: UC1271 で辞書/ロジックをファイルからアップロードし testScoreLogic 検証後に Storage 更新。infra 側は 'score-logic-json'（辞書）と 'driving-score-logic'（JS 本体）の分離保存が真実源。運用担当者ロールと検証失敗時の fail 経路が未整備。

**検証手順**:

1. ユーザー操作: UC1271 で settings 画面から scoreLogic.json を端末ファイルからアップロード

1. 期待状態(検証成功): testScoreLogic 通過後、score-logic-json（辞書）が更新される。JS 本体は driving-score-logic に分離保存される

1. エラーパス(検証失敗): testScoreLogic 失敗時は Storage を更新せず、エラーが提示される

1. 再確認: 更新後の診断で新辞書のメッセージが使用される

1. 書き出し: 現在の内容をファイル（scoreLogicJson.YYYYMMDD-HHMMSS.txt）として書き出せる



### TC-INFRA-MAPS-001 — Google Maps JS API の1回ロードと再ロード防止・日本ローカライズ

- **node_id**: `infra.google.maps`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec/infra/google-maps.md: Loader は 1 度だけロード、isInitialize で再ロード防止、region=JP/language=ja、各種コントロールは全 false。UC1269/UC1270/診断終了地図表示の基盤。

**検証手順**:

1. ユーザー操作: opening→driving→badspot と地図を使う複数画面を順に遷移

1. 期待状態: Loader.load() は初回のみ実行され、isInitialize フラグで 2 回目以降は再ロードされない

1. 期待 DOM 反映: 地図は region=JP/language=ja で日本語表記、mapTypeControl/zoomControl/streetViewControl/fullscreenControl/rotateControl がすべて非表示

1. 期待挙動: ロード完了までのマップ生成要求はキューされ、完了後に実行される



### TC-INFRA-MAPS-002 — ヒヤリマーカー click から bad-spot 遷移までの地図マーカー整合

- **node_id**: `infra.google.maps`
- **priority**: `should`
- **applicable_roles**: user
- **rationale**: spec gap: UC1269 から自然に導出される基本フロー。spec/infra/google-maps.md は Marker click リスナと SymbolPath を挙げるが、ヒヤリマーカー click→/bad-spot/:path 遷移の infra 側マーカー生成・click ハンドリング詳細は未記載。

**検証手順**:

1. ユーザー操作: UC1269 で診断終了地図または /comment 経由でヒヤリマーカーをタップ

1. 期待 DOM 反映: google.maps.Marker の click リスナが発火し /bad-spot/:path へ遷移する

1. 期待状態: 遷移先で当該ヒヤリ地点の車両マーカー・軌跡円マーカー・S/E マーカーが正しい LatLng で描画される

1. 境界: ヒヤリ地点ゼロ件のときマーカーが表示されず遷移動線も出ない



### TC-INFRA-GEO-001 — gpsDemo=true 時に geolocation.json が再生されないことの負の確認（drift 固定）

- **node_id**: `infra.assets.geolocation`
- **priority**: `nice`
- **applicable_roles**: user
- **rationale**: spec/infra/assets-geolocation.md: 設計意図では gpsDemo=true で geolocation.json を再生するが、middleware.sensor.service は現状これを直接ロードしていない（設計と実装の齟齬、spec/unknowns.md 記録済）。現状挙動を QA で固定し、将来接続時にこの負の確認が反転することで実装追従を検出する。

**検証手順**:

1. ユーザー操作: UC1272 で gpsDemo フラグを ON にして UC1267 診断を実行

1. 期待状態(現状): geolocation.json は読み込まれず、固定経路の再生は発生しない（実機 GPS もしくは demoData 経由のみ）

1. 確認: このシナリオは『設計意図未接続』の drift ガードであり、実装接続時には期待値を再生ありへ更新する前提





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `TC-INFRA-BLE-001` → **must** : scanStart の 0/1/複数分岐は CAN 系診断の中核 non-negotiable

- `TC-INFRA-BLE-002` → **must** : Bluetooth 無効・接続失敗の fail 経路とリトライは必須エラーパス

- `TC-INFRA-BLE-003` → **must** : stop() の完全解除はリソースリーク・二重購読防止の必須挙動

- `TC-INFRA-STORAGE-001` → **must** : 設定 OFF での完全 no-op はプライバシ/ストレージ保護の non-negotiable

- `TC-INFRA-SLJSON-001` → **must** : version 比較上書きと parse 例外据え置きは起動時の中核ルール

- `TC-INFRA-BLE-004` → **should** : smartphoneOnly スキップは重要だがモード分岐の派生検証

- `TC-INFRA-BLE-005` → **should** : デコード契約は infra 定義だが実装は middleware、境界検証は should

- `TC-INFRA-STORAGE-002` → **should** : 既定パス抑止は歯抜けになりやすいが派生ルール

- `TC-INFRA-STORAGE-003` → **should** : 閾値/force フラッシュは境界条件として重要

- `TC-INFRA-STORAGE-004` → **should** : ブラウザフォールバックは UC1271/UC1273 の検証環境で必要

- `TC-INFRA-SENSOR-001` → **should** : パーミッション順次要求は起動の前提だが Manifest drift 含みで確定要

- `TC-INFRA-SENSOR-002` → **should** : runScoreLogic 分岐は重要ルールだが挙動観測が実装依存

- `TC-INFRA-SENSOR-003` → **should** : ライフサイクル整合は重要だが UC1267 内の派生

- `TC-INFRA-SLJSON-002` → **should** : メッセージ選定は表示品質に直結、境界含む

- `TC-INFRA-SLJSON-003` → **should** : UC1271 のアップロード検証、admin 限定運用フロー

- `TC-INFRA-MAPS-001` → **should** : 1回ロード/再ロード防止は地図基盤の重要挙動

- `TC-INFRA-MAPS-002` → **should** : spec gap のため確定は保留、should に設定

- `TC-INFRA-GEO-001` → **nice** : 設計未接続の drift ガード。実装接続で期待値反転する前提のため nice



---

## Open Questions



### ヒヤリマーカー click から /bad-spot 遷移の infra 側マーカー生成仕様が未記載

- **質問**: spec/infra/google-maps.md にマーカー click→ルーティング（/bad-spot/:path）の対応関係、遷移パラメータ、ゼロ件時の動線が明記されていない。UC1269 の基本フローを QA 化するには infra 側でどこまで責務を持つか（middleware.map.service との境界）を確定する必要がある。
- **保留中の判断**: TC-INFRA-MAPS-002 の期待値確定


### gpsDemo 経路再生の設計意図と実装の齟齬（未接続）

- **質問**: spec/infra/assets-geolocation.md 記載のとおり gpsDemo=true 時に geolocation.json を再生する設計意図があるが middleware.sensor.service は未接続。今後実装で接続するのか、設計文書側を現状に合わせるのか方針が未確定。方針が決まるまで TC-INFRA-GEO-001 は『再生されない』負の確認として固定。
- **保留中の判断**: TC-INFRA-GEO-001 の期待値（再生あり/なし）確定


### WRITE_EXTERNAL_STORAGE の Manifest 未宣言と requestPermission の齟齬

- **質問**: spec/infra/cordova-sensors.md では WRITE_EXTERNAL_STORAGE が Manifest 未宣言のまま requestPermission が呼ばれ、Android 12+ で自動許可扱いとされる。対応 Android バージョン範囲と、外部ストレージ書き込みが失敗しうる端末条件が未定義で、TC-INFRA-STORAGE-001 の対照（ON 時に確実に書ける前提）が保証できない。
- **保留中の判断**: TC-INFRA-SENSOR-001 のパーミッション拒否時後続挙動の期待値確定


### Google Maps API キーの2箇所平文管理ガバナンス

- **質問**: environment.ts と AndroidManifest.xml で異なる平文 API キーが管理されている。キー無効/超過時の地図ロード失敗のフォールバック挙動が spec に未記載で、UC1269/UC1270 の地図系 QA で失敗パスを定義できない。
- **保留中の判断**: TC-INFRA-MAPS-001 のロード失敗時フォールバック検証追加




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/infra-ble-connection.md`

- `spec/qa/infra-file-storage.md`

- `spec/qa/infra-sensor-lifecycle.md`

- `spec/qa/infra-scorelogic-json.md`

- `spec/qa/infra-google-maps.md`


