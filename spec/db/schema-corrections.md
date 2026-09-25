<!-- 作成: 2026-09-10 17:34:30 JST | 更新: 2026-09-18 18:48:19 JST -->

# DB スキーマ是正仕様（db.schema.corrections）

- ノード: `db.schema.corrections`
- エントリポイント: `spec/db/schema-corrections.md`
- 関連ユースケース: UC03（アカウント作成 / `users.height` の保存）、UC06（運転診断の実行 / スコア値の保存）、UC09（過去の診断結果閲覧 / `score_history`・`capability_score` の読み出し）

---

## 1. 目的とスコープ

本ノードは、永続化スキーマ（`CREATE TABLE` 定義）の**是正を最小限に限定**して定義する。

### 1.1 実施すること（必須）

- §5 に定める **`CREATE TABLE` の REAL 是正**
  - 対象: `users.height`
  - 対象: `score` / `score_history` / `capability_score` のスコア系カラム
- 上記是正に伴う **マイグレーション手順**（既存端末の DB 再作成有無）の明示

### 1.2 実施しないこと（明示的な非対象）

| 非対象項目 | 理由 |
| --- | --- |
| テーブル名・カラム名の変更 | 既存コードが依拠するため、型宣言の是正に留める |
| 既存値のスケール変換・丸め処理 | §5 が要求していない |
| `settings` へのシード投入 UI の追加 | シードは既存経路に依存する方針 |
| in-memory `DbService` の追加 | 仕様肥大の回避 |
| `webm` のリポジトリコミット | 資産管理は本ノードの責務外 |
| DB シードの拡充・新規シード経路の追加 | モックセンサログ／DemoData 件数の決定があっても本ノードでは行わない |
| GPS 用テーブル／カラムの追加、GPS の DB シード化 | B 案 GPS 追加投入は承認済みだが、投入経路側の責務 |
| `infra.assets.geolocation` の復活 | 同上 |
| 2026 年度改修要求に伴うスキーマ拡張 | 後述 §6 のとおり未確定のため本是正に含めない |

---

## 2. データ意味論

### 2.1 `users.height`

- ユーザの身長として保存される値であり、**小数を含み得る**。
- `CREATE TABLE` 上 `REAL` 型として定義・是正する。

### 2.2 スコア系カラム（`score` / `score_history` / `capability_score`）

- スコアまたはスコア履歴として保存される値であり、**小数を含み得る**。
- `CREATE TABLE` 上 `REAL` 型として定義・是正する。
- 現行の `capability_score` は `scoreA` / `scoreB` / `scoreC` の 3 列構成で、値域は 0〜100 の `REAL` である。**本是正ではこの列構成・値域を変更しない。**

### 2.3 是正前後の意味の同一性

SQLite の型親和性（type affinity）により、`REAL` 宣言の前後で保存される数値の意味（身長・スコア値）は変わらない。本是正は **小数値の保持精度に関する宣言の明確化** であり、データの意味論的変更ではない。

---

## 3. 是正の適用単位

SQLite では **既存列の型宣言を `ALTER TABLE ... ALTER COLUMN` で変更できない**。

したがって、REAL 是正が実際に適用されるのは **`CREATE TABLE` が実行されるタイミング（＝新規 DB 作成時）** に限られる。既存 DB を保持したままでは、宣言型は旧定義のまま残る。

---

## 4. マイグレーション手順

### 4.1 方針（既定）

開発段階であり、シードが `User.dummy()` / `DemoData` / 一時的な手動 `INSERT` に依存している現状を踏まえ、**既存端末では DB を再作成する**ことを既定とする。

- 手順: **アプリのデータ削除、または再インストール** により DB ファイルを破棄し、次回起動時に是正後の `CREATE TABLE` で再生成する。
- **既存レコードの移送は行わない。**
- 既存のユーザ・スコア・履歴レコードは **保全対象外** とする。DB 再作成後は `User.dummy()` / `DemoData` / 手動 `INSERT`、および診断の再実行によって再生成する。

> 本方針は assumption（仮定）である。配布済み端末の診断履歴を残す要求が確認された場合は §4.2 の代替案へ切り替える。

### 4.2 代替案（既存データを保全する場合）

既存レコードの保全が必要と判断された場合は、DB バージョンを上げてテーブルを再作成する。

1. DB バージョン定数をインクリメントする
2. 旧テーブルをリネームして退避する（例: `users` → `users_old`）
3. 是正後の定義で新テーブルを `CREATE TABLE` する
4. 旧テーブルから新テーブルへデータを移送する（`INSERT INTO ... SELECT ...`、値変換は行わない）
5. 旧テーブルを `DROP` する

> 本代替案の採否には、現行実装に `onUpgrade` 相当のバージョン分岐機構が存在するかの確認が必要（§7 参照）。

### 4.3 マイグレーション後の確認観点

- クリーンインストール（新規 DB 作成）ケースで、`users.height` およびスコア系カラムの読み書きが正常であること
- §4.2 を採る場合、移送後のスコア履歴が UC09 で参照できること
- `User.dummy()` / `DemoData` 経路、および手動 `INSERT` で投入したデータが是正後スキーマに整合すること

---

## 5. シード方針

- シードは **既存の `User.dummy()`（ユーザ）と `DemoData`（センサログ）に依存**する。
- 不足分は **一時的な手動 `INSERT` 手順**で補う。
- 新たなシード UI・シード経路は追加しない（§1.2 参照）。

---

## 6. 境界注記（他ノード確定事項との関係）

以下は他ノードで確定または進行中の事項であり、**本ノードの永続スキーマ是正を拡張しない**。

### 6.1 センサ・BLE 関連

- `DemoData.getSensorLogDataSize() > 0` によるデモ／実機切替
- センサログの UI FileReader Base64 → `pushSensorLogFile` 投入
- モード別センサーゲート、10ms 周期 / `runScoreLogic`
- スコア区間集約・量子化、BLE `--rate-ms` 既定 100
- BLE notify ペイロード 12 バイト固定長（`PAYLOAD_LEN=12`）

上記はいずれも実装追認または別責務であり、DDL へ展開しない。

### 6.2 B 案 GPS 追加投入

実機 GPS 受信と競合しない場合の GPS 追加投入は承認済みだが、**GPS 用テーブル／カラムの追加および GPS の DB シード化は本ノードでは実施しない**。GPS は投入経路（Middleware／センサ経路側）の責務とする。

### 6.3 2026 年度改修要求との関係

2026 年度改修要求（日産自動車受領資料、5 本の要求）のうち、以下はデータ構造への影響が想定されるが、**いずれも未確定のため本是正には含めない**。

| 要求 | データ構造への想定影響 | 本是正での扱い |
| --- | --- | --- |
| ③ レーダーチャート表示（6 項目・1〜5 の 5 段階） | 現行 `capability_score` は 3 列・0〜100 `REAL` で、列数も尺度も新仕様と一致しない | 対象外（§7 の open_question） |
| ① 診断開始前画面の前回結果表示（「前回」＝履歴平均） | 集計期間の定義、および集計値を保存するか都度再計算するかが未定 | 対象外（§7 の open_question） |
| ⑤ ヒヤリ録画データサイズ改善（前後 15 秒の個別動画化） | 動画の粒度変更に伴う参照関係・保持件数の再定義が必要になり得る | 対象外 |
| CAN データの確認用保存 | 保存要否そのものが先方の宿題として未確定 | 対象外 |

本是正はあくまで **型宣言の是正**であり、上記の構造変更は別ノード／別フェーズで扱う。なお開発スケジュールは 2026 年 11 月末完了・12 月実験開始であるため、上記の未確定事項の確定は早期に必要となる。

---

## 7. 未解決事項

1. §5 に列挙される REAL 是正対象カラムの完全一覧（`score` / `score_history` / `capability_score` 配下の具体的なテーブル名・カラム名）が本ノード資料に含まれていない。既存 `CREATE TABLE` および SpecGraph 上の §5 と突合する必要がある。
2. 既存端末のマイグレーション方式（§4.1 の DB 再作成か §4.2 のデータ移送か）が未確定。既存レコードの保全要否が未合意のため。
3. DB バージョン管理機構（`onUpgrade` 相当の分岐、version 定数）の現行実装有無が未確認。
4. REAL 是正が UI / Middleware 側の小数表示・丸めに影響するか（従来 INTEGER 前提で整数化していた箇所の有無）が未確定。
5. B 案 GPS 追加投入が永続テーブルへの保存を含むかが未確定。
6. 能力指標（6 項目・1〜5 段階）の保持構造を、現行 3 列の拡張とするか新テーブル新設とするか、尺度の対応づけをどうするかが未確定。
7. 履歴平均の集計期間が現行 `scoreLogic.json` の `capability_score_target_days`（既定 30 日）を流用するか、別定義を置くかが未確定。集計値を保存するか都度再計算するかも併せて未確定。

---

```json
{
  "required_changes": [
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "approved の最小是正方針（§5 の CREATE TABLE REAL 是正のみ）を維持したまま、マイグレーション手順節（既定=DB再作成 / 代替=バージョン更新による移送）を明記する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "REAL 是正対象を users.height と score / score_history / capability_score のスコア系カラムに限定し、テーブル名・カラム名は不変であることを再掲する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "SQLite では列の型宣言を ALTER で変更できないため、是正の適用単位は CREATE TABLE 実行時（新規DB作成時）である旨を注記する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "シード方針を既存 User.dummy() と DemoData（センサログ）＋必要時の一時的な手動 INSERT に限定し、settings シード UI・in-memory DbService・webm コミット・DBシード拡充は非対象と明記する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "B案GPS追加投入・infra.assets.geolocation 復活は本ノードのスキーマ／シード非対象である境界注記を維持する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "2026年度改修要求（レーダーチャート6項目5段階、前回=履歴平均、ヒヤリ動画個別化、CANデータ保存）によるスキーマ影響は未確定のため本是正の対象外である旨を境界注記として追加する"},
    {"node": "db.schema.corrections", "entrypoint": "spec/db/schema-corrections.md", "description": "現行 capability_score が scoreA/scoreB/scoreC の3列・0〜100 REAL であり、本是正では列構成・値域を変更しないことを明記する"}
  ],
  "suggested_impacts": [
    {"domain": "QA-agent", "severity": "must", "reason": "既存端末の DB 再作成有無によって検証手順が変わるため、クリーンインストール／既存データ保持の両ケースで REAL 是正後の読み書きとスコア表示の非回帰確認が必要"},
    {"domain": "QA-agent", "severity": "should", "reason": "User.dummy() と DemoData 経路、および手動 INSERT で投入したデータが是正後スキーマに整合することの確認が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "スコア値・身長を小数として永続化・読み出しする前提が Middleware 側の型解釈（整数丸めの有無）と一致するか確認が必要"},
    {"domain": "Middleware-agent", "severity": "should", "reason": "能力指標が6項目・1〜5段階へ変わる場合、現行 capability_score（3列・0〜100 REAL）の読み書き・換算責務の所在を確定する必要がある"},
    {"domain": "UI-agent", "severity": "should", "reason": "1-2 の『前回』が履歴平均であり記録が無ければ未描画という要求に対し、平均値を保存するか都度再計算するかで参照インタフェースが変わる"},
    {"domain": "Middleware-agent", "severity": "could", "reason": "B案GPS追加投入は本是正の非対象であり、投入経路は Middleware／センサ経路側責務であることの相互確認"}
  ],
  "requirements_context": "db.schema.corrections は永続化スキーマ（CREATE TABLE）の是正を最小限に限定する。必須実施は §5 の REAL 是正のみで、対象は users.height、および score / score_history / capability_score のスコア系カラムである。テーブル名・カラム名は変更せず、型宣言の是正に留める。データ変換（スケール変更等）は §5 が要求しない限り行わない。マイグレーション手順を仕様本文に明記する。SQLite では列の型宣言を ALTER で変更できないため、是正が有効になるのは CREATE TABLE が実行される新規 DB 作成時であり、既存端末の DB については (a) アプリのデータ削除／再インストールによる DB 再作成、(b) DB バージョンを上げてテーブル再作成（旧テーブル退避→新定義で作成→データ移送→旧削除）のいずれかを採る。開発段階かつシードが User.dummy()/DemoData/手動 INSERT に依存する現状からは (a) を既定とするが、確定は実装・QA 判断を要する。SQLite の型親和性により REAL 宣言前でも数値は保持されるため、既存データが失われても診断の再実行で再生成可能である点を前提とする。シードは既存 User.dummy() と DemoData（センサログ）に依存し、不足分は一時的な手動 INSERT 手順で補う。settings へのシード UI、in-memory DbService、webm のリポジトリコミット、DB シード拡充、infra.assets.geolocation 復活、モックセンサログ生成物の変更は実施しない。B案のGPS追加投入（実機GPS受信と競合しない場合に投入可）は承認済みだが、GPS 用テーブル／カラム追加および GPS の DB シード化は本ノードでは実施しない。2026年度改修要求（日産自動車受領の2資料に基づく5本の要求：①診断開始前画面の前回結果表示 ②タブ切り替え追加 ③採点スコアのレーダーチャート表示 ④BLE通信安定化 ⑤ヒヤリ録画データサイズ改善）のうち、③は能力指標を6項目・1〜5の5段階で保持する必要を生じ、現行 capability_score（scoreA/scoreB/scoreC の3列、0〜100 REAL）と列数・尺度が一致しないが、保持構造が未確定のため本是正の対象外とする。①の『前回』は直近1件ではなく過去の履歴の平均であり、記録が無ければ未描画とするが、集計期間（現行 scoreLogic.json の capability_score_target_days 既定30日の流用可否）および集計値を保存するか都度再計算するかが未確定のため対象外とする。⑤のヒヤリ動画個別化（前後15秒、30秒以内の連続ヒヤリは1本継続でも個別生成でも可）、CANデータの確認用保存可否も未確定のため対象外とする。開発は2026年11月末完了・12月実験開始が目標であり、これら未確定事項の早期確定が必要。DemoData.getSensorLogDataSize()>0 によるデモ/実機切替、センサログの UI FileReader Base64 → pushSensorLogFile 投入、モード別センサーゲート、10ms/runScoreLogic、スコア区間集約・量子化、BLE --rate-ms 既定 100、BLE notify ペイロード12バイト固定長は他ノードの確定事項であり、本ノードの永続スキーマ是正を拡張しない。UI 表示形式・API 形状・集計再計算方針・履歴保持期間など §5 外の意味論拡張は範囲外。関連ユースケースは UC03（アカウント作成：users.height の保存）、UC06（運転診断の実行：スコア値の保存）、UC09（過去の診断結果閲覧：score_history / capability_score の読み出し）である。",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": "スキーマ是正スコープは §5 の REAL 是正に限定",
      "statement": "db.schema.corrections で必須実施するスキーマ変更は、§5 の CREATE TABLE REAL 是正（users.height および score・score_history・capability_score のスコア系）に限定する",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "users.height は REAL として永続化する",
      "statement": "users テーブルの height は、ユーザの身長として保存される小数を含み得る値であり、CREATE TABLE 上 REAL 型として定義・是正する",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "スコア系カラムは REAL として永続化する",
      "statement": "score・score_history・capability_score に関するスコア系カラムは、スコアまたはスコア履歴として保存される小数を含み得る数値であり、CREATE TABLE 上 REAL 型として定義・是正する",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "是正は型のみで識別子は変えない",
      "statement": "本是正では既存コードが依拠するテーブル名・カラム名を変更せず、型宣言の是正に留める",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "データ変換は行わない",
      "statement": "REAL 是正に伴う既存値のスケール変換や丸め処理は §5 が要求しない限り実施せず、型宣言の適合のみを目的とする",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "型宣言是正は CREATE TABLE 実行時に有効となる",
      "statement": "SQLite では既存列の型宣言を ALTER で変更できないため、REAL 是正が適用されるのは CREATE TABLE が実行される新規 DB 作成時である",
      "status": "candidate"
    },
    {
      "type": "assumption",
      "title": "既存端末は DB 再作成で対応する",
      "statement": "既存端末に対するマイグレーションは、アプリのデータ削除または再インストールにより DB を再作成する手順を既定とし、既存レコードの移送は行わない",
      "status": "assumption"
    },
    {
      "type": "assumption",
      "title": "既存データは保全対象外",
      "statement": "開発段階のためユーザ・スコア・履歴の既存レコードは保全対象とせず、DB 再作成後は User.dummy()／DemoData／手動 INSERT および診断の再実行で再生成する",
      "status": "assumption"
    },
    {
      "type": "data_semantics",
      "title": "REAL 是正前後で数値の意味は変わらない",
      "statement": "SQLite の型親和性により REAL 宣言前後で保存される数値の意味（身長・スコア値）は変わらず、是正は小数値の保持精度に関する宣言の明確化である",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "現行 capability_score は 3 列・0〜100 REAL である",
      "statement": "capability_score テーブルは scoreA / scoreB / scoreC の 3 列で構成され、各値は 0〜100 の REAL であり、本是正では列構成・値域を変更しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "6 項目 5 段階の能力指標保持は本是正の対象外",
      "statement": "レーダーチャート要求に伴う 6 項目・1〜5 段階の能力指標保持構造は未確定であり、db.schema.corrections では列追加・新テーブル追加・尺度変換のいずれも実施しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "履歴平均の保持方式決定は本是正の対象外",
      "statement": "1-2 の『前回』が履歴平均であることに伴う集計値の保存／都度再計算の決定は未確定であり、db.schema.corrections ではスキーマを追加しない",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "シードは既存 User.dummy と DemoData に依存",
      "statement": "データシードは既存の User.dummy() と DemoData（センサログ）に依存し、不足分は一時的な手動 INSERT 手順で補う。settings へのシード UI は追加しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "in-memory DbService と webm コミットは追加しない",
      "statement": "本是正において in-memory DbService の追加、および webm のリポジトリコミットは行わない",
      "status": "approved"
    },
    {
      "type": "data_semantics",
      "title": "DB シード拡充は本是正の対象外",
      "statement": "モックセンサログや DemoData 件数に関する決定があっても、DB シードの拡充・新規シード経路の追加は db.schema.corrections では実施しない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "GPS用スキーマとDBシードは本是正で追加しない",
      "statement": "実機GPS受信と競合しない場合のGPS追加投入（B案）は承認されているが、db.schema.corrections ではGPS用テーブル・カラムの追加、infra.assets.geolocation の復活、およびGPSデータのDBシード化を実施しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "マイグレーション手順を仕様本文に明記する",
      "statement": "spec/db/schema-corrections.md は、REAL 是正に伴う既存端末の DB 再作成有無を含むマイグレーション手順を明記しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "CANデータの確認用保存は未確定のため対象外",
      "statement": "CANデータを確認用に保存するか否かは先方の宿題として未確定であり、db.schema.corrections では保存先スキーマを定義しない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "§5 に列挙される REAL 是正対象カラムの完全一覧（score / score_history / capability_score 配下の具体的テーブル名とカラム名）が本入力に無い。未確定な理由は正準 §5 のカラム単位定義が本ノード資料に含まれていないため。DB ドメインで既存 CREATE TABLE / SpecGraph 上の §5 と突合する必要がある。決まらないと是正適用範囲と検証対象が曖昧になる。",
    "既存端末のマイグレーション方式が「DB 再作成（データ削除／再インストール）」か「DB バージョン更新によるテーブル再作成＋データ移送」かは未確定。未確定な理由は既存レコードの保全要否（配布端末に残る診断履歴の価値）が合意されていないため。DB と QA、および配布運用の判断が必要。決まらないと UC09 の過去診断結果が是正後に参照できるかが確定しない。",
    "DB バージョン管理（onUpgrade 相当の分岐や version 定数の存在）が現行実装にあるかが未確定。未確定な理由は本入力に既存マイグレーション機構の記述が無いため。実装（Middleware/DbService）側の確認が必要。決まらないと再作成方式の実現手段が書けない。",
    "REAL 是正が UI/Middleware 側の小数表示・丸めに影響するか（従来 INTEGER 前提で整数化していた箇所があるか）は未確定。Middleware/UI ドメインの確認が必要。決まらないと表示値の非回帰判定基準が定まらない。",
    "B案GPS追加投入が永続テーブルへの保存を含むかは未確定。未確定な理由は承認事実が投入可否（実機競合がなければ可）のみで保存先・保持期間を述べていないため。Middleware と DB の突合が必要。決まらないと GPS カラム追加やシード拡充を本是正へ誤って持ち込むリスクがある。",
    "能力指標の保持構造が未確定。現行 capability_score は scoreA/scoreB/scoreC の 3 列・0〜100 REAL だが、新仕様は筋力・柔軟性・空間把握・危険予測・視力・視野の 6 項目・1〜5 の 5 段階であり列数も尺度も一致しない。3 列を拡張するか新テーブルを設けるか、既存値との尺度対応をどう定義するかについて、先方の採点データ形式確定（試作中に提示予定）と Middleware 判断が必要。決まらないと UC09 の履歴読み出しとレーダーチャート描画のデータ源が確定しない。",
    "履歴平均（1-2 の『前回』）を集計値として保存するか都度再計算するかが未確定。集計期間が現行 scoreLogic.json の capability_score_target_days（既定 30 日）を流用するのか別定義かも未定。UI と Middleware の判断が必要。決まらないと平均保持用スキーマの要否が確定しない。",
    "CAN データを確認用に保存するかが未確定（先方の宿題として明記）。保存する場合はペイロード長・割り当ての変更可能性（現行 12 バイト固定）が保存形式に影響する。決まらないと保存スキーマの要否・構造が定義できない。",
    "ヒヤリ動画をヒヤリ前後 15 秒の個別動画とする場合、動画レコードの粒度・診断との参照関係・保持件数上限が未確定。30 秒以内の連続ヒヤリは 1 本継続でも個別生成でも可とされているため、実装方式決定後にデータ構造への影響を再評価する必要がある。"
  ],
  "rationale_notes": [
    "設計方針は最小限：スキーマの型是正のみを仕様どおり行い、デモデータ供給・UI・資産コミットなど周辺の拡張は明示的に非対象とする。",
    "SQLite は列の型宣言を後から変更できず、型親和性により宣言と無関係に数値を保持するため、REAL 是正の実質的効果は新規 DB 作成時の定義明確化と小数精度の保証に限られる。したがってマイグレーションは「再作成するか否か」の判断が本質となる。",
    "開発段階でシードが User.dummy()／DemoData／手動 INSERT に依存している現状では、既存レコードの保全価値が低く、データ削除による DB 再作成が最も低コストかつ副作用が小さい既定候補となる。ただし配布済み端末の履歴を残す要求があれば方式を再検討する。",
    "シードを User.dummy() と DemoData に寄せることで、settings シード UI や in-memory DbService といった代替経路の仕様肥大を避ける。",
    "B案GPS投入は承認済みだが本ノードの approved 最小是正方針が優先される。GPS は投入経路の話として境界注記に留め、DDL/シードへ展開しない。",
    "2026 年度改修要求はデータ構造への影響が大きいが、採点データ形式が先方で検討中（試作中に提示）であり、現時点で列追加や新テーブルを先行定義すると手戻りコストが高い。本 MD では境界注記と open_question に留め、確定後に別ノード／別フェーズで扱う。",
    "スケジュール（2026 年 11 月末完了、12 月実験開始）を踏まえると、能力指標の保持構造と履歴平均の保持方式は早期確定が必要であり、本是正の完了を待たずに並行して確認を進めるべきである。",
    "他ノードの確定事項（10ms、DemoData 閾値 0、モード別ゲート、区間集約・量子化、BLE 既定 100、ペイロード 12 バイト）は実装追認または別責務であり、本 MD では境界注記に留め DDL へ展開しない。",
    "UC03/UC06/UC09 は本是正の影響確認観点として参照するのみで、各ユースケースの画面遷移や API 形状は本ノードの記述対象外とする。"
  ]
}
```