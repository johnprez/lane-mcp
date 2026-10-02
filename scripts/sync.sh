#!/usr/bin/env bash
# Refresh the vendored Lane files (src/lane/*) from a local checkout of the app
# repo (github.com/johnprez/e-lane). These files are the ONE source of
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
cp "$APP/src/lib/mcp/journey-format.ts"         "$LANE/journey-format.ts"             # re-exported by format.ts; no imports
# format.ts renders budgets: vendor its money + budget helpers too.
cp "$APP/src/lib/format-money.ts"               "$LANE/format-money.ts"
cp "$APP/src/lib/planner/budget-model.ts"       "$LANE/budget-model.ts"
cp "$APP/src/lib/budget/expand.ts"              "$LANE/budget-expand.ts"
cp "$APP/src/lib/supabase/database.types.ts"    "$LANE/database.types.ts"              # type-only; stripped at build
# Journeys + knowledge (proxied to /api/mcp/{journey,kg,apply-journey,ingest}).
# All zod-only, so they copy verbatim with no path rewrites. (Markdown for these
# tools is rendered by the hosted endpoint and returned as `text`.)
cp "$APP/eve-pilot/journey-contracts.ts"        "$LANE/journey-contracts.ts"          # proposal item whitelist
cp "$APP/eve-pilot/journey-action-contracts.ts" "$LANE/journey-action-contracts.ts"   # MCP write/read + tool-input schemas
cp "$APP/eve-pilot/kg-contracts.ts"             "$LANE/kg-contracts.ts"               # KgContextBundle (cited, untrusted)
cp "$APP/eve-pilot/view-contracts.ts"           "$LANE/view-contracts.ts"             # lane_render_view's view list

# Only rewrite import PATHS so the group is self-contained — no logic/type surgery.
sed -i '' 's#\.\./supabase/database\.types#./database.types#' "$LANE/lane-context.ts"
sed -i '' 's#@/lib/ai/lane-context#./lane-context#g' "$LANE/workspaces.ts"
sed -i '' 's#@/lib/ai/lane-context#./lane-context#g; s#@/lib/mcp/workspaces#./workspaces#g; s#@/lib/format-money#./format-money#g; s#@/lib/planner/budget-model#./budget-model#g' "$LANE/format.ts"
sed -i '' 's#@/lib/budget/expand#./budget-expand#g' "$LANE/budget-model.ts"
sed -i '' 's#@/lib/format-money#./format-money#g' "$LANE/budget-expand.ts"
# Fail loudly if anything still points into the app (a new import upstream).
if grep -n '"@/' "$LANE"/*.ts; then echo "✗ Unrewritten @/ imports above — vendor or rewrite them in sync.sh"; exit 1; fi

echo "✓ Synced src/lane/ from $APP"
echo "  Review the diff, then: npm run typecheck && npm run build"
