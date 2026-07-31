#!/bin/bash
# SessionStart hook: 起動時に mode 状態を初期化する
set -e

STATE_DIR=".claude/state"
mkdir -p "$STATE_DIR"

# 既に mode が設定済みなら尊重、未設定なら ASK にリセット
if [ ! -s "$STATE_DIR/current_mode" ]; then
  echo "ASK" > "$STATE_DIR/current_mode"
  date -Iseconds > "$STATE_DIR/mode_changed_at"
fi

# 確認ブロック出力フラグもクリア
: > "$STATE_DIR/build_block_acknowledged"

# UserPromptSubmit hook が injection text を出すので、ここでは何も出力しない
exit 0
