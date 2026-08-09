import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getLaneContext } from "./lane/lane-context.js";
import { listLaneWorkspaces } from "./lane/workspaces.js";
import { describeAction, summarizeContextMarkdown, workspacesMarkdown } from "./lane/format.js";
import { LaneAgentActionSchema } from "./lane/action-contracts.js";
import type { LaneSession } from "./session.js";
import { WORKSPACES_APP_HTML } from "./generated/workspaces-app.js";
import { APPROVAL_APP_HTML } from "./generated/approval-app.js";
import { DASHBOARD_APP_HTML } from "./generated/dashboard-app.js";
import { FORM_APP_HTML } from "./generated/form-app.js";
import { ACTIVITY_APP_HTML } from "./generated/activity-app.js";

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

  server.registerTool(
    "lane_list_workspaces",
    {
      title: "List Lane workspaces",
      description:
        "List the Lane workspaces you belong to, with your role and which one is currently active. Call this first to resolve the workspaceId and project scope before reading context or applying actions.",
      inputSchema: z.object({}),
      outputSchema: z.object({
        workspaces: z.array(z.object({ id: z.string(), name: z.string(), role: z.string(), active: z.boolean() })),
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
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: DASHBOARD_APP_URI } },
    },
    async ({ projectId }) => {
      const token = await session.accessToken();
      const context = await getLaneContext({ accessToken: token, projectId });
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
        "Open an interactive form in the chat for the user to create a Lane record themselves (milestone, event, task, note, or link) — including assigning people — instead of you guessing the fields. Use this when the user wants to add/create something and details are missing, or when they'd rather fill it in. For creating or editing an ACTIVITY, use lane_edit_activity instead (it has the full tabbed editor). Pass the `kind` and the active `projectId`. For a task pass the parent activity id as `parentId`. For a note pass the owning record's id as `parentId` and its type as `parentType` (activity|milestone|event|deliverable). For a link pass the target object id as `parentId` and its type as `parentType` (work_item|milestone|event|task|deliverable). The user edits and submits; the form applies the change itself and reports its own receipt — do NOT also call lane_apply_action for it.",
      inputSchema: z.object({
        kind: z.enum(["milestone", "event", "task", "note", "link"]),
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
}
