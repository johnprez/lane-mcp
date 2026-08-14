#!/usr/bin/env bash
# Refresh the vendored Lane files (src/lane/*) from a local checkout of the app
# repo (github.com/johnprez/e-lane). These four files are the ONE source of
# truth in the app; this repo keeps standalone copies so it can build without
# the app. Re-run this whenever the app's read logic or action contracts change.
#
# Usage:  ./scripts/sync.sh /path/to/e-lane
set -euo pipefail

APP="${1:-}"
[ -n "$APP" ] && [ -d "$APP/src/lib/ai" ] || { echo "Usage: ./scripts/sync.sh /path/to/e-lane"; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANE="$HERE/src/lane"

cp "$APP/eve-pilot/action-contracts.ts"         "$LANE/action-contracts.ts"           # zod-only, verbatim
cp "$APP/eve-pilot/project-action-contracts.ts" "$LANE/project-action-contracts.ts"   # project CRUD + export schemas
cp "$APP/src/lib/ai/lane-context.ts"            "$LANE/lane-context.ts"
cp "$APP/src/lib/mcp/workspaces.ts"             "$LANE/workspaces.ts"
cp "$APP/src/lib/mcp/format.ts"                 "$LANE/format.ts"
cp "$APP/src/lib/supabase/database.types.ts"    "$LANE/database.types.ts"              # type-only; stripped at build

# Only rewrite import PATHS so the group is self-contained — no logic/type surgery.
sed -i '' 's#\.\./supabase/database\.types#./database.types#' "$LANE/lane-context.ts"
sed -i '' 's#@/lib/ai/lane-context#./lane-context#g' "$LANE/workspaces.ts"
sed -i '' 's#@/lib/ai/lane-context#./lane-context#g; s#@/lib/mcp/workspaces#./workspaces#g' "$LANE/format.ts"

echo "✓ Synced src/lane/ from $APP"
echo "  Review the diff, then: npm run typecheck && npm run build"
