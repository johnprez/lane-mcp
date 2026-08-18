import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getLaneContext } from "./lane/lane-context.js";
import { listLaneWorkspaces } from "./lane/workspaces.js";
import { describeAction, summarizeContextMarkdown, workspacesMarkdown } from "./lane/format.js";
import { LaneAgentActionSchema } from "./lane/action-contracts.js";
import { LaneProjectActionSchema } from "./lane/project-action-contracts.js";
import type { LaneSession } from "./session.js";
import { WORKSPACES_APP_HTML } from "./generated/workspaces-app.js";
import { APPROVAL_APP_HTML } from "./generated/approval-app.js";
import { DASHBOARD_APP_HTML } from "./generated/dashboard-app.js";
import { FORM_APP_HTML } from "./generated/form-app.js";
import { ACTIVITY_APP_HTML } from "./generated/activity-app.js";
import { ENTITY_APP_HTML } from "./generated/entity-app.js";
import { DEPS_APP_HTML } from "./generated/deps-app.js";
import { TASKS_APP_HTML } from "./generated/tasks-app.js";
import { VIEW_APP_HTML } from "./generated/view-app.js";
import { SUGGEST_APP_HTML } from "./generated/suggest-app.js";

/**
 * Registers Lane's three tools on a stdio MCP server. Auth comes from the local
 * PAT-backed session: reads use a session-minted JWT straight against Supabase;
 * writes are POSTed to Lane's hosted, HMAC-signed write endpoint.
 */
function jsonResource(uri: string, name: string, value: unknown) {
  return {
    type: "resource" as const,
    resource: { uri, name, mimeType: "application/json", text: JSON.stringify(value, null, 2) },
  };
}

// Ask Lane interactive UI (MCP Apps). Each `ui://lane/*` resource is an
// esbuild-bundled iframe app (src/app-src/* + scripts/build-apps.mjs); a tool
// opts in by pointing `_meta.ui.resourceUri` at one. Hosts that support MCP Apps
// render the iframe; others ignore it and fall back to text + structuredContent.
const APP_MIME = "text/html;profile=mcp-app";
const WORKSPACES_APP_URI = "ui://lane/workspaces";
const APPROVAL_APP_URI = "ui://lane/approval";
const DASHBOARD_APP_URI = "ui://lane/dashboard";
const FORM_APP_URI = "ui://lane/form";
const ACTIVITY_APP_URI = "ui://lane/activity";
const ENTITY_APP_URI = "ui://lane/record";
const DEPS_APP_URI = "ui://lane/dependencies";
const TASKS_APP_URI = "ui://lane/tasks";
const VIEW_APP_URI = "ui://lane/view";
const SUGGEST_APP_URI = "ui://lane/suggest";

export function registerLaneTools(server: McpServer, session: LaneSession): void {
  server.registerResource(
    "lane-workspaces-app",
    WORKSPACES_APP_URI,
    { title: "Ask Lane workspaces", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: WORKSPACES_APP_HTML }] }),
  );
  // Approval card for lane_apply_action: shows the pending change with
  // Apply / Cancel; Apply re-invokes the tool with preview:false from the iframe.
  server.registerResource(
    "lane-approval-app",
    APPROVAL_APP_URI,
    { title: "Ask Lane approval card", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: APPROVAL_APP_HTML }] }),
  );
  // Plan overview dashboard for lane_get_context: needs-attention tiles + upcoming
  // milestone timeline (read-only).
  server.registerResource(
    "lane-dashboard-app",
    DASHBOARD_APP_URI,
    { title: "Ask Lane plan overview", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: DASHBOARD_APP_HTML }] }),
  );
  // Create form: the user fills fields (incl. assignees) and the form applies the
  // resulting lane_apply_action itself.
  server.registerResource(
    "lane-form-app",
    FORM_APP_URI,
    { title: "Ask Lane create form", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: FORM_APP_HTML }] }),
  );
  // Full activity editor (Details / Tasks / Notes / Links), create + edit.
  server.registerResource(
    "lane-activity-app",
    ACTIVITY_APP_URI,
    { title: "Ask Lane activity editor", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: ACTIVITY_APP_HTML }] }),
  );
  // Record editor: milestones, phases, deliverables, time off, people, roles, groups.
  server.registerResource(
    "lane-record-app",
    ENTITY_APP_URI,
    { title: "Ask Lane record editor", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: ENTITY_APP_HTML }] }),
  );
  // Dependencies card: list / add / remove activity dependencies.
  server.registerResource(
    "lane-deps-app",
    DEPS_APP_URI,
    { title: "Ask Lane dependencies", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: DEPS_APP_HTML }] }),
  );
  // Tasks board: activities grouped by lane with progress, owner avatars, and
  // their checklist tasks — read-only, with tap-through to the editors.
  server.registerResource(
    "lane-tasks-app",
    TASKS_APP_URI,
    { title: "Ask Lane tasks board", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: TASKS_APP_HTML }] }),
  );
  // Generative view for lane_render_view: renders whichever data-bound view the
  // model requested (availability/PTO, overview, milestones, deliverables,
  // activities, signals, portfolio) from the server-computed spec — read-only.
  server.registerResource(
    "lane-view-app",
    VIEW_APP_URI,
    { title: "Ask Lane view", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: VIEW_APP_HTML }] }),
  );
  // Suggested-dependencies checklist: the model proposes predecessor→successor
  // edges; the card resolves titles, drops already-linked/self edges, and applies
  // the checked ones via dependency.bulkCreate.
  server.registerResource(
    "lane-suggest-app",
    SUGGEST_APP_URI,
    { title: "Ask Lane suggested dependencies", mimeType: APP_MIME },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: APP_MIME, text: SUGGEST_APP_HTML }] }),
  );

  server.registerTool(
    "lane_list_workspaces",
    {
      title: "List Lane workspaces",
      description:
        "List the Lane workspaces you belong to, with your role and which one is currently active. Call this first to resolve the workspaceId and project scope before reading context or applying actions.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        workspaces: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), access: z.enum(["all", "scoped"]), active: z.boolean() })),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: WORKSPACES_APP_URI } },
    },
    async () => {
      const token = await session.accessToken();
      const workspaces = await listLaneWorkspaces(token);
      return {
        content: [{ type: "text", text: workspacesMarkdown(workspaces) }],
        structuredContent: { workspaces },
      };
    },
  );

  server.registerTool(
    "lane_get_context",
    {
      title: "Read Lane plan context",
      description:
        "Read the current Lane plan graph for you (projects, lanes, phases, milestones, activities, tasks, events, people, roles, groups, assignments, notes, dependencies). Pass a projectId to focus on one project, or omit it to read across the active workspace. Returns a chat summary plus the full structured graph — use the structured data to build tables, timelines, or other visual artifacts.",
      inputSchema: z.object({
        projectId: z.string().uuid().optional().describe("Focus the read on one project. Omit to read the whole active workspace."),
        projectIds: z.array(z.string().uuid()).min(1).max(20).optional().describe("Focus on multiple specific projects (e.g. canvas multi-select). Wins over projectId when both are provided."),
        include: z.array(z.enum(["timeOff", "deliverables", "links"])).optional().describe("Pull extra data sections on demand: 'timeOff' for availability/PTO, 'deliverables' for handoffs, 'links' for attached resources. Omit when not needed."),
      }),
      // No fixed UI: lane_get_context answers many different questions (PTO,
      // workload, schedule, overview…). Binding it to the project-overview
      // dashboard rendered that same card for every read, even when it was
      // irrelevant to the question. Reads now return text + the structured graph;
      // the model composes the answer, and lane_render_view paints a fitting
      // visual when one helps.
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, projectIds, include }) => {
      const token = await session.accessToken();
      const context = await getLaneContext({ accessToken: token, projectId, projectIds, include });
      return {
        content: [
          { type: "text", text: summarizeContextMarkdown(context) },
          jsonResource("lane://context.json", "Lane plan graph", context),
        ],
        structuredContent: context as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "lane_apply_action",
    {
      title: "Apply a Lane change",
      description:
        "Create, update, or delete one Lane object (lane, phase, milestone, activity, task, event, note, dependency, person, role, or group). Read lane_get_context first to ground IDs and the expectedVersion for updates/deletes. Pass the full action object under `action`. Set preview:true to validate and see exactly what would change WITHOUT applying it — do this first for destructive or ambiguous changes, then re-call with preview:false to apply. Never claim a change happened until this returns applied:true.",
      inputSchema: z.object({
        action: LaneAgentActionSchema.describe("The exact Lane mutation to apply (a discriminated union keyed by its own `action` field, e.g. \"milestone.create\")."),
        preview: z.boolean().optional().describe("When true, validate and describe the change without applying it."),
      }),
      outputSchema: z.object({
        applied: z.boolean(),
        preview: z.boolean().optional(),
        action: z.string(),
        message: z.string(),
        describe: z.string().optional(),
      }),
      annotations: { destructiveHint: true },
      _meta: { ui: { resourceUri: APPROVAL_APP_URI } },
    },
    async ({ action, preview }) => {
      if (preview) {
        const describe = describeAction(action as Record<string, unknown>);
        const message = `Preview only — nothing applied. This would run:\n\n${describe}\n\nRe-call with \`preview: false\` to apply.`;
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { applied: false, preview: true, action: action.action, message: "Preview only; nothing was applied.", describe },
        };
      }
      const result = await session.apply(action);
      return {
        content: [{ type: "text", text: `✓ Applied \`${result.action}\`. ${result.message}` }],
        structuredContent: { applied: true, action: result.action, message: result.message },
      };
    },
  );

  server.registerTool(
    "lane_render_form",
    {
      title: "Open a Lane create form",
      description:
        "Open an interactive form in the chat for the user to create a Lane record themselves (event, task, note, or link) — instead of you guessing the fields. Use this when the user wants to add/create something and details are missing, or when they'd rather fill it in. For an ACTIVITY use lane_edit_activity; for a MILESTONE, PHASE, DELIVERABLE, or TIME OFF use lane_edit_record. Pass the `kind` and the active `projectId`. For a task pass the parent activity id as `parentId`. For a note pass the owning record's id as `parentId` and its type as `parentType` (activity|milestone|event|deliverable). For a link pass the target object id as `parentId` and its type as `parentType` (work_item|milestone|event|task|deliverable). The user edits and submits; the form applies the change itself and reports its own receipt — do NOT also call lane_apply_action for it.",
      inputSchema: z.object({
        kind: z.enum(["event", "task", "note", "link"]),
        projectId: z.string().uuid().optional().describe("The project to create in (required for every kind)."),
        parentId: z.string().uuid().optional().describe("Owning record: activity id for a task, note target for a note, link target for a link."),
        parentType: z.string().optional().describe("For note: activity|milestone|event|deliverable. For link: work_item|milestone|event|task|deliverable."),
        title: z.string().max(300).optional().describe("Optional prefill for the title/name/body field."),
      }),
      // This tool only opens a form; the actual (destructive) write happens when the
      // user submits, via lane_apply_action.
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: FORM_APP_URI } },
    },
    async ({ kind, projectId, parentId, parentType, title }) => ({
      content: [{ type: "text", text: `Opening a ${kind} form for you to fill in and submit.` }],
      structuredContent: {
        kind,
        projectId: projectId ?? null,
        parentId: parentId ?? null,
        parentType: parentType ?? null,
        title: title ?? null,
      },
    }),
  );

  server.registerTool(
    "lane_edit_activity",
    {
      title: "Open the Lane activity editor",
      description:
        "Open the full interactive activity editor in the chat — tabs for Details (title, description, status, priority, milestone, lane, team owners & groups, color, start/due dates, progress), Tasks (add/toggle/remove), Notes (add/remove), and Links (add). Pass the active `projectId`. To EDIT an existing activity, also pass its `activityId` (Tasks/Notes/Links are available in edit mode). Omit `activityId` to CREATE a new activity (Details only until it's saved and reopened). The user edits and applies changes themselves; the editor calls the write tool and reports its own receipts — do NOT also call lane_apply_action for it.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("The project the activity lives in."),
        activityId: z.string().uuid().optional().describe("Existing activity to edit. Omit to create a new one."),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ACTIVITY_APP_URI } },
    },
    async ({ projectId, activityId }) => ({
      content: [{ type: "text", text: activityId ? "Opening the activity editor." : "Opening a new activity editor." }],
      structuredContent: { projectId, activityId: activityId ?? null },
    }),
  );

  server.registerTool(
    "lane_edit_record",
    {
      title: "Open a Lane record editor",
      description:
        "Open an interactive editor for a milestone, phase, deliverable, time-off entry, team member (person), role, or group — create or edit. Milestones and deliverables get a Notes tab; a person carries roles + primary role; a group carries members. Pass `kind` and the active `projectId`. To EDIT an existing record, also pass its `entityId`; omit it to CREATE. For the workspace-scoped kinds — `pto`, `person`, `role`, `group` — also pass `workspaceId`. The user edits and applies changes themselves; the editor calls the write tool and reports its own receipts — do NOT also call lane_apply_action for it.",
      inputSchema: z.object({
        kind: z.enum(["milestone", "phase", "deliverable", "pto", "person", "role", "group"]),
        projectId: z.string().uuid().describe("The project in scope (required for every kind)."),
        workspaceId: z.string().uuid().optional().describe("Required for the workspace-scoped kinds: pto, person, role, group."),
        entityId: z.string().uuid().optional().describe("Existing record to edit. Omit to create a new one."),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: ENTITY_APP_URI } },
    },
    async ({ kind, projectId, workspaceId, entityId }) => ({
      content: [{ type: "text", text: `Opening the ${kind} editor.` }],
      structuredContent: { kind, projectId, workspaceId: workspaceId ?? null, entityId: entityId ?? null },
    }),
  );

  server.registerTool(
    "lane_edit_dependencies",
    {
      title: "Open the Lane dependencies editor",
      description:
        "Open an interactive card to view, add, and remove activity dependencies (predecessor → successor, with an optional lag in days) for a project. Pass the active `projectId`. The user makes changes themselves; the card calls the write tool and reports its own receipts — do NOT also call lane_apply_action for it.",
      inputSchema: z.object({ projectId: z.string().uuid().describe("The project whose dependencies to manage.") }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: DEPS_APP_URI } },
    },
    async ({ projectId }) => ({
      content: [{ type: "text", text: "Opening the dependencies editor." }],
      structuredContent: { projectId },
    }),
  );

  server.registerTool(
    "lane_view_tasks",
    {
      title: "Open the Lane tasks board",
      description:
        "Open the interactive Tasks board in the chat for one project — its activities grouped by lane, each with a progress bar, owner avatars, status, due date, and its checklist tasks, with Active/All/Done filters. Use this for 'show me the tasks / activities / to-dos / checklist / what's on the board' requests. Pass the active `projectId`. The board is read-only but rows are actionable: tapping an activity or an add-task/add-activity control asks to open the matching editor — so do NOT also call lane_apply_action for it; let the follow-up editor tool handle writes.",
      inputSchema: z.object({ projectId: z.string().uuid().describe("The project whose tasks to show.") }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: TASKS_APP_URI } },
    },
    async ({ projectId }) => ({
      content: [{ type: "text", text: "Opening the tasks board." }],
      structuredContent: { projectId },
    }),
  );

  server.registerTool(
    "lane_apply_project_action",
    {
      title: "Create, update, or delete a Lane project",
      description:
        "Create a new Lane project, update an existing one (name, key, description, status, health, priority, dates), or permanently delete one. Read lane_get_context first to confirm the projectId and expectedVersion for edits and deletes. Pass the full action object. Set preview:true to validate without applying — do this first for destructive changes, then re-call with preview:false to apply. Never claim a change happened until this returns applied:true.",
      inputSchema: z.object({
        action: LaneProjectActionSchema.describe("The exact project mutation (discriminated union keyed by 'action': project.create | project.update | project.delete)."),
        preview: z.boolean().optional().describe("When true, describe the change without applying it."),
      }),
      annotations: { destructiveHint: true },
      _meta: { ui: { resourceUri: APPROVAL_APP_URI } },
    },
    async ({ action, preview }) => {
      if (preview) {
        const describe = describeAction(action as Record<string, unknown>);
        const message = `Preview only — nothing applied. This would run:\n\n${describe}\n\nRe-call with \`preview: false\` to apply.`;
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { applied: false, preview: true, action: action.action, message: "Preview only; nothing was applied.", describe },
        };
      }
      const result = await session.applyProject(action);
      return {
        content: [{ type: "text", text: `✓ Applied \`${result.action}\`. ${result.message}` }],
        structuredContent: { applied: true, action: result.action, projectId: result.projectId, message: result.message },
      };
    },
  );

  server.registerTool(
    "lane_get_project_share_link",
    {
      title: "Get the share link for a Lane project",
      description:
        "Read the current public share status for one project: whether it is shared, the link URL, whether a password is required and what it is, and any expiry date. Use when the user asks about sharing, the share link, or the share password. Pass the exact projectId.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("The project whose share status to read."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => {
      const result = await session.getShareLink(projectId);
      const text = result.active
        ? `Project is shared.\nURL: ${result.url as string}${result.requiresPassword ? `\nPassword: ${result.password as string}` : ""}${result.expiresAt ? `\nExpires: ${result.expiresAt as string}` : ""}`
        : (result.message as string | undefined) ?? "Project is not shared publicly.";
      return {
        content: [{ type: "text", text }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "lane_generate_plan_export",
    {
      title: "Get a Lane plan export download link",
      description:
        "Return a download link for the current project plan in PDF, PowerPoint, or Excel format. The link must be opened in the user's authenticated browser session to download the file. This is read-only and does not change any project records.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("The project to export."),
        format: z.enum(["pdf", "pptx", "xlsx"]).describe("Export format."),
        title: z.string().trim().min(1).max(200).optional().describe("Optional document title (defaults to project name)."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, format, title }) => {
      const result = await session.planExport({ projectId, format, title });
      const text = `Your plan export is ready.\nFormat: ${result.format as string}\nFile: ${result.fileName as string}\nDownload URL (open in your browser): ${result.downloadUrl as string}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "lane_render_view",
    {
      title: "Render a Lane view",
      description:
        "Render a rich, read-only view of real Lane data in the chat — Lane computes the numbers server-side so you never invent them. Pick `view`: `availability` (who is on PTO + any owner/PTO scheduling conflicts — use for ANY 'who's out / time off / PTO / vacation / availability' question), `workload` (each team member's open-activity load + upcoming PTO — use for 'who's overloaded / who has capacity / workload / bandwidth' questions), `attention` (prioritized needs-attention queue: blocked, overdue milestones, behind schedule, unassigned, unscheduled — use for 'what needs attention / what's at risk / what should I look at' questions), `activity_log` (recent activity: who changed what — use for 'what changed / recent activity / who did what' questions), `project_overview` (compact status header), `project_signals` (health/risk tiles), `milestones` (milestone sequence), `deliverables` (deliverable status + timeline), `activities` (work items grouped by lane with tasks, progress, assignees), `timeline` (a Gantt-style schedule: phases, milestones, and activity bars on a date axis — use for 'show me the schedule / timeline / gantt / when things happen' questions), `risks_decisions` (open risks with likelihood/impact score + logged decisions — use for 'what are the risks / risk register / decisions / decision log' questions), `portfolio_health` (portfolio roll-up). Pass `projectId` for the project-scoped views. `availability` and `portfolio_health` may omit projectId to span the active workspace (pass `workspaceId` to target one). Read-only; changes nothing.",
      inputSchema: z.object({
        view: z.enum(["availability", "workload", "attention", "activity_log", "timeline", "risks_decisions", "project_overview", "project_signals", "milestones", "deliverables", "activities", "portfolio_health"]).describe("Which view to render."),
        projectId: z.string().uuid().optional().describe("Required for all project-scoped views (workload/attention/activity_log/project_overview/project_signals/milestones/deliverables/activities); optional for availability (project vs workspace)."),
        workspaceId: z.string().uuid().optional().describe("For workspace-scoped availability or portfolio_health; defaults to the active workspace."),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEW_APP_URI } },
    },
    async ({ view, projectId, workspaceId }) => {
      const request: Record<string, unknown> = { view };
      if (projectId) request.projectId = projectId;
      if (workspaceId) request.workspaceId = workspaceId;
      const result = await session.renderView(request);
      return {
        content: [{ type: "text", text: `Rendered the ${view} view.` }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "lane_suggest_dependencies",
    {
      title: "Suggest activity dependencies",
      description:
        "Propose predecessor→successor dependencies for a project and let the user review them before applying. Read lane_get_context FIRST, then reason the edges from the plan (schedule, milestones, lanes, titles) and pass them in `edges` as { predecessorId, successorId, lagDays? } using real activity ids. The review card resolves titles, drops any that are self-referential or already linked, and applies the CHECKED ones in one shot via dependency.bulkCreate (cycles/dupes are skipped server-side). Do NOT also call lane_apply_action — the card applies it and reports its own receipt. Use this for 'wire up / suggest / sequence the dependencies' requests.",
      inputSchema: z.object({
        projectId: z.string().uuid().describe("The project to connect activities in."),
        edges: z.array(z.object({
          predecessorId: z.string().uuid().describe("The activity that must come first."),
          successorId: z.string().uuid().describe("The activity that depends on it."),
          lagDays: z.number().int().min(-365).max(365).optional().describe("Optional lag in days (+ waits after, - starts before)."),
        })).min(1).max(500).describe("The proposed predecessor→successor edges, reasoned from the plan."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: SUGGEST_APP_URI } },
    },
    async ({ projectId, edges }) => {
      return {
        content: [{ type: "text", text: `Proposed ${edges.length} ${edges.length === 1 ? "dependency" : "dependencies"} for review.` }],
        structuredContent: { projectId, edges },
      };
    },
  );
}
