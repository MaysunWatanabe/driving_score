#!/bin/bash
# UserPromptSubmit hook: 毎ターン、現 mode と直近合意状態を context に注入する
# 標準入力に Claude Code から JSON が来る（user_prompt 等を含む）。今は読まずに無視。
set -e

STATE_DIR=".claude/state"
mkdir -p "$STATE_DIR"

CURRENT_MODE="ASK"
[ -s "$STATE_DIR/current_mode" ] && CURRENT_MODE=$(cat "$STATE_DIR/current_mode")

MODE_CHANGED_AT="(unknown)"
[ -s "$STATE_DIR/mode_changed_at" ] && MODE_CHANGED_AT=$(cat "$STATE_DIR/mode_changed_at")

NOW_ISO=$(date -Iseconds)

# ランダムにルールを 1 つ pick して reminder に含める（CLAUDE.md 希釈対策）
RULES=(
  "❌ 会話履歴・記憶を仕様の根拠にしてはいけない。必ず ask_repository で再確認すること。"
  "❌ ローカルの spec/*.md は recast 前のため古い可能性あり。最新 fact は Smith から取得すること。"
  "❌ 既存コードを「実装は仕様」と見なしてはいけない。仕様は fact / proposal のみ。"
  "❌ 「普通こうする」「自明」「小さな変更」は ask スキップの理由にならない。"
  "❌ commit message に proposal #N または fact #N を含めること。commit-msg hook で必須化されている。"
  "✅ propose_decision の応答が escalated なら、ユーザの「合図」を聞き list_pending_decisions を叩くこと。"
  "✅ BUILD mode で Edit/Write を呼ぶ前に、必ず「## 実装前 spec 確認」ブロックを出力すること。"
  "✅ ask_repository の scope は必ず 'session'。'generation' は禁止。"
  "✅ spec/*.md は BUILD mode で編集してはいけない（recast の責務）。"
)
RANDOM_RULE="${RULES[$RANDOM % ${#RULES[@]}]}"

cat <<EOF
---
[ProjectSmith mode tracker]
- 現在 mode: **${CURRENT_MODE}**  (切替: ${MODE_CHANGED_AT})
- 現在時刻: ${NOW_ISO}

mode 切替コマンド: \`/ask-mode\` / \`/propose-mode\` / \`/build-mode\`

[今回のリマインダー]
${RANDOM_RULE}

[判定ガイド]
- ユーザが新しい要望 → /ask-mode
- ユーザが具体値・選択肢を確定 → /propose-mode
- propose が synced/decided かつ未確定なし → /build-mode
- 「回答した」「裁定済み」等の合図 → 真っ先に list_pending_decisions
---
EOF

exit 0
