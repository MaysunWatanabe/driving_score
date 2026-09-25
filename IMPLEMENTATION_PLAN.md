<!-- 作成: 2026-07-31 14:36:09 JST | 更新: 2026-09-25 11:40:00 JST -->

# 実装指示書 — 運転診断アプリ (driving-score)

対象リポジトリ: `driving-score`
生成日時: 2026-07-20 JST
対象読者: Env-agent / UI-agent / Middleware-agent / DB-agent / Infra-agent / QA-agent

> **重要**: 本書は「何を・どの順で・誰が作るか」を定義する上位指示書である。**各ノードの詳細仕様（関数シグネチャ、閾値、バイト列、画面要素、期待値など）は必ず各ノードの `entrypoint` に記載された仕様書を参照すること。** 本書と仕様書に差異がある場合は **仕様書（entrypoint）を正** とし、差異を Issue として報告すること。

---

## 1. 目的 / 完成定義（Definition of Done）

### 1.1 目的

Ionic 7 + Angular 15 + Capacitor 4 で構成された運転診断 SPA を、**仕様書群（CanonicalSpecGraph の全 39 ノード）に一致する状態で実装・再現**し、以下を成立させる。

1. スマートフォンセンサー（GPS / 加速度 / ジャイロ / 磁力）および BLE 車載機 `DrivingCanData` からの CAN データを 10ms 周期で統合し、300ms 周期でスコアロジックを評価できる。
2. 診断結果を SQLite (`driving-score.db`) に永続化し、履歴・能力指標・ヒヤリ地点として再表示できる。
3. **開発機のみで実機相当の検証が完結する**（モックセンサログ 9 ファイル再生 / BLE ペリフェラル・エミュレータ / モック GPS フィーダ）。
4. 社内配布用フルオートインストーラでビルド・配布が再現できる。

### 1.2 Definition of Done（全項目 AND 条件）

| # | 完成条件 | 検証方法 | 参照 |
|---|---|---|---|
| DoD-1 | `scripts/setup.sh` 実行で Linux 開発機に Node 18.19.1（nvm + `src/data/.nvmrc`）・依存・Android SDK 前提が揃う | クリーン環境で 1 コマンド成功 | [env/build-installer](spec/env/build-installer.md) |
| DoD-2 | `scripts/start-web.sh` / `scripts/start-android.sh` でブラウザ起動と Android 実機/エミュ起動が成功する | 手順再現 | [env/app-bootstrap](spec/env/app-bootstrap.md) |
| DoD-3 | 全 8 画面がルータ配線され、未ログイン時のアクセス制御が仕様どおり動作する | E2E | [qa/cross-domain](spec/qa/cross-domain.md) |
| DoD-4 | `users` / `score` / `score_history` / `capability_score` の CREATE TABLE が REAL 是正済みで、小数が丸められずに往復する | ユニット + DB ダンプ | [db/schema-corrections](spec/db/schema-corrections.md), [ER_DIAGRAM](spec/ER_DIAGRAM.md) |
| DoD-5 | センサログ（JSON Lines + pako.gzip `.txt.gz`）の書出・再生がラウンドトリップし、skip 0・行数一致 | ユニット | [qa/mockdata-sensorlog-schema](spec/qa/mockdata-sensorlog-schema.md) |
| DoD-6 | 正準モック 9 ファイルが決定的に生成され、commit 済みバイト列と一致（既存 6 ファイルのバイト列は不変） | 生成器セルフチェック + `git diff` 空 | [qa/mockdata-sensorlog-generator](spec/qa/mockdata-sensorlog-generator.md) |
| DoD-7 | BLE エミュレータ（既定 A: BlueZ D-Bus 実装）が `LocalName=DrivingCanData` / service `0x2310` / notify `0x2311` / 12 バイトで広告・通知し、**logcat 実測**でアプリ受信を確認（Phase 1 完了ゲート） | 実機 logcat | [qa/mockdata-ble-emulator](spec/qa/mockdata-ble-emulator.md), [infra/ble-device](spec/infra/ble-device.md) |
| DoD-8 | CLI 値域違反時の挙動が仕様一致（exit code 1 / stderr `[ERROR]` 1 行 / GATT・広告・notify 未到達 / 検証順序 `--rate-ms` → `--inject-invalid`） | CLI テスト（TC-BLE-EMU-010 等） | [qa/mockdata-ble-emulator](spec/qa/mockdata-ble-emulator.md) |
| DoD-9 | `steer_stable` / `steer_wobble_weak` / `steer_wobble_strong` の score2 が実機 BLE 100ms 経路で `stable>=80`、`weak` は 40 以上 70 未満、`strong<20`、かつ `stable>weak>strong` | 実機シナリオ E2E | [qa/mockdata-sensorlog-scenarios](spec/qa/mockdata-sensorlog-scenarios.md), [middleware/score-logicCan](spec/middleware/score-logicCan.md) |
| DoD-10 | モック GPS フィーダが `adb cmd location` テストプロバイダ `gps` に 1Hz・60 点投入でき、終了時に provider 削除と `appops default` が実行される | 実機手順 | [qa/mockdata-gps-feeder](spec/qa/mockdata-gps-feeder.md) |
| DoD-11 | `smartphoneOnly` では CAN ゼロ埋めにより **全項目 100 の未算出** となる既知挙動を、仕様どおりそのまま再現（勝手に直さない） | ユニット + 手動確認 | [middleware/sensor-service](spec/middleware/sensor-service.md), [middleware/score-logicCan](spec/middleware/score-logicCan.md) |
| DoD-12 | QA 仕様の全 TC が実行され、結果表（PASS/FAIL/BLOCKED）が `spec/qa/` 配下の記載と突き合わせ済み | テストレポート | [qa/*](spec/qa/) |
| DoD-13 | `.smith` 除外・ローカル bind の gitignore 方針が適用され、生成物混入がない | `git status` クリーン | [env/repo-gitignore](spec/env/repo-gitignore.md) |
| DoD-14 | `README` に環境構築・起動・検証（モック/BLE/GPS）の手順が一本化されている | レビュー | 本書 §9 |
| DoD-15 | 設定画面 3-1 の「ヒヤリ前後秒数」で 5〜60 の整数秒を設定でき、不正入力（範囲外/非数値/小数/空欄）は保存されず入力欄が直前の保存値へ戻る | 実機操作 | proposal #229 / #231、fact #4633 |
| DoD-16 | 診断中のヒヤリ検知で `hiyari.NN.webm` が 01 起点の連番で生成され、通し動画 `movie.webm` は作られない。区間が重なる連続ヒヤリは 1 本に連結され、ヒヤリ地点は 1 件ずつ別マーカーとして記録される | 実機 E2E | fact #4330、proposal #227 / #230 / #242 |
| DoD-17 | 6-1 で各ヒヤリ動画が再生でき、マーカーから seek した先に該当時刻の映像が出る。ファイルをまたぐ前後ボタンのリング巡回で `src` が差し替わる | 実機 E2E | proposal #241 / #244 / #245 |

---

## 2. スコープ

### 2.1 やること

- **env**: アプリブートストラップ、`environment` 定義、Capacitor / AndroidManifest 設定、インストーラ・ビルドバッチ、gitignore 方針。
- **ui**: 8 画面（opening / account / driving / history / settings / edit / badspot / comment）の実装と導線。
- **middleware**: login / log / map / sensor(service, manager, demoData) / score(logic, logicSimple, logicCan) の 9 サービス。
- **db**: User / Score モデルとリポジトリ、CREATE TABLE の REAL 是正、シード最小方針。
- **infra**: BLE デバイスクラス、Bluetooth LE プラグイン、Google Maps ローダ、ファイルストレージ、Cordova センサープラグイン群、アセット JSON。
- **qa**: モックセンサログ（schema / scenarios / generator / aggregation）、BLE エミュレータ、GPS フィーダ、ドメイン別 QA、横断 QA。
- **2026年度改修⑤（ヒヤリ録画のサイズ削減）**: 通し録画を廃止し、ヒヤリ前後 n 秒の区間のみを個別ファイルへ書き出す（M10）。
- **成果物**: 環境構築スクリプト・起動スクリプト（§9 必須）。

### 2.2 やらないこと（明示的に対象外）

- `middleware.score.logicSimple`（`scoreLogicFunction_simple.txt`）の**実行配線**。`opening.page.ts` は常に `scoreLogicFunction.txt`（CAN 版）のみを GET する現行実装を維持する。`selectedSensorMode` によるロジック切替は**未実装のまま**とする。
- スコアロジック本体・集約方式・初期値（平均初期値 100、`calculator()` の -1 除外、0 件フィールドは前回値保持）の**変更**。`start()` 直後の空 Score が 1 件混ざる既知挙動も**維持**。
- `score3` / `score4` / `scoreC` の実装（CAN 版が未設定であり、`settings.label3/label4/labelC` も空であることと対応）。
- `infra.assets.geolocation` の参照配線（死にアセットとして現状維持）。
- `smartphoneOnly` における CAN ゼロ埋め起因の「全項目 100」の**是正**。
- BLE エミュレータ代替 B（`src/tools/ble-can-emulator/`、bumble・要 sudo）の**改変**。**凍結**扱い。A が使用不能な場合（`LEAdvertisingManager1` 無し / `SupportedInstances=0` / `Register*` 失敗）のみ利用。
- BLE エミュレータの Windows / macOS 対応、リアルタイム操作型エミュレーション、`infra.ble.device` への `notify_interval_ms` 追加、A 用の新規 pip 依存追加。
- モック GPS における `altitude` / `heading` / `speed` の投入、`fused` プロバイダ登録。
- アプリ本体をエミュレータ都合で変更すること（**アプリ本体変更は禁止**）。
- サーバサイド / クラウド連携（本アプリはローカル完結）。

---

## 3. 参照する仕様一覧

### 3.1 env

- [spec/env/app-bootstrap.md](spec/env/app-bootstrap.md) — `env.app.bootstrap`
- [spec/env/config-environment.md](spec/env/config-environment.md) — `env.config.environment`
- [spec/env/config-capacitor.md](spec/env/config-capacitor.md) — `env.config.capacitor`
- [spec/env/build-installer.md](spec/env/build-installer.md) — `env.build.installer`
- [spec/env/repo-gitignore.md](spec/env/repo-gitignore.md) — `env.repo.gitignore`

### 3.2 ui

- [spec/ui/opening-page.md](spec/ui/opening-page.md) — `ui.opening.page`
- [spec/ui/account-page.md](spec/ui/account-page.md) — `ui.account.page`
- [spec/ui/driving-page.md](spec/ui/driving-page.md) — `ui.driving.page`
- [spec/ui/history-page.md](spec/ui/history-page.md) — `ui.history.page`
- [spec/ui/settings-page.md](spec/ui/settings-page.md) — `ui.settings.page`
- [spec/ui/edit-page.md](spec/ui/edit-page.md) — `ui.edit.page`
- [spec/ui/badspot-page.md](spec/ui/badspot-page.md) — `ui.badspot.page`
- [spec/ui/comment-page.md](spec/ui/comment-page.md) — `ui.comment.page`

### 3.3 middleware

- [spec/middleware/login-service.md](spec/middleware/login-service.md) — `middleware.login.service`
- [spec/middleware/log-service.md](spec/middleware/log-service.md) — `middleware.log.service`
- [spec/middleware/map-service.md](spec/middleware/map-service.md) — `middleware.map.service`
- [spec/middleware/sensor-service.md](spec/middleware/sensor-service.md) — `middleware.sensor.service`
- [spec/middleware/sensor-manager.md](spec/middleware/sensor-manager.md) — `middleware.sensor.manager`
- [spec/middleware/sensor-demoData.md](spec/middleware/sensor-demoData.md) — `middleware.sensor.demoData`
- [spec/middleware/score-logic.md](spec/middleware/score-logic.md) — `middleware.score.logic`
- [spec/middleware/score-logicSimple.md](spec/middleware/score-logicSimple.md) — `middleware.score.logicSimple`（**記録のみ・配線対象外**）
- [spec/middleware/score-logicCan.md](spec/middleware/score-logicCan.md) — `middleware.score.logicCan`

### 3.4 db

- [spec/db/user-model.md](spec/db/user-model.md) — `db.user.model`
- [spec/db/user-repository.md](spec/db/user-repository.md) — `db.user.repository`
- [spec/db/score-model.md](spec/db/score-model.md) — `db.score.model`
- [spec/db/score-repository.md](spec/db/score-repository.md) — `db.score.repository`
- [spec/db/schema-corrections.md](spec/db/schema-corrections.md) — `db.schema.corrections`
- [spec/ER_DIAGRAM.md](spec/ER_DIAGRAM.md) — ER 図

### 3.5 infra

- [spec/infra/ble-device.md](spec/infra/ble-device.md) — `infra.ble.device`
- [spec/infra/bluetooth-le.md](spec/infra/bluetooth-le.md) — `infra.bluetooth.le`
- [spec/infra/google-maps.md](spec/infra/google-maps.md) — `infra.google.maps`
- [spec/infra/file-storage.md](spec/infra/file-storage.md) — `infra.file.storage`
- [spec/infra/cordova-sensors.md](spec/infra/cordova-sensors.md) — `infra.cordova.sensors`
- [spec/infra/assets-scoreLogicJson.md](spec/infra/assets-scoreLogicJson.md) — `infra.assets.scoreLogicJson`
- [spec/infra/assets-geolocation.md](spec/infra/assets-geolocation.md) — `infra.assets.geolocation`（死にアセット）

### 3.6 qa

- [spec/qa/mockdata-sensorlog-schema.md](spec/qa/mockdata-sensorlog-schema.md) — `qa.mockdata.sensorlog.schema`
- [spec/qa/mockdata-sensorlog-scenarios.md](spec/qa/mockdata-sensorlog-scenarios.md) — `qa.mockdata.sensorlog.scenarios`
- [spec/qa/mockdata-sensorlog-generator.md](spec/qa/mockdata-sensorlog-generator.md) — `qa.mockdata.sensorlog.generator`
- [spec/qa/mockdata-sensorlog-aggregation.md](spec/qa/mockdata-sensorlog-aggregation.md) — `qa.mockdata.sensorlog.aggregation`
- [spec/qa/mockdata-ble-emulator.md](spec/qa/mockdata-ble-emulator.md) — `qa.mockdata.ble.emulator`
- [spec/qa/mockdata-gps-feeder.md](spec/qa/mockdata-gps-feeder.md) — `qa.mockdata.gps.feeder`
- [spec/qa/cross-domain.md](spec/qa/cross-domain.md) / [spec/qa/ui.md](spec/qa/ui.md) / [spec/qa/middleware.md](spec/qa/middleware.md) / [spec/qa/db.md](spec/qa/db.md) / [spec/qa/infra.md](spec/qa/infra.md) / [spec/qa/env.md](spec/qa/env.md) / [spec/qa/qa.md](spec/qa/qa.md)

### 3.7 アーキテクチャ図

- [spec/C4_c4_svg/context.svg](spec/C4_c4_svg/context.svg) / [container.svg](spec/C4_c4_svg/container.svg) / [components_ui.svg](spec/C4_c4_svg/components_ui.svg) / [components_middleware.svg](spec/C4_c4_svg/components_middleware.svg) / [components_db.svg](spec/C4_c4_svg/components_db.svg) / [components_infra.svg](spec/C4_c4_svg/components_infra.svg) / [components_env.svg](spec/C4_c4_svg/components_env.svg) / [deployment.svg](spec/C4_c4_svg/deployment.svg)

---

## 4. 実装順序（マイルストーン & 依存関係）

依存関係の原則: **env（基盤） → infra（外部 I/F） → db（永続化） → middleware（ロジック） → ui（画面） → qa（検証資材）**。
ただし `qa.mockdata.*` は middleware/infra の受入に必要なため、M3 で先行着手する。

### M0: 基盤・リポジトリ整備（担当: Env-agent）

- 依存: なし
- 成果物
  - Node 18.19.1 固定（nvm + `src/data/.nvmrc=18.19.1`）
  - `scripts/setup.sh`（環境構築）、`scripts/start-web.sh` / `scripts/start-android.sh`（起動）→ §9 必須
  - `.gitignore`（`.smith` 除外、ローカル bind 方針）
  - `environment`（`mapsKey` 等）、Capacitor / AndroidManifest（Android Maps SDK API キー）
- 完了判定: DoD-1 / DoD-2 / DoD-13
- 参照: `env/build-installer`, `env/config-environment`, `env/config-capacitor`, `env/repo-gitignore`

### M1: infra 層（担当: Infra-agent）

- 依存: M0
- 成果物
  - `infra.bluetooth.le`（`@capacitor-community/bluetooth-le`、**addressType=public 前提**）
  - `infra.ble.device`（3 秒スキャン → `connect(timeout:10000)` → `startNotifications` → 12 バイト CAN デコード）
  - `infra.file.storage`（`Documents/driving-score`、ブラウザは Blob ダウンロード、`.txt.gz` 形式）
  - `infra.google.maps`（JS API ローダ）
  - `infra.cordova.sensors`（GPS / 加速度 / ジャイロ / 磁力 / SQLite / 権限）
  - `infra.assets.scoreLogicJson`（`settings.label1/label2/labelA/labelB` 設定、`label3/label4/labelC` は空のまま）
  - `infra.assets.geolocation`（同梱のみ・未参照）
- 完了判定: `spec/qa/infra.md` の TC 通過
- 注意: `infra.ble.device` に `notify_interval_ms` を追加しない。

### M2: db 層（担当: DB-agent）

- 依存: M0（infra.cordova.sensors の SQLite に依存するため M1 と並行可）
- 成果物
  - `db.user.model`（MD5 ハッシュ済みパスワード文字列保持）
  - `db.user.repository`（`users.height` を **REAL**）
  - `db.score.model`（スコア系は **REAL**、丸めは表示層責務）
  - `db.score.repository`（`score` / `score_history` / `capability_score` の REAL 是正）
  - `db.schema.corrections`（CREATE TABLE 是正 + シード最小方針）
- 完了判定: DoD-4 + `spec/qa/db.md` の TC 通過

### M3: QA モックデータ資材（担当: QA-agent、Middleware-agent レビュー）

- 依存: M1（file-storage の形式確定）
- 成果物
  - `qa.mockdata.sensorlog.schema` 準拠のレコード定義（1 行 `{date, sensor}`、`date=YYYY-MM-DD HH:mm:ss.SSS`、必須 `videoTime/geolocation/acceleration/gyroscope/magnetometer`）
  - `src/data/tools/gen-mock-sensorlog.mjs`（Node 18.19.1、依存は pako のみ）
  - `src/data/mock/sensor-log.<scenario>.<sensorMode>.txt.gz` 正準 **9 ファイル** を決定的生成し commit
  - 10 件区間集約 + 12 バイト符号化ルール（`qa.mockdata.sensorlog.aggregation`）
- 決定的パラメータ（**必ず仕様書で確認して実装**）
  - base `T0=2026-07-01T10:00:00.000+09:00`（`--base-time` 可）、`timestamp = T0_ms + i*10`、`date` は JST 固定整形
  - 初期 `heading=0.0`
  - `accel_decel` は 20s 周期（8s +0.21G 加速 → 4s 定速 → 8s −0.21G 緩減速）
  - pedal/brake は量子化前 `longAcc` の ±0.02G で全シナリオ共通判定（`>0.02:120/0/0`、`<-0.02:0/200/1`、`else:40/0/0`）
  - `steer_*` は `Math.random` 禁止・固定 LCG（`seed0=12345, a=1103515245, c=12345, m=0x7fffffff`、角度 `(u*2-1)*2.0`）をシナリオごとリセット。duty は区間 3 の `(t mod 4)/4 < duty`
  - `steer_stable` = 4 秒階段 `0/+8/-8`、`weak` = ±2° duty25%、`strong` = ±2° duty100%。いずれも `|steeringAngle|<=15` / `turnSignal=0` を維持し、区間 3 の 37.2 秒で 10 秒ゲート成立
  - GPS は東京駅起点の相対計算、`speed` は `vehicleSpeed/3.6` と整合、合成時 `repeat` は全 0
  - `smartphoneOnly` は `canData` キー省略（`convertOldData` がゼロ補充）、`canConnected` は `canData` 全フィールド明示
- 完了判定: DoD-5 / DoD-6、セルフチェックで skip 0・行数一致、既存 6 ファイルのバイト列不変

### M4: middleware 層 — 基盤サービス（担当: Middleware-agent）

- 依存: M1, M2
- 成果物
  - `middleware.log.service`（`sensor()` は `{date,sensor}` を JSON Lines バッファ → `pako.gzip` → `sensor-log.YYYYMMDD-HHMMSS.txt.gz`）
  - `middleware.login.service`（認証・状態管理・`settings` 永続化）
  - `middleware.map.service`（マーカー・軌跡・自車位置追従）
- 完了判定: `spec/qa/middleware.md` の該当 TC 通過

### M5: middleware 層 — センサー統合（担当: Middleware-agent）

- 依存: M3, M4
- 成果物
  - `middleware.sensor.manager`（キャリブレーション & 座標変換、静的クラス、sensor.service と相互依存）
  - `middleware.sensor.demoData`（gzip+Base64 センサログ + webm 再生、必須キー欠落行は skip、`canData` 欠落は `convertOldData` がゼロ補充）
  - `middleware.sensor.service`（10ms 周期集約、デモ/実機切替は `DemoData.getSensorLogDataSize()>0`、モード別ゲート通過後のゼロ埋め: `acceleration.interval=10` / 各 `repeat=-1`、`geolocation` はゼロ埋めしない）
- 完了判定: モック 9 ファイルが `ui.edit.page` 経由で通し再生でき、skip 0

### M6: middleware 層 — スコアロジック（担当: Middleware-agent）

- 依存: M5
- 成果物
  - `middleware.score.logic`（Ionic Storage の JS 文字列を `new Function()` 化し **300ms 周期**評価。平均初期値 100、`calculator()` は -1 以外を平均、0 件フィールドは前回値保持）
  - `middleware.score.logicCan`（`scoreLogicFunction.txt` / 885 行、実行される唯一のロジック。`score1/scoreA/scoreB` は駐車 D→R→P のみ。`score2` は 40km/h・ウィンカ 0・`|steer|<=15°` が 10 秒継続。ヒヤリは `hiyari=true` とメッセージのみでスコア値不変）
  - `middleware.score.logicSimple`（`scoreLogicFunction_simple.txt` / 394 行を**同梱のみ、配線しない**）
- 完了判定: `smartphoneOnly` で全項目 100（DoD-11）、`canConnected` で score2 が期待レンジ

### M7: ui 層（担当: UI-agent）

- 依存: M4, M5, M6
- 順序（依存の浅い順）
  1. `ui.opening.page`（`scoreLogicJson` 初期化、`scoreLogicFunction.txt` のみ GET、ログイン誘導・導線制御）
  2. `ui.account.page`（Reactive Forms バリデーション、MD5 保存）
  3. `ui.settings.page` → `ui.edit.page`（`.txt.gz` を FileReader で Base64 化 → `DemoData.pushSensorLogFile`、webm は `movieFile`）
  4. `ui.driving.page`（10ms センサー統合、スコア表示、地図描画、動画記録、`db.score.repository` / `infra.file.storage` 書込、badspot 遷移）
  5. `ui.badspot.page`（動画再生 + マーカー自動追尾）
  6. `ui.comment.page`（positive/negative コメント選出）
  7. `ui.history.page`（Chart.js による履歴・能力指標可視化）
- 完了判定: `spec/qa/ui.md` 8 ノード分 TC 通過 + DoD-3

### M8: BLE エミュレータ / GPS フィーダ（担当: QA-agent + Infra-agent）

- 依存: M1, M3, M7
- 成果物
  - `src/data/tools/ble-can-emulator.py`（**既定 A**、BlueZ D-Bus `LEAdvertisingManager1`/`GattManager1`、依存ゼロ・sudo 不要・bluetoothd 共存）
    - CLI: `--source`（mock `canConnected` 実データ再生）、`--rate-ms`（閉区間 10..1000、既定 100 は暫定）、`--loop`、`--inject-invalid {short11,long13,zeros,ones}`（既定未指定）
    - **値域検証は argparse に委ねず `main()` 冒頭（`load_can_frames` / D-Bus より前）で行い、`SystemExit` / exit code 1 / stderr `[ERROR]` 1 行 / GATT・広告・notify 未到達に統一**
    - 検証順序は `--rate-ms` → `--inject-invalid`（両方不正なら `--rate-ms` のみ出力）
    - 正常起動時は `[source]` 行の直後に `[inject-invalid] <kind>` を 1 行出力
    - 広告は **public アドレスタイプ**（Privacy=off 等）— random static だと GATT が status `0x3E` で失敗し得る
  - `src/data/tools/mock-gps-feeder.py`（`adb cmd location` テストプロバイダ `gps` に `latitude/longitude/accuracy` のみ 1Hz・100 レコードごと・60 点投入。事前 `appops set com.android.shell android:mock_location allow`、終了時 `remove-test-provider gps` + `appops default`）
- 完了判定: DoD-7 / DoD-8 / DoD-10。**Phase 1 完了ゲートは A で判定**（B は対象外）。A/B 同時起動不可。B 使用後は `restore-bluez.sh` で BlueZ 復帰必須。

### M9: 統合テスト・受入（担当: QA-agent 主導、全エージェント支援）

- 依存: M0〜M8
- 成果物: テストレポート（TC ごとに PASS/FAIL/BLOCKED、実測値、logcat 抜粋）
- 完了判定: DoD-9 / DoD-12 / DoD-14

### M10: 2026年度改修⑤ — ヒヤリ録画のサイズ削減（担当: UI-agent + Middleware-agent、QA-agent 検証）

- 依存: M7（ui 層）/ M8（BLE エミュ・GPS フィーダ）/ M9（既存機能の受入）
- 変更許可: proposal #240（`scoped-lift`）により下記 6 ファイルの変更を包括許可済み。エミュレータ都合の変更禁止（fact #31 / TC-BLE-EMU-020）は維持する。
- 対象ファイル:
  - `src/data/src/app/driving/driving.page.ts`
  - `src/data/src/app/bad-spot/bad-spot.page.ts` / `.html`
  - `src/data/src/app/settings/settings.page.ts` / `.html`
  - `src/data/src/app/services/map.service.ts`
  - `src/data/src/app/services/login.service.ts`
  - `src/data/src/environments/environment.ts`
  - `src/data/tools/gen-mock-sensorlog.mjs`（`hiyari_recording` シナリオ追加）

#### タスク

| # | 内容 | 根拠 |
|---|---|---|
| 10-1 | 設定画面 3-1 の録画トグル直下に「ヒヤリ前後秒数（秒）」を追加。`ion-input type="number"`、既定 15 / 閉区間 [5,60]、検証・復帰・保存は `ionBlur`、エラー表示なし、無効化条件は `!hasAndroid \|\| settingRecording=='disable'` | fact #4633、proposal #229 / #231 |
| 10-2 | `environment.ts` に `settingRecordingMargin: 'setting-recording-margin'`、`login.service` に `settings.recordingMargin`（`?? 15`、非 Android の強制値なし） | proposal #229 |
| 10-3 | `startVideo()` を `start(1000)` に変更。`chunk[0]` を常時保持しつつ、直近 `n+5` 秒のリングバッファを持つ。切り詰め・区間選択は**チャンク個数ではなく受信時刻**で判定する | proposal #227 / #243 |
| 10-4 | 区間 `[t-n, t+n]` の確定。区間が開いた時点で `hiyari.NN.webm` を作成し、閉じるまで逐次 append。重なる連続ヒヤリは終端を `t2+n` へ延長して連結。尺不足は取得範囲をそのまま保存し、診断終了時に未確定区間を確定させる。ヒヤリ 0 件なら生成しない。`movie.webm` は作らない | fact #4330、proposal #227 / #230 / #242 |
| 10-5 | 書き出しは `chunk[0]` の **EBML ヘッダ部分のみ**（先頭から最初の Cluster ID `0x1F43B675` の手前まで）＋区間クラスタ。クラスタの Timecode は書き換えない | proposal #244 / #245 |
| 10-6 | `markersVideoTime` は元の録画ストリーム内オフセット秒（`pushBadPoint()` / `seekVideo()` は変更しない）。`drawMarker()` に動画ファイル名引数を追加し `markersVideoPath` で保持 | proposal #241、fact #4635 撤回 |
| 10-7 | 6-1: マーカー選択時にファイルが異なれば `src` 差し替え→`seekVideo()`。300ms 自動追尾は同一ファイル内に限定。前後ボタンは全マーカーをリング巡回。`autoplay=false` 維持 | proposal #228 §2-2 |
| 10-8 | `onStart()` で `videoStartTimestamp` を記録し、`videoStartTimestamp - startTimestamp` のギャップをログに出す（proposal #243 で「実測後に判断」とされた項目） | proposal #243 |
| 10-9 | モックシナリオ `hiyari_recording`（`canConnected` / `--duration 90` / 9000 行、ヒヤリ 15・30・40・45・48・60 秒）を生成し、正準を 9 シナリオ 10 ファイルへ拡張。既存 9 ファイルのバイト列は不変 | proposal #253 / #254 |
| 10-10 | 実機 E2E（BLE エミュレータ＋モック GPS＋`settingRecordingMargin = 5`）。期待値は 5 ファイル・6 マーカー | proposal #253 §4-4 |

#### 完了判定

DoD-15 / DoD-16 / DoD-17。あわせて proposal #253 §4-4 の合格条件 12 項目を満たすこと。

### 依存関係ダイアグラム（テキスト）

```
M0(env) ──> M1(infra) ──┬──> M4(mw基盤) ──> M5(mwセンサ) ──> M6(mwスコア) ──> M7(ui) ──> M9(受入)
            │           │                     ^                                  ^
            └> M2(db) ──┘                     │                                  │
            └> M3(qa mock) ───────────────────┘                                  │
                                    M8(BLEエミュ/GPSフィーダ) ────────────────────┘
                                                                              │
                                                    M10(2026改修⑤ ヒヤリ録画) <┘
```

---

## 5. アーキテクチャ決定

### 5.1 採用技術（固定・変更禁止）

| 区分 | 採用 | 備考 |
|---|---|---|
| UI フレームワーク | Ionic 7 | SPA |
| アプリフレームワーク | Angular 15 | `AppModule` 単一モジュールで 8 画面ルータ配線 |
| ネイティブブリッジ | Capacitor 4（+ Cordova プラグイン併用） | `env.config.capacitor` |
| Node | **18.19.1**（nvm + `src/data/.nvmrc`） | ビルド前提 |
| DB | SQLite (`driving-score.db`) | Cordova SQLite プラグイン経由 |
| BLE | `@capacitor-community/bluetooth-le` | addressType=public 前提 |
| 地図 | Google Maps JavaScript API（Android はネイティブ Maps SDK キー併用） | `mapsKey` は `environment` |
| グラフ | Chart.js | `ui.history.page` |
| 圧縮 | pako（gzip） | センサログ `.txt.gz` |
| ハッシュ | MD5 | パスワード保存（現行仕様維持） |
| モック生成 | Node 18.19.1 + pako のみ | `gen-mock-sensorlog.mjs` |
| BLE エミュレータ | Python3 + python3-dbus（BlueZ D-Bus）— **新規依存ゼロ** | 既定 A |
| 開発プラットフォーム | Linux（`dev_platform=linux`） | Win/Mac 非対応 |

### 5.2 ディレクトリ構造（骨格）

```
driving-score/
├── scripts/                         # ★必須成果物（§9）
│   ├── setup.sh                     # 環境構築（nvm/Node 18.19.1/npm ci/Android前提チェック）
│   ├── start-web.sh                 # ブラウザ起動（ionic serve）
│   ├── start-android.sh             # Android 実機/エミュ起動（build + cap run）
│   ├── gen-mock.sh                  # 正準9ファイル再生成 + 差分検査
│   ├── start-ble-emulator.sh        # 既定A起動ラッパ
│   ├── start-gps-feeder.sh          # GPSフィーダ起動ラッパ
│   └── restore-bluez.sh             # 代替B使用後のBlueZ復帰（必須）
├── spec/                            # 仕様書（本書の参照先・改変は仕様更新PRで）
├── src/
│   ├── app/
│   │   ├── app.module.ts            # env.app.bootstrap
│   │   ├── pages/                   # ui.* （opening/account/driving/history/settings/edit/badspot/comment）
│   │   ├── services/                # middleware.*（login/log/map/sensor*/score*）
│   │   ├── models/                  # db.user.model / db.score.model
│   │   ├── repositories/            # db.user.repository / db.score.repository
│   │   └── infra/                   # infra.*（ble-device / bluetooth-le / google-maps / file-storage / cordova-sensors）
│   ├── assets/
│   │   ├── scoreLogicJson/          # infra.assets.scoreLogicJson
│   │   └── geolocation.json         # infra.assets.geolocation（未参照）
│   ├── environments/                # env.config.environment
│   └── data/
│       ├── .nvmrc                   # 18.19.1
│       ├── src/                     # scoreLogicFunction.txt / scoreLogicFunction_simple.txt
│       ├── mock/                    # sensor-log.<scenario>.<sensorMode>.txt.gz（正準9ファイル・commit）
│       └── tools/
│           ├── gen-mock-sensorlog.mjs
│           ├── ble-can-emulator.py  # 既定A
│           └── mock-gps-feeder.py
├── src/tools/ble-can-emulator/      # 代替B（bumble）— 凍結・改変禁止
├── capacitor.config.ts
├── android/                         # AndroidManifest（Maps SDK キー）
└── .gitignore                       # .smith 除外 / ローカル bind 方針
```

### 5.3 状態管理方針

- **グローバル状態は Angular DI のシングルトンサービスに集約**する。専用状態管理ライブラリ（NgRx 等）は導入しない。
  - 認証・ユーザ・アプリ設定 → `middleware.login.service`（`settings` 永続化を含む）
  - センサー現在値 → `middleware.sensor.service`（10ms 周期、`sensor.manager` と相互依存）
  - デモ再生状態 → `middleware.sensor.demoData`（**シングルトン**）
  - スコア状態 → `middleware.score.logic`（300ms 周期評価、平均初期値 100、0 件フィールドは前回値保持）
- **永続化の役割分担**
  - 構造化データ（ユーザ・スコア・履歴・能力指標） → SQLite（`db.*.repository`）
  - スコアロジック JS 文字列 → Ionic Storage
  - ログ / センサログ / webm → `infra.file.storage`（`Documents/driving-score`、ブラウザは Blob ダウンロード）
- **周期の固定値**: センサー集約 10ms、スコア評価 300ms、BLE notify（実機経路）100ms、モック GPS 1Hz。**変更禁止**。
- **数値の丸め**: DB は REAL で保持し、**丸めは表示層（UI）責務**。リポジトリ層で丸めない。
- **ログ経路の統一**: 全層のログは `middleware.log.service` → `infra.file.storage` に集約する。各層で直接ファイル書込しない。

### 5.4 契約（インターフェース）上の不変条件

1. センサログ 1 行 = `{date, sensor}`。`date` = `YYYY-MM-DD HH:mm:ss.SSS`。JSON Lines を pako.gzip した `.txt.gz`。Base64 化は `ui.edit.page` 投入時のみ。
2. 必須キー: `videoTime` / `geolocation` / `acceleration` / `gyroscope` / `magnetometer`。欠落行は skip。
3. `smartphoneOnly` は `canData` 省略（`convertOldData` がゼロ補充）、`canConnected` は全フィールド明示。
4. CAN パケットは 12 バイト固定。service `0x2310` / notify characteristic `0x2311` / LocalName `DrivingCanData`。
5. デモ/実機切替は `DemoData.getSensorLogDataSize()>0`。非 Android でも DemoData 再生する。
6. `infra.ble.device` の I/F は BLE エミュレータ都合で変更しない（`notify_interval_ms` 追加禁止）。

---

## 6. タスク分解（担当エージェント別）

> 各タスクは「実装 → 自己テスト → 該当 QA 仕様の TC 実行 → PR」を 1 単位とする。詳細仕様は必ず entrypoint を参照すること。

### 6.1 Env-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| ENV-01 | `AppModule` で 8 画面のルータ配線 + Cordova/Capacitor プラグイン DI 登録 | `spec/env/app-bootstrap.md` | 全ルート到達可 |
| ENV-02 | Node 18.19.1 固定（nvm / `src/data/.nvmrc`） | `spec/env/app-bootstrap.md`, `spec/env/build-installer.md` | `node -v` = v18.19.1 |
| ENV-03 | `environment` 定義（`mapsKey`、ロール定義、ログイン認証方式） | `spec/env/config-environment.md` | ビルド通過 |
| ENV-04 | Capacitor / AndroidManifest 設定（Android Maps SDK キー、権限） | `spec/env/config-capacitor.md` | 実機で地図表示 |
| ENV-05 | **`scripts/setup.sh`（環境構築スクリプト）** | `spec/env/build-installer.md` | DoD-1 |
| ENV-06 | **`scripts/start-web.sh` / `scripts/start-android.sh`（起動スクリプト）** | `spec/env/build-installer.md` | DoD-2 |
| ENV-07 | 社内配布用フルオートインストーラ／ビルドバッチ群（`dev_platform=linux`） | `spec/env/build-installer.md` | APK 生成再現 |
| ENV-08 | `.gitignore`（`.smith` 除外、ローカル bind 方針） | `spec/env/repo-gitignore.md` | DoD-13 |
| ENV-09 | `spec/qa/env.md` の TC 実行 | `spec/qa/env.md` | 全 TC PASS |

### 6.2 Infra-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| INF-01 | `@capacitor-community/bluetooth-le` 導入（addressType=public 前提） | `spec/infra/bluetooth-le.md` | 接続成功 |
| INF-02 | `BLEDevice` 実装（3s スキャン → `connect(timeout:10000)` → `startNotifications` → 12 バイトデコード） | `spec/infra/ble-device.md` | エミュレータから notify 受信 |
| INF-03 | `infra.file.storage`（`Documents/driving-score` 書出、ブラウザ Blob、`.txt.gz`） | `spec/infra/file-storage.md` | ラウンドトリップ成功 |
| INF-04 | Google Maps JS API ローダ | `spec/infra/google-maps.md` | 地図初期化成功 |
| INF-05 | Cordova センサープラグイン群（GPS/加速度/ジャイロ/磁力/SQLite/権限） | `spec/infra/cordova-sensors.md` | 各センサー値取得 |
| INF-06 | `scoreLogicJson` アセット整備（`label1/label2/labelA/labelB` 設定、`label3/label4/labelC` は空） | `spec/infra/assets-scoreLogicJson.md` | バージョン管理付きで読込成功 |
| INF-07 | `geolocation.json` 同梱（**参照配線しない**） | `spec/infra/assets-geolocation.md` | ファイル存在のみ |
| INF-08 | `spec/qa/infra.md` の TC 実行 | `spec/qa/infra.md` | 全 TC PASS |

### 6.3 DB-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| DB-01 | `db.user.model`（POCO、MD5 済み文字列保持） | `spec/db/user-model.md` | 型定義完了 |
| DB-02 | `db.user.repository`（`users.height` を REAL） | `spec/db/user-repository.md`, `spec/db/schema-corrections.md` | 小数往復 |
| DB-03 | `db.score.model`（スコア系 REAL、丸めは表示層） | `spec/db/score-model.md` | 型定義完了 |
| DB-04 | `db.score.repository`（`score`/`score_history`/`capability_score` REAL 是正） | `spec/db/score-repository.md`, `spec/db/schema-corrections.md` | 小数往復 |
| DB-05 | CREATE TABLE 是正 + シード最小方針の適用 | `spec/db/schema-corrections.md`, `spec/ER_DIAGRAM.md` | DoD-4 |
| DB-06 | リポジトリ→`log.service` 経路の配線 | `spec/middleware/log-service.md` | ログ出力確認 |
| DB-07 | `spec/qa/db.md` 4 ノード分 TC 実行 | `spec/qa/db.md` | 全 TC PASS |

### 6.4 Middleware-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| MW-01 | `log.service`（debug/error/sensor、JSON Lines + pako.gzip、`sensor-log.YYYYMMDD-HHMMSS.txt.gz`） | `spec/middleware/log-service.md` | 形式一致 |
| MW-02 | `login.service`（認証・状態管理・`settings` 永続化） | `spec/middleware/login-service.md` | ログイン/ログアウト動作 |
| MW-03 | `map.service`（マーカー・軌跡・自車位置追従） | `spec/middleware/map-service.md` | 軌跡描画 |
| MW-04 | `sensor.manager`（キャリブレーション & 座標変換、静的クラス） | `spec/middleware/sensor-manager.md` | 変換単体テスト PASS |
| MW-05 | `sensor.demoData`（シングルトン、gzip+Base64 + webm 再生、欠落行 skip、`convertOldData` ゼロ補充） | `spec/middleware/sensor-demoData.md` | 9 ファイル通し再生 skip 0 |
| MW-06 | `sensor.service`（10ms 集約、デモ切替 `>0`、モード別ゲート + ゼロ埋め規則） | `spec/middleware/sensor-service.md` | DoD-11 再現 |
| MW-07 | `score.logic`（`new Function()` / 300ms、平均初期値 100、-1 除外、0 件は前回値） | `spec/middleware/score-logic.md` | 既知挙動一致 |
| MW-08 | `score.logicCan`（885 行、実行される唯一のロジック） | `spec/middleware/score-logicCan.md` | score2 期待レンジ |
| MW-09 | `score.logicSimple` 同梱のみ（**配線禁止**） | `spec/middleware/score-logicSimple.md` | ファイル同梱のみ |
| MW-10 | `spec/qa/middleware.md` 9 ノード分 TC 実行 | `spec/qa/middleware.md` | 全 TC PASS |

### 6.5 UI-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| UI-01 | `opening.page`（`scoreLogicJson` 初期化、`scoreLogicFunction.txt` のみ GET、導線制御） | `spec/ui/opening-page.md` | 導線・初期化成功 |
| UI-02 | `account.page`（2-1/2-2、Reactive Forms、MD5 保存、削除） | `spec/ui/account-page.md` | バリデーション網羅 |
| UI-03 | `settings.page`（3-1、設定切替、`scoreLogic`/`scoreLogicJson` 読込・書出） | `spec/ui/settings-page.md` | 読込/書出成功 |
| UI-04 | `edit.page`（3-2、`.txt.gz` を FileReader で Base64 化 → `pushSensorLogFile`、webm は `movieFile`） | `spec/ui/edit-page.md` | モック 9 ファイル通し再生 |
| UI-05 | `driving.page`（4-1〜4-3、10ms 統合、スコア表示、地図、動画記録、DB/ファイル書込、badspot 遷移） | `spec/ui/driving-page.md` | 一連の走行記録完了 |
| UI-06 | `badspot.page`（6-1、動画再生 + マーカー自動追尾） | `spec/ui/badspot-page.md` | 追尾同期 |
| UI-07 | `comment.page`（5-1、positive/negative 選出） | `spec/ui/comment-page.md` | コメント表示 |
| UI-08 | `history.page`（7-1/7-2、Chart.js 可視化） | `spec/ui/history-page.md` | 履歴・能力指標表示 |
| UI-09 | 表示層での丸め実装（DB は REAL 保持） | `spec/db/score-model.md` | 表示値一致 |
| UI-10 | `spec/qa/ui.md` 8 ノード分 TC 実行 | `spec/qa/ui.md` | 全 TC PASS |

### 6.6 QA-agent

| ID | タスク | 参照 entrypoint | 完了条件 |
|---|---|---|---|
| QA-01 | センサログ正準スキーマ定義の実装反映確認 | `spec/qa/mockdata-sensorlog-schema.md` | 契約一致 |
| QA-02 | `gen-mock-sensorlog.mjs` 実装（CLI: `--scenario/--sensor-mode/--duration/--out`、`--base-time`） | `spec/qa/mockdata-sensorlog-generator.md` | 決定的生成 |
| QA-03 | 正準 9 ファイル生成 & commit（既存 6 ファイルのバイト列不変） | `spec/qa/mockdata-sensorlog-scenarios.md` | DoD-6 |
| QA-04 | 10 件区間集約 + 12 バイト符号化の検証 | `spec/qa/mockdata-sensorlog-aggregation.md` | 符号化一致 |
| QA-05 | BLE エミュレータ A（`ble-can-emulator.py`）実装 | `spec/qa/mockdata-ble-emulator.md` | DoD-7 |
| QA-06 | CLI 値域・エラーメッセージ・検証順序・`[inject-invalid]` 出力の実装とテスト | `spec/qa/mockdata-ble-emulator.md` | DoD-8（TC-BLE-EMU-010 含む） |
| QA-07 | `mock-gps-feeder.py` 実装（`appops` 前後処理含む） | `spec/qa/mockdata-gps-feeder.md` | DoD-10 |
| QA-08 | 横断シナリオ（未ログインアクセス制御、DB 整合） | `spec/qa/cross-domain.md` | 全 TC PASS |
| QA-09 | score2 三段比較の実機受入（stable>weak>strong） | `spec/qa/mockdata-sensorlog-scenarios.md` | DoD-9 |
| QA-10 | `spec/qa/qa.md`（coverage 0）の整備 | `spec/qa/qa.md` | TC 定義完了 |
| QA-11 | 統合テストレポート作成 | 全 `spec/qa/*` | DoD-12 |

---

## 7. テスト戦略

### 7.1 レイヤ別方針

| レイヤ | 種別 | 対象 | ツール |
|---|---|---|---|
| ユニット | 純関数・変換ロジック | `sensor.manager` の座標変換、12 バイトデコード/エンコード、`convertOldData` のゼロ補充、`calculator()` の -1 除外、MD5、gzip ラウンドトリップ、REAL 往復 | Jasmine/Karma（Angular 既定） |
| コンポーネント | 画面単体 | Reactive Forms バリデーション（account）、Chart.js データバインド（history）、コメント選出（comment） | Angular TestBed |
| 結合 | サービス間 | `sensor.service` ⇄ `demoData` ⇄ `score.logic` の 10ms/300ms 周期連携、`log.service` → `file.storage` | TestBed + フェイクタイマー |
| E2E（デモ再生） | ブラウザ | `ui.edit.page` へモック 9 ファイルをアップロードして通し再生 → スコア確認 | 手動 + スクリプト補助 |
| E2E（実機 BLE） | Android 実機 | エミュレータ A → `infra.ble.device` → `sensor.service` → `score.logicCan` | logcat 実測 |
| E2E（実機 GPS） | Android 実機 | `mock-gps-feeder.py` → `sensor.service` | 手動 |
| 受入 | 横断 | `spec/qa/cross-domain.md` の全シナリオ | 手動 |

### 7.2 必須テストケース（抜粋・詳細は qa 仕様参照）

#### センサログ / モックデータ

1. **形式**: 1 行 `{date, sensor}`、`date=YYYY-MM-DD HH:mm:ss.SSS`、JSON Lines + pako.gzip。
2. **欠落行 skip**: 必須キー（`videoTime`/`geolocation`/`acceleration`/`gyroscope`/`magnetometer`）のいずれか欠落 → その行のみ skip、後続は継続。
3. **`canData` 欠落**: `smartphoneOnly` ログで `convertOldData` がゼロ補充。
4. **決定的性**: 同一 CLI 引数で再生成 → バイト列一致（`git diff` 空）。
5. **セルフチェック**: unzipped 相当で skip 0・行数一致（60s/10ms = **6000 レコード**）。
6. **既存 6 ファイル不変**: `cruise×smartphoneOnly/canConnected` + `accel_decel/hard_brake/sharp_curve/mixed×canConnected` のプロファイルとバイト列を変更しない。
7. **LCG 決定性**: `Math.random` 不使用。シナリオごとに seed リセットされること。

#### スコアロジック

8. **`smartphoneOnly`**: CAN ゼロ埋めにより全指標未発火 → **全項目 100（未算出）**。これを FAIL としない（仕様どおり）。
9. **初期空 Score**: `start()` 直後の空 Score（100）が 1 件混ざる → 平均に影響する既知挙動を再現。
10. **0 件フィールド**: 前回値（既定 100）保持。
11. **score1/scoreA/scoreB**: 駐車 D→R→P のみで発火。
12. **score2（10 秒ゲート）**: 40km/h・`turnSignal=0`・`|steer|<=15°` が 10 秒継続 → 区間 3 の **37.2 秒**で成立。
13. **score2 三段**: `stable>=80` / `weak` は 40 以上 70 未満 / `strong<20`、かつ `stable>weak>strong`（実機 BLE 100ms 経路）。
14. **score3/score4/scoreC**: 未設定のまま（`label3/label4/labelC` も空）。
15. **ヒヤリ**: `longAcc`/`latAcc` の Jerk で `hiyari=true` とメッセージのみ。**スコア値は変わらない**。

#### BLE

16. **正常起動**: LocalName `DrivingCanData`、service `0x2310`、notify `0x2311`、12 バイト notify を logcat で実測。
17. **アドレスタイプ**: 広告が **public**（random static では GATT `0x3E` 失敗し得る）。
18. **`--rate-ms` 境界**: 9 / 10 / 1000 / 1001。9 と 1001 は exit 1 + `[ERROR] --rate-ms は 10〜1000 の範囲で指定してください（指定値: N）`（TC-BLE-EMU-010）、GATT/広告/notify 未到達。
19. **`--inject-invalid` 値**: `short11`/`long13`/`zeros`/`ones` の**小文字完全一致のみ**（正規化なし、空文字列も不正）。未知値は `[ERROR] --inject-invalid は short11, long13, zeros, ones のいずれかを指定してください（指定値: X）`。
20. **検証順序**: 両方不正 → `--rate-ms` のエラーのみ出力。
21. **正常時出力**: `[source]` 行の直後に `[inject-invalid] <kind>` を 1 行。
22. **不正フレーム耐性**: `short11`（11 バイト）/`long13`（13 バイト）/`zeros`/`ones` 投入時にアプリがクラッシュしない。
23. **排他**: A/B 同時起動不可。B 使用後は `restore-bluez.sh` で BlueZ 復帰。

#### GPS

24. **投入項目**: `latitude`/`longitude`/`accuracy` のみ 1Hz・100 レコードごと・60 点。`altitude`/`heading`/`speed` は投入しない。`fused` は登録しない。
25. **前後処理**: 事前 `appops set com.android.shell android:mock_location allow`、終了時 `remove-test-provider gps` + `appops default`。

#### DB

26. **REAL 往復**: `users.height`、`score`/`score_history`/`capability_score` のスコア系が小数で往復し、丸められない。
27. **丸め位置**: リポジトリ層で丸めない。表示層のみで丸める。
28. **MD5**: パスワードがハッシュ済み文字列で保存され、平文が DB に残らない。

#### 横断 / UI

29. **未ログインアクセス制御**: 未ログイン状態で driving/history/comment 等へ到達不可（`spec/qa/cross-domain.md`）。
30. **切替閾値**: `DemoData.getSensorLogDataSize()>0` でデモ、`0` で実センサー。非 Android でもデモ再生。
31. **ロジック選択**: `opening.page` が常に `scoreLogicFunction.txt` のみ GET（`_simple` は GET しない）。

### 7.3 境界ケース一覧（必ず確認）

| カテゴリ | 境界 |
|---|---|
| センサログ件数 | 0 件（実センサー）/ 1 件（デモ切替）/ 6000 件（60s） |
| CAN パケット長 | 11 / **12** / 13 バイト |
| `--rate-ms` | 9 / 10 / 100（既定・暫定）/ 1000 / 1001 |
| `--inject-invalid` | 未指定 / 空文字列 / 大文字（`SHORT11`）/ 正規 4 値 / 未知値 |
| 舵角 | ±2°（wobble）/ ±8°（stable 階段）/ `±15°`（ゲート境界）/ 16°（ゲート外） |
| 10 秒ゲート | 9.99s / 10.00s / 37.2s（成立点） |
| longAcc 判定 | `0.02` / `>0.02`（120/0/0）/ `<-0.02`（0/200/1）/ 中間（40/0/0） |
| 速度 | 0km/h / 40km/h（score2 条件）/ `speed = vehicleSpeed/3.6` 整合 |
| スコア値 | 0 / 100（未算出）/ -1（`calculator()` 除外対象） |
| duty | 0% / 25%（weak）/ 100%（strong） |
| GPS | 東京駅起点 / 60 点目 / provider 未登録時 |
| 数値精度 | REAL の小数保持（例: `height=170.5`） |

---

## 8. PR / コミット運用

### 8.1 ブランチ戦略

- ベース: `main`（常にビルド可能・DoD 未達でもビルドは通ること）
- 統合: `develop`（マイルストーン単位の統合先）
- 作業: `feat/<domain>/<node-id-short>`（例: `feat/middleware/sensor-service`, `feat/qa/ble-emulator`）
- 修正: `fix/<domain>/<短い説明>`
- 仕様更新: `spec/<node-id-short>`（`spec/**` のみを変更する PR。実装 PR と混在させない）

### 8.2 コミット粒度・メッセージ

- **1 コミット = 1 ノード内の 1 論理変更**。複数ノードを跨ぐコミットは禁止。
- 形式: `<type>(<node-id>): <要約>`
  - `type`: `feat` / `fix` / `refactor` / `test` / `docs` / `chore` / `build`
  - 例: `feat(middleware.sensor.service): 10ms集約とモード別ゼロ埋めを実装`
  - 例: `test(qa.mockdata.ble.emulator): --rate-ms境界 TC-BLE-EMU-010 を追加`
- モック生成物（`src/data/mock/*.txt.gz`）は**生成器の変更と同一コミット**に含め、再生成コマンドを本文に記載する。
- `.smith` 等の除外対象、ビルド生成物、ローカル bind 対象は**コミット禁止**（`spec/env/repo-gitignore.md`）。

### 8.3 PR 粒度

- 1 PR = 1 ノード（または密結合な 2 ノード：`sensor.service` + `sensor.manager` のような相互依存）。
- 1 PR あたり差分は目安 600 行以内。超える場合は分割する。
- PR タイトル: `[<domain>] <node-id>: <要約>`
- PR 本文テンプレート（必須項目）
  1. 対象ノード ID と `entrypoint` へのリンク
  2. 実装内容の要約
  3. **仕様との対応表**（仕様の項目 → 実装箇所）
  4. 実行した TC と結果（PASS/FAIL/BLOCKED、実測値）
  5. 未対応事項・既知の制約（「やらないこと」該当は明記）
  6. 再現手順（`scripts/*` のどれを使うか）

### 8.4 レビュー観点（チェックリスト）

- [ ] **仕様一致**: `entrypoint` の記述と実装が一字一句レベルで一致しているか（特にエラーメッセージ文言・出力行順・exit code）
- [ ] **既知挙動の保存**: `smartphoneOnly` の全項目 100、初期空 Score 1 件混入、0 件フィールドの前回値保持を「修正していない」か
- [ ] **スコープ逸脱なし**: `logicSimple` の配線、`score3/4/C` の実装、`geolocation.json` の参照、`notify_interval_ms` 追加、アプリ本体のエミュレータ都合変更が**入っていない**か
- [ ] **決定的性**: モック生成物が再生成でバイト一致するか。`Math.random` 未使用か。既存 6 ファイルのバイト列が不変か
- [ ] **周期・定数**: 10ms / 300ms / 100ms / 1Hz、閾値（`±0.02G`、`|steer|<=15°`、40km/h、10 秒）が仕様値か
- [ ] **REAL 是正**: 丸めがリポジトリ層に混入していないか（丸めは表示層のみ）
- [ ] **BLE 前提**: 広告が public アドレスタイプか。CLI 値域検証が `main()` 冒頭（D-Bus 前）で行われているか。検証順序が `--rate-ms` → `--inject-invalid` か
- [ ] **クリーンアップ**: GPS フィーダ終了時の `remove-test-provider` + `appops default`、B 使用後の `restore-bluez.sh` が担保されているか
- [ ] **ログ経路**: 直接ファイル書込がなく `middleware.log.service` 経由か
- [ ] **成果物**: 変更に伴い `scripts/*` と README の手順が更新されているか
- [ ] **gitignore**: 生成物・`.smith` が混入していないか

### 8.5 マージ条件

1. レビュー承認 1 名以上（クロスドメイン変更は関係ドメインの owner 全員）
2. ビルド（`ionic build`）成功
3. ユニットテスト全 PASS
4. 該当ドメインの `spec/qa/<domain>.md` TC 全 PASS（BLOCKED は理由を PR に明記）
5. `git status` クリーン

---

## 9. 実装成果物（必須）: 環境構築・起動スクリプト

**以下は必須成果物である。実装完了の条件に含まれる（DoD-1 / DoD-2 / DoD-14）。**

### 9.1 `scripts/setup.sh` — 環境構築スクリプト

責務（詳細は `spec/env/build-installer.md` を参照）:

1. 実行プラットフォームが Linux（`dev_platform=linux`）であることを確認。非 Linux は明示エラーで終了。
2. nvm の存在確認 → 無ければ導入手順を案内。
3. `src/data/.nvmrc`（`18.19.1`）に基づき Node 18.19.1 をインストール・`use`。
4. `npm ci`（lockfile 厳守）で依存導入。Ionic CLI / Capacitor CLI の用意。
5. Android SDK / platform-tools / JDK の前提チェック（不足はメッセージで明示）。
6. BLE エミュレータ A の前提確認: `python3`、`python3-dbus`、BlueZ（`LEAdvertisingManager1` の存在、`SupportedInstances` > 0）。**新規 pip 依存は導入しない。**
7. `adb` の存在確認（GPS フィーダ用）。
8. 冪等であること（再実行で壊れない）。
9. 終了時にチェック結果サマリ（OK/NG 一覧）を出力し、NG があれば非 0 で終了。

### 9.2 `scripts/start-web.sh` — ブラウザ起動

1. Node 18.19.1 を `use`。
2. `ionic serve`（開発サーバ）を起動。
3. 起動後、モック検証手順（`ui.edit.page` へ `src/data/mock/*.txt.gz` をアップロード）を標準出力で案内。

### 9.3 `scripts/start-android.sh` — Android 実機/エミュ起動

1. Node 18.19.1 を `use`。
2. `ionic build` → `npx cap sync android` → `npx cap run android`。
3. `adb devices` で対象端末を確認できない場合は明示エラー。
4. 起動後、logcat 監視コマンド（BLE notify 実測用）を案内。

### 9.4 補助スクリプト（必須）

| スクリプト | 責務 | 参照 |
|---|---|---|
| `scripts/gen-mock.sh` | 正準 9 ファイルを再生成し、`git diff` が空であることを検査（非空なら非 0 終了） | `spec/qa/mockdata-sensorlog-generator.md` |
| `scripts/start-ble-emulator.sh` | 既定 A（`src/data/tools/ble-can-emulator.py`）を起動するラッパ。`--source` / `--rate-ms` / `--loop` / `--inject-invalid` を透過。A 使用不能時（`LEAdvertisingManager1` 無し / `SupportedInstances=0` / `Register*` 失敗）のみ B への切替を案内。**A/B 同時起動を防止** | `spec/qa/mockdata-ble-emulator.md` |
| `scripts/start-gps-feeder.sh` | `appops set com.android.shell android:mock_location allow` → `mock-gps-feeder.py` 実行 → 終了時に `remove-test-provider gps` + `appops default`（トラップで異常終了時も実行） | `spec/qa/mockdata-gps-feeder.md` |
| `scripts/restore-bluez.sh` | 代替 B 使用後の BlueZ 復帰（`bluetoothd` 再開など）。**B 使用後は必須実行** | `spec/qa/mockdata-ble-emulator.md` |

### 9.5 スクリプト共通要件

- `#!/usr/bin/env bash` + `set -euo pipefail`。
- 前提不足時は「何が不足し、どう解決するか」を 1 行で明示。
- 破壊的操作（`appops` 変更、`bluetoothd` 停止）は実行前に対象と復帰手順を表示し、終了時トラップで必ず復帰させる。
- すべて `README` からリンクし、開発者が README 1 ページで環境構築 → 起動 → モック検証 → BLE/GPS 検証まで到達できること。

---

## 10. リスクと注意事項

| # | リスク | 対応 |
|---|---|---|
| R-1 | `smartphoneOnly` の「全項目 100」を不具合と誤認して修正してしまう | 仕様どおりの既知挙動。**修正禁止**。PR レビューで必ず確認（§8.4） |
| R-2 | `logicSimple` を親切心で配線してしまう | スコープ外。`opening.page` は `scoreLogicFunction.txt` のみ GET |
| R-3 | モック既存 6 ファイルのバイト列が変わる | 生成器変更時は必ず `scripts/gen-mock.sh` で差分検査 |
| R-4 | BLE 広告が random static になり GATT `0x3E` で失敗 | エミュレータ側で Privacy=off 等により **public** を担保 |
| R-5 | CLI 値域検証を argparse に任せ、exit code / メッセージ形式が仕様と乖離 | `main()` 冒頭（D-Bus 前）で検証し、exit 1 + `[ERROR]` 1 行に統一 |
| R-6 | 代替 B の改変・A との同時起動で BlueZ が壊れる | B は凍結。同時起動禁止。B 後は `restore-bluez.sh` 必須 |
| R-7 | GPS モック後に `appops` が戻らず端末が汚れる | トラップで `appops default` + `remove-test-provider gps` を保証 |
| R-8 | REAL 是正漏れでスコア小数が丸まる | DB ダンプでの小数往復テストを DoD-4 に固定 |
| R-9 | Node バージョン差異でビルド再現しない | `.nvmrc=18.19.1` + `setup.sh` で強制 |
| R-10 | `infra.assets.geolocation` を参照配線してしまう | 死にアセットとして現状維持 |
| R-11 | `--rate-ms` 既定 100 を恒久仕様と誤認 | 「暫定」であることを実装コメントと README に明記 |