<!-- 作成: 2026-08-07 17:36:52 JST -->

```json
{
  "required_changes": [
    {
      "node": "qa.mockdata.ble.emulator",
      "entrypoint": "spec/qa/mockdata-ble-emulator.md",
      "description": "approved facts に整合する BLE CAN エミュレータ仕様 MD を新規定義（2フェーズ・Phase1ゲート・実装A/B併存・受入条件・禁止事項）する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "middleware",
      "severity": "should",
      "reason": "Phase1はアプリ不変だが canDataOnly/combination 購読差と切断後再接続は open_question のため Sensor サービス側の観測点確認が必要"
    },
    {
      "domain": "app",
      "severity": "could",
      "reason": "受入時 selectedSensorMode が canDataOnly または combination であることの UI/設定前提は App 設定仕様と一致確認が望ましい"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "Linux・BlueZ LEAdvertisingManager1・Privacy=off・public アドレスタイプ・A/B 相互排他と restore-bluez 手順が実行環境前提になる"
    }
  ],
  "requirements_context": "# spec/qa/mockdata-ble-emulator.md\n\n## 目的\n\n実機アプリを改変せず、開発 PC 上の BLE CAN エミュレータが実機と Bluetooth LE 接続を確立し、事前生成されたモック sensor-log（canConnected）から 12 バイト CAN ペイロードを Notify 供給できることを検証・受け入れる。\n\n本ノードは **データ供給方式を事前入力シミュレーション型に限定**する（リアルタイム操作型は不採用）。\n\n---\n\n## スコープ\n\n### 対象\n\n- BLE CAN エミュレータ CLI の起動・広告・接続・Notify\n- モックデータ（`src/data/mock/*.canConnected.txt.gz`）からの 12 バイト符号化再生\n- Phase 1 完了ゲート（実機 logcat での 12 バイト Notify 確認まで）\n- 実装 2 系統（A: 既定 / B: フォールバック凍結）の選択基準と相互排他\n\n### 非対象（本ノードで確定・実装しない）\n\n- `src/data/src/app/**` の変更\n- `middleware.sensor.service` の 4 センサー必須緩和\n- 切断後自動再接続ポリシーの確定\n- canDataOnly と combination の購読差の独断確定\n- Win/Mac 対応\n- リアルタイム操作型エミュレータ\n- DB シード・webm・infra.assets.geolocation の復活/変更\n- 固定ダミー専用モード（`--source` 無しの専用経路）\n- Phase 1 ゲートへの運転診断稼働・スコア変化の組込み\n\n---\n\n## 実装系統（A/B 併存）\n\n| 系統 | パス | 位置づけ | 依存 |\n|------|------|----------|------|\n| **A（既定）** | `src/data/tools/ble-can-emulator.py` | Phase 1 完了判定に用いる唯一の実装 | OS 同梱 `python3` / `python3-dbus` / `gi.repository.GLib` のみ。新規 pip/apt 禁止。sudo 不要、bluetoothd 共存 |\n| **B（凍結）** | `src/tools/ble-can-emulator/` | フォールバック。改変・削除・実データ再生移植・D-Bus 化しない | （既存のまま凍結） |\n\n### 選択基準\n\n- 起動手順・README 上の既定は **A**\n- 次のいずれかで A が使用不能なときのみ B を案内する\n  1. BlueZ が `org.bluez.LEAdvertisingManager1` を提供しない\n  2. `bluetoothctl show` の SupportedInstances が 0\n  3. A の RegisterAdvertisement / RegisterApplication が失敗\n- **B の実機検証は Phase 1 対象外（未検証のまま）**\n\n### 相互排他（MANDATORY）\n\n- A と B は **同時起動禁止**\n- B 使用後に A へ戻す前に、必ず `sudo src/tools/ble-can-emulator/restore-bluez.sh` で BlueZ を復帰する\n- mask 残存は reboot でも復帰しない点を README に明記する\n\n### アドレスタイプ前提（接続失敗回避）\n\n- 広告アドレスタイプは **public** であること\n- `@capacitor-community/bluetooth-le` は `addressType=public` 前提のため、random static だと GATT 接続が status `0x3E` で失敗する\n- A はアドレスタイプを明示指定しないため、`/etc/bluetooth/main.conf` の `Privacy=off`（既定）かつ `bluetoothctl show` でコントローラが `(public)` であることを確認する\n- 上記知見は A の `src/data/tools/ble-can-emulator.README.txt`「うまくいかないとき」に記載する\n\n---\n\n## BLE 広告・GATT 識別子（#14 踏襲）\n\n| 項目 | 値 |\n|------|-----|\n| LE 広告 LocalName | `DrivingCanData` |\n| Service UUID | `00002310-0000-1000-8000-00805f9b34fb` |\n| Notify Characteristic | `00002311-0000-1000-8000-00805f9b34fb` |\n| Notify ペイロード長 | **12 バイト**（`sensor.canData` を #14 §2 どおり符号化） |\n| 実行 OS | **Linux のみ** |\n| アプリ側 | **不変**（エミュレータ側のみで成立させる） |\n\n---\n\n## CLI 仕様（実装 A）\n\n```\npython3 src/data/tools/ble-can-emulator.py --source <path> [--rate-ms <ms>] [--loop]\n```\n\n| 引数 | 必須 | 仕様 |\n|------|------|------|\n| `--source <path>` | 実質必須 | gzip 解凍 → JSON Lines parse → 各行の `sensor.canData` のみを 12 バイト符号化して Notify。`canData` キー無し（smartphoneOnly 相当）は **拒否してエラー表示** |\n| `--rate-ms` | 任意 | 既定 `100`、範囲 `10..1000` |\n| `--loop` | 任意 | EOF 後に先頭へ戻って継続 |\n\n### データ源制約\n\n- Phase 1 疎通の `--source` は次を用いる:  \n  `src/data/mock/sensor-log.cruise.canConnected.txt.gz`\n- 入力はモック生成物（canConnected）の実データ再生に限る（固定ダミー専用モードは作らない）\n- 異常系シナリオ再生は **Phase 2**\n\n### モックデータ側の前提（関連 fact との整合）\n\n- canConnected 相当では `vehicleSpeed` / `longAcc` / `latAcc` / `frontDistance` / `lateralDistance` / `steeringAngle` / `accelPedalPosition` / `brakePressure` / `brakeSwitch` / `shiftIndication` / `turnSignal` / `repeat` を明示\n- 全 `repeat` は合成時 0 固定（`-1` 禁止）\n- smartphoneOnly 相当は `canData` キー省略（エミュレータはこれを入力として受け付けない）\n\n---\n\n## フェーズ定義\n\n### Phase 1（接続・Notify 疎通）\n\n**目標:** 実機との BLE 接続確立と、characteristic `00002311` の 12 バイト Notify が実機 logcat で確認できること。\n\n**完了ゲート（すべて必須・実装 A のみで判定）:**\n\n| ID | 条件 |\n|----|------|\n| P1-a | 開発 PC が LocalName=`DrivingCanData` で LE 広告している |\n| P1-b | 実機が 3 秒スキャンで 1 件検出し、自動 connect する |\n| P1-c | `connect(timeout:10000)` 成功かつ `startNotifications` が確立する |\n| P1-d | 12 バイト値が実機 logcat で実測確認できる |\n\n**Phase 1 ゲートに含めないもの:**\n\n- 運転診断の稼働\n- スコア変化\n\n**受入時アプリ設定:**\n\n- `settings.selectedSensorMode` は `canDataOnly` または `combination`\n- `smartphoneOnly` は BLE スキップのため **不可**\n\n**Phase 1 で診断が回らない実測:**\n\n- ゲート失敗とはみなさない\n- `open_question` として記録する\n\n### Phase 2（以降）\n\n- 異常系シナリオ（切断、不正ペイロード、レート境界、smartphoneOnly 入力拒否の回帰 等）\n- 診断・スコア・業務機能までの E2E は、購読差・再接続ポリシー等の open_question 解消後に拡張する\n\n---\n\n## 検証レイヤ（不安定実装下でも有用であること）\n\nテストは次の 3 層に分ける。\n\n### 1. Existence（存在確認）\n\n- エミュレータプロセスが起動する\n- LE 広告が LocalName / Service UUID で観測できる\n- `--source` が canConnected gzip を読み切れる（行 parse 可能）\n\n### 2. Interaction（相互作用）\n\n- 実機スキャン → connect → startNotifications まで到達する\n- Notify が `--rate-ms` に応じた間隔で届く（観測可能なこと）\n- `--loop` 有効時、EOF 後も Notify が継続する\n\n### 3. Business / Protocol rule（プロトコル・受入規則）\n\n- Notify ペイロードが **常に 12 バイト**\n- 各バイト列が `#14 §2` の canData 符号化規則に従う（cruise シナリオの決定的データで照合可能）\n- `canData` 欠落入力は起動時または再生時に拒否され、エラーが表示される\n- `selectedSensorMode=smartphoneOnly` では BLE 経路を受入対象にしない\n\nセレクタ・アプリ計測点はアプリ改変禁止のため、**実機 logcat / 接続 API 成功 / 広告スキャン結果**を正準観測点とする（data-testid 依存なし）。\n\n---\n\n## テストケース\n\n### Phase 1（必須）\n\n| ID | 層 | 前提 | 手順概要 | 合格条件 |\n|----|----|------|----------|----------|\n| TC-BLE-EMU-001 | existence | Linux・BlueZ・A 利用可 | A を `--source ...cruise.canConnected.txt.gz` で起動 | プロセスがエラーなく起動し広告可能状態になる |\n| TC-BLE-EMU-002 | existence | TC-BLE-EMU-001 | スキャナまたは実機で広告観測 | LocalName=`DrivingCanData` かつ Service UUID=`00002310-...` で検出 |\n| TC-BLE-EMU-003 | interaction | 実機、mode=`canDataOnly` または `combination` | 実機 3 秒スキャン | 1 件検出→自動 connect |\n| TC-BLE-EMU-004 | interaction | TC-BLE-EMU-003 | 接続待ち | `connect(timeout:10000)` 成功かつ startNotifications 確立 |\n| TC-BLE-EMU-005 | business | TC-BLE-EMU-004、rate 既定 100 | logcat 監視 | characteristic `00002311` で **12 バイト** Notify を実測確認 |\n| TC-BLE-EMU-006 | business | 同上 | 複数 Notify を採取 | ペイロード長が常に 12 バイト（短絡・過長なし） |\n| TC-BLE-EMU-007 | interaction | `--loop` 付与 | ソース長を超えて監視 | EOF 後も Notify が継続する |\n| TC-BLE-EMU-008 | business | `--source` に smartphoneOnly（canData 無し）相当 | 起動/再生 | **拒否**されエラー表示。Notify しない |\n\n### 入力・モード境界\n\n| ID | 層 | 内容 | 合格条件 |\n|----|----|------|----------|\n| TC-BLE-EMU-009 | business | `--rate-ms` 境界 10 および 1000 | 受付可能で Notify 継続 |\n| TC-BLE-EMU-010 | business | `--rate-ms` 範囲外（例: 9, 1001） | 拒否または明示的エラー（実装のエラー契約に従う。未定義なら open_question） |\n| TC-BLE-EMU-011 | business | 受入を `smartphoneOnly` で実施 | **受入対象外**（BLE スキップ）。Phase 1 パス扱いにしない |\n\n### 実装系統・運用安全\n\n| ID | 層 | 内容 | 合格条件 |\n|----|----|------|----------|\n| TC-BLE-EMU-012 | existence | README 既定経路が A である | ドキュメント上の既定が A |\n| TC-BLE-EMU-013 | interaction | A/B 同時起動しない運用 | 同時起動禁止が文書化され、手順が従える |\n| TC-BLE-EMU-014 | interaction | B 使用後に A 復帰 | `restore-bluez.sh` 実行後に A の広告登録が再度成功しうる |\n| TC-BLE-EMU-015 | existence | コントローラ address type | `bluetoothctl show` で `(public)`、Privacy=off 前提を満たす |\n\n### 劣化モード（degraded-mode）\n\n| ID | 状況 | それでも検証すること |\n|----|------|----------------------|\n| TC-BLE-EMU-D01 | 診断・スコア未稼働 | P1-a〜d（接続と 12 バイト Notify）のみで Phase 1 完了可 |\n| TC-BLE-EMU-D02 | A が LEAdvertisingManager1 不在等で使用不能 | B 案内条件に入ること。ただし B 実機検証は Phase 1 合格に使わない |\n| TC-BLE-EMU-D03 | combination の購読差が未確定 | canDataOnly で P1-a〜d を優先確認 |\n\n---\n\n## 失敗条件（ゲート）\n\nPhase 1 を **FAIL** とする条件（実装 A）:\n\n1. LocalName=`DrivingCanData` で LE 広告できない\n2. 実機 3 秒スキャンで対象を検出できない / 自動 connect しない\n3. `connect(timeout:10000)` 失敗、または startNotifications 未確立\n4. logcat 上で 12 バイト Notify を確認できない\n5. Notify ペイロード長が 12 以外を含む\n6. canData 無しソースを受け入れてしまった（拒否しない）\n7. アプリ改変や middleware の 4 センサー必須緩和無しには成立させられない（本ノード禁止事項違反）\n\n**FAIL にしない（記録のみ）:**\n\n- Phase 1 で運転診断が回らない・スコアが変わらない実測 → open_question 記録\n\n---\n\n## 証跡（Artifact）\n\n失敗・受入時に残すもの:\n\n| 必須 | 内容 |\n|------|------|\n| run_id | 当該受入実行の識別子 |\n| 広告確認ログ | LocalName / UUID 検出の記録 |\n| 実機 logcat | connect・startNotifications・12 バイト Notify の根拠 |\n| エミュレータ stdout/stderr | 起動パラメータ（source, rate-ms, loop）とエラー |\n| 環境スナップショット | `bluetoothctl show`（public / SupportedInstances）、BlueZ 広告サポート有無 |\n\n任意:\n\n- btmon / HCI トレース\n- スクリーンショット（設定画面の selectedSensorMode）\n\n---\n\n## レポート\n\n`qa_report.json` に少なくとも次を含める:\n\n- `run_id`\n- `status`（pass/fail）\n- `phase`（`1` / `2`）\n- `implementation`（`A` / `B`）※ Phase 1 公式ゲートは `A` のみ\n- `fail_reason`\n- `evidence_paths`\n- `reproduction_steps`（source パス、rate-ms、loop、selectedSensorMode、コントローラ public 確認）\n- `open_questions`（診断未稼働などゲート外の実測）\n\n---\n\n## 例外・allowlist\n\n- 3rd party / OS コンポーネントの無害ログは allowlist 可（期限付きで理由を記録）\n- B 実装の未検証状態そのものは Phase 1 失敗理由にしない\n\n---\n\n## 禁止事項（再掲・受入で違反なら即 FAIL）\n\n- `src/data/src/app/**` 変更\n- middleware.sensor.service の 4 センサー必須緩和\n- 切断後自動再接続ポリシーの独断確定\n- canDataOnly vs combination 購読差の独断確定\n- Win/Mac 対応の追加\n- リアルタイム操作型の実装\n- A への bumble 導入、B への機能追加・削除・リファクタ\n- A/B 同時起動\n- 新規 pip/apt 依存の追加（A）\n\n---\n\n## 関連アーティファクト\n\n- モック生成: `src/data/tools/gen-mock-sensorlog.mjs`（canConnected シナリオ）\n- Phase 1 データ: `src/data/mock/sensor-log.cruise.canConnected.txt.gz`\n- エミュレータ A: `src/data/tools/ble-can-emulator.py`\n- README（トラブルシュート含む）: `src/data/tools/ble-can-emulator.README.txt`\n- 凍結 B: `src/tools/ble-can-emulator/`\n- BlueZ 復帰: `sudo src/tools/ble-can-emulator/restore-bluez.sh`\n",
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
      "type": "validation_rule",
      "title": "canData無しソースは拒否",
      "statement": "sensor.canData キーが無い入力（smartphoneOnly 相当）をエミュレータは拒否しエラー表示しなければならない",
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
      "title": "rate-msの既定と範囲",
      "statement": "エミュレータの --rate-ms は既定 100、許容範囲 10 以上 1000 以下である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "Phase1公式ゲートは実装Aのみ",
      "statement": "Phase 1 完了ゲートの合否判定は実装 A（src/data/tools/ble-can-emulator.py）のみで行い、実装 B の実機検証は Phase 1 対象外とする",
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
      "statement": "実機 GATT 接続成立のため、コントローラの広告アドレスタイプは public である必要がある（random static では接続 status 0x3E となり得る）",
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
      "type": "api_contract",
      "title": "canDataのみを12バイト符号化してNotify",
      "statement": "エミュレータは JSON Lines 各行の sensor.canData のみを #14 §2 に従い 12 バイトへ符号化して Notify する",
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
    "Phase 1 で接続・12 バイト Notify は成功しても運転診断が回らない場合の原因切り分け（アプリ購読・middleware デコード・mode 差分）は未確定。middleware/app の判断が必要。決まらないと Phase 2 の業務 E2E 受入範囲が定義できない。",
    "canDataOnly と combination で BLE 購読・UI・診断開始条件に差があるかは独断確定禁止のまま未確定。app/middleware 確認が必要。差がある場合は mode 別テストケース分割が必須になる。",
    "切断後の自動再接続ポリシーは未確定（本ノードで確定禁止）。infra/app/middleware の方針決定が必要。決まらないと異常系（Phase 2）の期待結果を固定できない。",
    "--rate-ms 範囲外値（10..1000 外）のエラー契約（即 exit / メッセージ内容 / 非ゼロ exit code）が facts に無い。実装 A の実際の CLI 契約確認が必要。境界テスト TC-BLE-EMU-010 の合格条件が確定しない。",
    "12 バイト符号化 #14 §2 のビットレイアウト詳細が本ノード facts にインラインされていない。符号化仕様の正準ドキュメント位置の確認が必要。ペイロード内容照合（長さ以外）の自動判定ができない。"
  ],
  "rationale_notes": [
    "本仕様は approved design_decision を正本とし、モックセンサログ生成 fact はエミュレータ入力契約（canConnected 必須・smartphoneOnly 拒否・cruise 固定ソース）に関連する範囲のみ QA 観点で参照した。",
    "検証は existence / interaction / business の 3 層に分け、診断やスコアなど未安定部分にブロックされないよう Phase 1 ゲートを接続と 12 バイト Notify に限定した。",
    "アプリ不変制約のため data-testid ではなく logcat・広告スキャン・接続 API 成功を正準観測点とした。",
    "実装 B は凍結・Phase1 判定外とし、フォールバック案内と BlueZ 復帰手順のみ運用安全としてテスト対象に含めた。",
    "fact_candidates にはツール導入手順や実装詳細ではなく、受入で成立すべき条件・失敗条件・制約のみを載せた。"
  ]
}
```