/**
 * Ask Lane approval card. Rendered when the model calls `lane_apply_action`.
 * Shows the pending change with Apply / Cancel buttons; Apply re-invokes the tool
 * with preview:false via the ext-apps App client. The action to apply comes from
 * the tool INPUT (delivered to the app at render via ontoolinput) with the
 * preview RESULT as a secondary source for the human-readable description.
 *
 * Browser target — bundled to an inlined HTML string by scripts/build-apps.mjs
 * and excluded from the Node typecheck.
 */
import { App } from "@modelcontextprotocol/ext-apps";
import { badge, esc, wireTheme, applyInitialTheme } from "./shared.js";

const root = document.getElementById("root")!;

type LaneAction = { action?: string } & Record<string, unknown>;
let pendingAction: LaneAction | null = null;
let settled = false;

// Plumbing the reader doesn't need to eyeball on an approval card.
const HIDDEN_FIELDS = new Set([
  "action", "projectId", "entityId", "parentId", "workspaceId", "expectedVersion", "id", "version", "personId",
]);

function humanKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function fmtValue(value: unknown): string {
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  return s;
}

function fieldsHtml(action: LaneAction): string {
  const rows = Object.entries(action)
    .filter(([key, value]) => !HIDDEN_FIELDS.has(key) && value != null && typeof value !== "object")
    .map(([key, value]) => `<div class="row"><span class="k">${esc(humanKey(key))}</span><span class="v">${esc(fmtValue(value))}</span></div>`)
    .join("");
  return rows ? `<div class="fields">${rows}</div>` : "";
}

function renderLoading(): void {
  if (settled) return;
  root.innerHTML =
    '<div class="card">' + badge("Lane · Approval") +
    "<h1>Preparing change…</h1><p>Reading the change details from Lane…</p></div>";
}

function renderPending(describe?: string): void {
  if (settled || !pendingAction) return;
  const type = pendingAction.action ? String(pendingAction.action) : "Lane change";
  root.innerHTML =
    '<div class="card">' + badge("Lane · Approval") +
    "<h1>Apply this change?</h1>" +
    `<p>Lane will run <code class="chip">${esc(type)}</code>.</p>` +
    (describe ? `<p class="note">${esc(describe)}</p>` : "") +
    fieldsHtml(pendingAction) +
    '<div class="actions">' +
    '<button class="btn btn-primary" id="apply">Apply change</button>' +
    '<button class="btn btn-ghost" id="cancel">Cancel</button>' +
    "</div></div>";
  document.getElementById("apply")?.addEventListener("click", onApply);
  document.getElementById("cancel")?.addEventListener("click", onCancel);
}

function renderStatus(title: string, cls: "ok" | "err" | "", message: string): void {
  settled = true;
  root.innerHTML =
    '<div class="card">' + badge("Lane · Approval") +
    `<h1 class="${cls}">${esc(title)}</h1><p>${esc(message)}</p></div>`;
}

async function onApply(): Promise<void> {
  if (!pendingAction) return;
  const applyBtn = document.getElementById("apply") as HTMLButtonElement | null;
  const cancelBtn = document.getElementById("cancel") as HTMLButtonElement | null;
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }
  if (cancelBtn) cancelBtn.disabled = true;
  try {
    const result = await app.callServerTool({ name: "lane_apply_action", arguments: { action: pendingAction, preview: false } });
    const structured = (result as { structuredContent?: { applied?: boolean; message?: string } }).structuredContent;
    const isError = (result as { isError?: boolean }).isError;
    if (structured?.applied) {
      renderStatus("Applied ✓", "ok", structured.message ?? "Change applied.");
    } else {
      renderStatus("Not applied", "err", structured?.message ?? (isError ? "Lane rejected this change." : "Nothing was applied."));
    }
  } catch {
    renderStatus("Not applied", "err", "Couldn't reach Lane to apply this change.");
  }
}

function onCancel(): void {
  renderStatus("Cancelled", "", "No change was applied.");
}

const app = new App({ name: "Lane Approval", version: "0.1.0" });
wireTheme(app);

// Primary source: the tool arguments the host streams in at render time.
app.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
  const action = params?.arguments?.action;
  if (action && typeof action === "object") {
    pendingAction = action as LaneAction;
    renderPending();
  }
};

// Secondary: the preview result carries the human-readable description (and the
// full action, if the host didn't deliver tool input). If the model applied
// directly (preview:false), reflect the outcome.
app.ontoolresult = (result: unknown) => {
  const structured = (result as {
    structuredContent?: { applied?: boolean; message?: string; describe?: string };
  }).structuredContent;
  if (!structured) return;
  if (structured.applied) {
    renderStatus("Applied ✓", "ok", structured.message ?? "Change applied.");
    return;
  }
  // A preview result: the human description enriches the card, but the action to
  // apply comes from the tool input (ontoolinput), not this string-typed result.
  if (pendingAction) renderPending(structured.describe);
};

app.onerror = (error: unknown) => console.error("[lane-approval]", error);

renderLoading();
app
  .connect()
  .then(() => {
    applyInitialTheme(app);
    if (!pendingAction && !settled) renderLoading();
    // Fallback so the card never sits silently if the host delivered neither
    // tool input nor result to this freshly-loaded app.
    window.setTimeout(() => {
      if (!pendingAction && !settled) {
        root.innerHTML =
          '<div class="card">' + badge("Lane · Approval") +
          "<h1>Waiting for change details</h1><p>Lane didn't hand this view the change to review. Ask Lane to prepare the change again.</p></div>";
      }
    }, 2500);
  })
  .catch((error: unknown) => console.error("[lane-approval] connect failed", error));
