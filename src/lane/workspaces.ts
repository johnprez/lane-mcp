import { laneContextClient } from "./lane-context";

/**
 * List the workspaces the authenticated user belongs to, marking which one is
 * their persisted active selection. Headless Claude clients call this first so
 * they can resolve `workspaceId` / project scope before reading or writing.
 *
 * Token-scoped (RLS) rather than reusing `loadWorkspaceSwitcher`, which depends
 * on `next/headers` cookies; the MCP route only has a Bearer token.
 */
export type LaneWorkspace = { id: string; name: string; role: string; active: boolean };

export async function listLaneWorkspaces(accessToken: string): Promise<LaneWorkspace[]> {
  const db = laneContextClient(accessToken);
  const memberships = await db.from("workspace_memberships")
    .select("workspace_id, role, created_at")
    .eq("membership_kind", "member")
    .order("created_at")
    .limit(100);
  if (memberships.error) throw new Error(`Lane could not read your workspace memberships: ${memberships.error.message}`);
  const rows = memberships.data ?? [];
  if (!rows.length) return [];

  const roleByWorkspace = new Map(rows.map((row) => [row.workspace_id, row.role as string]));
  const workspaceIds = rows.map((row) => row.workspace_id);
  const [workspaces, profile] = await Promise.all([
    db.from("workspaces").select("id, name").in("id", workspaceIds).is("archived_at", null).order("name").limit(100),
    db.from("profiles").select("active_workspace_id").maybeSingle(),
  ]);
  if (workspaces.error) throw new Error(`Lane could not read your workspaces: ${workspaces.error.message}`);

  const activeId = profile.error ? null : profile.data?.active_workspace_id ?? null;
  const options = (workspaces.data ?? []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    role: roleByWorkspace.get(workspace.id) ?? "viewer",
    active: false,
  }));
  // A single-workspace member is implicitly active; otherwise honor the
  // persisted selection so Claude widens reads to the right scope.
  const resolvedActive = options.length === 1 ? options[0]?.id : (activeId && options.some((o) => o.id === activeId) ? activeId : null);
  return options.map((option) => ({ ...option, active: option.id === resolvedActive }));
}
