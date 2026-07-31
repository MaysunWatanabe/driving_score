#!/bin/bash
# PreToolUse hook for Edit/Write/MultiEdit:
#   1. spec/**/*.md / canonical_spec.json / SPEC_INDEX.md は常時 block (recast の責務)
#   2. BUILD mode 時、直近 assistant 出力に「## 実装前 spec 確認」が無ければ block
#   3. ASK/PROPOSE mode 時、コード/spec 以外への編集は warning のみで通す
#
# 入力: stdin に Claude Code から JSON
#   { "tool_name": "Edit"|"Write"|"MultiEdit",
#     "tool_input": { "file_path": "...", ... },
#     "transcript_path": "...", "session_id": "...", "cwd": "..." }
# 出力: exit 0 → 通す / exit 2 → block (stderr が理由)
set -e

STATE_DIR=".claude/state"
mkdir -p "$STATE_DIR"

CURRENT_MODE="ASK"
[ -s "$STATE_DIR/current_mode" ] && CURRENT_MODE=$(cat "$STATE_DIR/current_mode")

INPUT_JSON=$(cat)

# JSON フィールド抽出（jq があれば優先、無ければ grep フォールバック）
extract() {
  local key="$1"
  if command -v jq >/dev/null 2>&1; then
    echo "$INPUT_JSON" | jq -r "$key // empty"
  else
    # ごく簡易な fallback
    local pattern
    pattern=$(echo "$key" | sed 's/^\.//; s/\./"."/g')
    echo "$INPUT_JSON" | grep -oE "\"${pattern##*.}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
  fi
}

FILE_PATH=$(extract '.tool_input.file_path')
[ -z "$FILE_PATH" ] && FILE_PATH=$(extract '.tool_input.notebook_path')
TRANSCRIPT_PATH=$(extract '.transcript_path')

# ---- ガード 1: spec/* / canonical_spec.json / SPEC_INDEX.md は常時 block ----
case "$FILE_PATH" in
  */spec/*.md|spec/*.md|*spec/SPEC_INDEX.md|*canonical_spec.json)
    cat >&2 <<EOF
[PreToolUse:Edit/Write hook] BLOCK
ファイル '${FILE_PATH}' は spec / canonical の管理下にあり、
recast の責務のため Claude からの直接編集は禁止されています。

対処:
  - 仕様変更が必要なら /ask-mode → /propose-mode で propose_decision を投げる
  - Smith 側で synced されたら、recast (将来実装) が spec/*.md を再生成する
  - 当面は spec/*.md は古いまま運用し、最新は ask_repository から取得すること
EOF
    exit 2
    ;;
esac

# ---- ガード 2: BUILD mode の確認ブロック義務 ----
if [ "$CURRENT_MODE" = "BUILD" ]; then
  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    cat >&2 <<EOF
[PreToolUse:Edit/Write hook] BLOCK
transcript_path を取得できず確認ブロックの有無を判定できません。
安全側に block します。

対処:
  - hook の入力 JSON 仕様を確認してください (TRANSCRIPT_PATH='${TRANSCRIPT_PATH}')
EOF
    exit 2
  fi

  RECENT_BLOCK=$(tail -n 200 "$TRANSCRIPT_PATH" | grep -c '## 実装前 spec 確認' || true)
  if [ "$RECENT_BLOCK" -eq 0 ]; then
    cat >&2 <<EOF
[PreToolUse:Edit/Write hook] BLOCK
BUILD mode 中ですが、直近の assistant 出力に「## 実装前 spec 確認」ブロックが見つかりません。

対処:
  1. 以下の形式で確認ブロックを出力してから Edit/Write を呼び直す:

     ## 実装前 spec 確認

     | 判断項目 | ソース種別 | ID | 値 |
     |---|---|---|---|
     | <ノードパス.属性> | fact / proposal | <id> | <値> |
     ...

     未確定項目: なし | あり (→ /propose-mode に戻る)

  2. 全判断項目に fact_id または proposal_id を必ず記入
  3. 未確定項目があれば実装に進まず /propose-mode に戻る

詳細: .claude/commands/build-mode.md
EOF
    exit 2
  fi
  exit 0
fi

# ---- ガード 3: ASK/PROPOSE mode で「コードっぽい」拡張子に書こうとしたら警告 ----
case "$FILE_PATH" in
  *.kt|*.java|*.swift|*.ts|*.tsx|*.js|*.jsx|*.py|*.go|*.rs|*.rb|*.cpp|*.c|*.h|*.cs)
    cat >&2 <<EOF
[PreToolUse:Edit/Write hook] BLOCK
現在 mode: ${CURRENT_MODE}
コード変更を伴う Edit/Write は BUILD mode のみで許可されています。

対処:
  1. /build-mode で BUILD モードに切替
  2. 「## 実装前 spec 確認」ブロックを出力
  3. その後 Edit/Write を再試行

ファイル: ${FILE_PATH}
EOF
    exit 2
    ;;
esac

# ASK/PROPOSE mode で CLAUDE.md / .claude/* / scripts/* / README.md などを編集するのは許可
exit 0
