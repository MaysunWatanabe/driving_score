# QA Test Specification — env

> このドキュメントは qa-maintainer-domain によって生成された正本です。
> Generation: 1 / Domain: env / Generated: 2026-07-20 01:22:36 UTC

## カバレッジ評価

- **coverage_score**: 8
- **coverage_notes**: env ドメインには canonical_spec_nodes が空・facts が空・existing_qa が空のため、QA で検証可能な状態はほぼ未整備。spec_documents に 4 ノード (env.app.bootstrap / env.build.installer / env.config.capacitor / env.config.environment) が存在するが、いずれも対応する QA が 0 件。特に不足しているのは (1) env.app.bootstrap の 8 経路ルーティング配線・DI プラグイン登録・prod モード判定、(2) env.config.environment の Storage キー定義とその参照整合、(3) env.config.capacitor の Android パーミッション/マニフェスト整合、(4) env.build.installer のインストーラ実行フロー。env は環境/ブートストラップ層のため、業務シナリオよりも起動シーケンス・設定値整合・ビルド成立性の検証が中心となる。
- **quality_notes**: 既存 QA が皆無のため API only 偏りの評価対象すらない。env ドメインの性質上、UI 業務フロー検証は各 UI ドメイン (ui.*) 側の責務であり、env 側では『アプリが正しく起動しルーティングが配線されるか』『環境設定値が仕様通りロードされ各サービスに渡るか』『ビルド/インストールが成立するか』という基盤検証を提案する。use_cases (UC1262-1273) は UI/機能側の業務フローであり env 単独では扱わない (cross/ui の責務) が、それらが依存する起動基盤・Storage キー整合は env で担保すべき。
- **drift_notes**: spec 内で明示された drift 候補: (1) mapsKey が environment.ts (AIzaSyBx_9cQGGES...) と AndroidManifest.xml (AIzaSyA8DXX0csw...) で異なる値。用途分けは spec/unknowns.md 送りとされており QA で『2 値が意図的に別か』を検証する必要がある。(2) ui.opening.page の checkPermission() が WRITE_EXTERNAL_STORAGE を要求するが AndroidManifest.xml に未宣言 (Android 12 自動許可想定)。この drift はランタイム権限失敗リスクがあり QA 対象。(3) main.ts の bootstrap 失敗時が console.log(err) のみで UI フィードバックなし。既存 QA が無いため QA↔spec の直接矛盾は現時点で存在しない。

---

## 検証シナリオ（追加）



### QA-ENV-BOOT-001 — アプリ起動時に AppModule が bootstrap され opening にリダイレクトされる

- **node_id**: `env.app.bootstrap`
- **priority**: `must`
- **applicable_roles**: driver, operator, developer
- **rationale**: env.app.bootstrap の起動シーケンス (main.ts → bootstrapModule(AppModule) → '' redirectTo 'opening') は非交渉の基盤挙動だが対応 QA が 0 件。起動が成立しなければ全 use_case が破綻するため must。

**検証手順**:

1. ユーザー操作: アプリを新規起動する（Storage クリア状態）

1. 期待 DOM 反映: app-root が描画され、URL が /opening に解決し OpeningPage の初期 DOM が表示される

1. 期待 DB / API 状態: bootstrap 例外が発生しないこと（例外時は console.log のみで UI に出ない点を確認）

1. 再読込・別セッションでの再確認: リロード後も '' → opening リダイレクトが再現すること



### QA-ENV-BOOT-002 — 8 経路すべてが AppRoutingModule により配線され直接遷移できる

- **node_id**: `env.app.bootstrap`
- **priority**: `must`
- **applicable_roles**: driver, operator, developer
- **rationale**: spec のルーティング表 (account/:type, bad-spot/:path, comment, driving, history, opening, settings, edit) は非交渉。PreloadAllModules 指定のため各 lazy module が事前ロードされる前提を検証する QA が無い。

**検証手順**:

1. ユーザー操作: 各パス (/opening /driving /history /comment /settings /edit /account/edit /bad-spot/xxx) へ直接ナビゲートする

1. 期待 DOM 反映: 各パスで対応する Page モジュールがロードされ 404/blank にならない

1. 期待 DB / API 状態: PreloadAllModules によりチャンクが事前取得されていること（ネットワークタブでの遅延ロード無しを確認）

1. 再読込・別セッションでの再確認: 各パスで直接リロードしても同一 Page が再表示されること



### QA-ENV-BOOT-003 — DI で必須 Cordova/Capacitor プラグインが登録され、コメントアウト対象は登録されない

- **node_id**: `env.app.bootstrap`
- **priority**: `must`
- **applicable_roles**: driver, operator, developer
- **rationale**: AppModule.providers への ScreenOrientation/Geolocation/DeviceMotion/Magnetometer/SQLite/AndroidPermissions/IonicRouteStrategy 登録は各サービスの前提。BLE/Diagnostic は登録しない (実 BLE は capacitor-community 経由) という non-negotiable も検証対象。

**検証手順**:

1. ユーザー操作: 起動後、SQLite/センサー/権限を利用する画面 (driving/settings) を開く

1. 期待 DOM 反映: プラグイン未注入起因の DI エラー（NullInjectorError 等）が発生しないこと

1. 期待 DB / API 状態: 実 BLE アクセスが @capacitor-community/bluetooth-le 経由で行われ、awesome-cordova-plugins/ble は使われないこと

1. 再読込・別セッションでの再確認: 再起動後も DI 登録が安定していること



### QA-ENV-BOOT-004 — production フラグにより enableProdMode の呼び出しが切り替わる

- **node_id**: `env.config.environment`
- **priority**: `must`
- **applicable_roles**: developer
- **rationale**: env.config.environment の production (dev=false/prod=true) が env.app.bootstrap の enableProdMode 判定を制御する。prod ビルド時の fileReplacements 差し替えと合わせて整合検証が必要。対応 QA が無い。

**検証手順**:

1. ユーザー操作: dev ビルドと prod ビルドをそれぞれ起動する

1. 期待 DOM 反映: prod ビルドで Angular の開発モード警告が出ないこと、dev ビルドでは出ること

1. 期待 DB / API 状態: prod ビルド成果物内で environment.prod.ts の値 (production=true) が反映されていること

1. 再読込・別セッションでの再確認: 各ビルドで再起動しても production 判定が一貫すること



### QA-ENV-ENVVAL-005 — environment の Ionic Storage キー群が各サービスから仕様通り参照される

- **node_id**: `env.config.environment`
- **priority**: `should`
- **applicable_roles**: driver, operator
- **rationale**: loginKey/lastLoginUserId/scoreLogicKey/scoreLogicJsonKey/setting-* 等のキー名は複数ノード横断で参照される契約値。キー名 drift が起きると自動ログイン (UC1263) やロジック更新 (UC1271/1272) が静かに破綻する。env は定義元のため整合検証を担う。

**検証手順**:

1. ユーザー操作: 自動ログイン設定保存・センサーモード切替・スコアロジック保存をそれぞれ実行する

1. 期待 DOM 反映: 保存操作が成功トースト/画面反映される

1. 期待 DB / API 状態: Ionic Storage 上に environment 定義キー (login, last-login-user-id, driving-score-logic, score-logic-json, setting-selected-sensor-mode 等) の値が書き込まれ、ハードコード文字列とキー名が一致していること

1. 再読込・別セッションでの再確認: 再起動後に同一キーから値が読み戻されること



### QA-ENV-ENVVAL-006 — geolocation 設定値 (maximumAge=0 / timeout=1000) が watchPosition に渡る

- **node_id**: `env.config.environment`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: geolocationMaximumAge/geolocationTimeout/geolocationLastPosKey は測位挙動を規定する契約値。値が反映されないと運転診断の位置取得 (UC1267) の即時性・タイムアウト挙動が変わる。env で定義値の伝播を検証する。

**検証手順**:

1. ユーザー操作: GPS デモ OFF で運転診断を開始し位置取得を発火させる

1. 期待 DOM 反映: 位置未取得時に timeout=1000ms 相当でフォールバック/エラー扱いになること

1. 期待 DB / API 状態: 最後に取得した位置が geolocation-last-pos-key に {lat,lng} JSON として保存されること

1. 再読込・別セッションでの再確認: 再起動後に geolocation-last-pos-key の値が残存し利用されること



### QA-ENV-MAPKEY-007 — mapsKey が environment と AndroidManifest で異なる値のまま両者が正しく機能する

- **node_id**: `env.config.environment`
- **priority**: `should`
- **applicable_roles**: driver
- **rationale**: drift: environment.ts の mapsKey (AIzaSyBx...) と AndroidManifest.xml の geo.API_KEY (AIzaSyA8...) が異なる。JS API Loader と Android ネイティブ Maps で別キーを用いる設計が意図的か未確定 (spec/unknowns.md 送り)。QA で両経路の地図表示成立を検証し、逆に spec 側へ用途確定を要求する。

**検証手順**:

1. ユーザー操作: 地図を用いる画面 (bad-spot / driving 終了地図) を開く

1. 期待 DOM 反映: Google Maps タイル/マーカーが RefererNotAllowed 等のエラー無く描画されること

1. 期待 DB / API 状態: JS API Loader は environment.mapsKey を、ネイティブ経路は Manifest キーを使用しており、どちらも有効応答すること

1. 再読込・別セッションでの再確認: 再読込後も両キーで地図が表示されること



### QA-ENV-PERM-008 — Manifest 宣言パーミッションと opening の checkPermission 要求が整合する

- **node_id**: `env.config.capacitor`
- **priority**: `should`
- **applicable_roles**: driver, operator
- **rationale**: drift: AndroidManifest.xml は INTERNET/位置/CAMERA/RECORD_AUDIO/READ_EXTERNAL_STORAGE/BLUETOOTH_* を宣言するが、ui.opening.page の checkPermission() は WRITE_EXTERNAL_STORAGE も要求 (Manifest 未宣言、Android12 自動許可想定)。ランタイム権限拒否リスクがあるため env で整合検証。spec gap: 対応 fact/canonical ノードが無く根拠は spec_document 記載のみ。

**検証手順**:

1. ユーザー操作: 初回起動でオープニングの権限確認フローを通す (Android 12 実機/エミュレータ)

1. 期待 DOM 反映: 権限ダイアログが表示され、拒否時に機能制限メッセージが出ること

1. 期待 DB / API 状態: WRITE_EXTERNAL_STORAGE が Manifest 未宣言でも自動許可され checkPermission が失敗しないこと。Android 13+ 端末での挙動差も記録

1. 再読込・別セッションでの再確認: 権限付与後の再起動で再要求されないこと



### QA-ENV-CAP-009 — capacitor.config.ts の appId/webDir 設定で Android ビルドが成立する

- **node_id**: `env.config.capacitor`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: appId='jp.co.nissan.drivingscore' / webDir='www' / bundledWebRuntime=false と Manifest package が一致していないとインストール/起動が失敗する。ビルド成立性の非交渉条件だが QA が無い。

**検証手順**:

1. ユーザー操作: build-android バッチを実行し生成 APK を端末にインストールする

1. 期待 DOM 反映: インストール後アプリアイコンから起動でき app-root が描画されること

1. 期待 DB / API 状態: APK の applicationId が jp.co.nissan.drivingscore で Manifest package と一致すること、www 配下の web 資産が同梱されること

1. 再読込・別セッションでの再確認: 再インストール後も同一 appId で上書き更新できること



### QA-ENV-INSTALL-010 — install-* スクリプトが依存確認〜ビルドまで一括で成立する

- **node_id**: `env.build.installer`
- **priority**: `should`
- **applicable_roles**: developer
- **rationale**: install-windows.bat/install-mac.sh は Desktop 展開→npm install→cap sync→build の一連を保証する配布手段。java/adb/node チェック失敗時の案内やシンボリックリンク (mklink /D は管理者権限要) の成立性は配布成否を左右する。QA が無い。

**検証手順**:

1. ユーザー操作: クリーン環境で install-windows.bat（管理者権限）と install-mac.sh をそれぞれ実行する

1. 期待 DOM 反映: 依存欠如時 (java/adb/node) に該当する案内メッセージが表示され停止すること

1. 期待 DB / API 状態: ~/Desktop/driving-score が生成され、android/src シンボリックリンクが作成され、ionic capacitor build android が成功すること

1. 再読込・別セッションでの再確認: 再実行時に既存 android/ が削除・再構築されても成果物が同等であること



### QA-ENV-INSTALL-011 — npm install 失敗時にプロキシ/strict-ssl フォールバックが機能する

- **node_id**: `env.build.installer`
- **priority**: `nice`
- **applicable_roles**: developer
- **rationale**: install-windows.bat は npm install 失敗時に registry=http://… + strict-ssl false へフォールバック再実行する。社内プロキシ環境での配布成否に直結するエラーパスだが QA が無い。config-npm.bat のプロキシ登録/delete も併せて検証。

**検証手順**:

1. ユーザー操作: プロキシ必須環境で install-windows.bat を実行し、初回 npm install を失敗させる

1. 期待 DOM 反映: フォールバックの再実行ログが表示されること

1. 期待 DB / API 状態: npm config に registry/strict-ssl が設定され再 install が成功すること。config-npm.bat で 'delete' 入力時に proxy/https-proxy がグローバル設定から削除されること

1. 再読込・別セッションでの再確認: 再実行時にフォールバック設定が残存し二重登録されないこと



### QA-ENV-BOOT-012 — bootstrap 失敗時のフィードバック欠如を検出する

- **node_id**: `env.app.bootstrap`
- **priority**: `nice`
- **applicable_roles**: driver, operator, developer
- **rationale**: spec gap: main.ts は bootstrapModule 失敗時 console.log(err) のみで UI フィードバックが無い。起動失敗がユーザーに伝わらず白画面のまま放置される懸念。spec に UI フィードバック要件の記載が無いため spec 側の補強要否を open_questions に逆フィードバックする。

**検証手順**:

1. ユーザー操作: 意図的に bootstrap を失敗させる (壊れたモジュール注入等) 状態で起動する

1. 期待 DOM 反映: 現状は白画面/blank になること（欠陥として記録）。将来的にはエラー画面表示が望ましい

1. 期待 DB / API 状態: console にのみエラーが出力され、ユーザー向けの状態表示が無いことを確認

1. 再読込・別セッションでの再確認: 再起動しても同一失敗が同様に無通知で発生すること





---

## 既存シナリオへの修正提案


（修正提案なし）


---

## 削除提案


（削除提案なし）


---

## 優先度調整



- `QA-ENV-BOOT-001` → **must** : 起動成立は全 use_case の前提。失敗時アプリ利用不可。

- `QA-ENV-BOOT-002` → **must** : 8 経路配線は non-negotiable なルーティング契約。

- `QA-ENV-BOOT-003` → **must** : 必須 DI プラグイン未登録は SQLite/センサー機能を破綻させる。

- `QA-ENV-BOOT-004` → **must** : prod/dev モード切替は本番配布の基本条件。

- `QA-ENV-ENVVAL-005` → **should** : Storage キー drift は静かな破綻を招くが単体では起動を止めない。

- `QA-ENV-ENVVAL-006` → **should** : 測位挙動の契約値伝播。運転診断精度に影響。

- `QA-ENV-MAPKEY-007` → **should** : mapsKey 二重値の意図が未確定 (spec/unknowns 送り) のため断定回避。

- `QA-ENV-PERM-008` → **should** : WRITE_EXTERNAL_STORAGE 未宣言 drift。端末バージョン依存で挙動が変わる。

- `QA-ENV-CAP-009` → **should** : appId/package 整合はビルド/インストール成立の前提。

- `QA-ENV-INSTALL-010` → **should** : 配布フロー成立性。開発者環境依存で自動化しにくい。

- `QA-ENV-INSTALL-011` → **nice** : プロキシ環境限定のエラーパス。再現環境が限られる。

- `QA-ENV-BOOT-012` → **nice** : spec gap 検出目的。要件未確定のため断定不可。



---

## Open Questions



### mapsKey が environment と AndroidManifest で異なる 2 値である理由

- **質問**: environment.ts の mapsKey (AIzaSyBx...) と AndroidManifest.xml の geo.API_KEY (AIzaSyA8...) が異なるのは意図的な用途分け (JS API 用 / ネイティブ Maps 用) か、あるいは設定ミスか。QA でどちらの経路の描画成立を必須とするか確定したい。
- **保留中の判断**: QA-ENV-MAPKEY-007 の priority を should から確定 (must/正常系断定) にするか


### WRITE_EXTERNAL_STORAGE の Manifest 未宣言に対する正式方針

- **質問**: ui.opening.page の checkPermission() が要求する WRITE_EXTERNAL_STORAGE を AndroidManifest.xml に宣言すべきか、Android 12 自動許可前提のまま据え置くか。Android 13+ 端末での挙動保証範囲も spec に明記が必要。
- **保留中の判断**: QA-ENV-PERM-008 の期待結果 (権限拒否時の許容挙動) を確定できない


### bootstrap 失敗時の UI フィードバック要件

- **質問**: main.ts の bootstrapModule 失敗時が console.log(err) のみで UI 無通知の現状を許容するか、起動失敗画面/リトライ導線を設けるべきか。spec に要件記載が無い。
- **保留中の判断**: QA-ENV-BOOT-012 を欠陥検出 (nice) に留めるか、正常系 (エラー画面表示) を must 化するか


### env ドメインの role 定義

- **質問**: spec に role 定義 (driver/operator/developer) が明示されていない。use_cases から driver/運用担当者/開発者を推定して applicable_roles を付与したが、env 側で正式なロール一覧を確定してほしい。
- **保留中の判断**: 全 env シナリオの applicable_roles の妥当性確定




---

## Spec to update（参考）


LLM が修正対象として挙げた仕様書：

- `spec/qa/env-bootstrap-routing.md`

- `spec/qa/env-config-environment.md`

- `spec/qa/env-config-capacitor.md`

- `spec/qa/env-build-installer.md`


