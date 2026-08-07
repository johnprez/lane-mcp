import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * The user-scoped Lane plan-graph read, extracted so it has exactly one
 * implementation shared by every caller:
 *   - the eve `get_lane_context` tool (Ask Lane, in the eve runtime), and
 *   - the MCP `lane_get_context` tool (`/api/mcp`, headless Claude clients).
 *
 * It performs no auth of its own — the caller passes a Supabase access token and
 * RLS scopes every read to that user. Keep this file free of `server-only` and
 * of `next/*` imports so the standalone eve runtime can import it too.
 */

function logContextFailure(
  label: string,
  error: { code?: string; message?: string; details?: string; hint?: string } | null,
) {
  if (!error) return;
  console.warn("[lane-context] read failed", {
    label,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

type ContextRead<T> = { data: T; error: null } | { data: T; error: { code?: string; message?: string; details?: string; hint?: string } };

function isOptionalContextReadFailure(error: { code?: string } | null | undefined) {
  return Boolean(error && ["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? ""));
}

function optionalContext<T>(label: string, result: ContextRead<T>, fallback: T): T {
  if (!result.error) return result.data;
  if (isOptionalContextReadFailure(result.error)) {
    logContextFailure(label, result.error);
    return fallback;
  }
  logContextFailure(label, result.error);
  throw new Error(`Lane could not read ${label} context.`);
}

type LaneContextClient = ReturnType<typeof createClient<Database>>;
type LaneContextRow = Record<string, unknown>;

const CONTEXT_ROW_LIMITS = {
  lanes: 120,
  phases: 120,
  milestones: 250,
  activities: 600,
  tasks: 1_200,
  events: 250,
  people: 500,
  roles: 250,
  groups: 250,
  assignments: 2_000,
  notes: 400,
  dependencies: 1_000,
} as const;

function compactText(value: unknown, maximum: number): unknown {
  if (typeof value !== "string" || value.length <= maximum) return value;
  return `${value.slice(0, maximum - 1).trimEnd()}…`;
}

/**
 * Keep the context tool useful for action grounding without replaying entire
 * documents and note histories into every turn. IDs, versions, dates, and
 * statuses remain untouched; only bounded prose is compacted.
 */
function compactRows(rows: LaneContextRow[], limit: number): LaneContextRow[] {
  return rows.slice(0, limit).map((row) => ({
    ...row,
    name: compactText(row.name, 180),
    title: compactText(row.title, 240),
    description: compactText(row.description, 720),
    body: compactText(row.body, 600),
  }));
}

function rowContextRead(result: { data: unknown[] | null; error: { code?: string; message?: string; details?: string; hint?: string } | null }): ContextRead<LaneContextRow[]> {
  return result.error ? { data: [], error: result.error } : { data: (result.data ?? []) as LaneContextRow[], error: null };
}

async function readWorkspacePeople(db: LaneContextClient, workspaceIds: string[]): Promise<ContextRead<LaneContextRow[]>> {
  const rich = await db.from("workspace_people")
    .select("id, workspace_id, full_name, email, person_kind, role_title, organization_name, default_allocation_percent, level, version")
    .in("workspace_id", workspaceIds)
    .is("archived_at", null);
  if (!rich.error) return rowContextRead(rich);
  if (!isOptionalContextReadFailure(rich.error)) return rowContextRead(rich);

  const fallback = await db.from("workspace_people")
    .select("id, workspace_id, full_name, default_allocation_percent, version")
    .in("workspace_id", workspaceIds)
    .is("archived_at", null);
  if (fallback.error) return rowContextRead(fallback);

  return {
    data: (fallback.data ?? []).map((person) => ({
      ...person,
      email: null,
      person_kind: "team_member",
      role_title: "",
      organization_name: "",
      level: null,
    })),
    error: null,
  };
}

async function readProjectPlanningPeople(db: LaneContextClient, workspaceIds: string[], projectIds: string[]): Promise<ContextRead<LaneContextRow[]>> {
  const result = await db.from("project_planning_people")
    .select("project_id, person_id, role_id, allocation_percent")
    .in("workspace_id", workspaceIds)
    .in("project_id", projectIds);
  if (!result.error) return rowContextRead(result);
  if (isOptionalContextReadFailure(result.error)) return { data: [], error: null };
  return rowContextRead(result);
}

export type LaneContext = {
  projects: LaneContextRow[];
  lanes: LaneContextRow[];
  phases: LaneContextRow[];
  milestones: LaneContextRow[];
  activities: LaneContextRow[];
  tasks: LaneContextRow[];
  events: LaneContextRow[];
  people: LaneContextRow[];
  roles: LaneContextRow[];
  groups: LaneContextRow[];
  assignments: Record<string, LaneContextRow[]>;
  notes: Record<string, LaneContextRow[]>;
  dependencies: LaneContextRow[];
};

const EMPTY_CONTEXT: LaneContext = {
  projects: [], lanes: [], phases: [], milestones: [], activities: [], tasks: [],
  events: [], people: [], roles: [], groups: [], assignments: {}, notes: {}, dependencies: [],
};

/**
 * Build an RLS-scoped Supabase client from a user access token. Kept coupled to
 * Lane's database contract so a stale field name fails typecheck, not the
 * user's request.
 */
export function laneContextClient(accessToken: string): LaneContextClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Read the authenticated user's Lane plan graph. Passing `projectId` narrows the
 * read to that one project; omitting it widens to the workspace (bounded).
 */
export async function getLaneContext(params: { accessToken: string; projectId?: string }): Promise<LaneContext> {
  const { accessToken, projectId } = params;
  const db = laneContextClient(accessToken);
  const projects = await db.from("projects")
    .select("id, workspace_id, project_key, name, description, status, health, priority, owner_id, starts_on, due_on, version, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(projectId ? 1 : 25)
    .match(projectId ? { id: projectId } : {});
  if (projects.error) {
    logContextFailure("projects", projects.error);
    throw new Error("Lane could not read the authorized project context.");
  }
  const projectIds = (projects.data ?? []).map((project) => project.id);
  if (!projectIds.length) return { ...EMPTY_CONTEXT };
  const workspaceIds = [...new Set((projects.data ?? []).map((project) => project.workspace_id))];
  const projectContext = (projects.data ?? []).map((project) => ({
    id: project.id,
    workspace_id: project.workspace_id,
    name: project.name,
    summary: project.description || null,
    goal: null,
    status: project.status,
    health: project.health,
    target_date: project.due_on,
    version: project.version,
    updated_at: project.updated_at,
  }));
  const [lanes, phases, milestones, activities, tasks, events, people, roles, groups, projectPeople, lanePeople, milestonePeople, activityPeople, activityGroups, eventPeople, eventGroups, phaseLanes, activityNotes, milestoneNotes, eventNotes, dependencies] = await Promise.all([
    db.from("workstreams").select("id, project_id, name, description, status, color, version").in("workspace_id", workspaceIds).in("project_id", projectIds).is("archived_at", null).limit(CONTEXT_ROW_LIMITS.lanes),
    db.from("project_phases").select("id, project_id, name, description, starts_on, ends_on, color, version").in("workspace_id", workspaceIds).in("project_id", projectIds).is("archived_at", null).limit(CONTEXT_ROW_LIMITS.phases),
    db.from("milestones").select("id, project_id, title, description, status, target_date, version").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.milestones),
    // work_items are not soft-deleted; unlike lanes and events, the table has
    // no archived_at column.
    db.from("work_items").select("id, project_id, workstream_id, milestone_id, title, description, status, priority, starts_at, due_at, progress, color, version").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.activities),
    db.from("work_item_checklist_items").select("id, project_id, work_item_id, name, is_done, sort_key, version").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.tasks),
    db.from("planning_events").select("id, project_id, title, description, starts_at, ends_at, all_day, timezone, color, version").in("workspace_id", workspaceIds).in("project_id", projectIds).eq("scope", "project").is("archived_at", null).limit(CONTEXT_ROW_LIMITS.events),
    readWorkspacePeople(db, workspaceIds),
    db.from("workspace_role_catalog").select("id, workspace_id, name, description, color, version").in("workspace_id", workspaceIds).is("archived_at", null).limit(CONTEXT_ROW_LIMITS.roles),
    db.from("workspace_team_groups").select("id, workspace_id, name, description, color, version").in("workspace_id", workspaceIds).is("archived_at", null).limit(CONTEXT_ROW_LIMITS.groups),
    readProjectPlanningPeople(db, workspaceIds, projectIds),
    db.from("workstream_planning_people").select("project_id, workstream_id, person_id").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("milestone_planning_people").select("project_id, milestone_id, person_id").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("work_item_planning_people").select("project_id, work_item_id, person_id").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("work_item_team_groups").select("project_id, work_item_id, group_id").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("planning_event_people").select("event_id, person_id").in("workspace_id", workspaceIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("planning_event_groups").select("event_id, group_id").in("workspace_id", workspaceIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("project_phase_workstreams").select("project_id, phase_id, workstream_id").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.assignments),
    db.from("work_item_notes").select("id, project_id, work_item_id, body, version, created_by, updated_by, created_at, updated_at").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.notes),
    db.from("milestone_notes").select("id, project_id, milestone_id, body, version, created_by, updated_by, created_at, updated_at").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.notes),
    db.from("planning_event_notes").select("id, project_id, event_id, body, version, created_by, updated_by, created_at, updated_at").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.notes),
    db.from("work_item_dependencies").select("project_id, predecessor_id, successor_id, lag_days, version").in("workspace_id", workspaceIds).in("project_id", projectIds).limit(CONTEXT_ROW_LIMITS.dependencies),
  ]);
  // A complete plan needs its structural records. The enrichment reads below are
  // valuable but cannot prevent understanding a plan when a newly deployed
  // optional table is temporarily unavailable.
  const required = [lanes, phases, milestones, activities, events];
  const failed = required.find((result) => result.error);
  if (failed?.error) {
    logContextFailure("plan-context", failed.error);
    throw new Error("Lane could not finish reading the authorized plan context.");
  }

  const taskRows = optionalContext("tasks", tasks, []);
  const peopleRows = optionalContext("people", people, []);
  const roleRows = optionalContext("roles", roles, []);
  const groupRows = optionalContext("groups", groups, []);
  const projectPeopleRows = optionalContext("project-people", projectPeople, []);
  const lanePeopleRows = optionalContext("lane-people", lanePeople, []);
  const milestonePeopleRows = optionalContext("milestone-people", milestonePeople, []);
  const activityPeopleRows = optionalContext("activity-people", activityPeople, []);
  const activityGroupRows = optionalContext("activity-groups", activityGroups, []);
  const eventPeopleRows = optionalContext("event-people", eventPeople, []);
  const eventGroupRows = optionalContext("event-groups", eventGroups, []);
  const phaseLaneRows = optionalContext("phase-lanes", phaseLanes, []);
  const activityNoteRows = optionalContext("activity-notes", activityNotes, []);
  const milestoneNoteRows = optionalContext("milestone-notes", milestoneNotes, []);
  const eventNoteRows = optionalContext("event-notes", eventNotes, []);
  const dependencyRows = optionalContext("dependencies", dependencies, []);
  return {
    projects: projectContext as unknown as LaneContextRow[],
    lanes: compactRows((lanes.data ?? []) as LaneContextRow[], CONTEXT_ROW_LIMITS.lanes),
    phases: compactRows((phases.data ?? []) as LaneContextRow[], CONTEXT_ROW_LIMITS.phases),
    milestones: compactRows((milestones.data ?? []) as LaneContextRow[], CONTEXT_ROW_LIMITS.milestones),
    activities: compactRows((activities.data ?? []) as LaneContextRow[], CONTEXT_ROW_LIMITS.activities),
    tasks: compactRows(taskRows ?? [], CONTEXT_ROW_LIMITS.tasks),
    events: compactRows((events.data ?? []) as LaneContextRow[], CONTEXT_ROW_LIMITS.events),
    people: compactRows(peopleRows ?? [], CONTEXT_ROW_LIMITS.people),
    roles: compactRows(roleRows ?? [], CONTEXT_ROW_LIMITS.roles),
    groups: compactRows(groupRows ?? [], CONTEXT_ROW_LIMITS.groups),
    assignments: {
      projects: compactRows(projectPeopleRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      lanes: compactRows(lanePeopleRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      milestones: compactRows(milestonePeopleRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      activities: compactRows(activityPeopleRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      activityGroups: compactRows(activityGroupRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      events: compactRows(eventPeopleRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      eventGroups: compactRows(eventGroupRows ?? [], CONTEXT_ROW_LIMITS.assignments),
      phaseLanes: compactRows(phaseLaneRows ?? [], CONTEXT_ROW_LIMITS.assignments),
    },
    notes: {
      activities: compactRows(activityNoteRows ?? [], CONTEXT_ROW_LIMITS.notes),
      milestones: compactRows(milestoneNoteRows ?? [], CONTEXT_ROW_LIMITS.notes),
      events: compactRows(eventNoteRows ?? [], CONTEXT_ROW_LIMITS.notes),
    },
    dependencies: compactRows(dependencyRows ?? [], CONTEXT_ROW_LIMITS.dependencies),
  };
}
