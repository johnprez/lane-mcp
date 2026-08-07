import type { LaneContext } from "./lane-context";
import type { LaneWorkspace } from "./workspaces";

/**
 * Every MCP tool returns two representations so both Claude Desktop surfaces are
 * well served:
 *   - a compact **markdown** summary → renders cleanly in the chat transcript;
 *   - the full **structured JSON** (as `structuredContent` and an embedded
 *     resource) → the data Claude reaches for when the user asks to build a
 *     table, timeline, or other visual artifact.
 * Dumping the raw graph into chat would be unreadable; hiding it would block
 * artifacts. Returning both keeps chat legible and artifacts one request away.
 */

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function count(rows: unknown): number {
  return Array.isArray(rows) ? rows.length : 0;
}

/** Short, chat-friendly briefing of the plan graph. */
export function summarizeContextMarkdown(ctx: LaneContext): string {
  if (!ctx.projects.length) {
    return "**Lane context** — no projects are visible for this user in the current scope.";
  }
  const lines: string[] = [];
  const scope = ctx.projects.length === 1 ? "1 project" : `${ctx.projects.length} projects`;
  lines.push(`**Lane context** — ${scope} · ${count(ctx.milestones)} milestones · ${count(ctx.activities)} activities · ${count(ctx.people)} people`);
  lines.push("");
  for (const project of ctx.projects.slice(0, 25)) {
    const id = str(project.id);
    const projectMilestones = ctx.milestones.filter((m) => str(m.project_id) === id);
    const projectActivities = ctx.activities.filter((a) => str(a.project_id) === id);
    const health = str(project.health);
    const status = str(project.status);
    const meta = [status, health].filter(Boolean).join(" · ");
    lines.push(`### ${str(project.name) || "(untitled project)"}${meta ? ` — ${meta}` : ""}`);
    lines.push(`\`${id}\` · ${projectMilestones.length} milestones · ${projectActivities.length} activities`);
    if (projectMilestones.length) {
      lines.push("");
      lines.push("| Milestone | Status | Target |");
      lines.push("| --- | --- | --- |");
      for (const milestone of projectMilestones.slice(0, 8)) {
        lines.push(`| ${str(milestone.title) || "—"} | ${str(milestone.status) || "—"} | ${str(milestone.target_date) || "—"} |`);
      }
      if (projectMilestones.length > 8) lines.push(`| …and ${projectMilestones.length - 8} more | | |`);
    }
    lines.push("");
  }
  lines.push("_Full structured plan graph is attached below for building tables or visual artifacts._");
  return lines.join("\n");
}

/** Chat-friendly workspace picker. */
export function workspacesMarkdown(workspaces: LaneWorkspace[]): string {
  if (!workspaces.length) return "You are not a member of any Lane workspace yet.";
  const lines = ["**Your Lane workspaces**", "", "| Workspace | Role | Active | ID |", "| --- | --- | :---: | --- |"];
  for (const workspace of workspaces) {
    lines.push(`| ${workspace.name} | ${workspace.role} | ${workspace.active ? "✓" : ""} | \`${workspace.id}\` |`);
  }
  return lines.join("\n");
}

/**
 * A human-readable, one-line-per-field description of a proposed or applied
 * action — used both for `preview` (what *would* change) and for confirming
 * what *did* change. Renders the discriminated-union payload without dumping
 * raw JSON into chat.
 */
export function describeAction(action: Record<string, unknown>): string {
  const kind = str(action.action) || "(unknown action)";
  const skip = new Set(["action"]);
  const fields = Object.entries(action)
    .filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0) && value !== "")
    .map(([key, value]) => `- **${key}**: ${Array.isArray(value) ? value.map(str).join(", ") : str(value)}`);
  return [`\`${kind}\``, ...fields].join("\n");
}
