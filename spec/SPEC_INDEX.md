<!-- 作成: 2026-07-20 10:35:19 JST -->

# 仕様書インデックス — 運転診断アプリ (driving-score)

生成日時: 2026-07-20 JST

## プロジェクト概要

本プロジェクトは、Ionic 7 + Angular 15 + Capacitor 4 で構築された運転診断 SPA アプリケーションです。スマートフォンのセンサー（GPS・加速度計・ジャイロスコープ・磁力計）または BLE 経由の車載機 CAN データを入力に、リアルタイムで運転診断を行い、スコア・ヒヤリ地点・走行軌跡を記録・可視化します。診断結果は SQLite (`driving-score.db`) に永続化され、履歴・能力指標として過去分析に利用されます。

ドメインは以下の 6 領域に分類されます。

- **env** — アプリ起動・設定・ビルド／配布
- **ui** — 8 画面のページコンポーネント
- **middleware** — 認証・ログ・地図・センサー・スコアロジックのサービス群
- **db** — User / Score モデルとリポジトリ
- **infra** — BLE・Google Maps・ファイルストレージ・センサープラグイン・アセット
- **qa** — ドメイン別／横断のテスト仕様

---

## env — 環境・起動・ビルド

- [spec/env/app-bootstrap.md](spec/env/app-bootstrap.md) — Angular/Ionic アプリのブートストラップ。`AppModule` が全 8 画面のルータ配線と Cordova/Capacitor プラグイン群を DI 登録する。
- [spec/env/config-environment.md](spec/env/config-environment.md) — `environment` 定義（`mapsKey` 等）。ロール定義とログイン認証方式の記述を含む。
- [spec/env/config-capacitor.md](spec/env/config-capacitor.md) — Capacitor / AndroidManifest 設定。Android ネイティブ Maps SDK 用 API キーを保持。
- [spec/env/build-installer.md](spec/env/build-installer.md) — 社内配布用フルオートインストーラ／ビルドバッチ群。

## ui — 画面（ページコンポーネント）

- [spec/ui/opening-page.md](spec/ui/opening-page.md) — オープニング／起動画面。scoreLogicJson 初期化とログイン誘導、各画面への導線制御。
- [spec/ui/account-page.md](spec/ui/account-page.md) — アカウント作成／編集／削除画面 (2-1/2-2)。Reactive Forms によるバリデーションと MD5 保存。
- [spec/ui/driving-page.md](spec/ui/driving-page.md) — 運転診断画面 (4-1〜4-3)。10ms 周期のセンサー統合、スコア表示、地図描画、動画記録。
- [spec/ui/history-page.md](spec/ui/history-page.md) — 過去の診断結果 履歴・能力指標画面 (7-1/7-2)。Chart.js による可視化。
- [spec/ui/settings-page.md](spec/ui/settings-page.md) — 設定画面 (3-1)。各種設定切替と scoreLogic / scoreLogicJson の読込・書出。
- [spec/ui/edit-page.md](spec/ui/edit-page.md) — スコアロジック直接編集・デモ再生画面 (3-2)。開発者向け検証ページ。
- [spec/ui/badspot-page.md](spec/ui/badspot-page.md) — ヒヤリ地点確認画面 (6-1)。動画再生とマーカー自動追尾。
- [spec/ui/comment-page.md](spec/ui/comment-page.md) — アドバイス表示画面 (5-1)。診断結果の positive/negative コメント選出。

## middleware — サービス層

- [spec/middleware/login-service.md](spec/middleware/login-service.md) — ログイン・アプリ設定サービス。認証・状態管理・`settings` 永続化を担う。
- [spec/middleware/log-service.md](spec/middleware/log-service.md) — デバッグ/エラーログ・センサログサービス。gzip 圧縮でファイル書出。
- [spec/middleware/map-service.md](spec/middleware/map-service.md) — Google Maps 描画サービス。マーカー・軌跡・自車位置追従を管理。
- [spec/middleware/sensor-service.md](spec/middleware/sensor-service.md) — センサー統合サービス。BLE・Cordova センサー・デモデータを統合。
- [spec/middleware/sensor-manager.md](spec/middleware/sensor-manager.md) — センサーキャリブレーション & 座標変換ユーティリティ（静的クラス）。
- [spec/middleware/sensor-demoData.md](spec/middleware/sensor-demoData.md) — センサログ再生シングルトン。過去ログ／動画の再生。
- [spec/middleware/score-logic.md](spec/middleware/score-logic.md) — 運転診断ロジック実行ランナー。JS 文字列を動的関数化して周期実行。
- [spec/middleware/score-logicSimple.md](spec/middleware/score-logicSimple.md) — スマホセンサー版簡易スコアロジック（減点方式）。
- [spec/middleware/score-logicCan.md](spec/middleware/score-logicCan.md) — 車載 CAN 対応本番スコアロジック（約 885 行）。

## db — データモデル・リポジトリ

- [spec/db/user-model.md](spec/db/user-model.md) — User モデル (POCO)。パスワードは MD5 ハッシュ済み文字列で保持。
- [spec/db/user-repository.md](spec/db/user-repository.md) — User リポジトリ。`users.height` を REAL に是正（小数格納整合）。
- [spec/db/score-model.md](spec/db/score-model.md) — Score モデル。スコア系は REAL（小数）保持、丸めは表示層責務。
- [spec/db/score-repository.md](spec/db/score-repository.md) — Score リポジトリ。`score`/`score_history`/`capability_score` の REAL 是正。

## infra — インフラ・外部連携・アセット

- [spec/infra/ble-device.md](spec/infra/ble-device.md) — BLE 車載機 `DrivingCanData` 通信クラス。12 バイト CAN パケットのデコード。
- [spec/infra/bluetooth-le.md](spec/infra/bluetooth-le.md) — Bluetooth LE Capacitor プラグイン (`@capacitor-community/bluetooth-le`)。
- [spec/infra/google-maps.md](spec/infra/google-maps.md) — Google Maps JavaScript API ローダ。
- [spec/infra/file-storage.md](spec/infra/file-storage.md) — 外部ストレージ (`Documents/driving-score`) 書出。ブラウザは Blob ダウンロード。
- [spec/infra/cordova-sensors.md](spec/infra/cordova-sensors.md) — 端末センサープラグイン群（GPS・加速度・ジャイロ・磁力・SQLite・権限等）。
- [spec/infra/assets-scoreLogicJson.md](spec/infra/assets-scoreLogicJson.md) — スコアメッセージ辞書 & 交差点マスタ JSON（バージョン管理付き）。
- [spec/infra/assets-geolocation.md](spec/infra/assets-geolocation.md) — GPS デモ用アセット（現状 middleware 側から未参照）。

## qa — テスト仕様

- [spec/qa/cross-domain.md](spec/qa/cross-domain.md) — ドメイン横断検証シナリオ（未ログイン状態のアクセス制御と DB 整合など）。
- [spec/qa/ui.md](spec/qa/ui.md) — UI ドメイン QA（8 ノード）。
- [spec/qa/middleware.md](spec/qa/middleware.md) — middleware ドメイン QA（9 ノード）。
- [spec/qa/db.md](spec/qa/db.md) — db ドメイン QA（4 ノード）。
- [spec/qa/infra.md](spec/qa/infra.md) — infra ドメイン QA。
- [spec/qa/env.md](spec/qa/env.md) — env ドメイン QA。
- [spec/qa/qa.md](spec/qa/qa.md) — qa ドメイン集約（現状未整備・coverage 0）。

## C4 / アーキテクチャ図

- [spec/C4_c4_svg/context.svg](spec/C4_c4_svg/context.svg) — システムコンテキスト図。
- [spec/C4_c4_svg/container.svg](spec/C4_c4_svg/container.svg) — コンテナ図。
- [spec/C4_c4_svg/components_ui.svg](spec/C4_c4_svg/components_ui.svg) — UI コンポーネント図。
- [spec/C4_c4_svg/components_middleware.svg](spec/C4_c4_svg/components_middleware.svg) — middleware コンポーネント図。
- [spec/C4_c4_svg/components_db.svg](spec/C4_c4_svg/components_db.svg) — db コンポーネント図。
- [spec/C4_c4_svg/components_infra.svg](spec/C4_c4_svg/components_infra.svg) — infra コンポーネント図。
- [spec/C4_c4_svg/components_env.svg](spec/C4_c4_svg/components_env.svg) — env コンポーネント図。
- [spec/C4_c4_svg/deployment.svg](spec/C4_c4_svg/deployment.svg) — デプロイメント図。
- [spec/ER_DIAGRAM.md](spec/ER_DIAGRAM.md) — ER 図（`users` / `score` / `score_history` / `capability_score`）。

---

## 主要な依存関係・関連

### 起動フロー
- **env.app.bootstrap** が全 8 UI 画面 (`ui.*`) を配線し、`infra.cordova.sensors` に依存、`env.config.environment` を読み込む。
- **env.build.installer** → **env.config.capacitor** → **env.config.environment** の設定チェーン。

### UI → middleware / db
- **ui.opening.page** は認証・ログ・地図の各 middleware サービスと `db.score.repository`・`infra.assets.scoreLogicJson` を参照し、driving/account/settings への導線を持つ。
- **ui.driving.page** はセンサー・地図・スコアロジック・デモデータの middleware を呼び、`db.score.repository` と `infra.file.storage` に書込、`ui.badspot.page` へ遷移。
- **ui.history.page** / **ui.comment.page** は `db.score.repository` と `middleware.login.service` を参照（読取中心）。
- **ui.settings.page** / **ui.edit.page** はスコアロジック編集・検証を通じて `middleware.score.logic` を呼ぶ。

### middleware 内部・infra への依存
- **middleware.login.service** → `db.user.repository`・`db.user.model`・`infra.assets.scoreLogicJson`・`middleware.log.service`。
- **middleware.sensor.service** は `infra.ble.device`・`middleware.sensor.manager`・`middleware.sensor.demoData`・`infra.cordova.sensors` を統合（`sensor.manager` とは相互依存）。
- **middleware.map.service** → `infra.google.maps`。
- **middleware.score.logic** → `db.score.model`・`infra.assets.scoreLogicJson`。派生の **logicSimple** / **logicCan** は `score.logic` に依存し、`logicCan` は `infra.ble.device` を参照。

### db・infra 基盤
- **db.*.repository** は各モデルへ書込み、`middleware.log.service`（および `login.service`）を利用。
- **infra.ble.device** → `infra.bluetooth.le`。
- 各層のログは **middleware.log.service** → `infra.file.storage` へ集約される。

### 注記
- `infra.assets.geolocation` は GPS デモ用アセットだが、現状 `middleware.sensor.service` からは未参照（死にアセット）である点に留意。