#!/bin/bash
# .githooks/ を git の hooks パスとして登録する。
# 各開発者が clone 後に 1 回だけ実行する想定。
set -e

cd "$(dirname "$0")/.."

if [ ! -d .githooks ]; then
  echo "ERROR: .githooks/ ディレクトリがありません。リポジトリのルートで実行してください。" >&2
  exit 1
fi

# 実行権限を付与
chmod +x .githooks/* 2>/dev/null || true

# git に hooks パスを通知
git config core.hooksPath .githooks

echo "[install-githooks] core.hooksPath = .githooks"
echo "[install-githooks] 以下の hook が有効になりました:"
ls -la .githooks/ | grep -v '^total\|^d' | awk '{print "  - " $NF}'
echo ""
echo "確認: git config --get core.hooksPath"
git config --get core.hooksPath
