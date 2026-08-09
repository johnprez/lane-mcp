/**
 * Ask Lane interactive UI — Phase 1 "hello" app. Runs inside the sandboxed
 * MCP Apps iframe. It uses the ext-apps App client to complete the ui/initialize
 * handshake (required for the host to actually render the frame) and then shows
 * the workspaces the host pushes in from the lane_list_workspaces tool result.
 *
 * This file targets the browser (uses document/window) and is bundled to an
 * inlined HTML string by scripts/build-apps.mjs — it is excluded from the Node
 * typecheck on purpose.
 */
import { App } from "@modelcontextprotocol/ext-apps";

const dataEl = document.getElementById("data");
function show(text: string) {
  if (dataEl) dataEl.textContent = text;
}

type WorkspacesResult = {
  structuredContent?: { workspaces?: Array<{ name?: string; role?: string; active?: boolean }> };
};

function renderResult(result: unknown): void {
  const workspaces = (result as WorkspacesResult)?.structuredContent?.workspaces;
  if (!Array.isArray(workspaces)) return;
  const active = workspaces.find((w) => w.active);
  const count = `${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`;
  show(active ? `${count} · active: ${active.name}${active.role ? ` (${active.role})` : ""}.` : `${count}.`);
}

const app = new App({ name: "Lane Hello", version: "0.1.0" });
// If the host pushes the triggering tool's result, use it…
app.ontoolresult = (result: unknown) => renderResult(result);
app.onerror = (error: unknown) => console.error("[lane-hello]", error);

app
  .connect()
  .then(async () => {
    show("Connected to Lane. Reading your workspaces…");
    // …but the host doesn't reliably replay the initial result to a freshly
    // loaded app, so read it ourselves — this is the dependable pattern.
    try {
      const result = await app.callServerTool({ name: "lane_list_workspaces", arguments: {} });
      renderResult(result);
    } catch (error) {
      console.error("[lane-hello] read failed", error);
      show("Connected, but couldn't read your workspaces.");
    }
  })
  .catch((error: unknown) => {
    console.error("[lane-hello] connect failed", error);
  });
