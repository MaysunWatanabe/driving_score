<!-- 作成: 2026-09-10 17:39:45 JST | 更新: 2026-09-18 17:52:53 JST -->

# spec/qa/mockdata-ble-emulator.md

## 目的

実機アプリを改変せず、開発 PC 上の BLE CAN エミュレータが実機と Bluetooth LE 接続を確立し、事前生成されたモック sensor-log（canConnected）から 12 バイト CAN ペイロードを Notify 供給できることを検証・受け入れる。

本ノードは **データ供給方式を事前入力シミュレーション型に限定**する（リアルタイム操作型は不採用）。

---

## スコープ

### 対象

- BLE CAN エミュレータ CLI の起動・広告・接続・Notify
- モックデータ（`src/data/mock/*.canConnected.txt.gz`）からの 12 バイト符号化再生
- 既定の 10 レコード集約送出と、1 レコード=1 Notify の `--raw`（または同等）経路
- `--rate-ms` 閉区間 [10, 1000] と範囲外の即終了契約
- 実装 A の `--inject-invalid {short11,long13,zeros,ones}`（Phase 2）とその**未知値拒否契約**
- Phase 1 完了ゲート（実機 logcat での 12 バイト Notify 確認まで）および Phase 1 completed 記録（実装 A のみ）
- Phase 2（異常系に限定）
- 実装 2 系統（A: 既定 / B: フォールバック凍結）の選択基準と相互排他
- README（トラブルシュート）記載の存在確認

### 非対象（本ノードで確定・実装しない）

- `src/data/src/app/**` の変更
- `middleware.sensor.service` のセンサー必須ゲートの独断緩和・独断改訂
- 切断後自動再接続ポリシーの確定（Phase 2 にも入れない）
- canDataOnly と combination の購読差の独断確定（Phase 2 にも入れない）
- 診断・スコア・DB/履歴までの業務 E2E（購読差・再接続ポリシーの open_question 解消後の別フェーズ）
- Win/Mac 対応
- リアルタイム操作型エミュレータ
- DB シード・webm・infra.assets.geolocation の復活/変更
- 固定ダミー専用モード（`--source` 無しの専用経路）
- Phase 1 ゲートへの運転診断稼働・スコア変化の組込み
- `infra.ble.device` への `notify_interval_ms=100` 確定定数追加（`--rate-ms` 既定 100 は暫定据え置き）
- 実装 B への `--inject-invalid` 追加・実データ再生移植・改変
- 2026 年度改修要求（BLE 安定化、標識認識・先行車検知追加など）にともなう**ペイロード長・割り当ての変更の確定**（本ノードは現行 12 バイト固定前提のまま。変更は open_question）

---

## 実装系統（A/B 併存）

| 系統 | パス | 位置づけ | 依存・実行前提 |
|------|------|----------|----------------|
| **A（既定）** | `src/data/tools/ble-can-emulator.py` | Phase 1 完了判定および completed 記録に用いる唯一の実装。`--inject-invalid` も A のみ | BlueZ D-Bus。OS 同梱 `python3` / `python3-dbus` / `gi.repository.GLib` のみ。新規 pip/apt 禁止。**sudo 不要**、`bluetoothd` と共存 |
| **B（凍結）** | `src/tools/ble-can-emulator/` | フォールバック。改変・削除・実データ再生移植・D-Bus 化・`--inject-invalid` 追加をしない | bumble。**sudo 必須**、`bluetoothd` 停止が必要。送出は**合成波**であり `--source` 実データ再生ではない |

### 選択基準

- 起動手順・README 上の既定は **A**
- 次のいずれかで A が使用不能なときのみ B を案内する
  1. BlueZ が `org.bluez.LEAdvertisingManager1` を提供しない
  2. `bluetoothctl show` の SupportedInstances が 0
  3. A の RegisterAdvertisement / RegisterApplication が失敗
- **B の実機検証は Phase 1 対象外（未検証のまま）**
- Phase 1 を completed と記録してよいのは **実装 A のみ**
- B は合成波送出のため、モック実データ再生（集約・端数・`--raw`・`--inject-invalid`）の受入判定には使用しない

### 相互排他（MANDATORY）

- A と B は **同時起動禁止**
- B 使用後に A へ戻す前に、必ず `sudo src/tools/ble-can-emulator/restore-bluez.sh` で BlueZ を復帰する
- mask 残存は reboot でも復帰しない点を README に明記する

### アドレスタイプ前提（接続失敗回避）

- 広告アドレスタイプは **public** であること
- `@capacitor-community/bluetooth-le` は `addressType=public` 前提のため、random static だと GATT 接続が status `0x3E` で失敗する
- A はアドレスタイプを明示指定しないため、`/etc/bluetooth/main.conf` の `Privacy=off`（既定）かつ `bluetoothctl show` でコントローラが `(public)` であることを確認する
- 上記知見は A の `src/data/tools/ble-can-emulator.README.txt`「うまくいかないとき」に記載する

---

## BLE 広告・GATT 識別子（#14 踏襲）

| 項目 | 値 |
|------|-----|
| LE 広告 LocalName | `DrivingCanData` |
| Service UUID | `00002310-0000-1000-8000-00805f9b34fb` |
| Notify Characteristic | `00002311-0000-1000-8000-00805f9b34fb` |
| Notify ペイロード長 | **12 バイト**（`sensor.canData` を #14 §2 どおり符号化。`--inject-invalid` 指定時は本規則の例外） |
| 広告アドレスタイプ | **public** |
| 実行 OS | **Linux のみ** |
| アプリ側 | **不変**（エミュレータ側のみで成立させる） |

---

## CLI 仕様（実装 A）

```
python3 src/data/tools/ble-can-emulator.py --source <path> [--rate-ms <ms>] [--loop] [--raw] [--inject-invalid <KIND>] [--verbose] [--adapter <hciX>]
```

| 引数 | 必須 | 仕様 |
|------|------|------|
| `--source <path>` | 実質必須 | gzip 解凍 → JSON Lines parse → 各行の `sensor.canData` を集約または生再生し、#14 §2 どおり 12 バイト符号化して Notify。`canData` キー無し（smartphoneOnly 相当）は **拒否してエラー表示** |
| `--rate-ms` | 任意 | 既定 `100`（**暫定値**。`infra.ble.device` の確定定数にはしない）。許容は閉区間 **[10, 1000]** |
| `--loop` | 任意 | EOF 後に先頭へ戻って継続 |
| `--raw`（または同等） | 任意 | 1 レコード = 1 Notify。未指定時は既定の 10 レコード集約 |
| `--inject-invalid <KIND>` | 任意 | 既定は未指定（`None`）。`type=str` / `metavar='KIND'` で受け、**argparse の `choices` では検証しない**。許容値は `short11` / `long13` / `zeros` / `ones` の**小文字完全一致**。指定時は **全フレーム** を当該 kind にする。実装 A のみ。Phase 1 では未指定であること |

### `--rate-ms` 範囲外契約（確定）

`--rate-ms` が 10 未満または 1000 超のとき、次が成立しなければならない。

- 判定は `main()` 冒頭（`load_can_frames()` / D-Bus 接続 / アダプタ取得より前）で行われる
- BLE に到達しない（D-Bus 接続・アダプタ取得・GATT 登録・LE 広告・Notify を行わない）
- 即座に終了し **exit code は 1**
- 次の **`[ERROR]` 1 行** を出力する:  
  `[ERROR] --rate-ms は 10〜1000 の範囲で指定してください（指定値: <指定値>）`
- **`[adapter]` 行は出ない**

範囲内の 10 および 1000 は受付可能であり、Notify が継続する（TC-BLE-EMU-009）。既定 100 は変更しない。

### `--inject-invalid` 未知値契約（確定・`--rate-ms` と同一様式）

- 検証は `main()` 冒頭、`--rate-ms` 範囲チェックの**直後**に行う（`load_can_frames()` / D-Bus 接続 / アダプタ取得より前）
- 許容値集合は `('short11', 'long13', 'zeros', 'ones')`
- 未知値のとき次が成立する
  - **exit code 1**
  - stderr に **`[ERROR]` 1 行のみ**:  
    `[ERROR] --inject-invalid は short11, long13, zeros, ones のいずれかを指定してください（指定値: <指定値>）`
  - `[source]` / `[adapter]` 行を出さず、D-Bus 接続 / GATT 登録 / LE 広告 / Notify を一切行わない
- **正規化は行わない**（`lower()` / `strip()` をしない）。したがって `SHORT11`、` zeros`（前後空白付き）、空文字列 `''` はいずれも**不正**である
- **検証順序は `--rate-ms` → `--inject-invalid`**。両方不正な場合は `--rate-ms` のエラーのみを出力して終了する
- 未指定（`None`）は検証をすり抜け、現行どおり正常 12 バイト送出となる

### `--inject-invalid` 起動ログ

- 正常起動時、`[source]` 行の**直後**に `[inject-invalid] <kind>` を 1 行 stdout へ出力する
- 未指定時は当該行を出力しない

### 既定送出（10 レコード集約）

`--raw` 未指定時の既定は次のとおりとする。単純間引き（デシメーション）はピーク取りこぼしのため **採用しない**。

- 入力 10 レコードを 1 区間として集約し、**100ms に 1 フレーム**送出する
- 連続 5 フィールドは **平均**
- `steeringAngle` は **平均**
- `accelPedalPosition` / `brakePressure` は **区間先頭**
- `brakeSwitch` / `shiftIndication` / `turnSignal` は **区間先頭**
- 平均後は #22 量子化を `floor(x+0.5)` で適用して 12 バイト符号化する
- レコード数が 10 で割り切れない端数区間は **切り捨てず**、残り全部で平均（および上記の区間先頭規則）する

### `--inject-invalid` 適用位置とペイロード（Phase 2・実装 A）

- 未指定（既定）: 通常の 12 バイト符号化経路
- 適用は **Notify 直前**（`CanCharacteristic._on_tick` で `self.value` に載せる直前）で行う
- kind ごとのペイロード

| kind | 送出ペイロード | 長さ |
|------|----------------|------|
| `short11` | 正常符号化結果の `payload[:11]` | 11 バイト |
| `long13` | 正常符号化結果 + `b'\x00'` | 13 バイト |
| `zeros` | `b'\x00' * 12` | 12 バイト |
| `ones` | `b'\xff' * 12` | 12 バイト |

- `encode_can_data` / `aggregate_can_records` / `load_can_frames` / `format_send_lines` および既存 `--rate-ms` / `--loop` / `--raw` / `--verbose` / `--adapter` の挙動は変更されない
- 実装 B には追加しない（凍結）
- Phase 1 完了ゲートでは使用しない（12 バイト Notify の実測と矛盾するため）

### データ源制約

- Phase 1 疎通の `--source` は次を用いる:  
  `src/data/mock/sensor-log.cruise.canConnected.txt.gz`
- 入力はモック生成物（canConnected）の実データ再生に限る（固定ダミー専用モードは作らない）
- 異常系シナリオ再生は **Phase 2**

### モックデータ側の前提（関連 fact との整合）

- canConnected 相当では `vehicleSpeed` / `longAcc` / `latAcc` / `frontDistance` / `lateralDistance` / `steeringAngle` / `accelPedalPosition` / `brakePressure` / `brakeSwitch` / `shiftIndication` / `turnSignal` / `repeat` を明示
- 全 `repeat` は合成時 0 固定（`-1` 禁止）
- smartphoneOnly 相当は `canData` キー省略（エミュレータはこれを入力として受け付けない）

---

## フェーズ定義

### Phase 1（接続・Notify 疎通）

**目標:** 実機との BLE 接続確立と、characteristic `00002311` の 12 バイト Notify が実機 logcat で確認できること。

**完了ゲート（すべて必須・実装 A のみで判定）:**

| ID | 条件 |
|----|------|
| P1-a | 開発 PC が LocalName=`DrivingCanData` で LE 広告している |
| P1-b | 実機が 3 秒スキャンで 1 件検出し、自動 connect する |
| P1-c | `connect(timeout:10000)` 成功かつ `startNotifications` が確立する |
| P1-d | 12 バイト値が実機 logcat で実測確認できる |

**Phase 1 ゲートに含めないもの:**

- 運転診断の稼働
- スコア変化
- DB / 履歴の業務 E2E
- `--inject-invalid` の実施（未知値拒否の検証を含む）
- `--rate-ms` 範囲外の実施

**完了記録:**

- Phase 1 を `completed` と記録してよいのは **実装 A のみ**
- 実装 B での実機結果は Phase 1 completed に使わない
- 現状、Phase 1 は上記ゲート (a)–(d) を満たし **completed** として記録済み

**受入時アプリ設定:**

- `settings.selectedSensorMode` は `canDataOnly` または `combination`
- `smartphoneOnly` は BLE スキップのため **不可**

**関連する起動ゲート（本ノードでは改訂しない・参照のみ）:**

- センサー起動ゲートはモード別（全モード GPS 必須。canDataOnly は GPS+canData、smartphoneOnly は GPS+加速度+方位+磁力計、combination は両方）が別 fact で承認済み
- 本ノードは当該ゲートの緩和・改訂を行わない
- Phase 1 完了は診断開始の成否に依存しない

**Phase 1 で診断が回らない実測:**

- ゲート失敗とはみなさない
- `open_question` として記録する

### Phase 2（異常系に限定）

Phase 2 は次の異常系に限定する。

- 切断（自動再接続の成否は合格条件にしない）
- 不正ペイロード（実装 A の `--inject-invalid` 4 kind）
- `--inject-invalid` の**未知値・不正表記**（未知文字列 / 空文字列 / 大文字 / 前後空白）の拒否
- `--rate-ms` 境界（範囲内 10/1000 と範囲外 9/1001）と `--rate-ms` 優先の検証順序
- smartphoneOnly 入力拒否の回帰

**Phase 2 に入れないもの（未決のまま）:**

- 切断後の自動再接続ポリシー
- canDataOnly と combination の購読差
- 診断・スコア・DB/履歴の E2E（上記 open_question 解消後の別フェーズ）
- BLE 安定化要求（パラレル処理化仮説）の恒久対策の合否判定

`--rate-ms` 既定 100 は暫定据え置きとする。

---

## 検証レイヤ（不安定実装下でも有用であること）

テストは次の 3 層に分ける。

### 1. Existence（存在確認）

- エミュレータプロセスが起動する
- LE 広告が LocalName / Service UUID で観測できる
- `--source` が canConnected gzip を読み切れる（行 parse 可能）
- `--rate-ms` 範囲外ではプロセスが広告前に終了する
- `--inject-invalid` 未知値でもプロセスが広告前に終了する
- 正常起動時に `[inject-invalid] <kind>` 行が `[source]` 直後に出る（指定時のみ）
- README に既定 A・B 案内条件・public / `0x3E`・mask 残存の注意が記載されている

### 2. Interaction（相互作用）

- 実機スキャン → connect → startNotifications まで到達する
- Notify が既定 100ms フレーム、または `--rate-ms` / `--raw` に応じた間隔で届く（観測可能なこと）
- `--loop` 有効時、EOF 後も Notify が継続する
- `--inject-invalid` 中も BLE 接続が維持され、通常経路へ復帰できる

### 3. Business / Protocol rule（プロトコル・受入規則）

- Phase 1 および `--inject-invalid` 未指定時、Notify ペイロードは **常に 12 バイト**
- 既定経路では 10 レコード集約後の 1 フレームが #14 §2 および #22 量子化（`floor(x+0.5)`）に従う
- `--raw` では 1 レコード = 1 Notify となる
- 単純間引き（デシメーション）によるピーク欠落を合格条件にしない
- `canData` 欠落入力は起動時または再生時に拒否され、エラーが表示される
- `selectedSensorMode=smartphoneOnly` では BLE 経路を受入対象にしない
- `--rate-ms` 範囲外は exit code 1 かつ指定の `[ERROR]` 1 行で、BLE に到達しない
- `--inject-invalid` 未知値は exit code 1 かつ指定の `[ERROR]` 1 行のみで、BLE に到達しない（`[source]` / `[adapter]` も出ない）
- `--rate-ms` と `--inject-invalid` が同時に不正な場合、出力は `--rate-ms` のエラーのみ
- `--inject-invalid` の 4 kind 各々でアプリがクラッシュせず、BLE が維持され、正常復帰できる
- `--inject-invalid` の各 kind の送出ペイロードは short11=11 バイト / long13=13 バイト / zeros=`0x00`×12 / ones=`0xFF`×12 である

セレクタ・アプリ計測点はアプリ改変禁止のため、**実機 logcat / 接続 API 成功 / 広告スキャン結果 / プロセス exit code・stdout・stderr**を正準観測点とする（data-testid 依存なし）。

---

## テストケース

### Phase 1（必須）

| ID | 層 | 前提 | 手順概要 | 合格条件 |
|----|----|------|----------|----------|
| TC-BLE-EMU-001 | existence | Linux・BlueZ・A 利用可 | A を `--source ...cruise.canConnected.txt.gz` で起動（`--inject-invalid` 未指定） | プロセスがエラーなく起動し広告可能状態になる（sudo 不要・bluetoothd 停止不要） |
| TC-BLE-EMU-002 | existence | TC-BLE-EMU-001 | スキャナまたは実機で広告観測 | LocalName=`DrivingCanData` かつ Service UUID=`00002310-...` で検出 |
| TC-BLE-EMU-003 | interaction | 実機、mode=`canDataOnly` または `combination` | 実機 3 秒スキャン | 1 件検出→自動 connect |
| TC-BLE-EMU-004 | interaction | TC-BLE-EMU-003 | 接続待ち | `connect(timeout:10000)` 成功かつ startNotifications 確立 |
| TC-BLE-EMU-005 | business | TC-BLE-EMU-004、rate 既定 100、集約既定 | logcat 監視 | characteristic `00002311` で **12 バイト** Notify を実測確認 |
| TC-BLE-EMU-006 | business | 同上 | 複数 Notify を採取 | ペイロード長が常に 12 バイト（短絡・過長なし） |
| TC-BLE-EMU-007 | interaction | `--loop` 付与 | ソース長を超えて監視 | EOF 後も Notify が継続する |
| TC-BLE-EMU-016 | business | `--raw` 未指定 | 既定再生を観測 | 10 レコード集約の 1 フレームが 100ms 周期で送出される（単純間引きではない） |
| TC-BLE-EMU-017 | business | `--raw` 付与 | 生再生を観測 | 1 レコード = 1 Notify となる |
| TC-BLE-EMU-018 | business | レコード数が 10 で割り切れない入力 | 終端区間を観測 | 端数区間が切り捨てられず、残り全部で集約されたフレームが送出される |

### Phase 2（異常系）

| ID | 層 | 内容 | 合格条件 |
|----|----|------|----------|
| TC-BLE-EMU-008 | business | `--source` に smartphoneOnly（canData 無し）相当 | **拒否**されエラー表示。Notify しない |
| TC-BLE-EMU-009 | business | `--rate-ms` 境界 10 および 1000 | 受付可能で Notify 継続 |
| TC-BLE-EMU-010 | business | `--rate-ms 9` および `--rate-ms 1001` を各々実行（実装 A。B・アプリ本体は対象外） | 各々で (1) exit code が 1 (2) `[ERROR] --rate-ms は 10〜1000 の範囲で指定してください（指定値: 9 または 1001）` が出力される (3) `[adapter]` 行が出ない。BLE 広告・GATT・Notify に到達しない |
| TC-BLE-EMU-019 | interaction | 接続確立後にエミュレータ側切断 | 切断が観測できる（自動再接続の成否は合格条件にしない） |
| TC-BLE-EMU-020 | business | 実装 A で `--inject-invalid` を `short11` / `long13` / `zeros` / `ones` の 4 kind 各々指定（B は対象外） | 各 kind で (1) クラッシュしない (2) BLE が維持され正常復帰できる (3) 実機 logcat を evidence に残す |
| TC-BLE-EMU-022 | business | 実装 A で `--inject-invalid` に未知値を指定（最低 4 パターン: `foo` / 空文字列 `''` / `SHORT11` / ` zeros`） | 各々で (1) exit code が 1 (2) `[ERROR] --inject-invalid は short11, long13, zeros, ones のいずれかを指定してください（指定値: <指定値>）` が **1 行のみ** stderr に出る (3) `[source]` 行も `[adapter]` 行も出ない (4) LE 広告・GATT 登録・Notify に到達しない |
| TC-BLE-EMU-023 | business | `--rate-ms 9 --inject-invalid foo` のように両方不正で実行 | exit code 1 かつ出力は `--rate-ms` の `[ERROR]` 1 行のみ（`--inject-invalid` のエラーは出ない） |
| TC-BLE-EMU-024 | existence | (a) `--inject-invalid zeros` で正常起動 (b) `--inject-invalid` 未指定で正常起動 | (a) `[source]` 行の直後に `[inject-invalid] zeros` が 1 行出力される (b) `[inject-invalid]` 行が出力されない |
| TC-BLE-EMU-025 | business | 4 kind 各々の送出ペイロードを観測（logcat / btmon 等） | short11 は 11 バイト（正常符号化結果の先頭 11）、long13 は 13 バイト（正常符号化結果 + `0x00`）、zeros は `0x00`×12、ones は `0xFF`×12 |

TC-BLE-EMU-020 の **FAIL** 条件（いずれかで失敗）:

- アプリが FC する
- 切断後に正常復帰できない
- 成立のためにアプリ改変が必須になる

### 入力・モード境界

| ID | 層 | 内容 | 合格条件 |
|----|----|------|----------|
| TC-BLE-EMU-011 | business | 受入を `smartphoneOnly` で実施 | **受入対象外**（BLE スキップ）。Phase 1 パス扱いにしない |

### 実装系統・運用安全

| ID | 層 | 内容 | 合格条件 |
|----|----|------|----------|
| TC-BLE-EMU-012 | existence | README 既定経路が A である | ドキュメント上の既定が A |
| TC-BLE-EMU-013 | interaction | A/B 同時起動しない運用 | 同時起動禁止が文書化され、手順が従える |
| TC-BLE-EMU-014 | interaction | B 使用後に A 復帰 | `restore-bluez.sh` 実行後に A の広告登録が再度成功しうる |
| TC-BLE-EMU-015 | existence | コントローラ address type | `bluetoothctl show` で `(public)`、Privacy=off 前提を満たす |
| TC-BLE-EMU-021 | existence | A の README「うまくいかないとき」記載確認 | (1) public アドレス前提と random static 時の GATT status `0x3E` (2) B 使用後の `restore-bluez.sh` 必須と mask 残存は reboot でも復帰しない旨 (3) B 案内条件（LEAdvertisingManager1 非提供 / SupportedInstances=0 / Register 失敗）が記載されている |

### 劣化モード（degraded-mode）

| ID | 状況 | それでも検証すること |
|----|------|----------------------|
| TC-BLE-EMU-D01 | 診断・スコア未稼働 | P1-a〜d（接続と 12 バイト Notify）のみで Phase 1 完了可 |
| TC-BLE-EMU-D02 | A が LEAdvertisingManager1 不在等で使用不能 | B 案内条件に入ること。ただし B は合成波・sudo/bluetoothd 停止前提であり、Phase 1 合格・completed および実データ再生系 TC には使わない |
| TC-BLE-EMU-D03 | combination の購読差が未確定 | canDataOnly で P1-a〜d を優先確認 |
| TC-BLE-EMU-D04 | 集約符号化のビット完全照合が未整備 | ペイロード長 12 バイトと Notify 到達のみで Phase 1 は完了可。内容照合は可能な範囲で記録 |
| TC-BLE-EMU-D05 | `--inject-invalid` 未実装 | Phase 1 は P1-a〜d で完了可。TC-BLE-EMU-020 / 022〜025 は未実施として記録し Phase 1 FAIL にしない |
| TC-BLE-EMU-D06 | 実機（テスト用ナビ端末）が未提供 | 実機不要な TC（001/002/010/012/015/021/022/023/024）は CLI 単体で先行実施し、実機依存 TC は blocked として記録する |

---

## 失敗条件（ゲート）

Phase 1 を **FAIL** とする条件（実装 A）:

1. LocalName=`DrivingCanData` で LE 広告できない
2. 実機 3 秒スキャンで対象を検出できない / 自動 connect しない
3. `connect(timeout:10000)` 失敗、または startNotifications 未確立
4. logcat 上で 12 バイト Notify を確認できない
5. Notify ペイロード長が 12 以外を含む（`--inject-invalid` 未指定時）
6. アプリ改変や middleware センサーゲートの独断緩和無しには成立させられない（本ノード禁止事項違反）
7. Phase 1 completed を実装 B の結果だけで記録した

**FAIL にしない（記録のみ）:**

- Phase 1 で運転診断が回らない・スコアが変わらない実測 → open_question 記録
- smartphoneOnly 入力拒否・rate 境界・切断・不正ペイロードの未実施（これらは Phase 2）
- 自動再接続の未実施・未成立
- canDataOnly と combination の購読差未確認
- `--inject-invalid` 未実装（Phase 1 完了をブロックしない）
- テスト用ナビ端末未提供による実機 TC の blocked

Phase 2 を **FAIL** とする条件（該当ケース実施時）:

1. canData 無しソースを受け入れてしまった（拒否しない）
2. `--rate-ms` 許容範囲内の 10 および 1000 で Notify が継続しない
3. `--rate-ms 9` または `--rate-ms 1001` で exit code が 1 でない、指定の `[ERROR]` 1 行が出ない、`[adapter]` 行が出る、または BLE 広告/Notify に到達する
4. `--inject-invalid` の 4 kind のいずれかでアプリが FC する、切断後に正常復帰できない、またはアプリ改変が必須になる
5. `--inject-invalid` 未知値（`foo` / `''` / `SHORT11` / ` zeros` を含む）を受理して起動した、exit code が 1 でない、`[ERROR]` 行が 1 行でない、`[source]` または `[adapter]` 行が出た、または BLE に到達した
6. `--rate-ms` と `--inject-invalid` が同時に不正なとき `--inject-invalid` のエラーが出力された（検証順序違反）
7. `--inject-invalid` 各 kind の送出ペイロードが規定（short11=11B / long13=13B / zeros=0x00×12 / ones=0xFF×12）と異なる
8. `--inject-invalid` 指定時に `[inject-invalid] <kind>` 行が出ない、または未指定時に当該行が出た

---

## 証跡（Artifact）

失敗・受入時に残すもの:

| 必須 | 内容 |
|------|------|
| run_id | 当該受入実行の識別子 |
| 広告確認ログ | LocalName / UUID 検出の記録 |
| 実機 logcat | connect・startNotifications・12 バイト Notify の根拠。`--inject-invalid` 実施時は各 kind の受信とクラッシュ有無 |
| エミュレータ stdout/stderr | 起動パラメータ（source, rate-ms, loop, raw, inject-invalid）と `[source]` / `[inject-invalid]` / `[adapter]` 行、エラー。範囲外・未知値時は `[ERROR]` 行と `[source]` / `[adapter]` 非出力 |
| 終了コード | `--rate-ms` 範囲外および `--inject-invalid` 未知値ケースでは exit code |
| 環境スナップショット | `bluetoothctl show`（public / SupportedInstances）、BlueZ 広告サポート有無 |
| README 参照 | TC-BLE-EMU-021 判定時は該当節の該当記述箇所 |

任意:

- btmon / HCI トレース（TC-BLE-EMU-025 のペイロード内容照合に有効）
- スクリーンショット（設定画面の selectedSensorMode）
- 集約前後のサンプル対照（10 レコード区間と送出 12 バイト）

---

## レポート

`qa_report.json` に少なくとも次を含める:

- `run_id`
- `status`（pass/fail/blocked）
- `phase`（`1` / `2`）
- `implementation`（`A` / `B`）※ Phase 1 公式ゲートおよび completed 記録は `A` のみ
- `fail_reason`
- `evidence_paths`
- `reproduction_steps`（source パス、rate-ms、loop、raw、inject-invalid（未知値ケースは指定文字列そのまま）、selectedSensorMode、コントローラ public 確認、範囲外・未知値時の exit code）
- `open_questions`（診断未稼働などゲート外の実測）

---

## 例外・allowlist

- 3rd party / OS コンポーネントの無害ログは allowlist 可（期限付きで理由を記録）
- B 実装の未検証状態そのものは Phase 1 失敗理由にしない
- `--inject-invalid` 指定時の 12 バイト長逸脱は Phase 1 の長さゲートを適用しない（Phase 2 専用例外）

---

## 禁止事項（再掲・受入で違反なら即 FAIL）

- `src/data/src/app/**` 変更
- middleware.sensor.service のセンサー必須ゲートの独断緩和
- 切断後自動再接続ポリシーの独断確定
- canDataOnly vs combination 購読差の独断確定
- Win/Mac 対応の追加
- リアルタイム操作型の実装
- A への bumble 導入、B への機能追加・削除・リファクタ・移植・D-Bus 化（`--inject-invalid` を含む）
- A/B 同時起動
- 新規 pip/apt 依存の追加（A）
- 単純間引き（デシメーション）を既定送出として採用すること
- Phase 1 completed を実装 B のみで記録すること
- Phase 1 ゲートに `--inject-invalid` を用いて 12 バイト条件を無効化すること
- `--inject-invalid` を argparse `choices` で弾く実装に変更すること、および値の `lower()` / `strip()` 正規化を追加すること
- 2026 年度改修要求を根拠にペイロード長・割り当てを本ノードで独断変更すること

---

## 関連アーティファクト

- モック生成: `src/data/tools/gen-mock-sensorlog.mjs`（canConnected シナリオ）
- Phase 1 データ: `src/data/mock/sensor-log.cruise.canConnected.txt.gz`
- エミュレータ A: `src/data/tools/ble-can-emulator.py`
- README（トラブルシュート含む）: `src/data/tools/ble-can-emulator.README.txt`
- 凍結 B: `src/tools/ble-can-emulator/`
- BlueZ 復帰: `sudo src/tools/ble-can-emulator/restore-bluez.sh`

```json
{
  "required_changes": [
    {
      "node": "qa.mockdata.ble.emulator",
      "entrypoint": "spec/qa/mockdata-ble-emulator.md",
      "description": "--inject-invalid の未知値拒否契約（main()冒頭検証・exit1・ERROR1行のみ・BLE非到達・正規化なし・rate-ms優先）、[inject-invalid]行の出力規則、4 kind のペイロード実体（short11=11B/long13=13B/zeros=0x00x12/ones=0xFFx12）と適用位置をTC-BLE-EMU-022〜025として追加した"
    },
    {
      "node": "qa.mockdata.ble.emulator",
      "entrypoint": "spec/qa/mockdata-ble-emulator.md",
      "description": "2026年度改修要求（BLE安定化・標識認識/先行車検知によるペイロード変更）は本ノードで独断確定しない旨を非対象・禁止事項に明記し、テスト用ナビ端末未提供時の劣化モード TC-BLE-EMU-D06 と status=blocked を追加した"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "middleware",
      "severity": "must",
      "reason": "CANペイロードの長さ・割り当て変更が未確定のままだと12バイト前提のTC-BLE-EMU-005/006/025およびshort11/long13の定義が一斉に無効化されるため、変更有無と確定時期の判断が必要"
    },
    {
      "domain": "middleware",
      "severity": "should",
      "reason": "不正長・全0/全1フレームをNotifyされてもデコード失敗で購読切断やプロセス異常にしない観測点が必要"
    },
    {
      "domain": "app",
      "severity": "should",
      "reason": "TC-BLE-EMU-020/025 は不正ペイロード受信時の非クラッシュ・BLE維持・正常復帰を合格とするためアプリ側の耐障害性が前提になる"
    },
    {
      "domain": "infra",
      "severity": "should",
      "reason": "テスト用ナビ端末の提供時期未定により実機依存TCがblockedとなるため、CLI単体実施可能TCの先行実行環境と証跡保存先の確保が必要"
    }
  ],
  "requirements_context": "qa.mockdata.ble.emulator は、実機アプリ（src/data/src/app/**）を一切改変せず、開発PC（Linux/BlueZ）上のBLE CANエミュレータが実機とLE接続し、事前生成モックsensor-log（canConnected）から12バイトCANペイロードをNotify供給できることを検証・受け入れるノードである。データ供給は事前入力シミュレーション型のみで、リアルタイム操作型は不採用。広告LocalName=DrivingCanData、Service UUID=00002310-0000-1000-8000-00805f9b34fb、Notify Characteristic=00002311-0000-1000-8000-00805f9b34fb、ペイロード12バイト固定、広告アドレスタイプはpublic（random staticだと@capacitor-community/bluetooth-le で GATT status 0x3E 失敗）。実装は2系統併存で、既定A（src/data/tools/ble-can-emulator.py、BlueZ D-Bus、OS同梱python3/python3-dbus/GLibのみ、新規pip/apt禁止、sudo不要・bluetoothd共存）と凍結B（src/tools/ble-can-emulator/、bumble、sudo必須・bluetoothd停止必須、送出は合成波であり--source実データ再生ではない）。BはLEAdvertisingManager1非提供／SupportedInstances=0／A のRegister失敗時のみ案内し、A/B同時起動禁止、B使用後は restore-bluez.sh で復帰（mask残存はrebootでも復帰しない）。Phase 1 完了ゲートはA のみで判定し、(a)LE広告 (b)実機3秒スキャン1件検出→自動connect (c)connect(timeout:10000)成功かつstartNotifications確立 (d)12バイト値のlogcat実測、の4条件で、診断稼働・スコア変化・DB/履歴E2E・--inject-invalid・rate-ms範囲外は含めない。Phase 1 はA でcompletedとして記録済み。受入時 selectedSensorMode は canDataOnly または combination（smartphoneOnly は BLE スキップのため不可）。CLI は --source（gzip→JSON Lines→sensor.canData を#14 §2符号化。canData 無しは拒否）/ --rate-ms（既定100は暫定、閉区間[10,1000]、範囲外は main() 冒頭で検証しBLE非到達・exit 1・指定の[ERROR]1行・[adapter]行なし）/ --loop / --raw / --inject-invalid / --verbose / --adapter。既定送出は10レコード集約で100msに1フレーム（連続5フィールドとsteeringAngleは平均、accelPedalPosition/brakePressure/brakeSwitch/shiftIndication/turnSignalは区間先頭、平均後 floor(x+0.5) 量子化、端数区間は切り捨てず残り全部で集約）。単純間引きは不採用。--raw は1レコード=1Notify。--inject-invalid は実装Aのみで既定未指定、許容は short11/long13/zeros/ones の小文字完全一致で argparse choices は使わず main() 冒頭（rate-ms チェック直後、load_can_frames/D-Bus前）に検証し、未知値は exit 1・stderrに[ERROR]1行のみ・[source]/[adapter]非出力・BLE非到達。正規化しないため SHORT11・' zeros'・空文字列も不正。両方不正時は rate-ms のエラーのみ。正常起動時は [source] 直後に [inject-invalid] <kind> を1行出力し、未指定時は出力しない。適用は Notify 直前（CanCharacteristic._on_tick）で short11=payload[:11]、long13=payload+b'\\x00'、zeros=b'\\x00'*12、ones=b'\\xff'*12。encode_can_data / aggregate_can_records / load_can_frames / format_send_lines と既存オプション挙動は不変、B は凍結。Phase 2 は異常系限定（切断（自動再接続の成否は非合格条件）・不正ペイロード4kind・未知値拒否・rate境界と検証順序・smartphoneOnly入力拒否の回帰）で、自動再接続ポリシー・購読差・業務E2Eは含めない。検証は existence / interaction / business の3層＋劣化モード（診断未稼働、A使用不能、購読差未確定、ビット照合未整備、--inject-invalid未実装、実機未提供）で構成し、観測点は実機logcat・接続API成功・広告スキャン結果・exit code/stdout/stderr（data-testid非依存）。証跡は run_id・広告確認ログ・logcat・stdout/stderr・exit code・bluetoothctl show・README該当箇所、任意で btmon/HCIトレース。qa_report.json には run_id / status(pass|fail|blocked) / phase / implementation / fail_reason / evidence_paths / reproduction_steps / open_questions を含める。2026年度改修要求（前回結果表示、タブ追加、レーダーチャート、BLE安定化、録画サイズ改善）のうち BLE 安定化（パラレル処理化は仮説であり確定でない）と標識認識・先行車検知によるペイロード長/割り当て変更は未確定であり、本ノードは現行12バイト前提を維持し独断変更しない。開発完了目標は2026年11月末（12月に高齢者実験開始）。",
  "fact_candidates": [
    {
      "type": "validation_rule",
      "title": "inject-invalid未知値はBLE非到達でexit code 1",
      "statement": "--inject-invalid に short11 / long13 / zeros / ones 以外を指定したとき、エミュレータは D-Bus 接続・GATT 登録・LE 広告・Notify に到達せず exit code 1 で終了する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "inject-invalid未知値は指定のERROR1行のみ",
      "statement": "--inject-invalid 未知値では '[ERROR] --inject-invalid は short11, long13, zeros, ones のいずれかを指定してください（指定値: <指定値>）' が stderr に 1 行のみ出力され、[source] 行も [adapter] 行も出ない",
      "status": "candidate"
    },
    {
      "type": "validation_rule",
      "title": "inject-invalidの値は正規化しない",
      "statement": "--inject-invalid の値は小文字完全一致で判定し正規化しないため、SHORT11・前後空白付きの ' zeros'・空文字列はいずれも不正である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "引数検証順序はrate-ms優先",
      "statement": "--rate-ms と --inject-invalid が同時に不正な場合、出力されるのは --rate-ms のエラー 1 行のみである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "inject-invalid指定時は起動ログに1行出る",
      "statement": "--inject-invalid 指定での正常起動時は [source] 行の直後に '[inject-invalid] <kind>' が 1 行 stdout へ出力され、未指定時は当該行を出力しない",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "short11は正常符号化結果の先頭11バイト",
      "statement": "--inject-invalid short11 の送出ペイロードは正常符号化結果の先頭 11 バイトであり長さは 11 バイトである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "long13は正常符号化結果に0x00を1バイト付加",
      "statement": "--inject-invalid long13 の送出ペイロードは正常符号化結果に 0x00 を 1 バイト付加した 13 バイトである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "zerosは0x00を12バイト",
      "statement": "--inject-invalid zeros の送出ペイロードは 0x00 を 12 バイト並べたものである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "onesは0xFFを12バイト",
      "statement": "--inject-invalid ones の送出ペイロードは 0xFF を 12 バイト並べたものである",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "inject-invalidはNotify直前で適用される",
      "statement": "--inject-invalid の不正ペイロード生成は Notify 直前で適用され、符号化・集約・読み込み処理および --rate-ms / --loop / --raw / --verbose / --adapter の挙動は変更されない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "inject-invalidはargparse choicesで弾かない",
      "statement": "--inject-invalid は argparse の choices では検証せず、main() 冒頭の明示検証で拒否する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "12バイト前提はペイロード仕様変更で無効化される",
      "statement": "CAN ペイロード長・割り当てが変更された場合、12 バイト固定を前提とする受入条件および short11 / long13 の定義は再定義が必要である",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "実機未提供時はCLI単体TCを先行し実機TCはblocked",
      "statement": "テスト用実機が未提供の期間は CLI 単体で判定可能な受入項目を先行実施し、実機依存の受入項目は blocked として記録する",
      "status": "candidate"
    },
    {
      "type": "qa_expectation",
      "title": "BLE安定化の恒久対策はPhase2の合否条件にしない",
      "statement": "BLE 受信不安定に対するパラレル処理化は未確定の仮説であり、その恒久対策の成否を Phase 2 の合格条件にしない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "CAN ペイロードの長さ・割り当てが標識認識・先行車検知の追加でどう変わるかが未確定。現行は 12 バイト固定（offset 5-6 のみ u16 BE）だが 2026 年度要求で拡張の可能性がある。middleware/infra.ble.device の確定が必要。決まらないと 12 バイト前提の受入条件と short11/long13 の定義、正準モックの符号化規則がすべて影響を受ける。",
    "BLE 受信安定化（シーケンス→パラレル処理化）は仮説のままで確定対策ではない。app/middleware の実機調整判断が必要。決まらないとエミュレータ側で安定化検証の合格条件（連続 Notify 欠落率など）を定義できない。",
    "テスト用ナビ端末の提供時期が未定のため実機依存 TC（003/004/005/006/007/016/017/018/019/020/025）の実施時期が確定できない。調達・運用側の判断が必要。決まらないと Phase 2 の完了時期が読めない。",
    "Phase 1 で接続・12 バイト Notify は成功しても運転診断が回らない場合の原因切り分け（アプリ購読・middleware デコード・mode 差分・GPS 必須ゲート）は未確定。middleware/app の判断が必要。決まらないと業務 E2E の別フェーズ範囲が定義できない。",
    "canDataOnly と combination で BLE 購読・UI・診断開始条件に差があるかは独断確定禁止のまま未確定。app/middleware 確認が必要。差がある場合は mode 別テストケース分割が必須になる。",
    "切断後の自動再接続ポリシーは未確定（本ノードで確定禁止、Phase 2 にも入れない）。infra/app/middleware の方針決定が必要。決まらないと切断後の期待結果を合格条件にできない。",
    "12 バイト符号化 #14 §2 および #22 量子化のビットレイアウト詳細が本ノード facts にインラインされていない。正準ドキュメント位置の確認が必要。ペイロード内容照合（長さ以外）の自動判定ができない。",
    "「連続 5 フィールド」の具体フィールド名が approved fact に列挙されていない。残る候補は vehicleSpeed / longAcc / latAcc / frontDistance / lateralDistance だが断定できない。middleware/データ仕様の確認が必要。決まらないと集約結果の期待値を固定できない。",
    "集約時の repeat の扱い（区間先頭 / 平均 / 常に 0 / 送出しない）が未記載。モック合成は repeat=0 固定だが実行系の扱いは不明。middleware/モック生成側の確認が必要。決まらないと 12 バイト中の当該バイト期待値が決まらない。",
    "--raw 指定時に --rate-ms が送出間隔を上書きするのか、入力タイムスタンプを再現するのか未確定。実装 A の CLI 契約確認が必要。決まらないと TC-BLE-EMU-017 の間隔合格条件が書けない。",
    "Phase 1 completed の evidence（logcat・広告ログ・実行日時・run_id）が実際にどこへ保存されているかが未記載。QA 記録運用（保存先・保持期間）の確認が必要。決まらないと completed の再検証ができない。",
    "--inject-invalid short11 / long13 のように 12 バイト以外を送出した際に BlueZ / GATT 層がそのまま通すか切り詰めるかが未検証。実機・btmon での確認が必要。決まらないと TC-BLE-EMU-025 の長さ照合をどの層で判定するかが定まらない。"
  ],
  "rationale_notes": [
    "approved facts を正本として既存 MD を差分更新した。今回の主差分は --inject-invalid の未知値拒否契約（argparse choices 不使用・main() 冒頭検証・exit 1・ERROR 1 行のみ・BLE 非到達・正規化なし・rate-ms 優先）、[inject-invalid] 起動ログ、4 kind のペイロード実体と適用位置である。",
    "従来 open_question だった zeros / ones のバイトレイアウトは fact で確定したため open_question から外し、TC-BLE-EMU-025 として照合可能な合格条件に格上げした。",
    "未知値拒否は --rate-ms と同一様式であるため、失敗条件・証跡・レポート項目も rate-ms 系と同じ枠で記述し運用を単純化した。",
    "2026 年度改修要求は本ノードの前提（12 バイト固定・BLE 安定化）に影響しうるが、いずれも未確定なため仕様本文では非対象・禁止事項として封じ、open_question に分離した。",
    "テスト用ナビ端末の提供時期未定を踏まえ、実機不要 TC を先行実施できる degraded-mode D06 と status=blocked を追加した。これにより不安定・未提供状態でも検証が止まらない。",
    "アプリ不変制約のため data-testid ではなく logcat・広告スキャン・接続 API 成功・exit code/stdout/stderr を正準観測点とする方針を維持した。"
  ]
}
```