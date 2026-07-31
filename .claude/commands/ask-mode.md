---
description: ASK モードに切替。ユーザ要望を聞き、Smith で既存仕様を確認し、提案文を組み立てるフェーズ
---

[ASK モード起動]

`.claude/state/current_mode` を `ASK` に更新して、これから ASK モードに入ります。
切替を実行するため、まず以下を Bash で実行してください:

```bash
echo ASK > .claude/state/current_mode && date -Iseconds > .claude/state/mode_changed_at
```

## ASK モードの責務

このモードでは **コードを書かない**。ユーザの要望を Smith の言葉に翻訳することが唯一の仕事です。

### 必ずやること

1. **ユーザ要望を一次受け** — 自然言語の発話をそのまま受け取り、解釈を加えない
2. **既存仕様を Smith で確認** — 必ず以下の順で叩く:
   - `ask_repository(scope='session', scope_id=<identity の session_id>, query=<要望の主旨>)`
   - 関連 node が見つかれば `get_node_detail(node_id=...)` で詳細
   - 関連 node が複数あれば `find_related_nodes(node_id=...)` で周辺探索
3. **未確定箇所を抽出** — 既存 fact / spec で answer できない判断点を箇条書きで明示
4. **ユーザに整理して返す** — 「現状こうです / 未確定はこれです / どう決めますか?」のフォーマットで提示

### 絶対にやらないこと

- ❌ Edit / Write でコードや spec/*.md を編集する
- ❌ 推測で「たぶんこうでしょう」と仕様を補完する
- ❌ ask_repository を叩かずに会話履歴・記憶から答える
- ❌ propose_decision をいきなり投げる（PROPOSE モードに切替てから）

### 出力フォーマット例

```
## ASK 結果サマリ

**対象**: <要望の主題>

**Smith から取得した現状仕様**:
- <fact_id> [<status>] <node_path>: <statement>
- ...

**未確定箇所** (要 propose):
- <判断点 1>: <選択肢 A / B / C>
- <判断点 2>: <選択肢 ...>

**確認質問**:
- <ユーザに決めてほしい点 1>
- <ユーザに決めてほしい点 2>
```

### 次に進む条件

ユーザが未確定箇所に対して具体値を提示したら、以下のいずれかに進む:

- 1 つの判断のみ → `/propose-mode` に切替て propose_decision を 1 回投げる
- 複数判断が一括で決まった → `/propose-mode` で各 propose を順次投げる
- 既存 spec で全て解ける（新規 propose 不要）→ `/build-mode` に切替

## 重要な注意

- session_id / repo_id は `projectsmith identity --json` から取得すること（`.smith` を直接読まない／手打ちしない。CLAUDE.md §14-3-1）
- ask_repository の scope は **必ず `session`**（`generation` は禁止）
- ユーザの「あれ」「それ」「前のやつ」のような曖昧表現は Smith に問い合わせる前に必ず具体化を求める
