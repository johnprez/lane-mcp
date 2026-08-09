import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getLaneContext } from "./lane/lane-context.js";
import { listLaneWorkspaces } from "./lane/workspaces.js";
import { describeAction, summarizeContextMarkdown, workspacesMarkdown } from "./lane/format.js";
import { LaneAgentActionSchema } from "./lane/action-contracts.js";
import type { LaneSession } from "./session.js";
import { HELLO_APP_HTML } from "./generated/hello-app.js";

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

// Ask Lane interactive UI (MCP Apps). `ui://lane/hello` is the esbuild-bundled
// iframe app (src/app-src/hello.ts + scripts/build-apps.mjs); a tool opts in by
// pointing `_meta.ui.resourceUri` at it. HELLO_APP_HTML is the generated inlined
// HTML string (regenerated on every build).
const HELLO_APP_MIME = "text/html;profile=mcp-app";
const HELLO_APP_URI = "ui://lane/hello";

export function registerLaneTools(server: McpServer, session: LaneSession): void {
  // Register the interactive UI resource and link it from the workspaces tool via
  // _meta.ui.resourceUri. Hosts that support MCP Apps render the iframe; others
  // ignore it and fall back to the tool's normal text + structuredContent.
  server.registerResource(
    "lane-hello-app",
    HELLO_APP_URI,
    { title: "Ask Lane interactive UI", mimeType: HELLO_APP_MIME },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: HELLO_APP_MIME, text: HELLO_APP_HTML }],
    }),
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
      _meta: { ui: { resourceUri: HELLO_APP_URI } },
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
      }),
      annotations: { destructiveHint: true },
    },
    async ({ action, preview }) => {
      if (preview) {
        const message = `Preview only — nothing applied. This would run:\n\n${describeAction(action as Record<string, unknown>)}\n\nRe-call with \`preview: false\` to apply.`;
        return {
          content: [{ type: "text", text: message }],
          structuredContent: { applied: false, preview: true, action: action.action, message: "Preview only; nothing was applied." },
        };
      }
      const result = await session.apply(action);
      return {
        content: [{ type: "text", text: `✓ Applied \`${result.action}\`. ${result.message}` }],
        structuredContent: { applied: true, action: result.action, message: result.message },
      };
    },
  );
}
