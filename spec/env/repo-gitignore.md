<!-- 作成: 2026-09-10 17:27:16 JST | 更新: 2026-09-18 17:43:17 JST -->

# リポジトリ .gitignore 方針

## 目的

開発者ローカルのツール状態・復元一時ファイル・先方から受領した仕様資料の原本を版管理対象から除外する。クローン後は各自が ProjectSmith を bind してローカル環境を再構成する。現状実装の追認ではなく、approved design_decision（方針 1-A、および受領資料原本の除外）をこのノードの正とする。

## 必須の ignore / 追跡除外

### ProjectSmith ローカル状態（.smith）

- `.gitignore` に `.smith` を追加しなければならない。
- 既に Git 追跡されている場合は `git rm --cached .smith` でインデックスから外さなければならない（作業ツリー上のディレクトリ自体は残してよい）。
- `.smith` は開発者ローカル専用であり、リポジトリで共有してはならない。
- クローンまたは追跡除外後、各開発者は `projectsmith bind --repo-id <id>` を実行してローカルの `.smith` を再構成しなければならない。
- bind 手順は README または env.build.installer 仕様に明記しなければならない。

### Claude ローカル状態

- `.gitignore` に `.claude/state/` を追加しなければならない。
- `.claude/state/` は開発者ローカル専用であり、リポジトリで共有してはならない。

### 復元前バックアップ

- 復元前に作成された `.bak` ファイル 6 件はリポジトリから削除しなければならない。
- `.gitignore` に `*.bak.[0-9]*-[0-9]*` を追加しなければならない。

### 先方から受領した仕様資料の原本（docs/design/）

- `.gitignore` の末尾に、次の 2 行を追加しなければならない。
  1. コメント行: `# 先方から受領した仕様資料の原本（内容は Smith の fact / design change に投入する）`
  2. パターン行: `/docs/design/`
- パターンは先頭スラッシュ付きの `/docs/design/` としなければならない。リポジトリ直下の `docs/design/` に限定する。
- `docs/design`（末尾スラッシュなし）や `docs/**` のように他階層・上位階層へ波及する形にしてはならない。
- `docs/` 全体、および `*.pptx` を ignore 対象にしてはならない。既に追跡済みの `docs/運転診断アプリ_詳細設計書_20250228.xlsx` を巻き込まないため。
- この変更は `.gitignore` の 1 ファイルのみに限定しなければならない。`git rm --cached` は実行してはならない（対象 2 ファイル `docs/design/20260917_確認.pptx` / `docs/design/20260917_仕様.pptx` はいずれも未追跡である）。
- 仕様としての真実源は Smith の fact / canonical_spec とし、受領資料の原本バイナリはリポジトリに置かない。

#### 確認手順（受領資料除外の検証）

- `git status --porcelain` を実行し、`docs/design/` 配下が untracked として現れないことを確認しなければならない。
- `git check-ignore -v docs/運転診断アプリ_詳細設計書_20250228.xlsx` を実行し、何も返らない（= 無視されていない）ことを確認しなければならない。

## 追跡を維持する対象

- `package-lock.json` は `.gitignore` 対象にしてはならない。
- `package-lock.json` を誤って削除または改変した場合は `git checkout` でリポジトリ上の版に戻さなければならない。
- `docs/運転診断アプリ_詳細設計書_20250228.xlsx` は追跡対象として維持しなければならない。

## 運用上の前提

- リポジトリの正本に ProjectSmith のローカル bind 状態を含めない。
- 新規クローン後にスコア計算・センサー・BLE 等のアプリ実行前提を満たすことと、`.smith` 再 bind は別手順である。
- 本ノードは実行ランタイムや環境変数の値自体は定めない。対象は版管理から除外するパスと、除外後の再構成手順の置き場所である。
- 受領資料（2026-08-04『運転機能チェックアプリの一次仕様』、2026-09-17『要求仕様確認』）のリポジトリ外での保管場所・共有方法、および内容の spec 反映（ingest_fact_candidates / submit_design_change）は本ノードの対象外である。
- 本ノードの変更はコードおよび他の spec ファイルを一切変更しない。

## 関連ノード

- env.build.installer から本ノードが参照される（referenced_by）。bind 手順の実体（コマンド列・`<id>` の与え方・実行タイミング）はセットアップ仕様側で確定し、本ノードは版管理からの除外方針と再構成が必要である事実のみを定める。
- UC12（編集とデモ再生）では、クローン直後の開発者が `.smith` を持たない状態から作業を開始する。編集・デモ再生を行う前に bind を完了していなければならない。
- 2026 年度改修（レーダーチャート・タブ追加・BLE 安定化・録画サイズ改善・サービス案表示）の仕様源は `docs/design/` 配下の原本ではなく Smith の fact 台帳である。原本を除外しても仕様参照が失われない前提に依存する。

```json
{
  "required_changes": [
    {"node": "env.repo.gitignore", "entrypoint": "spec/env/repo-gitignore.md", "description": "approved design_decision に基づき、.gitignore 末尾へコメント行 + /docs/design/ を追加する節と、git status --porcelain / git check-ignore -v による検証手順を追記する"},
    {"node": "env.repo.gitignore", "entrypoint": "spec/env/repo-gitignore.md", "description": "docs/運転診断アプリ_詳細設計書_20250228.xlsx を追跡維持対象として明記し、docs/ 全体および *.pptx の ignore を禁止する制約を追加する"}
  ],
  "suggested_impacts": [
    {"domain": "env.build.installer", "severity": "must", "reason": "projectsmith bind --repo-id <id> の手順と <id> の具体値、記載先（README か installer か）をセットアップ仕様側で確定する必要がある"},
    {"domain": "Infra-agent", "severity": "should", "reason": "クローン後に .smith と .claude/state が存在しない前提になるため、CI/ビルドがローカル状態に依存していないか確認が必要"},
    {"domain": "Infra-agent", "severity": "should", "reason": "docs/design/ 配下の受領資料原本がリポジトリ外保管となるため、資料の保管場所・共有方法を運用側で定める必要がある"}
  ],
  "requirements_context": "# リポジトリ .gitignore 方針\n\n## 目的\n\n開発者ローカルのツール状態・復元一時ファイル・先方から受領した仕様資料の原本を版管理対象から除外する。クローン後は各自が ProjectSmith を bind してローカル環境を再構成する。現状実装の追認ではなく、approved design_decision（方針 1-A、および受領資料原本の除外）をこのノードの正とする。\n\n## 必須の ignore / 追跡除外\n\n### ProjectSmith ローカル状態（.smith）\n\n- `.gitignore` に `.smith` を追加しなければならない。\n- 既に Git 追跡されている場合は `git rm --cached .smith` でインデックスから外さなければならない（作業ツリー上のディレクトリ自体は残してよい）。\n- `.smith` は開発者ローカル専用であり、リポジトリで共有してはならない。\n- クローンまたは追跡除外後、各開発者は `projectsmith bind --repo-id <id>` を実行してローカルの `.smith` を再構成しなければならない。\n- bind 手順は README または env.build.installer 仕様に明記しなければならない。\n\n### Claude ローカル状態\n\n- `.gitignore` に `.claude/state/` を追加しなければならない。\n- `.claude/state/` は開発者ローカル専用であり、リポジトリで共有してはならない。\n\n### 復元前バックアップ\n\n- 復元前に作成された `.bak` ファイル 6 件はリポジトリから削除しなければならない。\n- `.gitignore` に `*.bak.[0-9]*-[0-9]*` を追加しなければならない。\n\n### 先方から受領した仕様資料の原本（docs/design/）\n\n- `.gitignore` の末尾に、コメント行『# 先方から受領した仕様資料の原本（内容は Smith の fact / design change に投入する）』と、その次の行に `/docs/design/` を追加しなければならない。\n- パターンは先頭スラッシュ付きの `/docs/design/` とし、リポジトリ直下の `docs/design/` に限定する。`docs/design`（末尾スラッシュなし）や `docs/**` のように他階層・上位階層へ波及する形にしてはならない。\n- `docs/` 全体および `*.pptx` を ignore 対象にしてはならない（既追跡の `docs/運転診断アプリ_詳細設計書_20250228.xlsx` を巻き込まないため）。\n- 変更は `.gitignore` の 1 ファイルのみに限定し、`git rm --cached` は実行してはならない（対象 2 ファイル `docs/design/20260917_確認.pptx` / `docs/design/20260917_仕様.pptx` はいずれも未追跡）。\n- 仕様の真実源は Smith の fact / canonical_spec とし、受領資料の原本バイナリはリポジトリに置かない。\n- 検証として `git status --porcelain` で `docs/design/` 配下が untracked として現れないこと、および `git check-ignore -v docs/運転診断アプリ_詳細設計書_20250228.xlsx` が何も返さないことを確認しなければならない。\n\n## 追跡を維持する対象\n\n- `package-lock.json` は `.gitignore` 対象にしてはならない。\n- `package-lock.json` を誤って削除または改変した場合は `git checkout` でリポジトリ上の版に戻さなければならない。\n- `docs/運転診断アプリ_詳細設計書_20250228.xlsx` は追跡対象として維持しなければならない。\n\n## 運用上の前提\n\n- リポジトリの正本に ProjectSmith のローカル bind 状態を含めない。\n- 新規クローン後にスコア計算・センサー・BLE 等のアプリ実行前提を満たすことと、`.smith` 再 bind は別手順である。\n- 本ノードは実行ランタイムや環境変数の値自体は定めない。対象は版管理から除外するパスと、除外後の再構成手順の置き場所である。\n- 受領資料（2026-08-04『運転機能チェックアプリの一次仕様』、2026-09-17『要求仕様確認』）のリポジトリ外での保管場所・共有方法、および内容の spec 反映（ingest_fact_candidates / submit_design_change）は本ノードの対象外である。\n- 本ノードの変更はコードおよび他の spec ファイルを一切変更しない。\n\n## 関連ノード\n\n- env.build.installer から本ノードが参照される（referenced_by）。bind 手順の実体（コマンド列・`<id>` の与え方・実行タイミング）はセットアップ仕様側で確定し、本ノードは版管理からの除外方針と再構成が必要である事実のみを定める。\n- UC12（編集とデモ再生）では、クローン直後の開発者が `.smith` を持たない状態から作業を開始する。編集・デモ再生を行う前に bind を完了していなければならない。\n- 2026 年度改修（レーダーチャート・タブ追加・BLE 安定化・録画サイズ改善・サービス案表示）の仕様源は `docs/design/` 配下の原本ではなく Smith の fact 台帳である。\n",
  "fact_candidates": [
    {
      "type": "constraint",
      "title": ".smith を gitignore する",
      "statement": ".gitignore に .smith を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": ".smith をインデックスから外す",
      "statement": "既に追跡されている .smith は git rm --cached .smith でインデックスから外さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "各自が projectsmith bind する",
      "statement": "各開発者は projectsmith bind --repo-id <id> を実行してローカルの .smith を再構成しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": ".claude/state/ を gitignore する",
      "statement": ".gitignore に .claude/state/ を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "復元前 .bak 6 ファイルを削除する",
      "statement": "復元前に作成された .bak ファイル 6 件はリポジトリから削除しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "番号付き bak パターンを gitignore する",
      "statement": ".gitignore に *.bak.[0-9]*-[0-9]* を追加しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "package-lock.json は checkout で戻す",
      "statement": "package-lock.json は ignore せず、誤削除・改変時は git checkout でリポジトリ上の版に戻さなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "bind 手順をドキュメントに明記する",
      "statement": "projectsmith bind 手順は README または env.build.installer に明記しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "/docs/design/ を gitignore する",
      "statement": ".gitignore の末尾にコメント行と /docs/design/ を追加し、先方から受領した仕様資料の原本を追跡対象から除外しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "ignore パターンは /docs/design/ に限定する",
      "statement": "ignore パターンは先頭スラッシュ付きの /docs/design/ とし、docs/design や docs/** のように他階層・上位階層へ波及する形にしてはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "docs/ 全体と *.pptx は ignore しない",
      "statement": "既追跡の docs/運転診断アプリ_詳細設計書_20250228.xlsx を巻き込まないため、docs/ 全体および *.pptx を ignore 対象にしてはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "受領資料除外では git rm --cached を実行しない",
      "statement": "docs/design/20260917_確認.pptx と docs/design/20260917_仕様.pptx はいずれも未追跡であるため、変更は .gitignore 1 ファイルのみとし git rm --cached を実行してはならない",
      "status": "approved"
    },
    {
      "type": "qa_expectation",
      "title": "gitignore 追加後の検証コマンド",
      "statement": "追加後に git status --porcelain で docs/design/ 配下が untracked として現れないこと、および git check-ignore -v docs/運転診断アプリ_詳細設計書_20250228.xlsx が何も返さないことを確認しなければならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "仕様の真実源は Smith の fact / canonical_spec",
      "statement": "仕様の真実源は Smith の fact / canonical_spec とし、受領資料の原本バイナリはリポジトリに置いてはならない",
      "status": "approved"
    },
    {
      "type": "constraint",
      "title": "UC12 の作業前に bind が完了している必要がある",
      "statement": "クローン直後の開発者は編集とデモ再生（UC12）を行う前に projectsmith bind を完了していなければならない",
      "status": "candidate"
    }
  ],
  "open_questions": [
    "projectsmith bind の <id> 具体値が未記載である。リポジトリ識別子が環境ドキュメントに無いため未確定。env.build.installer または README 担当の判断が必要。決まらないとクローン後に bind できず .smith を再構成できない。",
    "bind 手順の記載先が README か env.build.installer か未選択である。fact が「または」のため単一の正本が無い。Env / インストーラ仕様の判断が必要。決まらないと手順が分散し、gitignore 後のセットアップ欠落が起きる。",
    "削除対象の復元前 .bak 6 ファイルのパス一覧が未記載である。入力資料にファイル名が無いため特定できない。リポジトリ現状を知る実装/Infra 側の確認が必要。決まらないと削除漏れまたは無関係ファイル削除のリスクがある。",
    "UC12（編集とデモ再生）が .smith 配下のどの状態に依存するかが未記載である。ユースケース定義側に依存データの記述が無いため判断できない。UC12 担当ドメインの確認が必要。決まらないと bind 未実施時の失敗挙動を仕様化できない。",
    "docs/design/ 配下から除外した受領資料原本（2026-08-04 一次仕様 pptx / 2026-09-17 要求仕様確認 pptx）のリポジトリ外での保管場所・共有方法が未確定である。design_decision が本変更の対象外と明記しているため。運用/Infra 側の判断が必要。決まらないと原本の所在が属人化し、fact の出所追跡ができなくなる。",
    "docs/design/ 以外にも受領資料が追加される場合の置き場所ルール（docs/design/ に集約するのか、別ディレクトリを設けるのか）が未確定である。今回のパターンが /docs/design/ 限定であるため他パスは無視されない。Env / 運用側の判断が必要。決まらないと将来受領した pptx が誤ってコミットされる。"
  ],
  "rationale_notes": [
    "方針 1-A はローカルツール状態を共有せず、クローン後に各自 bind する運用を選んだものである。",
    "package-lock.json を checkout で戻すのは、依存ロックファイルをリポジトリの正本として維持するためである。",
    "/docs/design/ を先頭スラッシュ付き・末尾スラッシュ付きで限定したのは、既追跡の docs/運転診断アプリ_詳細設計書_20250228.xlsx を巻き込まないためである。docs/ 全体や *.pptx を対象にすると既存追跡ファイルへ波及する。",
    "git rm --cached を実行しないのは、対象 2 ファイルがいずれも未追跡でインデックスに存在しないためである。",
    "受領資料原本をリポジトリに置かない代わりに、内容は fact / design change として Smith 側へ投入する前提であり、仕様参照性は fact 台帳が担保する。",
    "本ノードは gitignore とローカル再構成に限定し、10ms 周期・センサーゲート・BLE rate など他ノードの実行仕様は扱わない。",
    "既存ファクトの B案（GPS投入）は node=env.repo.gitignore と無関係のため本仕様には反映しない。",
    "env.build.installer からの referenced_by を明示することで、bind 手順の実体をインストーラ仕様側に一本化する方向を示している（記載先の最終決定は open_question）。"
  ]
}
```