#!/bin/bash

#-----------------------------------------
# Unique tmux session launcher for Claude Code
#-----------------------------------------

# プロジェクトルート（必要に応じて変更）
PROJECT_DIR="${1:-$(pwd)}"

# リポジトリ名を取得（GitHub CLI → git remote URL → 親ディレクトリの順にフォールバック）
REPO_NAME=$(gh repo view --json name -q '.name' 2>/dev/null)
if [ -z "$REPO_NAME" ]; then
  REPO_NAME=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null \
    | sed 's/.*[:/]\([^/]*\)\.git$/\1/' \
    | sed 's/.*[:/]\([^/]*\)$/\1/')
fi
if [ -z "$REPO_NAME" ]; then
  REPO_NAME=$(basename "$PROJECT_DIR")
fi

SESSION_NAME="smith_${REPO_NAME}"

echo "Starting tmux session: $SESSION_NAME"

# 既に同名セッションが存在しないか確認（理論上重複しないが保険）
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session already exists. Aborting."
  exit 1
fi

# tmux セッション作成
tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"

# 外部スクリプトで Playwright MCP を追加
tmux send-keys -t "$SESSION_NAME" "nohup bash $PROJECT_DIR/add_mcp.sh &" C-m

# Claude 起動コマンドを送信
# CLAUDE.md はプロジェクト直下にあると自動読込される
tmux send-keys -t "$SESSION_NAME" \
  "echo 'Loading CLAUDE.md and preparing environment...'" C-m

# Issues 取得（GitHub CLI が必要）
tmux send-keys -t "$SESSION_NAME" \
  "echo 'Fetching GitHub Issues…'; gh issue list" C-m

# Claude Code を起動
tmux send-keys -t "$SESSION_NAME" "claude --teammate-mode tmux" C-m
#tmux send-keys -t "$SESSION_NAME" "claude --dangerously-skip-permissions  --teammate-mode tmux" C-m


# セッションへアタッチ
tmux attach -t "$SESSION_NAME"
