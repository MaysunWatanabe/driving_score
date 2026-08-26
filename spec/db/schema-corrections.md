<!-- 作成: 2026-08-07 17:32:24 JST -->

```json
{
  "required_changes": [
    {
      "node": "db.schema.corrections",
      "entrypoint": "spec/db/schema-corrections.md",
      "description": "approved facts に整合するよう §5 CREATE TABLE REAL 是正（users.height / スコア系）とシード方針の最小限スコープで schema-corrections 仕様 MD を生成・更新する"
    }
  ],
  "suggested_impacts": [
    {
      "domain": "Middleware-agent",
      "severity": "could",
      "reason": "デモ/実機切替の正準閾値は DemoData.getSensorLogDataSize()>0 であり DB シード追加は行わないため、Middleware 側実装・コメントとの一致確認のみ"
    },
    {
      "domain": "QA-agent",
      "severity": "should",
      "reason": "REAL 是正後の型・制約と、User.dummy()／DemoData／手動 INSERT に依存するシード手順の検証観点が必要"
    }
  ],
  "requirements_context": "db.schema.corrections はスキーマ是正を最小限に留める。実施対象は §5 で定められた CREATE TABLE の REAL 是正のみ（users.height、および score・score_history・capability_score のスコア系カラム）。シードは既存 User.dummy() と DemoData（センサログ）に依存し、必要なら一時的な手動 INSERT 手順で足りるものとする。settings へのシード UI、in-memory DbService、webm のコミットは追加しない。DB シード拡充・infra.assets.geolocation 復活は本ノードの対象外。モックセンサログの正準レコード・生成スクリプト・DemoData 件数閾値 0 は別 decision で確定済みだが、本ノードでは DB 永続スキーマ是正に触れない範囲として扱う。",
  "fact_candidates": [
    {
      "type": "data_semantics",
      "title": "users.height は REAL として永続化する",
      "statement": "users テーブルの height は CREATE TABLE 上 REAL 型として定義・是正される",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "スコア系カラムは REAL として永続化する",
      "statement": "score・score_history・capability_score に関するスコア系カラムは CREATE TABLE 上 REAL 型として定義・是正される",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "スキーマ是正スコープは §5 の REAL 是正に限定",
      "statement": "db.schema.corrections で必須実施するスキーマ変更は §5 の CREATE TABLE REAL 是正（users.height および score・score_history・capability_score のスコア系）に限定する",
      "status": "candidate"
    },
    {
      "type": "business_rule",
      "title": "シードは既存 User.dummy と DemoData に依存",
      "statement": "データシードは既存の User.dummy() と DemoData（センサログ）に依存し、不足分は一時的な手動 INSERT 手順で補う。settings へのシード UI は追加しない",
      "status": "candidate"
    },
    {
      "type": "constraint",
      "title": "in-memory DbService と webm コミットは追加しない",
      "statement": "本是正において in-memory DbService の追加、および webm のコミットは行わない",
      "status": "candidate"
    },
    {
      "type": "data_semantics",
      "title": "DB シード拡充は本是正の対象外",
      "statement": "モックセンサログや DemoData 件数に関する決定があっても、DB シードの拡充・新規シード経路の追加は db.schema.corrections では実施しない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "§5 本文に列挙される REAL 是正対象カラムの完全な一覧（score / score_history / capability_score 配下の具体的カラム名とテーブル名）が本入力に無い場合、既存 spec 他節または Canonical SpecGraph 上の §5 定義との突合が必要（DB）。決まらないと CREATE TABLE 是正の適用範囲が曖昧になる。",
    "users.height およびスコア系 REAL 化に伴う既存格納値のマイグレーション要否（型変更のみか、データ変換が必要か）は実装・QA と要確認。決まらないと Migration 手順と互換性検証が確定しない。"
  ],
  "rationale_notes": [
    "設計方針は「最小限」：スキーマの型是正のみを仕様どおり行い、デモデータ供給・UI・資産コミットなど周辺の拡張は明示的に非対象とする。",
    "シードを User.dummy() と DemoData に寄せることで、settings シード UI や in-memory DbService といった代替経路の仕様肥大を避ける。",
    "モックセンサログ生成・DemoData.getSensorLogDataSize()>0 閾値は approved design_decision だが永続スキーマ是正とは分離し、本 MD では非対象・依存関係の注記に留める。"
  ]
}
```

```markdown
# DB Schema Corrections

## 1. 目的

本仕様は、永続化スキーマ（CREATE TABLE）における型・定義の是正を **最小限** の範囲で確定する。  
対象は §5 で定められた **REAL 是正** に限定し、シード経路・デモ資産・UI・代替 DbService の追加は行わない。

## 2. スコープ

### 2.1 実施する

- `CREATE TABLE` 定義の **REAL 是正**（仕様 §5 どおり）
  - `users.height`
  - スコア系: `score` / `score_history` / `capability_score` に関するスコアカラム
- 是正後スキーマと、既存のシード手段（下記）との整合

### 2.2 実施しない（明示的非対象）

- settings へのシード UI 追加
- in-memory `DbService` の追加
- webm のコミット
- DB シードの拡充（新規シード経路・一括シード仕様の追加）
- `infra.assets.geolocation` の復活
- モックセンサログ生成スクリプト・`src/data/mock/*.txt.gz` 自体の変更（別 decision で確定済み。本ノードのスキーマ是正とは分離）

## 3. データ意味論（永続化）

| 対象 | 永続化上の意味 | 型是正 |
|------|----------------|--------|
| `users.height` | ユーザの身長として保存される値 | **REAL** |
| `score` 系スコア値 | スコアとして保存される数値 | **REAL** |
| `score_history` 系スコア値 | スコア履歴として保存される数値 | **REAL** |
| `capability_score` 系スコア値 | 能力スコアとして保存される数値 | **REAL** |

- 本是正は「何をどの型で事実として持つか」の修正であり、UI 表示形式や API レスポンス形状は扱わない。
- 集計の再計算方針・履歴の保持期間など、§5 に含まれない意味論の拡張は本仕様の範囲外とする。

## 4. 是正方針

1. **最小変更**: §5 の REAL 是正に必要な DDL / マイグレーション記述のみを更新する。  
2. **互換**: 既存コードが依拠するテーブル名・カラム名を不用意に変更しない（型の是正に留める）。  
3. **シード非拡張**: 是正のためにシード基盤を新設しない。

## 5. CREATE TABLE REAL 是正（実施対象）

§5 に従い、少なくとも次を REAL として定義する。

- `users.height` → **REAL**
- `score` / `score_history` / `capability_score` の **スコア系カラム** → **REAL**

> 具体的なカラム完全一覧は §5 の正準定義に従う。本ノードはそれを実装・仕様 MD 上で一貫させることが責務である。

### 5.1 マイグレーション

- 型是正が既存 DB ファイルに影響する場合は、プロジェクトの既存マイグレーション方針に沿って適用する。
- データ変換（値のスケール変更等）が §5 で要求されていない限り、**型の適合** を優先し、意味の再解釈は行わない。
- 変換要否が未確定の場合は実装前に確認する（open question）。

## 6. シード方針

是正後の検証・デモに必要なデータ供給は次に **依存** する。

| 手段 | 用途 | 本是正での扱い |
|------|------|----------------|
| `User.dummy()` | ユーザ等の既存ダミー | **利用する（追加実装しない）** |
| `DemoData`（センサログ） | センサログデモデータ | **利用する（DB シード化しない）** |
| 一時的な手動 INSERT | 不足分の補完 | **必要なら手順として頼る（UI 化しない）** |

禁止・非追加:

- settings 画面等へのシード UI
- in-memory `DbService`
- webm コミットを前提にしたシード

## 7. 他コンポーネントとの境界

- **DemoData 件数閾値**: デモ/実機切替の正準閾値は `DemoData.getSensorLogDataSize()>0`（`>0` デモ、`<=0` 実センサー）。これは Middleware / DemoData 側の契約であり、**DB スキーマ是正では変更しない**。
- **センサログの投入経路**: 現行どおり UI 側 FileReader Base64 → `pushSensorLogFile` 等に任せ、DB シードとしては扱わない。
- **モックセンサログ正準スキーマ**（JSON Lines、シナリオ、`canData` 省略規則、`repeat=0` 固定等）は別途確定済みの design decision に従う。本ノードはそれを DB テーブル定義へ持ち込まない。

## 8. 制約サマリ

- スキーマ必須変更は **§5 REAL 是正のみ**。
- シードは **User.dummy() + DemoData + 必要時手動 INSERT** に限定。
- **settings シード UI / in-memory DbService / webm コミット / DB シード拡充** は行わない。

## 9. 検証観点（DB 観点）

- 是正後の `CREATE TABLE` で `users.height` およびスコア系が REAL であること。
- 既存の `User.dummy()` が是正後スキーマで破綻しないこと。
- 手動 INSERT 手順を用いる場合、REAL カラムへ数値として投入できること。
- 本是正がデモセンサログ経路や DemoData 閾値の挙動を変えていないこと（非回帰）。
```