import type { LaneContext } from "./lane-context";
import type { LaneWorkspace } from "./workspaces";
import { formatMoney, formatPercent } from "./format-money";
import { buildProjectBudget, type BudgetBucketRow, type BudgetItemRow } from "./budget-model";

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

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * The budget block. Rolled up through the SAME buildProjectBudget the Budget tab
 * uses, so an agent's figures and the UI's can never disagree — in particular a
 * recurring cost's planned amount is expanded per occurrence here too, and a cost
 * with no recorded actual counts as 0 while being reported as incomplete.
 *
 * Read-only: there are no budget verbs in lane_apply_action in v1.
 */
function budgetMarkdown(ctx: LaneContext, projectId: string, projectDates: { startsOn: string | null; dueOn: string | null }): string[] {
  const source = ctx.budget;
  if (!source) return [];
  const totalRow = source.total && str(source.total.project_id) === projectId ? source.total : null;
  const buckets = source.categories.filter((row) => str(row.project_id) === projectId);
  const costs = source.costs.filter((row) => str(row.project_id) === projectId);
  if (!totalRow && buckets.length === 0 && costs.length === 0) return [];

  const budget = buildProjectBudget({
    project: { id: projectId, startsOn: projectDates.startsOn, dueOn: projectDates.dueOn },
    budget: totalRow
      ? {
          id: str(totalRow.id),
          total_amount_cents: num(totalRow.total_amount_cents),
          notes: str(totalRow.notes),
          version: num(totalRow.version),
        }
      : null,
    buckets: buckets.map((row) => ({
      id: str(row.id),
      name: str(row.name),
      color: "#5368f4",
      allocated_amount_cents: num(row.allocated_amount_cents),
      notes: str(row.notes),
      sort_key: str(row.sort_key) || "m",
      version: num(row.version),
    })) as BudgetBucketRow[],
    items: costs.map((row) => ({
      id: str(row.id),
      bucket_id: str(row.bucket_id),
      name: str(row.name),
      vendor: str(row.vendor),
      notes: "",
      planned_amount_cents: num(row.planned_amount_cents),
      actual_amount_cents: row.actual_amount_cents == null ? null : num(row.actual_amount_cents),
      cadence: (str(row.cadence) || "one_time") as BudgetItemRow["cadence"],
      incurred_on: row.incurred_on == null ? null : str(row.incurred_on),
      recurrence_start_on: row.recurrence_start_on == null ? null : str(row.recurrence_start_on),
      recurrence_end_on: row.recurrence_end_on == null ? null : str(row.recurrence_end_on),
      occurrence_count: row.occurrence_count == null ? null : num(row.occurrence_count),
      sort_key: str(row.sort_key) || "m",
      version: num(row.version),
    })) as BudgetItemRow[],
  });

  const lines: string[] = [""];
  const flags = [
    budget.warnings.includes("over_allocated") ? "over-allocated" : null,
    budget.warnings.includes("over_budget") ? "over budget" : null,
    budget.warnings.includes("unbounded_recurring") ? "some recurring costs can't expand without dates" : null,
  ].filter(Boolean).join(" · ");
  lines.push(
    `**Budget** — ${formatMoney(budget.totalCents)} budgeted · ${formatMoney(budget.allocatedCents)} allocated · ` +
    `${formatMoney(budget.plannedCents)} planned · ${formatMoney(budget.actualCents)} actual · ` +
    `${formatMoney(budget.remainingCents)} remaining (${formatPercent(budget.utilizationPercent)} used)` +
    (flags ? ` · ⚠ ${flags}` : ""),
  );
  if (budget.itemsMissingActual > 0) {
    lines.push(`Actuals are incomplete: ${budget.itemCount - budget.itemsMissingActual} of ${budget.itemCount} costs have a recorded actual.`);
  }
  if (budget.buckets.length) {
    lines.push("");
    lines.push("| Category | Allocated | Planned | Actual | Used |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const bucket of budget.buckets.slice(0, 12)) {
      lines.push(
        `| ${bucket.name}${bucket.isOverBudget ? " ⚠" : ""} | ${formatMoney(bucket.allocatedCents)} | ` +
        `${formatMoney(bucket.plannedCents)} | ${formatMoney(bucket.actualCents)} | ${formatPercent(bucket.utilizationPercent)} |`,
      );
    }
    if (budget.buckets.length > 12) lines.push(`| …and ${budget.buckets.length - 12} more | | | | |`);
  }
  return lines;
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

  // Deterministic "what needs attention" read — same truth the Now page leads
  // with, so a status answer needs no AI briefing.
  const { summary, attention } = ctx.insights;
  if (summary.needAttention === 0) {
    lines.push("**Needs attention** — every project is clear right now (no at-risk/off-track health, blocked work, or slipped milestones).");
  } else {
    lines.push(`**Needs attention** — ${summary.needAttention} of ${summary.activeProjects} project${summary.activeProjects === 1 ? "" : "s"}: ${summary.offTrack} off-track · ${summary.atRisk} at-risk · ${summary.blockedItems} blocked item${summary.blockedItems === 1 ? "" : "s"} · ${summary.slippedMilestones} slipped milestone${summary.slippedMilestones === 1 ? "" : "s"}.`);
    for (const item of attention.slice(0, 8)) {
      const reasons = [
        item.blockedItems > 0 ? `${item.blockedItems} blocked` : null,
        item.milestoneNeedsAttention && item.nextMilestone ? `“${item.nextMilestone}” needs review` : null,
        item.health === "off_track" || item.health === "at_risk" ? item.health.replace("_", "-") : null,
      ].filter(Boolean).join(" · ");
      lines.push(`- **${item.projectName}** — ${reasons || "needs a look"}`);
    }
  }
  lines.push("");

  for (const project of ctx.projects.slice(0, 25)) {
    const id = str(project.id);
    const projectMilestones = ctx.milestones.filter((m) => str(m.project_id) === id);
    const projectActivities = ctx.activities.filter((a) => str(a.project_id) === id);
    const health = str(project.health);
    const status = str(project.status);
    const meta = [status, health].filter(Boolean).join(" · ");
    const access = str(project.access);
    const accessLabel = access === "view" ? "view-only (read only)" : access === "admin" ? "full access" : "editable";
    lines.push(`### ${str(project.name) || "(untitled project)"}${meta ? ` — ${meta}` : ""}`);
    lines.push(`\`${id}\` · ${accessLabel} · ${projectMilestones.length} milestones · ${projectActivities.length} activities`);
    if (projectMilestones.length) {
      lines.push("");
      lines.push("| Milestone | Status | Target |");
      lines.push("| --- | --- | --- |");
      for (const milestone of projectMilestones.slice(0, 8)) {
        lines.push(`| ${str(milestone.title) || "—"} | ${str(milestone.status) || "—"} | ${str(milestone.target_date) || "—"} |`);
      }
      if (projectMilestones.length > 8) lines.push(`| …and ${projectMilestones.length - 8} more | | |`);
    }
    lines.push(...budgetMarkdown(ctx, id, {
      startsOn: typeof project.starts_on === "string" ? project.starts_on : null,
      dueOn: typeof project.due_on === "string" ? project.due_on : null,
    }));
    lines.push("");
  }
  lines.push("_Full structured plan graph is attached below for building tables or visual artifacts._");
  return lines.join("\n");
}

/** Chat-friendly workspace picker. */
export function workspacesMarkdown(workspaces: LaneWorkspace[]): string {
  if (!workspaces.length) return "You are not a member of any Lane workspace yet.";
  const lines = ["**Your Lane workspaces**", "", "| Workspace | Role | Projects | Active | ID |", "| --- | --- | --- | :---: | --- |"];
  for (const workspace of workspaces) {
    const projects = workspace.access === "all" ? "all" : "specific (see context)";
    lines.push(`| ${workspace.name} | ${workspace.role} | ${projects} | ${workspace.active ? "✓" : ""} | \`${workspace.id}\` |`);
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
  // Bulk activity update: render the count + the field changes, not the raw id
  // list and a `[object Object]` set.
  if (kind === "activity.bulkUpdate") {
    const count = Array.isArray(action.activityIds) ? action.activityIds.length : 0;
    const set = action.set && typeof action.set === "object" ? action.set as Record<string, unknown> : {};
    const changes = Object.entries(set)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `- **${key}** → ${value === null ? "cleared" : str(value)}`);
    return [`\`activity.bulkUpdate\``, `- **activities**: ${count}`, ...changes].join("\n");
  }
  // Bulk task import: render the row count + how activities are resolved, not a
  // huge nested `tasks` array.
  if (kind === "task.bulkCreate") {
    const tasks = Array.isArray(action.tasks) ? action.tasks as Array<Record<string, unknown>> : [];
    const named = tasks.filter((task) => !task.activityId && str(task.activityName)).length;
    const lines = [`\`task.bulkCreate\``, `- **tasks**: ${tasks.length}`];
    if (named > 0) lines.push(`- **matched by name**: ${named}`);
    if (action.createMissingActivities) lines.push(`- **create missing activities**: yes${action.laneId ? ` (lane ${str(action.laneId)})` : ""}`);
    return lines.join("\n");
  }
  // Bulk connect: render the edge count, not the full predecessor/successor list.
  if (kind === "dependency.bulkCreate") {
    const edges = Array.isArray(action.edges) ? action.edges as Array<Record<string, unknown>> : [];
    const lagged = edges.filter((edge) => Number(edge.lagDays) !== 0).length;
    const lines = [`\`dependency.bulkCreate\``, `- **connections**: ${edges.length}`];
    if (lagged > 0) lines.push(`- **with lag**: ${lagged}`);
    return lines.join("\n");
  }
  const skip = new Set(["action"]);
  const fields = Object.entries(action)
    .filter(([key, value]) => !skip.has(key) && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0) && value !== "")
    .map(([key, value]) => `- **${key}**: ${Array.isArray(value) ? value.map(str).join(", ") : str(value)}`);
  return [`\`${kind}\``, ...fields].join("\n");
}

// Journey + knowledge formatters live in an import-free module so the local
// MCP server can vendor them verbatim; re-exported here for one import site.
export * from "./journey-format";
