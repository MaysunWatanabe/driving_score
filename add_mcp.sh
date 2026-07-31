#!/bin/bash
#
# Claude Code に ProjectSmith の MCP を登録する。
#
# 接続先とトークンは環境変数で切り替える。未設定ならローカル（従来どおり）。
#
#   ローカル（self-host / 開発）:
#     export MCP_API_KEY=<サーバ共通の静的キー>
#     bash add_mcp.sh
#
#   ホスティング:
#     export PROJECTSMITH_API_URL=https://smith.example.com
#     export PROJECTSMITH_MCP_TOKEN=psm_xxxxx   # /settings/tokens で発行した自分のトークン
#     bash add_mcp.sh
#
#   ※ ホスティングでは静的キー（MCP_API_KEY）が無効化されていることがある
#     （ALLOW_STATIC_MCP_KEY=0）。その場合は PROJECTSMITH_MCP_TOKEN を使う。
set -e

API_URL="${PROJECTSMITH_API_URL:-http://localhost:10083}"
API_URL="${API_URL%/}"                                    # 末尾スラッシュを落とす
TOKEN="${PROJECTSMITH_MCP_TOKEN:-${MCP_API_KEY:-}}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: トークンが設定されていません。" >&2
  echo "  ホスティング: PROJECTSMITH_MCP_TOKEN（${API_URL}/settings/tokens で発行）" >&2
  echo "  ローカル    : MCP_API_KEY" >&2
  exit 1
fi

claude mcp add playwright -- npx -y @playwright/mcp@latest || true
claude mcp add maestro -- maestro mcp || true
# scope は **local**（= ~/.claude.json に保存。リポジトリには何も書かれない）。
# `--scope project` はリポジトリ直下に .mcp.json を作り、そこへ **トークンを平文で書く**。
# .mcp.json は .gitignore に入っていないため、`git add -A` でそのまま commit / push され
# 個人トークンが GitHub に載る。トークンは個人のものでチームで共有するものでもないので
# local が正しい。共有したい場合は値ではなく `${PROJECTSMITH_MCP_TOKEN}` 参照を書いた
# .mcp.json をリポジトリに置くこと（Claude Code が環境変数を展開する）。
# **先に消してから登録する。**
# `claude mcp add` は同名が既にあると "already exists" で拒否し（exit 1）、
# **古い設定をそのまま残す**。トークンを再発行しても古い（失効した）トークンが
# 使われ続け、Smith 側には 401 が並ぶ状態になる。`|| true` だとそれに気づけない。
claude mcp remove projectsmith --scope local >/dev/null 2>&1 || true
claude mcp add --transport http projectsmith "${API_URL}/mcp" \
  -H "Authorization: Bearer ${TOKEN}" --scope local || true

echo "MCP 登録先: ${API_URL}/mcp"

# 過去に --scope project で登録していた場合の後始末。平文トークンが残っていたら知らせる。
if [ -f .mcp.json ] && grep -q 'Bearer [A-Za-z0-9_-]\{16,\}' .mcp.json 2>/dev/null; then
  echo "警告: .mcp.json にトークンが平文で入っています。commit しないでください。" >&2
  echo "  local scope に登録済みなので、このファイルは削除して構いません: rm .mcp.json" >&2
  git check-ignore -q .mcp.json 2>/dev/null || \
    echo "  （.mcp.json は .gitignore にも入っていません）" >&2
fi

# 疎通確認（失敗しても登録自体は残すので警告のみ）
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${API_URL}/mcp" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' 2>/dev/null || echo "000")
case "$code" in
  200) echo "疎通確認: OK" ;;
  401) echo "警告: 認証に失敗しました (401)。トークンを確認してください。" >&2 ;;
  000) echo "警告: ${API_URL} に到達できません。URL を確認してください。" >&2 ;;
  *)   echo "警告: 予期しない応答 (HTTP ${code})" >&2 ;;
esac

exit 0
