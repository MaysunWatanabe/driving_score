---
description: PROPOSE モードに切替。propose_decision を Smith へ送付し裁定を待つフェーズ
---

[PROPOSE モード起動]

`.claude/state/current_mode` を `PROPOSE` に更新します。Bash で以下を実行:

```bash
echo PROPOSE > .claude/state/current_mode && date -Iseconds > .claude/state/mode_changed_at
```

## PROPOSE モードの責務

このモードでは **コードを書かない**。ユーザと合意した内容を Smith に審査可能な形式で提出し、結果を待ちます。

### 必ずやること

1. **propose_text に具体パラメータを埋める** — 数値・列挙値・適用ノードパスを必ず含める
2. **applies_to に正確な node_id を列挙** — ASK モードで取得した node_id を使う
3. **context に経緯を添える** — ユーザ意図 / 現状仕様 / 採用根拠を構造化
4. **propose_decision を MCP で送付** — `propose_decision(repository_id, session_id, proposal_text, applies_to, context)`
5. **応答を分岐**:
   - `status='decided' / 'synced'`: 自動承認 → ユーザに「Smith 承認 (#N synced)」と報告 → `/build-mode` 候補
   - `status='escalated'`: 人間裁定要 → ユーザに「proposal #N がブラウザに上がった、裁定後に合図ください」
6. **proposal_id を必ず記録** — escalated の場合は会話に明記、後の `list_pending_decisions` で参照

### 絶対にやらないこと

- ❌ 「具体値は後で aq1〜aqN で決める」のような placeholder propose（auditor が reject する想定）
- ❌ propose_text を曖昧な要約だけで済ませる（実装可能な粒度まで具体化）
- ❌ propose_decision の応答を待たずに次の作業へ進む
- ❌ escalated proposal を放置したまま BUILD に進む

### propose_text のテンプレート

```
<対象 node>.<属性> = <具体値>
（理由: ユーザ要望「<原文要約>」+ 既存 fact #<id> との整合）
適用範囲: <影響するノードリスト>
非適用範囲: <あえて含めないものリスト>
```

良い例:
```
ui.session.map.screen.wheel_picker.item.scale = {center:1.5, mid:1.1, edge:0.7}
ui.session.map.screen.wheel_picker.item.alpha = {center:1.0, mid:0.85, edge:0.5}
（理由: ユーザ要望「3 段階階段スケール」/ 既存 fact #2257 で center=1.5 確定済との整合）
```

悪い例:
```
wheel_picker をいい感じに 3 段階化する
（具体値は実装時に決める）
```

### ユーザからの「合図」を聞き逃さない

PROPOSE 中に escalated になった場合、ユーザがブラウザで裁定するまで待ちます。
以下の合図を受けたら **真っ先に `list_pending_decisions(repository_id=<this_repo>)` を叩く**:

- 「回答しました」「回答済み」「決まった?」「確認して」「進めて」
- 「結論は?」「OK だよ」「承認した」「これで」

`ready_to_implement=true` を確認したら → `get_proposal(proposal_id=N)` で `implementation_instruction` を取得 → ユーザに報告 → `/build-mode` 切替を提案

### 次に進む条件

- 全 proposal が synced/decided になり、未裁定がゼロ → `/build-mode` に切替
- まだ追加で詰める判断点がある → `/ask-mode` に戻る
- 提案が reject された → `/ask-mode` に戻り再ヒアリング
