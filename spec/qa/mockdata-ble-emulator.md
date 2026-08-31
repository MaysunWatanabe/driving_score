<!-- 作成: 2026-08-07 17:36:52 JST | 更新: 2026-08-24 14:21:23 JST -->

```json
{
  "required_changes": [
    {
      "node": "qa.mockdata.ble.emulator",
      "entrypoint": "spec/qa/mockdata-ble-emulator.md",
      "description": "approved facts を正本に、既定10レコード集約/--raw/量子化・端数・Phase1完了記録(Aのみ)・Phase2範囲を既存MDへ差分統合する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "middleware",
      "severity": "should",
      "reason": "Phase1はアプリ不変だが、モード別起動ゲートと canDataOnly/combination 購読差・切断後再接続は未決のため Sensor 側の観測点確認が必要"
    },
    {
      "domain": "app",
      "severity": "could",
      "reason": "受入時 selectedSensorMode が canDataOnly または combination である前提は App 設定仕様との一致確認が望ましい"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "Linux・BlueZ LEAdvertisingManager1・Privacy=off・public アドレスタイプ・A/B 相互排他と restore-bluez が実行環境前提になる"
    }
  ],
  "requirements_context": "# spec/qa/mockdata-ble-emulator.md\n\n## 目的\n\n実機アプリを改変せず、開発 PC 上の BLE CAN エミュレータが実機と Bluetooth LE 接続を確立し、事前生成されたモック sensor-log（canConnected）から 12 バイト CAN ペイロードを Notify 供給できることを検証・受け入れる。\n\n本ノードは **データ供給方式を事前入力シミュレーション型に限定**する（リアルタイム操作型は不採用）。\n\n---\n\n## スコープ\n\n### 対象\n\n- BLE CAN エミュレータ CLI の起動・広告・接続・Notify\n- モックデータ（`src/data/mock/*.canConnected.txt.gz`）からの 12 バイト符号化再生\n- 既定の 10 レコード集約送出と、1 レコード=1 Notify の `--raw`（または同等）経路\n- Phase 1 完了ゲート（実機 logcat での 12 バイト Notify 確認まで）および Phase 1 completed 記録（実装 A のみ）\n- Phase 2（異常系に限定）\n- 実装 2 系統（A: 既定 / B: フォールバック凍結）の選択基準と相互排他\n\n### 非対象（本ノードで確定・実装しない）\n\n- `src/data/src/app/**` の変更\n- `middleware.sensor.service` のセンサー必須ゲートの独断緩和・独断改訂\n- 切断後自動再接続ポリシーの確定（Phase 2 にも入れない）\n- canDataOnly と combination の購読差の独断確定（Phase 2 にも入れない）\n- 診断・スコア・DB/履歴までの業務 E2E（購読差・再接続ポリシーの open_question 解消後の別フェーズ）\n- Win/Mac 対応\n- リアルタイム操作型エミュレータ\n- DB シード・webm・infra.assets.geolocation の復活/変更\n- 固定ダミー専用モード（`--source` 無しの専用経路）\n- Phase 1 ゲートへの運転診断稼働・スコア変化の組込み\n- `infra.ble.device` への `notify_interval_ms=100` 確定定数追加（`--rate-ms` 既定 100 は暫定据え置き）\n\n---\n\n## 実装系統（A/B 併存）\n\n| 系統 | パス | 位置づけ | 依存 |\n|------|------|----------|------|\n| **A（既定）** | `src/data/tools/ble-can-emulator.py` | Phase 1 完了判定および completed 記録に用いる唯一の実装 | OS 同梱 `python3` / `python3-dbus` / `gi.repository.GLib` のみ。新規 pip/apt 禁止。sudo 不要、bluetoothd 共存 |\n| **B（凍結）** | `src/tools/ble-can-emulator/` | フォールバック。改変・削除・実データ再生移植・D-Bus 化しない | （既存のまま凍結） |\n\n### 選択基準\n\n- 起動手順・README 上の既定は **A**\n- 次のいずれかで A が使用不能なときのみ B を案内する\n  1. BlueZ が `org.bluez.LEAdvertisingManager1` を提供しない\n  2. `bluetoothctl show` の SupportedInstances が 0\n  3. A の RegisterAdvertisement / RegisterApplication が失敗\n- **B の実機検証は Phase 1 対象外（未検証のまま）**\n- Phase 1 を completed と記録してよいのは **実装 A のみ**\n\n### 相互排他（MANDATORY）\n\n- A と B は **同時起動禁止**\n- B 使用後に A へ戻す前に、必ず `sudo src/tools/ble-can-emulator/restore-bluez.sh` で BlueZ を復帰する\n- mask 残存は reboot でも復帰しない点を README に明記する\n\n### アドレスタイプ前提（接続失敗回避）\n\n- 広告アドレスタイプは **public** であること\n- `@capacitor-community/bluetooth-le` は `addressType=public` 前提のため、random static だと GATT 接続が status `0x3E` で失敗する\n- A はアドレスタイプを明示指定しないため、`/etc/bluetooth/main.conf` の `Privacy=off`（既定）かつ `bluetoothctl show` でコントローラが `(public)` であることを確認する\n- 上記知見は A の `src/data/tools/ble-can-emulator.README.txt`「うまくいかないとき」に記載する\n\n---\n\n## BLE 広告・GATT 識別子（#14 踏襲）\n\n| 項目 | 値 |\n|------|-----|\n| LE 広告 LocalName | `DrivingCanData` |\n| Service UUID | `00002310-0000-1000-8000-00805f9b34fb` |\n| Notify Characteristic | `00002311-0000-1000-8000-00805f9b34fb` |\n| Notify ペイロード長 | **12 バイト**（`sensor.canData` を #14 §2 どおり符号化） |\n| 実行 OS | **Linux のみ** |\n| アプリ側 | **不変**（エミュレータ側のみで成立させる） |\n\n---\n\n## CLI 仕様（実装 A）\n\n```\npython3 src/data/tools/ble-can-emulator.py --source <path> [--rate-ms <ms>] [--loop] [--raw]\n```\n\n| 引数 | 必須 | 仕様 |\n|------|------|------|\n| `--source <path>` | 実質必須 | gzip 解凍 → JSON Lines parse → 各行の `sensor.canData` を集約または生再生し、#14 §2 どおり 12 バイト符号化して Notify。`canData` キー無し（smartphoneOnly 相当）は **拒否してエラー表示** |\n| `--rate-ms` | 任意 | 既定 `100`（**暫定値**。`infra.ble.device` の確定定数にはしない）、範囲 `10..1000` |\n| `--loop` | 任意 | EOF 後に先頭へ戻って継続 |\n| `--raw`（または同等） | 任意 | 1 レコード = 1 Notify。未指定時は既定の 10 レコード集約 |\n\n### 既定送出（10 レコード集約）\n\n`--raw` 未指定時の既定は次のとおりとする。単純間引き（デシメーション）はピーク取りこぼしのため **採用しない**。\n\n- 入力 10 レコードを 1 区間として集約し、**100ms に 1 フレーム**送出する\n- 連続 5 フィールドは **平均**\n- `steeringAngle` は **平均**\n- `accelPedalPosition` / `brakePressure` は **区間先頭**\n- `brakeSwitch` / `shiftIndication` / `turnSignal` は **区間先頭**\n- 平均後は #22 量子化を `floor(x+0.5)` で適用して 12 バイト符号化する\n- レコード数が 10 で割り切れない端数区間は **切り捨てず**、残り全部で平均（および上記の区間先頭規則）する\n\n### データ源制約\n\n- Phase 1 疎通の `--source` は次を用いる:  \n  `src/data/mock/sensor-log.cruise.canConnected.txt.gz`\n- 入力はモック生成物（canConnected）の実データ再生に限る（固定ダミー専用モードは作らない）\n- 異常系シナリオ再生は **Phase 2**\n\n### モックデータ側の前提（関連 fact との整合）\n\n- canConnected 相当では `vehicleSpeed` / `longAcc` / `latAcc` / `frontDistance` / `lateralDistance` / `steeringAngle` / `accelPedalPosition` / `brakePressure` / `brakeSwitch` / `shiftIndication` / `turnSignal` / `repeat` を明示\n- 全 `repeat` は合成時 0 固定（`-1` 禁止）\n- smartphoneOnly 相当は `canData` キー省略（エミュレータはこれを入力として受け付けない）\n\n---\n\n## フェーズ定義\n\n### Phase 1（接続・Notify 疎通）\n\n**目標:** 実機との BLE 接続確立と、characteristic `00002311` の 12 バイト Notify が実機 logcat で確認できること。\n\n**完了ゲート（すべて必須・実装 A のみで判定）:**\n\n| ID | 条件 |\n|----|------|\n| P1-a | 開発 PC が LocalName=`DrivingCanData` で LE 広告している |\n| P1-b | 実機が 3 秒スキャンで 1 件検出し、自動 connect する |\n| P1-c | `connect(timeout:10000)` 成功かつ `startNotifications` が確立する |\n| P1-d | 12 バイト値が実機 logcat で実測確認できる |\n\n**Phase 1 ゲートに含めないもの:**\n\n- 運転診断の稼働\n- スコア変化\n- DB / 履歴の業務 E2E\n\n**完了記録:**\n\n- Phase 1 を `completed` と記録してよいのは **実装 A のみ**\n- 実装 B での実機結果は Phase 1 completed に使わない\n\n**受入時アプリ設定:**\n\n- `settings.selectedSensorMode` は `canDataOnly` または `combination`\n- `smartphoneOnly` は BLE スキップのため **不可**\n\n**関連する起動ゲート（本ノードでは改訂しない・参照のみ）:**\n\n- センサー起動ゲートはモード別（全モード GPS 必須。canDataOnly は GPS+canData、smartphoneOnly は GPS+加速度+方位+磁力計、combination は両方）が別 fact で承認済み\n- 本ノードは当該ゲートの緩和・改訂を行わない\n- Phase 1 完了は診断開始の成否に依存しない\n\n**Phase 1 で診断が回らない実測:**\n\n- ゲート失敗とはみなさない\n- `open_question` として記録する\n\n### Phase 2（異常系に限定）\n\nPhase 2 は次の異常系に限定する。\n\n- 切断\n- 不正ペイロード\n- `--rate-ms` 境界\n- smartphoneOnly 入力拒否の回帰\n\n**Phase 2 に入れないもの（未決のまま）:**\n\n- 切断後の自動再接続ポリシー\n- canDataOnly と combination の購読差\n- 診断・スコア・DB/履歴の E2E（上記 open_question 解消後の別フェーズ）\n\n`--rate-ms` 既定 100 は暫定据え置きとする。\n\n---\n\n## 検証レイヤ（不安定実装下でも有用であること）\n\nテストは次の 3 層に分ける。\n\n### 1. Existence（存在確認）\n\n- エミュレータプロセスが起動する\n- LE 広告が LocalName / Service UUID で観測できる\n- `--source` が canConnected gzip を読み切れる（行 parse 可能）\n\n### 2. Interaction（相互作用）\n\n- 実機スキャン → connect → startNotifications まで到達する\n- Notify が既定 100ms フレーム、または `--rate-ms` / `--raw` に応じた間隔で届く（観測可能なこと）\n- `--loop` 有効時、EOF 後も Notify が継続する\n\n### 3. Business / Protocol rule（プロトコル・受入規則）\n\n- Notify ペイロードが **常に 12 バイト**\n- 既定経路では 10 レコード集約後の 1 フレームが #14 §2 および #22 量子化（`floor(x+0.5)`）に従う\n- `--raw` では 1 レコード = 1 Notify となる\n- 単純間引き（デシメーション）によるピーク欠落を合格条件にしない\n- `canData` 欠落入力は起動時または再生時に拒否され、エラーが表示される\n- `selectedSensorMode=smartphoneOnly` では BLE 経路を受入対象にしない\n\nセレクタ・アプリ計測点はアプリ改変禁止のため、**実機 logcat / 接続 API 成功 / 広告スキャン結果**を正準観測点とする（data-testid 依存なし）。\n\n---\n\n## テストケース\n\n### Phase 1（必須）\n\n| ID | 層 | 前提 | 手順概要 | 合格条件 |\n|----|----|------|----------|----------|\n| TC-BLE-EMU-001 | existence | Linux・BlueZ・A 利用可 | A を `--source ...cruise.canConnected.txt.gz` で起動 | プロセスがエラーなく起動し広告可能状態になる |\n| TC-BLE-EMU-002 | existence | TC-BLE-EMU-001 | スキャナまたは実機で広告観測 | LocalName=`DrivingCanData` かつ Service UUID=`00002310-...` で検出 |\n| TC-BLE-EMU-003 | interaction | 実機、mode=`canDataOnly` または `combination` | 実機 3 秒スキャン | 1 件検出→自動 connect |\n| TC-BLE-EMU-004 | interaction | TC-BLE-EMU-003 | 接続待ち | `connect(timeout:10000)` 成功かつ startNotifications 確立 |\n| TC-BLE-EMU-005 | business | TC-BLE-EMU-004、rate 既定 100、集約既定 | logcat 監視 | characteristic `00002311` で **12 バイト** Notify を実測確認 |\n| TC-BLE-EMU-006 | business | 同上 | 複数 Notify を採取 | ペイロード長が常に 12 バイト（短絡・過長なし） |\n| TC-BLE-EMU-007 | interaction | `--loop` 付与 | ソース長を超えて監視 | EOF 後も Notify が継続する |\n| TC-BLE-EMU-016 | business | `--raw` 未指定 | 既定再生を観測 | 10 レコード集約の 1 フレームが 100ms 周期で送出される（単純間引きではない） |\n| TC-BLE-EMU-017 | business | `--raw` 付与 | 生再生を観測 | 1 レコード = 1 Notify となる |\n| TC-BLE-EMU-018 | business | レコード数が 10 で割り切れない入力 | 終端区間を観測 | 端数区間が切り捨てられず、残り全部で集約されたフレームが送出される |\n\n### Phase 2（異常系）\n\n| ID | 層 | 内容 | 合格条件 |\n|----|----|------|----------|\n| TC-BLE-EMU-008 | business | `--source` に smartphoneOnly（canData 無し）相当 | **拒否**されエラー表示。Notify しない |\n| TC-BLE-EMU-009 | business | `--rate-ms` 境界 10 および 1000 | 受付可能で Notify 継続 |\n| TC-BLE-EMU-010 | business | `--rate-ms` 範囲外（例: 9, 1001） | 拒否または明示的エラー（実装のエラー契約に従う。未定義なら open_question） |\n| TC-BLE-EMU-019 | interaction | 接続確立後にエミュレータ側切断 | 切断が観測できる（自動再接続の成否は合格条件にしない） |\n| TC-BLE-EMU-020 | business | 不正長または不正符号化ペイロード相当の入力 | 受入契約どおり拒否または非送出（詳細契約は open_question） |\n\n### 入力・モード境界\n\n| ID | 層 | 内容 | 合格条件 |\n|----|----|------|----------|\n| TC-BLE-EMU-011 | business | 受入を `smartphoneOnly` で実施 | **受入対象外**（BLE スキップ）。Phase 1 パス扱いにしない |\n\n### 実装系統・運用安全\n\n| ID | 層 | 内容 | 合格条件 |\n|----|----|------|----------|\n| TC-BLE-EMU-012 | existence | README 既定経路が A である | ドキュメント上の既定が A |\n| TC-BLE-EMU-013 | interaction | A/B 同時起動しない運用 | 同時起動禁止が文書化され、手順が従える |\n| TC-BLE-EMU-014 | interaction | B 使用後に A 復帰 | `restore-bluez.sh` 実行後に A の広告登録が再度成功しうる |\n| TC-BLE-EMU-015 | existence | コントローラ address type | `bluetoothctl show` で `(public)`、Privacy=off 前提を満たす |\n\n### 劣化モード（degraded-mode）\n\n| ID | 状況 | それでも検証すること |\n|----|------|----------------------|\n| TC-BLE-EMU-D01 | 診断・スコア未稼働 | P1-a〜d（接続と 12 バイト Notify）のみで Phase 1 完了可 |\n| TC-BLE-EMU-D02 | A が LEAdvertisingManager1 不在等で使用不能 | B 案内条件に入ること。ただし B 実機検証は Phase 1 合格・completed に使わない |\n| TC-BLE-EMU-D03 | combination の購読差が未確定 | canDataOnly で P1-a〜d を優先確認 |\n| TC-BLE-EMU-D04 | 集約符号化のビット完全照合が未整備 | ペイロード長 12 バイトと Notify 到達のみで Phase 1 は完了可。内容照合は可能な範囲で記録 |\n\n---\n\n## 失敗条件（ゲート）\n\nPhase 1 を **FAIL** とする条件（実装 A）:\n\n1. LocalName=`DrivingCanData` で LE 広告できない\n2. 実機 3 秒スキャンで対象を検出できない / 自動 connect しない\n3. `connect(timeout:10000)` 失敗、または startNotifications 未確立\n4. logcat 上で 12 バイト Notify を確認できない\n5. Notify ペイロード長が 12 以外を含む\n6. アプリ改変や middleware センサーゲートの独断緩和無しには成立させられない（本ノード禁止事項違反）\n7. Phase 1 completed を実装 B の結果だけで記録した\n\n**FAIL にしない（記録のみ）:**\n\n- Phase 1 で運転診断が回らない・スコアが変わらない実測 → open_question 記録\n- smartphoneOnly 入力拒否・rate 境界・切断・不正ペイロードの未実施（これらは Phase 2）\n- 自動再接続の未実施・未成立\n- canDataOnly と combination の購読差未確認\n\nPhase 2 を **FAIL** とする条件（該当ケース実施時）:\n\n1. canData 無しソースを受け入れてしまった（拒否しない）\n2. 不正ペイロードを契約に反して正規 12 バイト Notify として流した（契約確定後）\n3. `--rate-ms` 許容範囲内の 10 および 1000 で Notify が継続しない\n\n---\n\n## 証跡（Artifact）\n\n失敗・受入時に残すもの:\n\n| 必須 | 内容 |\n|------|------|\n| run_id | 当該受入実行の識別子 |\n| 広告確認ログ | LocalName / UUID 検出の記録 |\n| 実機 logcat | connect・startNotifications・12 バイト Notify の根拠 |\n| エミュレータ stdout/stderr | 起動パラメータ（source, rate-ms, loop, raw）とエラー |\n| 環境スナップショット | `bluetoothctl show`（public / SupportedInstances）、BlueZ 広告サポート有無 |\n\n任意:\n\n- btmon / HCI トレース\n- スクリーンショット（設定画面の selectedSensorMode）\n- 集約前後のサンプル対照（10 レコード区間と送出 12 バイト）\n\n---\n\n## レポート\n\n`qa_report.json` に少なくとも次を含める:\n\n- `run_id`\n- `status`（pass/fail）\n- `phase`（`1` / `2`）\n- `implementation`（`A` / `B`）※ Phase 1 公式ゲートおよび completed 記録は `A` のみ\n- `fail_reason`\n- `evidence_paths`\n- `reproduction_steps`（source パス、rate-ms、loop、raw、selectedSensorMode、コントローラ public 確認）\n- `open_questions`（診断未稼働などゲート外の実測）\n\n---\n\n## 例外・allowlist\n\n- 3rd party / OS コンポーネントの無害ログは allowlist 可（期限付きで理由を記録）\n- B 実装の未検証状態そのものは Phase 1 失敗理由にしない\n\n---\n\n## 禁止事項（再掲・受入で違反なら即 FAIL）\n\n- `src/data/src/app/**` 変更\n- middleware.sensor.service のセンサー必須ゲートの独断緩和\n- 切断後自動再接続ポリシーの独断確定\n- canDataOnly vs combination 購読差の独断確定\n- Win/Mac 対応の追加\n- リアルタイム操作型の実装\n- A への bumble 導入、B への機能追加・削除・リファクタ\n- A/B 同時起動\n- 新規 pip/apt 依存の追加（A）\n- 単純間引き（デシメーション）を既定送出として採用すること\n- Phase 1 completed を実装 B のみで記録すること\n\n---\n\n## 関連アーティファクト\n\n- モック生成: `src/data/tools/gen-mock-sensorlog.mjs`（canConnected シナリオ）\n- Phase 1 データ: `src/data/mock/sensor-log.cruise.canConnected.txt.gz`\n- エミュレータ A: `src/data/tools/ble-can-emulator.py`\n- README（トラブルシュート含む）: `src/data/tools/ble-can-emulator.README.txt`\n- 凍結 B: `src/tools/ble-can-emulator/`\n- BlueZ 復帰: `sudo src/tools/ble-can-emulator/restore-bluez.sh`\n",
  "fact_candidates": [
    {
      "type": "qa_expectation",
      "title": "Phase1完了は12バイトNotifyのlogcat確認まで",
      "statement": "qa.mockdata.ble.emulator の Phase 1 完了は、characteristic 00002311 の 12 バイト Notify が実機 logcat で確認できることまでを条件とし、運転診断の稼働およびスコア変化を完了条件に含めない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1ゲートP1-a LE広告",
      "statement": "Phase 1 では開発 PC が LocalName=DrivingCanData で LE 広告していることが必須である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1ゲートP1-b 実機検出と自動connect",
      "statement": "Phase 1 では実機が 3 秒スキャンで対象を 1 件検出し自動 connect することが必須である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1ゲートP1-c 接続と通知購読確立",
      "statement": "Phase 1 では connect(timeout:10000) が成功し startNotifications が確立していることが必須である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1ゲートP1-d 12バイト値の実測",
      "statement": "Phase 1 では 12 バイト値が実機 logcat で実測確認できることが必須である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1公式ゲートとcompleted記録は実装Aのみ",
      "statement": "Phase 1 完了ゲートの合否判定および completed 記録は実装 A（src/data/tools/ble-can-emulator.py）のみで行い、実装 B の実機検証は Phase 1 対象外とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Notifyペイロード長は12バイト",
      "statement": "BLE Notify で供給する CAN ペイロード長は 12 バイトでなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "広告LocalNameはDrivingCanData",
      "statement": "エミュレータの LE 広告 LocalName は DrivingCanData でなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Service UUIDは00002310",
      "statement": "エミュレータの Service UUID は 00002310-0000-1000-8000-00805f9b34fb でなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "Notify Characteristicは00002311",
      "statement": "Notify Characteristic UUID は 00002311-0000-1000-8000-00805f9b34fb でなければならない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "データ供給は事前入力シミュレーション型のみ",
      "statement": "エミュレータのデータ供給方式は事前入力シミュレーション型に限り、リアルタイム操作型は採用しない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "既定は10レコード集約で100msに1フレーム",
      "statement": "--raw 未指定の既定では入力 10 レコードを集約し 100ms に 1 フレームを Notify する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "連続5フィールドは区間平均",
      "statement": "既定の 10 レコード集約では連続 5 フィールドを区間平均する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "steeringAngleは区間平均",
      "statement": "既定の 10 レコード集約では steeringAngle を区間平均する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "accelPedalPositionとbrakePressureは区間先頭",
      "statement": "既定の 10 レコード集約では accelPedalPosition と brakePressure は区間先頭値を用いる",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "離散3フィールドは区間先頭",
      "statement": "既定の 10 レコード集約では brakeSwitch / shiftIndication / turnSignal は区間先頭値を用いる",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "平均後はfloor(x+0.5)で量子化して符号化",
      "statement": "集約で平均した値は #22 量子化を floor(x+0.5) で適用したうえで 12 バイト符号化する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "端数区間は切り捨てない",
      "statement": "レコード数が 10 で割り切れない端数区間は切り捨てず、残り全部で集約して送出する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "raw指定時は1レコード1Notify",
      "statement": "--raw（または同等）指定時は 1 レコードにつき 1 Notify とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "単純間引きは不採用",
      "statement": "既定送出に単純間引き（デシメーション）を用いてはならない",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "canData無しソースは拒否",
      "statement": "sensor.canData キーが無い入力（smartphoneOnly 相当）をエミュレータは拒否しエラー表示しなければならない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1疎通ソースはcruise canConnected",
      "statement": "Phase 1 疎通確認の入力ソースは src/data/mock/sensor-log.cruise.canConnected.txt.gz を用いる",
      "status": "candidate"
    },
    {
      "type": "permission_rule",
      "title": "受入時sensorModeはcanDataOnlyまたはcombination",
      "statement": "Phase 1 受入時の settings.selectedSensorMode は canDataOnly または combination であり、smartphoneOnly は BLE スキップのため受入不可とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "rate-msの既定は暫定100",
      "statement": "エミュレータの --rate-ms は既定 100（暫定）かつ許容範囲 10 以上 1000 以下であり、infra.ble.device の確定定数にはしない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "実装AとBの同時起動禁止",
      "statement": "実装 A（blueZ-dbus）と実装 B（bumble）は同時に起動してはならない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "B使用後はrestore-bluezで復帰",
      "statement": "実装 B を使用した後に実装 A へ戻す前に、sudo src/tools/ble-can-emulator/restore-bluez.sh による BlueZ 復帰が必要である",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "広告アドレスタイプはpublic前提",
      "statement": "実機 GATT 接続成立のため、コントローラの広告アドレスタイプは public である必要がある",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "エミュレータはLinuxのみ",
      "statement": "BLE CAN エミュレータの実行対象 OS は Linux のみである",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "アプリコード不変",
      "statement": "本エミュレータ受入のために src/data/src/app/** を変更してはならない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1で診断未稼働はゲート失敗ではない",
      "statement": "Phase 1 で運転診断が回らない実測は Phase 1 ゲート失敗ではなく open_question として記録する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "loop時はEOF後もNotify継続",
      "statement": "--loop 指定時、入力 EOF 後も先頭に戻って Notify 供給が継続される",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase2は異常系に限定する",
      "statement": "Phase 2 の受入範囲は切断・不正ペイロード・rate 境界・smartphoneOnly 入力拒否の回帰に限定し、診断・スコア・DB/履歴 E2E および自動再接続・購読差は含めない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "実装Aの新規依存禁止",
      "statement": "実装 A は新規 pip/apt 依存を追加せず、OS 同梱の python3-dbus および gi.repository.GLib のみを用いる",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "Phase 1 で接続・12 バイト Notify は成功しても運転診断が回らない場合の原因切り分け（アプリ購読・middleware デコード・mode 差分・GPS 必須ゲート）は未確定。middleware/app の判断が必要。決まらないと業務 E2E の別フェーズ範囲が定義できない。",
    "canDataOnly と combination で BLE 購読・UI・診断開始条件に差があるかは独断確定禁止のまま未確定。app/middleware 確認が必要。差がある場合は mode 別テストケース分割が必須になる。",
    "切断後の自動再接続ポリシーは未確定（本ノードで確定禁止、Phase 2 にも入れない）。infra/app/middleware の方針決定が必要。決まらないと切断後の期待結果を合格条件にできない。",
    "--rate-ms 範囲外値（10..1000 外）のエラー契約（即 exit / メッセージ内容 / 非ゼロ exit code）が facts に無い。実装 A の CLI 契約確認が必要。TC-BLE-EMU-010 の合格条件が確定しない。",
    "12 バイト符号化 #14 §2 および #22 量子化のビットレイアウト詳細が本ノード facts にインラインされていない。正準ドキュメント位置の確認が必要。ペイロード内容照合（長さ以外）の自動判定ができない。",
    "「連続 5 フィールド」の具体フィールド名が approved fact に列挙されていない。残る候補は vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance だが断定できない。middleware/データ仕様の確認が必要。決まらないと集約結果の期待値を固定できない。",
    "集約時の repeat の扱い（区間先頭 / 平均 / 常に 0 / 送出しない）が未記載。モック合成は repeat=0 固定、実行系 fact は canData {repeat:-1} 任意であり矛盾しうる。middleware/モック生成側の確認が必要。決まらないと 12 バイト中の当該バイト期待値が決まらない。",
    "--raw 指定時に --rate-ms が送出間隔を上書きするのか、入力タイムスタンプを再現するのか未確定。実装 A の CLI 契約確認が必要。決まらないと TC-BLE-EMU-017 の間隔合格条件が書けない。",
    "不正ペイロードの具体定義（短絡・過長・非数値・欠落フィールド・量子化範囲外）と拒否タイミングが未確定。実装/データ仕様の確認が必要。決まらないと TC-BLE-EMU-020 を実施できない。"
  ],
  "rationale_notes": [
    "facts と既存 MD が矛盾する場合は approved facts を正本とした。最大差分は「各行を即 Notify」から「既定 10 レコード集約、--raw で 1 レコード=1 Notify、単純間引き禁止」への改訂である。",
    "smartphoneOnly 入力拒否と rate 境界は最新 fact に従い Phase 2 異常系へ移し、Phase 1 ゲートは P1-a〜d と 12 バイト到達に限定した。",
    "モード別センサー起動ゲートは別 fact で承認済みだが、本ノード禁止事項（ゲート独断緩和）は維持し、参照情報として記載した。",
    "検証は existence / interaction / business の 3 層を維持し、診断やスコアにブロックされない degraded-mode を残した。",
    "アプリ不変制約のため data-testid ではなく logcat・広告スキャン・接続 API 成功を正準観測点とした。",
    "連続 5 フィールドの内訳は推測で断定せず open_question に分離した。"
  ]
}
```