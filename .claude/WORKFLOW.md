# ProjectSmith 対話ワークフロー — 初期実装後の使い方

このドキュメントは、初期実装 (gen-1 確立 + initial_files 配布完了) **以降** に、
ユーザが Claude Code (tmux 常駐) と会話しながら仕様変更や機能追加を回すときの
標準フローを説明します。

新規プロジェクト作成や初回 spec 生成については `IMPLEMENTATION_PLAN.md` を参照してください。

---

## 開発フロー (基本) — Web と CLI の役割分担

ProjectSmith の標準的な開発サイクル。Phase A (初版) は Web 主体、それ以降は CLI 主体になる。

### Phase A: 初版作成 / 大規模仕様変更 (Web 主体)

```
1. Web: Repository 作成
   - Repository row + GitHub repo + initial_files commit
2. Web: SpecSession 作成
   - ブランチ smith/gen-{session_id}   (※ session_id 基準。generation_number ではない)
3. Web: チャット (Orchestrator/Auditor) で仕様作成
4. Web: 「create PR」で
   spec_documents_session / canonical_spec_session / use_cases_session を
   smith/gen-{session_id} ブランチに commit + PR 作成
5. PR を main にマージ
6. マージ直後に _snapshot_to_generation()
   - session 配下テーブル → generation 配下テーブル
   - Generation row 作成 (generation_number = max + 1)
   - session.status = 'completed'
```

→ **使う UI**: SpecSession ページ (チャット + spec preview)

### Phase B: 初回実装 (Claude tmux + CLI)

```
7. tmux Claude: git pull (main)
8. /build-mode で実装
   - ブランチ impl/gen-{generation_number}
9. PR 作成 → main マージ
10. impl_complete API で Generation.impl_branch_name / impl_merged_at 記録
```

→ **使う UI**: Session Dashboard (進捗・OQ 監視) + tmux Claude (実装)

### Phase C: ドリフト (CLI 主体、日常作業の主戦場)

```
11. tmux Claude: 動作確認 → 仕様詰め直し
12. /ask-mode → ask_repository
13. /propose-mode → propose_decision (fact_session に approved 蓄積)
14. /build-mode → 実装
    - ブランチ drift-YYYYMMDD-<slug>      (※ spec_session 不要 で動く)
15. PR 作成 → main マージ (commit-msg hook で proposal/fact ID 強制)
```

→ **使う UI**: Session Dashboard (Proposals 裁定 + 進捗) + tmux Claude (実装)

### Phase D: spec への還流 (CLI、節目作業)

```
16. projectsmith spec-integrate
    - writer agent が spec_documents_session.content を更新
    - ブランチ spec-integrate-YYYYMMDD-...
17. PR 作成 → main マージ
```

→ **使う UI**: tmux Claude (CLI のみ)

### 修正サイクルの 2 パターン (重要)

セッション完了後に同 repo を更新するときの選択:

| パターン | 起点 | ブランチ | 必要な操作 |
|---|---|---|---|
| **小さな修正 / バグ / 詳細詰め** | tmux Claude (drift) | drift-YYYYMMDD-... | `projectsmith identity` の session_id を使うだけ。spec_session 不要 |
| **大きな仕様変更 / 新ドメイン追加 / 構造再編** | Web で 新規 SpecSession 作成 | smith/gen-{新 session_id} | Phase A 〜 D を再実行 |
| **repo そのものを起こし直し (枠組み再編)** | Repository Dashboard / Session Dashboard の Recast ボタン | (新 GitHub repo + 新 Repository row) | recast = 新 repo 作成、旧 repo は status='recast' で残る |

drift サイクルは spec_session の active 状態を要求しない。
新 spec_session を起こすのは骨格を作り直すとき、recast はさらに上位の「仕様体系をリセット」したいときのみ。

### Web UI の役割分離

| ページ | 用途 | 主な利用者 |
|---|---|---|
| **Repository Dashboard** (`/repositories/{id}`) | repo 全体の view、Generation 配下の閲覧、Recast 起点 | 全員 (週次レビュー / 新メンバー) |
| **Session Dashboard** (`/repositories/{id}/sessions/{sid}/dashboard`) | drift サイクルの主戦場、進捗 + Proposal 裁定 + Recast | tmux Claude を回す日々の作業者 |
| **SpecSession** (`/repositories/{id}/spec-session`) | 初版 / 大きな仕様変更時の編集ページ | 初版時 + 構造変更時のみ |
| **Governance** (`/repositories/{id}/governance`) | drift / unapproved merge / generation_mismatch の検査 | リリース前確認 |

---

## 全体像 — 3 mode を行き来するループ

```
        ┌──────────────────────────────────────────────┐
        │   ユーザ: 「○○ がしたい / 直したい」          │
        └────────────────────┬─────────────────────────┘
                             ▼
                   ┌─────────────────┐
                   │   /ask-mode     │  既存仕様を Smith で確認
                   │                 │  未確定箇所をユーザに提示
                   └──┬─────────┬────┘
                      │         │
        全て確定済み ◀┘         └▶ 未確定あり
        (実装可)                   (要 propose)
                      │              │
                      │              ▼
                      │    ┌─────────────────┐
                      │    │  /propose-mode  │  Smith に判断を仰ぐ
                      │    │                 │  synced か escalated 待ち
                      │    └──┬──────────────┘
                      │       │
                      │       ▼ synced/decided
                      │       │
                      ▼       ▼
                   ┌─────────────────┐
                   │  /build-mode    │  実装前確認ブロック → Edit/Write
                   │                 │  テスト → commit → push
                   └──┬──────────────┘
                      │
                      ▼
                   完了報告 → ユーザに PR 作成可否を確認
```

---

## 1 サイクルの典型的な流れ (例)

### Step 0: ユーザの要望

```
ユーザ: wheel picker でスクロール時に中央のアイコンが拡大しなくなった、直して
```

### Step 1: Claude が ASK モードに入る (自動 or `/ask-mode`)

```
Claude: /ask-mode に入ります。Smith で既存仕様を確認します。

  → ask_repository(scope=session, query="wheel picker icon scale")
  → get_node_detail("ui.session.map.screen.wheel_picker")
  → find_related_nodes("ui.session.map.screen.wheel_picker")

## ASK 結果サマリ

**対象**: wheel picker のアイコン拡大仕様

**Smith から取得した現状仕様**:
- fact #2257 [approved] ui.session.map.screen.wheel_picker.scale:
    center=1.6, others=0.5 の 2 値固定 (補間しない)
- fact #2098 [approved] ui.session.map.screen.wheel_picker.alpha:
    center=1.0, others=0.5 の 2 値固定

**未確定箇所** (要 propose):
- スケール段階数 (現状 2 値 / 提案 3 値?)
- 各位置の具体値
- alpha も連動するか

**確認質問**:
- 中央以外のスケールはどうしますか? 現行の 0.5 維持 / 階段化 / その他
```

### Step 2: ユーザが具体値を提示

```
ユーザ: 3 段階階段でいきたい。center=1.5, mid=1.1, edge=0.7。alpha も連動で 1.0/0.85/0.5
```

### Step 3: Claude が PROPOSE モードに切替

```
Claude: 仕様判断が複数決まったので /propose-mode に切り替えて Smith に提案します。

  → propose_decision(
      proposal_text="wheel_picker 3 段階階段スケール: center=1.5/mid=1.1/edge=0.7、
                     alpha=1.0/0.85/0.5。既存 fact #2257/#2098 を supersede",
      applies_to=["ui.session.map.screen.wheel_picker"],
      context={user_intent, current_state, related_facts}
    )
  → 応答: { status: "synced", proposal_id: 99, ... }

Smith 承認 (proposal #99 synced)。実装に入れます。
```

### Step 4: Claude が BUILD モードに切替

```
Claude: /build-mode に切り替えて実装します。

## 実装前 spec 確認

| 判断項目 | ソース種別 | ID | 値 |
|---|---|---|---|
| wheel_picker.item.scale.center | proposal | #99 | 1.5 |
| wheel_picker.item.scale.mid    | proposal | #99 | 1.1 |
| wheel_picker.item.scale.edge   | proposal | #99 | 0.7 |
| wheel_picker.item.alpha.center | proposal | #99 | 1.0 |
| wheel_picker.item.alpha.mid    | proposal | #99 | 0.85 |
| wheel_picker.item.alpha.edge   | proposal | #99 | 0.5 |

未確定項目: なし

  → git checkout -b drift-20260509-wheel-picker-3step
  → Edit app/.../WheelPickerItem.kt
  → Edit app/.../WheelPickerItemTest.kt
  → ./gradlew :app:testDebugUnitTest  → 4/4 pass
  → maestro test .maestro/wheel_picker_3step.yaml  → all pass
  → git commit -m "feat(ui): wheel_picker 3 段階階段スケール (proposal #99)"
  → git push origin drift-20260509-wheel-picker-3step

完了。PR を作成しますか?
```

### Step 5: ユーザの判断で PR 作成

```
ユーザ: お願い

Claude: → gh pr create ...
        PR #N を作成しました。
```

---

## mode 切替タイミング表

| 場面 | 推奨 mode | 理由 |
|---|---|---|
| ユーザが新しい要望を投げてきた | `/ask-mode` | 既存仕様の確認が必須 |
| ASK で全部既存 fact で解けた (新規判断ゼロ) | `/build-mode` | propose 不要 |
| ASK で 1 つでも未確定が残った | `/propose-mode` | Smith 承認が要る |
| propose の応答が `escalated` | そのまま PROPOSE で待機 | ユーザのブラウザ裁定待ち |
| propose 全部 synced/decided + 未確定なし | `/build-mode` | 実装可能 |
| BUILD 中に新たな判断点を発見 | `/ask-mode` に戻る | STOP して再確認 |
| BUILD 中にテストが落ちた | 原因分析 → `/ask-mode` or 修正 | 仕様起因か実装起因かで分岐 |
| 1 サイクル完了 | (mode 維持) | 次の要望待ち、新サイクルで `/ask-mode` |

---

## シナリオ別の対応

### A. 単純な追加要望 (既存 spec で解ける)

```
ユーザ → ASK (確認) → 既存 fact のみで解けた → BUILD (実装)
```

例: 「fact #2257 通りに WheelPickerItem を実装して」みたいに具体的な場合。
PROPOSE はスキップ。

### B. 仕様の不明点が複数ある

```
ユーザ → ASK → 質問列挙 → ユーザ回答 → PROPOSE (複数 propose を順次) → BUILD
```

各 propose は独立して投げる。1 つでも escalated になったら全 propose の処理を待つ。

### C. propose が escalated になった

```
PROPOSE → escalated → ユーザ「ブラウザで裁定して」→ ユーザ「OK 進めて」
       → list_pending_decisions(repo_id) → ready_to_implement=true 確認
       → BUILD
```

ユーザの「進めて」「OK」「決まった」「裁定済み」等の合図を聞き逃さないこと。
合図を受けたら **真っ先に list_pending_decisions** を叩く (CLAUDE.md §0-5)。

### D. BUILD 中にテストが落ちた

```
BUILD → テスト失敗 → エラーログを見る
  → 仕様起因 (期待値が誤って決まっていた): /ask-mode に戻り再ヒアリング
  → 実装起因 (バグ): 実装を修正 (BUILD のまま)、再テスト
```

判断に迷ったら STOP してユーザに聞くこと。推測で進めない。

### E. 仕様矛盾を検知した

```
ANY mode → 矛盾検知 → 即 STOP → ユーザに報告
  → projectsmith status で pending proposal を確認
  → 必要なら /ask-mode で再確認 / /propose-mode で矛盾解消 propose
```

「矛盾を見ぬふりして実装」は CLAUDE.md §0 違反。

### F. 長時間 session で記憶が薄れた感じがする

```
ANY mode → projectsmith status で現状確認
  → 直近 ask history と pending proposals を眺める
  → 必要なら /ask-mode に戻って再確認
```

UserPromptSubmit hook が毎ターン現 mode と reminder を注入するが、
要所では明示的に `projectsmith status` を叩いて視覚的に再確認すると良い。

---

## hook が止めてくれる事故

以下は機械的に block されるので、Claude が誤って実行しても被害が出ない：

| 事故 | block する hook |
|---|---|
| ASK/PROPOSE モードでコード (.kt/.py 等) を Edit/Write | PreToolUse hook |
| BUILD モードで「実装前 spec 確認」ブロックを出さずに Edit/Write | PreToolUse hook |
| spec/*.md / canonical_spec.json を編集 (どの mode でも) | PreToolUse hook |
| drift-* ブランチへの commit に proposal #N / fact #N が無い | commit-msg hook (.githooks/) |

> commit-msg hook は `bash scripts/install-githooks.sh` を 1 度実行して有効化する。
> Claude Code hook (PreToolUse 等) は settings.json で自動有効化される。

---

## よく使うコマンド・ツール

```bash
# 現状俯瞰 (fact 集計 / drift gap / OQ 抜粋 / pending / 直近 ask / git / mode)
projectsmith status                          # フル表示
projectsmith status --no-summary             # 軽量モード (fact 集計を省略)

# open_question フォーカスビュー (要裁定 fact を node ごとにグルーピング表示)
projectsmith oq                              # 全 OQ
projectsmith oq --node ui.session.map.screen # 特定ノードに絞る
projectsmith oq --show-rationale             # Auditor が OQ にした理由も表示

# fact の棚卸し (節目で実行 — 矛盾は escalated proposal として浮上)
projectsmith consolidate-facts

# 累積 fact を spec/*.md に還流 (spec drift gap を埋める)
projectsmith spec-integrate                  # 専用ブランチで commit
projectsmith spec-integrate --push           # commit + push まで

# server 上の最新 spec をローカルに pull (LLM 走らない、秒で完了)
projectsmith spec-pull                       # 専用ブランチで commit
projectsmith spec-pull --push                # commit + push まで
projectsmith spec-pull --dry-run             # 差分プランだけ表示

# テンプレート同期 (CLAUDE.md / .claude/ / .githooks/ などを最新に)
projectsmith sync-templates                  # dry-run
projectsmith sync-templates --apply --backup # 適用
```

---

## spec-integrate — fact から spec/*.md への還流

ASK → PROPOSE → BUILD のループを何度も回すと、**最新の真実は fact_session に分散**
し、ローカルの `spec/*.md` はどんどん古くなる (drift gap)。CLAUDE.md §0-0 の指示で
Claude は古い md を信用しないので実装上の問題は起きないが、人間が読むときや code review
で困る。

`spec-integrate` は累積 approved facts を各 node のドメイン writer に再投入して
`spec_documents_session.content` を最新化する。spec/*.md がローカルに書き出されて
専用ブランチに commit される。

### 重要 — 2 つの経路があり、どちらか一方だけを使う

spec-integrate の結果を GitHub に反映する経路は **2 つ** あり、**同じサイクルで両方は走らせない**
(同じ内容の branch が 2 本できて混乱の元)。

| 経路 | 起点 | 動き | branch 名 | 使う場面 |
|---|---|---|---|---|
| **Web 経路** | Session Dashboard の「▶ Spec Integrate を実行」ボタン | server で integrate → server から GitHub API 経由で commit + PR 作成 (ローカル workspace 不要) | `spec-integrate-YYYYMMDD-HHMMSS` | 通常はこちら (1-click 完結) |
| **CLI 経路** | `projectsmith spec-integrate` + `spec-pull --push` | server で integrate (DB 更新) → CLI が server からファイル取得 → ローカルに書き出し → ローカル git で commit + push | `spec-pull-YYYYMMDD-HHMMSS` | Web の長時間 ReadTimeout 復旧時 / cron / 別マシンで作業中 |

#### 使い分けルール

- **第一選択は Web 経路**: 動線が連続していて、エラー時の挙動も明示的
- **CLI 経路は復旧手段 / 自動化用途**:
  - Web で integrate-and-commit 中に ReadTimeout が起きたが server 側は完走している場合 → `spec-pull --push` で server の最新を branch に
  - cron / GitHub Actions で定期実行したい
  - Smith に GitHub token 未設定の repo (Web 経路は token 必要)
- **両方走らせない**: 同じ spec_documents_session を見るので branch が 2 本できる。merge 競合の元

> 既に Web ボタンで実行した直後に「念のため CLI でも」と思っても、spec-pull は **走らせない**。
> 1 つの cycle で push される branch は 1 本だけ、にする。

### 経路別の対応関係

```
[Web 経路]
  Session Dashboard ▶ Spec Integrate を実行
    → POST /api/repositories/{id}/sessions/{sid}/integrate-and-commit
    → server: integrate_session_spec (writer × N + auditor)
    → server: github_service.create_branch (spec-integrate-YYYYMMDD-HHMMSS)
    → server: commit_file × N (spec/*.md)
    → server: create_pull_request → PR 作成 (返り値: pr_url)
    → ローカル workspace は無変更
    → ユーザは PR をブラウザで review → main に merge → ローカルで git pull

[CLI 経路]
  projectsmith spec-integrate
    → server: integrate_session_spec (writer × N + auditor)
    → DB 更新のみ
  projectsmith spec-pull --push
    → server から最新 spec_documents_session.content を取得 (LLM 不要)
    → ローカル <cwd>/spec/*.md に上書き
    → ローカル git checkout -b spec-pull-YYYYMMDD-HHMMSS
    → git add + git commit + git push
    → PR は手動 (gh pr create)
```

### いつ走らせるか

| タイミング | 目的 |
|---|---|
| Sprint 末 / リリース前 | drift gap を埋めて PR レビューしやすくする |
| 大きな機能群が一段落した時 | spec/*.md を新メンバーが読める状態に |
| consolidate-facts が escalated を生成した時 | 矛盾解消後に spec を最新化 |
| 重要 propose が複数 synced になった直後 | facts が固まっているうちに反映 |

逆に、**1 サイクル毎に走らせる必要はない**。fact 蓄積→定期的に spec 反映、というリズムが正しい。

### 標準フロー

```bash
# 1. 状態確認 (worktree がクリーンであることが前提)
projectsmith status
git status

# 2. consolidate-facts (推奨)
#    candidate を整理して escalated 矛盾があれば先に裁定する
projectsmith consolidate-facts

# 3. (escalated proposal があれば) ブラウザで裁定 → 「進めて」合図 → list_pending_decisions
#    すべて synced/decided にする

# 4. spec-integrate
#    server 側で各 node の domain writer (ui-agent / db-agent 等) を順次走らせる
#    spec-auditor も自動で走り (audit=true default)、矛盾は escalated proposal として登録される
projectsmith spec-integrate

# 5. ローカルに spec-integrate-YYYYMMDD-HHMMSS-genN ブランチが切られ、
#    spec/*.md が更新されて commit される

# 6. 内容確認
git diff main..HEAD -- "spec/*.md" | less

# 7. push して PR を作る
projectsmith spec-integrate --push        # 一気にやる場合
# または手動で:
git push -u origin <branch>
gh pr create
```

### consolidate-facts と spec-integrate の違い

| 観点 | consolidate-facts | spec-integrate |
|---|---|---|
| 対象 | `fact_session` の candidate を approved/open_question 等に整理 | `spec_documents_session.content` を最新 fact で書き換え |
| LLM | fact-auditor 1 回 | 各ドメイン writer × N (node 数だけ呼ぶ) + spec-auditor 1 回 |
| 所要時間 | 数十秒〜数分 | 数分〜数十分 (node 数次第) |
| 副作用 | 矛盾検知 → escalated proposal | spec/*.md 更新 + git commit (専用ブランチ) |
| 推奨頻度 | サイクル末ごと | sprint 末・節目ごと |

つまり: consolidate-facts は **fact 内の整理**、spec-integrate は **fact → spec への反映**。
順序的に consolidate を先に走らせて escalated を解消してから integrate するのが安全。

### オプション

| flag | 効果 |
|---|---|
| `--no-audit` | spec-auditor をスキップ (速度優先、品質トレードオフ) |
| `--no-branch` | 現ブランチに直接 commit (main 直 commit を避けるため通常は branch 推奨) |
| `--no-commit` | git add/commit はせず、ファイル書き込みだけ |
| `--push` | commit 後に origin にも push する (default は push しない) |
| `--dry-run` | server は走らせるが、ローカルファイル書き込み・git 操作はスキップ |

### 失敗・部分成功の扱い

- 1 ノードの compose に失敗しても、他のノードは続行される (`failed[]` に詳細)
- spec-auditor が矛盾を検知した場合は escalated proposal として登録されるので、
  ブラウザで proposal を裁定 → 必要に応じて再度 spec-integrate
- LLM タイムアウト (30 分超) や network 切断は再実行で対応

### Claude (tmux) との関係

- spec-integrate は **CLI から人間 / cron が起動する**操作。tmux Claude は呼ばない
- spec-integrate の commit message には fact ID 群を引用するため、commit-msg hook (drift-* のみチェック) は素通り
- spec-integrate 完了後、tmux Claude は **新しい spec/*.md を信用してはいけない** (CLAUDE.md §0-0 の無効ソース原則は変わらない)。あくまで ask_repository / fact から取得する

---

## spec-pull — server 上の最新 spec をローカルに同期

`spec-integrate` は server 側で各 node の writer を回し、`spec_documents_session.content`
を更新してから生成 md を CLI に返す。が、ノード数が多いと処理が長時間 (10〜30 分超) になり、
**CLI の HTTP response 受け取りで ReadTimeout 等が起きる**ことがある。
その場合 server 側の DB 更新は完了しているのに、ローカルへの反映だけが取りこぼされる。

`spec-pull` は **LLM を呼ばず DB 読み取りだけ** で server の最新 active
`spec_documents_session` をローカル `spec/*.md` に書き出す軽量コマンド。秒で完了する。

### いつ使うか

| 場面 | 何をするか |
|---|---|
| spec-integrate がタイムアウトで途切れた | `spec-pull` で server の現状を吸い出す |
| spec-integrate を別マシンで走らせていた | `spec-pull` でこちらに反映 |
| tmux Claude を起動する前に spec/*.md を最新にしたい | `spec-pull --dry-run` で差分確認、必要なら `spec-pull` |
| cron / GitHub Actions で定期 snapshot | `spec-pull --push` をスケジュール実行 |

### 標準フロー

```bash
# まず差分プランを確認 (LLM 走らないので即時)
projectsmith spec-pull --dry-run
#   各 file が NEW / DIFF / SAME のどれか表示される

# 専用ブランチで commit
projectsmith spec-pull
#   spec-pull-YYYYMMDD-HHMMSS ブランチに切替 → spec/*.md 上書き → git commit

# commit + push まで
projectsmith spec-pull --push
```

### spec-integrate / spec-pull の違いと使い分け

| 観点 | spec-integrate | spec-pull |
|---|---|---|
| LLM 呼び出し | あり (重い、長時間) | なし (DB 読み取りのみ) |
| 副作用 (server) | spec_documents_session を更新 | なし (read-only) |
| 副作用 (local) | spec/*.md 更新 + git commit | spec/*.md 更新 + git commit |
| 所要時間 | 数分〜数十分 | 数秒 |
| 推奨頻度 | sprint 末・節目ごと | 必要時いつでも、cron でも可 |
| 想定用途 | fact → spec への能動的還流 | server → local の受動的同期 |

> **ペアで使うパターン**: `spec-integrate` で server に最新仕様を generate → `spec-pull`
> でローカルに反映、という 2 段構えにすると、ReadTimeout が起きても spec-pull で確実に
> ローカルに落とし込める。

### ブランチ命名

| 経路 | コマンド / トリガ | ブランチ名 |
|---|---|---|
| Web | Session Dashboard ▶ Spec Integrate を実行 | `spec-integrate-YYYYMMDD-HHMMSS` |
| CLI (server 側 integrate) | `projectsmith spec-integrate` (DB 更新のみ、push しない) | (なし) |
| CLI (push 段) | `projectsmith spec-pull --push` | `spec-pull-YYYYMMDD-HHMMSS` |

全てのブランチが commit-msg hook (drift-* のみ) の対象外なので proposal/fact ID 必須ルールは適用されない。

### PR マージ後のローカル取り込み

Web 経路でも CLI 経路でも、PR が main にマージされた後はローカル workspace を最新化する:

```bash
cd /path/to/your-project
git switch main
git pull
# → spec/*.md がローカルで最新化される
```

drift ブランチで作業中の場合:

```bash
git switch <drift-branch>
git fetch
git rebase origin/main      # or git merge origin/main
# → drift ブランチに最新 spec を取り込む
# → spec/*.md だけの差分なのでコード commit と物理的に被りにくい
```

> tmux Claude (rdrop 等) は CLAUDE.md §0-0 に従い spec/*.md を信用しないので、PR マージ前でも実装作業は止まらない。
> ローカル更新は code review / 新メンバー閲覧の便宜のため。

---

## トラブル別 復旧プレイブック

### 1. `spec-integrate` が ReadTimeout / Connection reset で落ちた

**症状**: CLI 側で httpx.ReadTimeout、Web 側でブラウザタブが反応なくなる、等。サーバ側ログには `[spec-integrate] ... done: updated=N` が出ているケース。

**原因**: response payload が大きい (数 MB) / 処理が長くて TCP idle 切断 / docker/uvicorn の途中レイヤで切断。

**復旧手順**:

```bash
# 1. server ログで完走したか確認
docker logs smith-app --tail 200 | grep "spec-integrate"
#    "session=N done: updated=M failed=0 ..." があれば server 側は成功

# 2. DB に反映されているか軽くチェック
projectsmith status
#    最新の spec/*.md は SpecDocumentSession に入っている

# 3. spec-pull で server の現状を吸い出して git に反映
projectsmith spec-pull --dry-run    # 差分確認
projectsmith spec-pull --push       # 反映 + push

# 4. tmux Claude には影響なし (Claude は ask_repository から fact を取るので)
```

**再発防止**: 現状は CLI 操作の運用回避。今後 background job 化する予定。

### 2. `spec-integrate` 中で一部ノードが失敗

**症状**: `failed=N (>0)` と server ログに出る、CLI レポートにも failed リストあり。

**原因**: 個別 LLM 呼び出しエラー (rate limit / プロンプト破損 / 該当 node の facts に矛盾)。

**復旧手順**:

```bash
# 1. 失敗ノードを確認 (CLI レポート or server log)
docker logs smith-app --tail 300 | grep "compose error"

# 2. 該当 node の facts を確認
projectsmith status   # ask history を見て直近の質問範囲を把握

# 3. 該当 node に矛盾 fact がある可能性 → consolidate-facts で再整理
projectsmith consolidate-facts
#    escalated proposal が出たらブラウザで裁定

# 4. spec-integrate を再実行 (成功済みノードはどうせ最新版が再生成されるだけ)
projectsmith spec-integrate
```

### 3. consolidate-facts が escalated proposal を生成した

**症状**: `consolidate-facts` 実行後、`escalated_proposal_ids: [N1, N2, ...]` が返る。

**原因**: 累積 fact 同士に矛盾、Auditor が自動裁定不可。

**復旧手順**:

```bash
# 1. ブラウザで proposal queue を開いて該当 ID を裁定
#    (status が escalated → synced/decided になる)
projectsmith status

# 2. tmux Claude に「進めて」「裁定済み」と伝える
#    Claude が list_pending_decisions で確認、ready_to_implement=true を見て続行

# 3. 必要なら consolidate-facts を再実行
projectsmith consolidate-facts
```

### 4. drift branch で commit できない (commit-msg hook block)

**症状**: `commit-msg hook BLOCK ... proposal/fact ID 必須`

**原因**: drift-* ブランチへの commit message に proposal #N / fact #N の参照がない。

**復旧手順**:

```bash
# 1. 直近の proposal/fact ID を確認
projectsmith status

# 2. commit message を書き直して再実行
git commit -m "feat(ui): wheel picker scale (proposal #99, fact #2257)"

# 緊急時のスキップ (CLAUDE.md 上は最終手段)
git commit --no-verify -m "..."
```

### 5. tmux Claude が `/ask-mode` を Unknown command と言う

**症状**: Claude Code のスラッシュコマンドが認識されない。

**原因**: session 起動時に `.claude/commands/*.md` がスキャンされていない。

**復旧手順**:

```
# Claude Code を再起動 (新規スラッシュコマンドは再起動必要)

# それでもダメなら commands ファイルが配置されているか確認
ls .claude/commands/

# なければ sync-templates で配布
projectsmith sync-templates --apply --only ".claude/"
```

### 6. PreToolUse hook で Edit が誤って block される

**症状**: BUILD mode 中なのに `## 実装前 spec 確認` ブロックを書いたのに block される。

**原因**: hook が transcript_path を取得できない / 確認ブロックが直近 200 行外。

**復旧手順**:

```
# 1. 現 mode を確認
cat .claude/state/current_mode

# 2. 直近で確認ブロックを再出力してから Edit を再試行
#    (hook は tail -n 200 で grep するので、間に長い出力があると見落とす)

# 3. それでもダメなら一時的に hook を無効化 (settings.json の hooks をコメントアウト → 再起動)
```

### 7. Smith サーバに繋がらない (Connection refused / reset)

**症状**: `httpx.ConnectError: [Errno 111] Connection refused`

**原因**: smith-app が落ちている / mysql が落ちて smith-app が初期化失敗 (zombie 状態)。

**復旧手順**:

```bash
# 1. コンテナ状態確認
docker ps --format "table {{.Names}}\t{{.Status}}" | grep smith
#    smith-mysql が "Up ... (healthy)" であること

# 2. mysql が unhealthy / restart loop なら mysql を再起動
docker compose restart mysql
#    health: starting → healthy 待ち (~10 秒)

# 3. smith-app を再起動 (mysql healthy 後)
docker compose restart app

# 4. 確認
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:10083/
#    307 (redirect) が返れば OK

projectsmith status   # 動作確認
```

### 8. `projectsmith` コマンド自体が見つからない / 古い

**症状**: `command not found` / 新コマンドが反映されない。

**復旧手順**:

```bash
# CLI を再 install (editable)
cd /path/to/projectsmith-2
pip install -e .

# パス確認
which projectsmith
projectsmith --help   # 全コマンド一覧
```

---

## NG パターン (やりがちな失敗)

| NG | なぜダメか | 正しいやり方 |
|---|---|---|
| ユーザに聞かれた瞬間に Edit を始める | ask_repository を飛ばすと古い仕様で実装してしまう | まず /ask-mode |
| ASK で「たぶんこうでしょう」と推測補完 | 推測は仕様根拠にならない (CLAUDE.md §0-0) | 未確定として propose に回す |
| propose を `aq1〜aqN で別途確定` のような placeholder で出す | auditor が reject する想定 / 実装可能粒度になっていない | 具体パラメータまで詰めてから propose |
| propose 投げたまま放置して BUILD を続ける | 確定前の実装は無効 (CLAUDE.md §0-0) | propose の synced/decided を待つ |
| spec/*.md を「ついでに」更新 | spec 編集は recast の責務 | hook で block される。touch しない |
| commit message に proposal/fact ID 書かない | commit-msg hook で reject | 必ず "(proposal #N)" などを subject か body に |
| 「前のセッションで決まった」記憶を根拠に実装 | 記憶は不確実 (CLAUDE.md §0-0) | 毎サイクル ask_repository で再確認 |

---

## 推奨運用 — fact / spec の整合を保つルール

以下は **機械的な enforce ではなく運用ルール**。守ることで「fact に違反する spec が紛れる」可能性を実質ゼロに保てる。

### 大原則

| ルール | 理由 |
|---|---|
| 重要な決定は必ず `propose_decision` 経由で行う | facts_session に `design_decision` (status=approved) として残る → 後続の ask_repository / spec-integrate が拾える |
| `spec/*.md` を直接書き換えない | hook で block 済 (recast/integrate の責務)。直編集は履歴が残らず drift する |
| Sprint 末・節目で `consolidate-facts` → `spec-integrate` → `spec-pull` を 1 セットで回す | fact 整理 → spec 反映 → ローカル同期で drift gap を閉じる |
| `spec-auditor` の inquiry 結果を必ず確認 | spec-integrate 後に違反を検知してくれる。読まないと素通りする |
| 違反検知時は propose で fact 側を訂正 (supersede) or spec 側を整える | 直接 fact / spec を上書きしない |

### 標準サイクル (1 ドリフト〜還流まで)

```
[毎サイクル]
1. ユーザ要望 → /ask-mode (Smith で既存仕様確認)
2. 未確定があれば /propose-mode (propose_decision を投げる)
3. synced 後 → /build-mode (実装前 spec 確認 → Edit/Write/test/commit/push)
4. PR レビュー → main マージ

[節目 (sprint 末 / リリース前 / 大量 fact 蓄積後)]
5. projectsmith status        # pending decisions / 直近 ask を俯瞰
6. projectsmith consolidate-facts
   ↳ escalated proposal が出たらブラウザで裁定
   ↳ もう一度 consolidate して整理が落ち着くまで繰り返し
7. projectsmith spec-integrate
   ↳ ReadTimeout 等で response 取りこぼしたら → projectsmith spec-pull で吸い出し
   ↳ spec-auditor inquiry を Web で確認、違反あれば propose で修正
8. spec-integrate-* / spec-pull-* ブランチを PR で main マージ
```

### 「fact > spec」を機械的には保証していないことの含意

- CLAUDE.md §0-0 / writer agent prompt / spec-auditor の **3 段ソフト enforce** で守っている
- DB constraint や API validator で「fact に違反する spec を弾く」層は **無い**
- 違反を見つける手段:
  - `spec-integrate --audit` (default true) → spec-auditor inquiry に違反が出る
  - `consolidate-facts` → fact↔fact 矛盾を escalated proposal で浮上
  - 将来必要なら「fact↔spec 専用 audit CLI」を新設可能

### fact のステータスと運用

| status | 意味 | 由来 | 扱い |
|---|---|---|---|
| `candidate` | 未整理の生 fact (compose / inquiry が積んだ素材) | domain agent の出力 | consolidate-facts で整理対象 |
| `approved` | 確定した事実。spec に反映してよい | propose_decision sync 時、または consolidate-facts Auditor 判断 | ask_repository / spec-integrate が拾う唯一の status |
| `assumption` | 仮置き。確定ではないが当面これで進める | consolidate-facts Auditor 判断 | ask_repository には含む (Claude には見える) が、spec-integrate の対象節点選定では使わない |
| `open_question` | 未確定で 2 案以上ある (人間裁定要) | consolidate-facts Auditor が矛盾検知時に作成 | **同時に escalated proposal も自動生成** される。人間裁定で別途 design_decision approved が積まれる |
| `superseded` | 旧 fact、もう参照しない | consolidate-facts で新版 approved/open_question が作られた時 | どこからも参照されない |
| `legacy` | (使われない場合あり) | 廃止予定 | — |
| `rejected` | Auditor が「これは fact ではない」と判断 | consolidate-facts | どこからも参照されない |

---

## open_question — 「答えが定まらない fact」の扱い

### どこから生まれるか

主に **`consolidate-facts` の fact-auditor LLM** が判断します。複数 candidate fact が同じ node について矛盾する内容を主張し、auditor が「単一の approved に統合できない」と判断すると、`status=open_question` で 1 件 INSERT する。

`propose_decision` 直接の経路では生まれない (propose-arbiter は decided / escalated の 2 値判断)。

### open_question が生まれた瞬間に同時起こること

`consolidate-facts` は open_question を作ると、**同じ内容を escalated proposal として自動登録** します (`fact_service.py:340-365` → `propose_service.create_fact_audit_escalation`)。

```
consolidate-facts 実行
  ↓
fact-auditor LLM が矛盾検知
  ↓
facts_session INSERT (status=open_question)
  ↓
propose_service.create_fact_audit_escalation(...)
  ↓
claude_proposals INSERT (status=escalated, decision_type=human)
  ↓
list_pending_decisions の needs_human=true で見える
```

### open_question が各機構でどう扱われるか

| 機構 | 振る舞い |
|---|---|
| **`ask_repository`** | INJECTABLE_FACT_STATUSES に `open_question` 含むので Claude には見える。回答に「このノードに未確定 open_question あり」と出る |
| **`spec-integrate` 対象選定** | status=approved のみ拾うので **open_question だけある node は処理対象外** (skipped) |
| **`spec-integrate` の writer 入力** | 該当 node が approved fact 由来で対象になった場合、`get_session_facts` (= INJECTABLE 全部) で open_question も writer に渡される。writer は「この点は未確定」として md に注記する想定 |
| **`spec-auditor`** | open_question に絡む箇所を「未確定」として inquiry_result に出す |
| **`list_pending_decisions`** | 自動生成された escalated proposal が `needs_human=true` で見える |

### 標準的な解消フロー

```
1. consolidate-facts で open_question + escalated proposal が生成された
2. projectsmith status で escalated proposal の id を確認
3. ブラウザの proposal queue で該当 ID を裁定
   ↳ 採用案 (A or B または独自) を選ぶと、claude_proposals が synced へ
   ↳ 同時に facts_session に新しい design_decision (approved) が INSERT される
4. tmux Claude に「進めて」「裁定済み」と合図
5. 次のサイクル冒頭、または明示的に projectsmith consolidate-facts を再実行
   ↳ Auditor が「新しい approved がある → 古い open_question は superseded に」と判断 (期待動作)
6. spec-integrate 時には新 approved を反映した md が writer から出力される
```

### 注意点

- open_question は **自動消滅しない**。人間裁定 → consolidate 再実行のセットで初めて superseded 化される
- 人間裁定だけして consolidate を回さないと、open_question fact が残ったまま。ask_repository では古い「未確定」として見えるので Claude が混乱する原因になる
- 「open_question を作りたくない」場合は **propose_decision で先に確定させる** のが筋。consolidate-facts は「気付かなかった矛盾を後追いで検知する」役割

---

## 進捗の見える化 — status / oq の読み方

ProjectSmith は CLI 中心で日々の作業が回るので、Web ダッシュボードを見ない時間が長くなる。
**`projectsmith status` と `projectsmith oq` を定期的に叩く習慣** が進捗管理の生命線。

### `projectsmith status` のセクション解説

#### Facts (status breakdown) — fact の健全性

```
total       = 376
approved    [■■■■■■■■■■····················]  125 (33%)  ← spec 反映済 / 反映可
open_q      [······························]    6 ( 1%)  ← 要裁定
candidate   [■■■■■·························]   66 (17%)  ← consolidate-facts 待ち
assumption  [■·····························]   10 ( 2%)
superseded  [■■■■■■■■■■■■■·················]  169 (44%)
```

**読み方**:
- `approved` 比率が増えている → 仕様が固まっていく方向。良い兆候
- `candidate` が増え続ける → consolidate-facts を回す合図
- `open_q` がゼロ → 矛盾なし。何でも実装可能な状態
- `open_q` が増えている → 要裁定タスクが溜まっている、優先処理
- `superseded` が増えている → 過去の試行錯誤の蓄積。健全 (むしろ意思決定がトレースできる証拠)

#### Drift gap (前回 spec 反映以降の approved fact 増分)

```
last spec_doc updated_at = 2026-05-10T01:27:16
approved_facts_since = 0  ← spec は最新
```

**読み方**:
- `approved_facts_since = 0` (緑) → spec/*.md は fact と同期している
- `approved_facts_since < 10` (黄) → 軽い drift、急がなくて良いが意識する
- `approved_facts_since >= 10` (赤) → spec-integrate を回す時期

#### Open questions (件数 + 抜粋)

要裁定 fact の上位 N 件をプレビュー表示。詳細を見たい場合は `projectsmith oq` を叩く。

#### Top blocking nodes

```
ui.session.map.screen   OQ count = 6
```

→ **OQ が集中している node を特定**。次に着手予定の node がここに上がっていたら、着手前に裁定する。

#### SpecDocumentSession active / legacy

DB 上の active 仕様 / legacy 化された旧仕様の数。active が node 数とほぼ一致していれば健全、極端に増減があると spec-integrate / consolidate のバグ疑い。

### `projectsmith oq` の読み方

OQ にフォーカスし、**node ごとにグルーピング** + **紐づく escalated proposal id を併記**。「どこから裁定を始めるか」の入り口になる。

```
━━ ui.session.map.screen  (6 OQ) ━━
  [fact #2219] wheel picker item halo の詳細仕様 (q6)
    → escalated proposal #97 [synced]  ブラウザで裁定可能
  [fact #2218] accent color 具体値 (q5)
    → 紐づく escalated proposal が見つからない (consolidate-facts を再実行で再生成可能)
```

**読み方**:
- 同じ node に複数 OQ → 一気にまとめて裁定すると効率的
- escalated proposal が紐づいている → ブラウザで `/governance` を開いて裁定
- proposal が見つからない (古い OQ) → `consolidate-facts` 再実行で proposal を再生成

### 健全な session のサイン

| 指標 | 健全レンジ |
|---|---|
| approved 比率 | 30% 以上 |
| candidate 比率 | 30% 未満 (越えたら consolidate) |
| open_q 件数 | 5 件未満 / または上昇傾向にない |
| drift gap (approved_facts_since) | 10 件未満 |
| top blocking node の OQ 数 | 3 件未満 |
| SpecDocs active / 期待 node 数 | ≈ 1.0 |

### 進捗管理のリズム

```
[毎朝 / セッション開始時]
  projectsmith status        → 今日の優先タスクを把握 (OQ あれば裁定検討)

[ASK/BUILD のたびに]
  projectsmith oq --node X   → 着手 node の OQ を確認、あれば裁定先行

[sprint 末 / 大きな機能完了時]
  projectsmith consolidate-facts → 矛盾検知
  projectsmith status            → drift gap を確認
  projectsmith spec-integrate    → drift gap を埋める
  projectsmith spec-pull         → ローカル反映 (timeout 回避)

[release 前]
  projectsmith status            → 健全レンジに収まっているか最終確認
  projectsmith oq                → 未裁定 OQ がゼロであることを確認
```

### CLI で見えにくいもの (Web の出番)

CLI で出来ないこと、Web に戻る価値がある場面：

- **escalated proposal の裁定 UI** (A/B 案の選択 + 自由記述) — Web 必須
- **時系列グラフ** (OQ 件数 / approved 件数の推移カーブ)
- **node 関係図** (canonical_spec の構造可視化 / C4 / ER)
- **spec-auditor inquiry の本文閲覧** (LLM の指摘文を読み込むのは Web の方が楽)
- **過去 ask の検索・フィルタ**
- **agent_config の調整** (LLM model / prompt 編集)

なので **「routine な日々の作業はほぼ CLI、構造変更や視覚化は Web」** のハイブリッド運用が現状の落としどころ。

---

## 参考

### CLAUDE.md / commands / hooks
- `CLAUDE.md` §0 (最優先ガードレール): 仕様の正本 / 無効ソース / 確認ブロック / mode 概念
- `.claude/commands/ask-mode.md` / `propose-mode.md` / `build-mode.md`: 各 mode の詳細手順
- `.claude/hooks/`: SessionStart / UserPromptSubmit / PreToolUse の各 hook script
- `.githooks/commit-msg`: commit message 検査ロジック

### CLI コマンド早見

| コマンド | 用途 | LLM | 所要 |
|---|---|---|---|
| `projectsmith status` | 全体ダッシュボード (fact 集計 / drift / OQ / pending / git / mode) | なし | 即時 |
| `projectsmith oq` | open_question フォーカスビュー (要裁定 fact を node ごとに) | なし | 即時 |
| `projectsmith consolidate-facts` | candidate fact を整理、矛盾は escalated proposal 化 | あり (auditor) | 数十秒〜分 |
| `projectsmith spec-integrate` | fact を spec/*.md に還流 (各 node の writer 走らせ) | あり (writer × N + auditor) | 分〜数十分 |
| `projectsmith spec-pull` | server 上の最新 spec をローカルに pull (LLM 不要) | なし | 秒 |
| `projectsmith sync-templates` | initial_files テンプレを既存プロジェクトに同期 | なし | 秒 |

### 標準的な 1 サイクル (実装〜還流まで通し)

```
1. ユーザ要望 → /ask-mode (Smith で既存仕様確認)
2. 未確定があれば /propose-mode (propose_decision)
3. synced 後 → /build-mode (実装前 spec 確認ブロック → Edit/Write/test/commit/push)
4. PR レビュー → main マージ
   ↑ ここまでが 1 ドリフト

5. (sprint 末 / 節目) projectsmith consolidate-facts
   → 矛盾あれば escalated proposal を裁定

6. projectsmith spec-integrate (server で fact → spec_documents_session 更新)
   → タイムアウトで取りこぼしたら projectsmith spec-pull で吸い出し

7. spec-integrate-* / spec-pull-* ブランチを PR で main マージ
   → ローカル spec/*.md が累積 fact 反映済みになる
```

---

> このドキュメントは `initial_files/.claude/WORKFLOW.md` から配布されます。
> 内容を変更したい場合は `initial_files/` 側を編集し、各プロジェクトでは
> `projectsmith sync-templates --apply --only ".claude/WORKFLOW.md"` で反映してください。
