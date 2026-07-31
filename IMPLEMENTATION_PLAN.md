<!-- 作成: 2026-07-20 10:37:20 JST -->

# IMPLEMENTATION_PLAN.md — 運転診断アプリ (driving-score)

作成日: 2026-07-20 JST
対象: Ionic 7 + Angular 15 + Capacitor 4 による運転診断 SPA アプリ

---

## 1. 目的 / 完成定義（Definition of Done）

### 1.1 目的
スマートフォンのセンサー（GPS・加速度・ジャイロ・磁力）または BLE 車載機の CAN データを入力に、リアルタイムで運転診断を行い、スコア・ヒヤリ地点・走行軌跡を SQLite に永続化・可視化する運転診断アプリを実装する。

### 1.2 完成定義（DoD）
以下をすべて満たした時点で完成とする。

- [ ] 全 8 画面（opening / account / driving / history / settings / edit / badspot / comment）がルータ配線され動作する。
- [ ] スマホセンサー版（logicSimple）と CAN 版（logicCan）の双方でリアルタイムスコアリングが動作する。
- [ ] 診断結果が SQLite (`driving-score.db`) の `users` / `score` / `score_history` / `capability_score` に整合して永続化される（スコア系・`users.height` は REAL 保持）。
- [ ] 走行軌跡・自車位置・ヒヤリ地点が Google Maps 上に描画され、badspot 画面で動画再生とマーカー追尾が行われる。
- [ ] 未ログイン時のアクセス制御が仕様どおり機能する（`spec/qa/cross-domain.md` 準拠）。
- [ ] センサログ・エラーログが gzip 圧縮で外部ストレージへ書き出される。
- [ ] 各ドメイン QA 仕様（`spec/qa/*`）のシナリオが自動テストで green。
- [ ] 環境構築スクリプト・起動スクリプトが整備され、README の手順のみで開発環境が立ち上がる。
- [ ] Android 実機ビルド（社内配布フルオートインストーラ）が成功する。

> 各コンポーネントの詳細仕様は下記「参照する仕様一覧」の各 entrypoint を必ず参照すること。

---

## 2. スコープ

### 2.1 やること
- Angular/Ionic ブートストラップとルーティング配線
- 8 ページコンポーネントの実装
- middleware サービス群（login / log / map / sensor 系 / score 系）の実装
- db モデル・リポジトリの実装（REAL 型是正を含む）
- infra 連携（BLE・Google Maps・ファイルストレージ・Cordova センサー・アセット JSON）の実装
- 環境構築・起動スクリプト、社内配布インストーラの整備
- QA 仕様に基づくテスト実装

### 2.2 やらないこと
- `infra.assets.geolocation` は現状 `middleware.sensor.service` から未参照（死にアセット）。**新規参照配線は行わない**。アセットの保持のみ行う。
- 新規診断アルゴリズムの発明（既存 logicSimple / logicCan の仕様に準拠）。
- サーバサイド／クラウド連携（本アプリはローカル完結）。
- iOS 向けネイティブ配布（Android を優先。iOS はスコープ外）。

---

## 3. 参照する仕様一覧

### env
- [spec/env/app-bootstrap.md](spec/env/app-bootstrap.md)
- [spec/env/config-environment.md](spec/env/config-environment.md)
- [spec/env/config-capacitor.md](spec/env/config-capacitor.md)
- [spec/env/build-installer.md](spec/env/build-installer.md)

### ui
- [spec/ui/opening-page.md](spec/ui/opening-page.md)
- [spec/ui/account-page.md](spec/ui/account-page.md)
- [spec/ui/driving-page.md](spec/ui/driving-page.md)
- [spec/ui/history-page.md](spec/ui/history-page.md)
- [spec/ui/settings-page.md](spec/ui/settings-page.md)
- [spec/ui/edit-page.md](spec/ui/edit-page.md)
- [spec/ui/badspot-page.md](spec/ui/badspot-page.md)
- [spec/ui/comment-page.md](spec/ui/comment-page.md)

### middleware
- [spec/middleware/login-service.md](spec/middleware/login-service.md)
- [spec/middleware/log-service.md](spec/middleware/log-service.md)
- [spec/middleware/map-service.md](spec/middleware/map-service.md)
- [spec/middleware/sensor-service.md](spec/middleware/sensor-service.md)
- [spec/middleware/sensor-manager.md](spec/middleware/sensor-manager.md)
- [spec/middleware/sensor-demoData.md](spec/middleware/sensor-demoData.md)
- [spec/middleware/score-logic.md](spec/middleware/score-logic.md)
- [spec/middleware/score-logicSimple.md](spec/middleware/score-logicSimple.md)
- [spec/middleware/score-logicCan.md](spec/middleware/score-logicCan.md)

### db
- [spec/db/user-model.md](spec/db/user-model.md)
- [spec/db/user-repository.md](spec/db/user-repository.md)
- [spec/db/score-model.md](spec/db/score-model.md)
- [spec/db/score-repository.md](spec/db/score-repository.md)
- [spec/ER_DIAGRAM.md](spec/ER_DIAGRAM.md)

### infra
- [spec/infra/ble-device.md](spec/infra/ble-device.md)
- [spec/infra/bluetooth-le.md](spec/infra/bluetooth-le.md)
- [spec/infra/google-maps.md](spec/infra/google-maps.md)
- [spec/infra/file-storage.md](spec/infra/file-storage.md)
- [spec/infra/cordova-sensors.md](spec/infra/cordova-sensors.md)
- [spec/infra/assets-scoreLogicJson.md](spec/infra/assets-scoreLogicJson.md)
- [spec/infra/assets-geolocation.md](spec/infra/assets-geolocation.md)

### qa / アーキテクチャ図
- [spec/qa/cross-domain.md](spec/qa/cross-domain.md)
- [spec/qa/ui.md](spec/qa/ui.md)
- [spec/qa/middleware.md](spec/qa/middleware.md)
- [spec/qa/db.md](spec/qa/db.md)
- [spec/qa/infra.md](spec/qa/infra.md)
- [spec/qa/env.md](spec/qa/env.md)
- [spec/qa/qa.md](spec/qa/qa.md)
- [spec/C4_c4_svg/context.svg](spec/C4_c4_svg/context.svg) / [container.svg](spec/C4_c4_svg/container.svg) / 各 components 図 / [deployment.svg](spec/C4_c4_svg/deployment.svg)

---

## 4. 実装順序（マイルストーン & 依存関係）

依存グラフの葉（infra / db）から根（ui / env）へ積み上げる。

### M0: 基盤セットアップ（env）
- `env.config.environment` → `env.config.capacitor` の設定チェーン確立
- `env.app.bootstrap` のスケルトン（ルータ配線、DI 骨組み）
- 環境構築・起動スクリプト整備（後述の必須成果物）
- 依存: なし（起点）

### M1: infra 層
- `infra.file.storage`（全ログ・出力の集約先）
- `infra.bluetooth.le` → `infra.ble.device`
- `infra.google.maps`
- `infra.cordova.sensors`
- `infra.assets.scoreLogicJson`（+ `infra.assets.geolocation` は保持のみ）
- 依存: M0

### M2: middleware 基盤サービス
- `middleware.log.service`（→ `infra.file.storage`。他サービスが依存するため最優先）
- `db.user.model` / `db.score.model`（POCO のため先行可）
- 依存: M1

### M3: db リポジトリ + login
- `db.user.repository`（`users.height` を REAL 是正）
- `middleware.login.service`（→ user.repository / user.model / scoreLogicJson / log.service）
- `db.score.repository`（`score`/`score_history`/`capability_score` の REAL 是正、login.service 参照）
- 依存: M2

### M4: middleware 上位サービス
- `middleware.map.service`（→ google.maps / log.service）
- `middleware.sensor.manager` ⇄ `middleware.sensor.service`（相互依存に注意）
- `middleware.sensor.demoData`（→ file.storage / log.service）
- `middleware.score.logic`（→ score.model / scoreLogicJson / log.service）
- `middleware.score.logicSimple` / `middleware.score.logicCan`（→ score.logic、logicCan は ble.device 参照）
- 依存: M3

### M5: UI 画面
- 先行: `ui.opening.page`（起動導線・認証誘導・scoreLogicJson 初期化）
- `ui.account.page` / `ui.settings.page` / `ui.edit.page`
- `ui.driving.page`（センサー統合の中核、10ms 周期）→ `ui.badspot.page`
- `ui.history.page` / `ui.comment.page`
- 依存: M4

### M6: 統合 & 配布
- `env.build.installer`（社内配布フルオートインストーラ）
- ドメイン横断 QA（`spec/qa/cross-domain.md`）通し
- Android 実機ビルド確認
- 依存: M5

---

## 5. アーキテクチャ決定

### 5.1 採用技術
- フレームワーク: Ionic 7 + Angular 15（NgModule ベース、`AppModule` 配線）
- ネイティブブリッジ: Capacitor 4 + Cordova プラグイン（GPS・加速度・ジャイロ・磁力・SQLite・権限）
- BLE: `@capacitor-community/bluetooth-le`
- 地図: Google Maps JavaScript API（Android ネイティブは Maps SDK、キーは Capacitor/AndroidManifest 側）
- グラフ: Chart.js（history 画面）
- DB: SQLite（`driving-score.db`）
- ハッシュ: MD5（User パスワード保存）
- 圧縮: gzip（センサログ・ログ書出）

### 5.2 ディレクトリ構造（指針）
```
src/
  app/
    app.module.ts / app-routing.module.ts       # env.app.bootstrap
    pages/
      opening/ account/ driving/ history/
      settings/ edit/ badspot/ comment/          # ui.*
    services/
      login.service.ts log.service.ts map.service.ts
      sensor.service.ts sensor-manager.ts sensor-demo-data.ts
      score-logic.ts score-logic-simple.ts score-logic-can.ts   # middleware.*
    db/
      models/ (user.model.ts score.model.ts)
      repositories/ (user.repository.ts score.repository.ts)    # db.*
    infra/
      ble/ (ble-device.ts) maps/ file-storage/ sensors/          # infra.*
  environments/                                   # env.config.environment
  assets/
    scoreLogicJson/ geolocation/                  # infra.assets.*
capacitor.config.ts / android/                    # env.config.capacitor
scripts/                                          # 環境構築・起動・ビルド
```

### 5.3 状態管理方針
- グローバル状態は **`middleware.login.service`** に集約（認証状態・`settings` 永続化）。専用状態管理ライブラリ（NgRx 等）は導入しない。
- リアルタイムセンサー統合は `sensor.service` を単一の統合点とし、UI は購読のみ。
- スコアロジックは JS 文字列を動的関数化して周期実行（`score.logic` ランナー）。編集は `edit.page` / `settings.page` からのみ。
- ログはすべて `log.service` → `file.storage` に一元集約。

### 5.4 設計上の注意
- `sensor.manager` と `sensor.service` は相互依存。循環参照を避けるため、`sensor.manager` は静的ユーティリティクラスとして実装し、`service` からの一方向呼び出しに寄せる。
- スコア系・`users.height` は DB では REAL（小数）保持し、**丸めは表示層責務**とする。
- `infra.assets.geolocation` は未参照アセット。配線しないこと。

---

## 6. タスク分解（担当エージェント別）

### Env-agent
- [ ] `env.config.environment`: `mapsKey`・ロール定義・ログイン認証方式の定義
- [ ] `env.config.capacitor`: Capacitor / AndroidManifest 設定、Maps SDK API キー
- [ ] `env.app.bootstrap`: 8 画面ルータ配線、プラグイン DI 登録
- [ ] `env.build.installer`: 社内配布フルオートインストーラ／ビルドバッチ
- [ ] **環境構築スクリプト・起動スクリプトの作成（必須成果物）**

### Infra-agent
- [ ] `infra.file.storage`: `Documents/driving-score` 書出（ブラウザは Blob DL）
- [ ] `infra.bluetooth.le` / `infra.ble.device`: 12 バイト CAN パケットデコード
- [ ] `infra.google.maps`: JS API ローダ
- [ ] `infra.cordova.sensors`: センサープラグイン群ラッパ
- [ ] `infra.assets.scoreLogicJson`: メッセージ辞書・交差点マスタ（バージョン管理付き）
- [ ] `infra.assets.geolocation`: 保持のみ（配線しない）

### DB-agent
- [ ] `db.user.model` / `db.score.model`: POCO 定義（MD5 保持、REAL 保持）
- [ ] `db.user.repository`: `users.height` REAL 是正
- [ ] `db.score.repository`: `score`/`score_history`/`capability_score` REAL 是正
- [ ] ER 図（`spec/ER_DIAGRAM.md`）とのスキーマ整合確認

### Middleware-agent
- [ ] `middleware.log.service`: gzip ログ書出
- [ ] `middleware.login.service`: 認証・状態管理・`settings` 永続化
- [ ] `middleware.map.service`: マーカー・軌跡・自車追従
- [ ] `middleware.sensor.service` / `sensor.manager` / `sensor.demoData`: センサー統合・座標変換・再生
- [ ] `middleware.score.logic` / `logicSimple` / `logicCan`: 診断ランナーと 2 系統ロジック

### UI-agent
- [ ] `ui.opening.page`: 起動・初期化・導線制御
- [ ] `ui.account.page`: Reactive Forms + MD5 保存
- [ ] `ui.driving.page`: 10ms 周期統合・スコア・地図・動画記録
- [ ] `ui.history.page`: Chart.js 可視化
- [ ] `ui.settings.page` / `ui.edit.page`: スコアロジック編集・デモ再生
- [ ] `ui.badspot.page`: 動画再生・マーカー追尾
- [ ] `ui.comment.page`: positive/negative コメント選出

### QA-agent
- [ ] 各ドメイン QA 仕様のテスト実装（`spec/qa/*`）
- [ ] 横断シナリオ（未ログインアクセス制御・DB 整合）

---

## 7. テスト戦略

### 7.1 ユニットテスト（各ドメイン QA 準拠）
- **db** (`spec/qa/db.md`, 4 ノード): モデルの REAL 保持、リポジトリの CRUD、`height` 是正、スコア小数格納の丸め非適用を検証。
- **middleware** (`spec/qa/middleware.md`, 9 ノード): login 認証・settings 永続化、log の gzip 書出、score.logic の動的関数化と周期実行、sensor.manager 座標変換。
- **infra** (`spec/qa/infra.md`): BLE 12 バイトパケットデコード、file.storage 書出分岐（ネイティブ/ブラウザ）、maps ローダ。
- **ui** (`spec/qa/ui.md`, 8 ノード): 各ページのフォームバリデーション・導線・表示ロジック。
- **env** (`spec/qa/env.md`): bootstrap ルータ配線、環境設定読込。

### 7.2 E2E テスト
- 起動 → 未ログイン導線（`ui.opening.page`）
- アカウント作成 → ログイン → 運転診断 → スコア保存 → 履歴確認の一連フロー
- 運転診断 → ヒヤリ地点発生 → `ui.badspot.page` での再生・追尾

### 7.3 横断・境界ケース（`spec/qa/cross-domain.md`）
- 未ログイン状態での保護画面アクセス制御
- DB 整合（`users`/`score`/`score_history`/`capability_score` の外部キー・REAL 整合）
- センサー欠損／BLE 切断時のフォールバック
- スコア境界値（0点・満点・減点上限）
- デモデータ再生とライブセンサーの切替
- `qa.qa` は現状 coverage 0。M6 までに最低限の集約テストを整備すること。

---

## 8. PR / コミット運用

### 8.1 ブランチ戦略
- `main`: リリース可能状態のみ
- `develop`: 統合ブランチ
- `feature/<domain>-<node>`: 例 `feature/middleware-login-service`
- `fix/<issue>` / `chore/<topic>`

### 8.2 コミット粒度
- 1 コミット = 1 論理変更。Conventional Commits（`feat:` / `fix:` / `test:` / `chore:` / `docs:`）を推奨。
- 仕様ノード単位でコミットをまとめ、コミットメッセージに対象ノード ID（例 `middleware.score.logic`）を含める。

### 8.3 PR 粒度
- 原則、仕様ノード 1 つ（または密結合する数ノード）につき 1 PR。
- マイルストーン単位で統合 PR を `develop` に対して作成。

### 8.4 レビュー観点
- 対応する `spec/*` の entrypoint と実装の整合
- 依存方向の遵守（循環参照の防止、特に sensor.manager ⇄ sensor.service）
- REAL 型保持・丸めの表示層責務が守られているか
- ログが `log.service` 経由に統一されているか
- 未ログインアクセス制御が機能しているか
- 対応 QA テストが追加され green か

---

## 9. 実装成果物（必須）

以下は **必ず作成すること**。README にワンライナー手順を記載する。

### 9.1 環境構築スクリプト（`scripts/setup.sh`）
- Node/npm バージョンチェック
- `npm install` 実行
- Ionic CLI / Capacitor CLI のインストール確認
- Android SDK 前提チェック
- `environment.ts` の雛形生成（`mapsKey` プレースホルダ）

### 9.2 起動スクリプト
- `scripts/start-web.sh`: `ionic serve`（ブラウザ開発、file.storage は Blob DL フォールバック）
- `scripts/start-android.sh`: `ionic build` → `npx cap sync android` → `npx cap run android`

### 9.3 ビルド／配布（`env.build.installer`）
- `scripts/build-installer.sh`: 社内配布用フルオートインストーラ／APK ビルドバッチ
- `env.config.capacitor` の設定を参照

### 9.4 テスト実行スクリプト
- `scripts/test.sh`: ユニット + E2E をまとめて実行

> 各スクリプトは冪等に動作し、失敗時は非ゼロ終了コードを返すこと。