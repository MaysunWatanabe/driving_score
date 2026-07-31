#!/bin/bash

#echo "Adding Playwright MCP server..."
#claude mcp add playwright -- npx -y @playwright/mcp@latest
#
#claude mcp add maestro -- maestro mcp
#
#claude mcp add --transport http projectsmith http://localhost:10083/mcp -H "Authorization: Bearer \${MCP_API_KEY}" --scope project #> /dev/null  
#
##!/bin/bash
set -e

claude mcp add playwright -- npx -y @playwright/mcp@latest || true
claude mcp add maestro -- maestro mcp || true
claude mcp add --transport http projectsmith http://localhost:10083/mcp \
  -H "Authorization: Bearer ${MCP_API_KEY}" --scope project || true

exit 0

