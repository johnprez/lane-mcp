export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type WorkspaceRole = "viewer" | "editor" | "admin" | "owner";
export type MembershipKind = "member" | "platform_elevation";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type ProjectStatus = "planned" | "active" | "paused" | "completed" | "archived";
export type HealthStatus = "unknown" | "on_track" | "at_risk" | "off_track";
export type WorkstreamStatus = "planned" | "active" | "paused" | "completed";
export type MilestoneStatus = "planned" | "in_progress" | "completed" | "missed" | "canceled";
export type WorkItemStatus = "backlog" | "ready" | "in_progress" | "blocked" | "done" | "canceled";
export type PriorityLevel = "none" | "low" | "medium" | "high" | "urgent";
export type ProjectBrandAssetKind = "logo" | "font" | "image" | "style_guide" | "presentation_template" | "other";

type TableDefinition<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown> = Partial<Row>,
  Update extends Record<string, unknown> = Partial<Insert>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Timestamped = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<
        Timestamped & { id: string; full_name: string; avatar_url: string | null; timezone: string; active_workspace_id: string | null },
        { id: string; full_name?: string; avatar_url?: string | null; timezone?: string; active_workspace_id?: string | null; created_at?: string; updated_at?: string }
      >;
      workspaces: TableDefinition<
        Timestamped & { id: string; name: string; slug: string; created_by: string; archived_at: string | null },
        { id?: string; name: string; slug: string; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      workspace_memberships: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; user_id: string; role: WorkspaceRole;
          membership_kind: MembershipKind; expires_at: string | null; created_by: string | null; reason: string | null;
        },
        {
          id?: string; workspace_id: string; user_id: string; role: WorkspaceRole;
          membership_kind?: MembershipKind; expires_at?: string | null; created_by?: string | null;
          reason?: string | null; created_at?: string; updated_at?: string;
        }
      >;
      workspace_invitations: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; email: string; role: WorkspaceRole; status: InvitationStatus;
          token: string; invited_by: string | null; accepted_user_id: string | null; expires_at: string;
        },
        {
          id?: string; workspace_id: string; email: string; role: WorkspaceRole; status?: InvitationStatus;
          token?: string; invited_by?: string | null; accepted_user_id?: string | null; expires_at?: string;
          created_at?: string; updated_at?: string;
        }
      >;
      projects: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_key: string; name: string; description: string;
          status: ProjectStatus; health: HealthStatus; priority: PriorityLevel; owner_id: string | null;
          starts_on: string | null; due_on: string | null; version: number; created_by: string; archived_at: string | null;
        },
        {
          id?: string; workspace_id: string; project_key: string; name: string; description?: string;
          status?: ProjectStatus; health?: HealthStatus; priority?: PriorityLevel; owner_id?: string | null;
          starts_on?: string | null; due_on?: string | null; version?: number; created_by: string; created_at?: string;
          updated_at?: string; archived_at?: string | null;
        }
      >;
      project_brand_assets: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string; asset_kind: ProjectBrandAssetKind;
          file_name: string; storage_path: string; mime_type: string; byte_size: number;
          is_primary: boolean; metadata: Json; created_by: string; created_at: string; archived_at: string | null;
        },
        {
          id?: string; workspace_id: string; project_id: string; asset_kind: ProjectBrandAssetKind;
          file_name: string; storage_path: string; mime_type: string; byte_size: number;
          is_primary?: boolean; metadata?: Json; created_by: string; created_at?: string; archived_at?: string | null;
        }
      >;
      workstreams: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; name: string; description: string;
          color: string; status: WorkstreamStatus; owner_id: string | null; sort_key: string;
          version: number; created_by: string; archived_at: string | null;
        },
        {
          id?: string; workspace_id: string; project_id: string; name: string; description?: string;
          color?: string; status?: WorkstreamStatus; owner_id?: string | null; sort_key?: string;
          version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null;
        }
      >;
      milestones: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; title: string; description: string;
          status: MilestoneStatus; target_date: string | null; completed_at: string | null;
          sort_key: string; version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; title: string; description?: string;
          status?: MilestoneStatus; target_date?: string | null; completed_at?: string | null;
          sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      milestone_workstreams: TableDefinition<
        {
          workspace_id: string; project_id: string; milestone_id: string; workstream_id: string;
          created_by: string; created_at: string;
        },
        {
          workspace_id: string; project_id: string; milestone_id: string; workstream_id: string;
          created_by: string; created_at?: string;
        }
      >;
      milestone_assignees: TableDefinition<
        {
          workspace_id: string; project_id: string; milestone_id: string; user_id: string;
          created_by: string; created_at: string;
        },
        {
          workspace_id: string; project_id: string; milestone_id: string; user_id: string;
          created_by: string; created_at?: string;
        }
      >;
      work_items: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; workstream_id: string | null; milestone_id: string | null;
          title: string; description: string; status: WorkItemStatus; priority: PriorityLevel;
          assignee_id: string | null; starts_at: string | null; due_at: string | null; completed_at: string | null;
          blocked_reason: string | null; estimate_minutes: number | null; progress: number; sort_key: string; color?: string | null; lane_color_shade?: number;
          version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; workstream_id?: string | null; milestone_id?: string | null;
          title: string; description?: string; status?: WorkItemStatus; priority?: PriorityLevel;
          assignee_id?: string | null; starts_at?: string | null; due_at?: string | null; completed_at?: string | null;
          blocked_reason?: string | null; estimate_minutes?: number | null; progress?: number; sort_key?: string; color?: string | null; lane_color_shade?: number;
          version?: number; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      work_item_dependencies: TableDefinition<
        { workspace_id: string; project_id: string; predecessor_id: string; successor_id: string; lag_days: number; version: number; created_by: string; created_at: string; updated_at: string },
        { workspace_id: string; project_id: string; predecessor_id: string; successor_id: string; lag_days?: number; version?: number; created_by: string; created_at?: string; updated_at?: string }
      >;
      plan_dependencies: TableDefinition<
        { id: string; workspace_id: string; project_id: string; predecessor_type: "work_item" | "deliverable"; predecessor_id: string; successor_type: "work_item" | "deliverable"; successor_id: string; lag_days: number; version: number; created_by: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; project_id: string; predecessor_type: "work_item" | "deliverable"; predecessor_id: string; successor_type: "work_item" | "deliverable"; successor_id: string; lag_days?: number; version?: number; created_by?: string | null; created_at?: string; updated_at?: string }
      >;
      project_updates: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; kind: "note" | "status" | "weekly" | "milestone";
          title: string; body: string; health: HealthStatus | null; period_start: string | null;
          period_end: string | null; is_shareable: boolean; author_id: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; kind?: "note" | "status" | "weekly" | "milestone";
          title: string; body: string; health?: HealthStatus | null; period_start?: string | null;
          period_end?: string | null; is_shareable?: boolean; author_id: string; created_at?: string; updated_at?: string;
        }
      >;
      risks: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; workstream_id: string | null; title: string;
          description: string; mitigation: string; status: "open" | "mitigating" | "accepted" | "resolved" | "closed";
          likelihood: number; impact: number; score: number; owner_id: string | null; due_on: string | null;
          is_shareable: boolean; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; workstream_id?: string | null; title: string;
          description?: string; mitigation?: string; status?: "open" | "mitigating" | "accepted" | "resolved" | "closed";
          likelihood?: number; impact?: number; owner_id?: string | null; due_on?: string | null;
          is_shareable?: boolean; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      decisions: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; title: string; context: string; decision: string;
          status: "proposed" | "decided" | "superseded"; decided_by: string | null; decided_at: string | null;
          superseded_by_id: string | null; is_shareable: boolean; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; title: string; context?: string; decision?: string;
          status?: "proposed" | "decided" | "superseded"; decided_by?: string | null; decided_at?: string | null;
          superseded_by_id?: string | null; is_shareable?: boolean; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      activity_events: TableDefinition<{
        id: number; workspace_id: string; actor_user_id: string | null; elevation_membership_id: string | null;
        entity_type: string; entity_id: string | null; action: string; metadata: Json; created_at: string;
      }>;
      dashboards: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string | null; name: string; description: string;
          audience: "internal" | "share_safe"; layout_version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id?: string | null; name: string; description?: string;
          audience?: "internal" | "share_safe"; layout_version?: number; created_by: string;
          created_at?: string; updated_at?: string;
        }
      >;
      dashboard_sections: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; dashboard_id: string;
          section_type: "overview" | "projects" | "workstreams" | "milestones" | "work_items" | "updates" | "risks" | "decisions" | "ai_summary";
          title: string; config: Json; layout: Json; sort_key: string; created_by: string;
        },
        {
          id?: string; workspace_id: string; dashboard_id: string;
          section_type: "overview" | "projects" | "workstreams" | "milestones" | "work_items" | "updates" | "risks" | "decisions" | "ai_summary";
          title: string; config?: Json; layout?: Json; sort_key?: string; created_by: string;
          created_at?: string; updated_at?: string;
        }
      >;
      dashboard_share_links: TableDefinition<
        {
          id: string; workspace_id: string; dashboard_id: string; token_hash: string; token_prefix: string;
          expires_at: string | null; revoked_at: string | null; created_by: string; created_at: string;
          last_accessed_at: string | null; access_count: number;
        },
        {
          id?: string; workspace_id: string; dashboard_id: string; token_hash: string; token_prefix: string;
          expires_at?: string | null; revoked_at?: string | null; created_by: string; created_at?: string;
          last_accessed_at?: string | null; access_count?: number;
        }
      >;
      ai_runs: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string | null; requested_by: string; feature: string;
          status: "queued" | "running" | "completed" | "failed" | "canceled"; model: string | null;
          prompt_version: string; input_refs: Json; output: Json | null; input_tokens: number | null;
          output_tokens: number | null; error_code: string | null; error_message: string | null;
          started_at: string | null; completed_at: string | null; created_at: string;
        },
        {
          id?: string; workspace_id: string; project_id?: string | null; requested_by: string; feature: string;
          status?: "queued" | "running" | "completed" | "failed" | "canceled"; model?: string | null;
          prompt_version: string; input_refs?: Json; output?: Json | null; input_tokens?: number | null;
          output_tokens?: number | null; error_code?: string | null; error_message?: string | null;
          started_at?: string | null; completed_at?: string | null; created_at?: string;
        }
      >;
      user_portfolio_briefings: TableDefinition<
        {
          id: string; workspace_id: string; user_id: string; ai_run_id: string;
          briefing_date: string; generated_at: string; snapshot_version: string;
          latest_record_updated_at: string; model: string; artifact: Json; created_at: string;
        },
        {
          id?: string; workspace_id: string; user_id: string; ai_run_id: string;
          briefing_date: string; generated_at?: string; snapshot_version: string;
          latest_record_updated_at: string; model: string; artifact: Json; created_at?: string;
        }
      >;
      workspace_role_catalog: TableDefinition<
        Timestamped & { id: string; workspace_id: string; name: string; description: string; color: string; sort_key: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; name: string; description?: string; color?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      workspace_people: TableDefinition<
        Timestamped & { id: string; workspace_id: string; full_name: string; email: string | null; person_kind: "team_member" | "client"; role_title: string; organization_name: string; default_allocation_percent: number; level: string | null; notes: string; availability_note: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; full_name: string; email?: string | null; person_kind?: "team_member" | "client"; role_title?: string; organization_name?: string; default_allocation_percent?: number; level?: string | null; notes?: string; availability_note?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      workspace_person_roles: TableDefinition<
        { workspace_id: string; person_id: string; role_id: string; is_primary: boolean; created_by: string; created_at: string },
        { workspace_id: string; person_id: string; role_id: string; is_primary?: boolean; created_by: string; created_at?: string }
      >;
      project_planning_people: TableDefinition<
        { workspace_id: string; project_id: string; person_id: string; role_id: string | null; allocation_percent: number | null; created_by: string; created_at: string; updated_at: string },
        { workspace_id: string; project_id: string; person_id: string; role_id?: string | null; allocation_percent?: number | null; created_by: string; created_at?: string; updated_at?: string }
      >;
      workstream_planning_people: TableDefinition<
        { workspace_id: string; project_id: string; workstream_id: string; person_id: string; created_by: string; created_at: string },
        { workspace_id: string; project_id: string; workstream_id: string; person_id: string; created_by: string; created_at?: string }
      >;
      milestone_planning_people: TableDefinition<
        { workspace_id: string; project_id: string; milestone_id: string; person_id: string; created_by: string; created_at: string },
        { workspace_id: string; project_id: string; milestone_id: string; person_id: string; created_by: string; created_at?: string }
      >;
      workspace_team_groups: TableDefinition<
        Timestamped & { id: string; workspace_id: string; name: string; description: string; color: string; sort_key: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; name: string; description?: string; color?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      workspace_team_group_members: TableDefinition<
        { workspace_id: string; group_id: string; person_id: string; created_by: string; created_at: string },
        { workspace_id: string; group_id: string; person_id: string; created_by: string; created_at?: string }
      >;
      project_phases: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string; name: string; description: string; starts_on: string | null; ends_on: string | null; color: string; sort_key: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; project_id: string; name: string; description?: string; starts_on?: string | null; ends_on?: string | null; color?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      project_phase_workstreams: TableDefinition<
        { workspace_id: string; project_id: string; phase_id: string; workstream_id: string; created_by: string; created_at: string },
        { workspace_id: string; project_id: string; phase_id: string; workstream_id: string; created_by: string; created_at?: string }
      >;
      planning_events: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string | null; scope: "workspace" | "project"; title: string; description: string; starts_at: string; ends_at: string | null; all_day: boolean; timezone: string; color: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; project_id?: string | null; scope?: "workspace" | "project"; title: string; description?: string; starts_at: string; ends_at?: string | null; all_day?: boolean; timezone?: string; color?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      planning_event_people: TableDefinition<{ workspace_id: string; event_id: string; person_id: string; created_by: string; created_at: string }, { workspace_id: string; event_id: string; person_id: string; created_by: string; created_at?: string }>;
      planning_event_groups: TableDefinition<{ workspace_id: string; event_id: string; group_id: string; created_by: string; created_at: string }, { workspace_id: string; event_id: string; group_id: string; created_by: string; created_at?: string }>;
      planning_event_workstreams: TableDefinition<{ workspace_id: string; project_id: string; event_id: string; workstream_id: string; created_by: string; created_at: string }, { workspace_id: string; project_id: string; event_id: string; workstream_id: string; created_by: string; created_at?: string }>;
      person_time_off: TableDefinition<
        Timestamped & { id: string; workspace_id: string; person_id: string; starts_on: string; ends_on: string; note: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; person_id: string; starts_on: string; ends_on: string; note?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      work_item_planning_people: TableDefinition<{ workspace_id: string; project_id: string; work_item_id: string; person_id: string; created_by: string; created_at: string }, { workspace_id: string; project_id: string; work_item_id: string; person_id: string; created_by: string; created_at?: string }>;
      work_item_team_groups: TableDefinition<{ workspace_id: string; project_id: string; work_item_id: string; group_id: string; created_by: string; created_at: string }, { workspace_id: string; project_id: string; work_item_id: string; group_id: string; created_by: string; created_at?: string }>;
      work_item_notes: TableDefinition<
        { id: string; workspace_id: string; project_id: string; work_item_id: string; body: string; version: number; created_by: string; updated_by: string; created_at: string; updated_at: string; search_vector: unknown },
        { id?: string; workspace_id: string; project_id: string; work_item_id: string; body: string; version?: number; created_by: string; updated_by: string; created_at?: string; updated_at?: string }
      >;
      milestone_notes: TableDefinition<
        { id: string; workspace_id: string; project_id: string; milestone_id: string; body: string; version: number; created_by: string; updated_by: string; created_at: string; updated_at: string; search_vector: unknown },
        { id?: string; workspace_id: string; project_id: string; milestone_id: string; body: string; version?: number; created_by: string; updated_by: string; created_at?: string; updated_at?: string }
      >;
      planning_event_notes: TableDefinition<
        { id: string; workspace_id: string; project_id: string; event_id: string; body: string; version: number; created_by: string; updated_by: string; created_at: string; updated_at: string; search_vector: unknown },
        { id?: string; workspace_id: string; project_id: string; event_id: string; body: string; version?: number; created_by: string; updated_by: string; created_at?: string; updated_at?: string }
      >;
      work_item_checklist_items: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string; work_item_id: string;
          name: string; is_done: boolean; completed_at: string | null; completed_by: string | null;
          note: string; progress: number;
          sort_key: string; version: number; created_by: string; created_at: string; updated_at: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; work_item_id: string;
          name: string; is_done?: boolean; completed_at?: string | null; completed_by?: string | null;
          note?: string; progress?: number;
          sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string;
        }
      >;
      deliverables: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string; title: string; description: string; delivery_date: string; progress: number; color: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; project_id: string; title: string; description?: string; delivery_date: string; progress?: number; color?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      deliverable_notes: TableDefinition<
        { id: string; workspace_id: string; project_id: string; deliverable_id: string; body: string; version: number; created_by: string; updated_by: string; created_at: string; updated_at: string; search_vector: unknown },
        { id?: string; workspace_id: string; project_id: string; deliverable_id: string; body: string; version?: number; created_by: string; updated_by: string; created_at?: string; updated_at?: string }
      >;
      plan_object_links: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string; object_type: "work_item" | "milestone" | "event" | "task" | "deliverable"; object_id: string; url: string; label: string; sort_key: string; version: number; created_by: string },
        { id?: string; workspace_id: string; project_id: string; object_type: "work_item" | "milestone" | "event" | "task" | "deliverable"; object_id: string; url: string; label?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string }
      >;
      work_item_checklist_assignees: TableDefinition<
        {
          workspace_id: string; project_id: string; work_item_id: string;
          checklist_item_id: string; person_id: string; created_by: string; created_at: string;
        },
        {
          workspace_id: string; project_id: string; work_item_id: string;
          checklist_item_id: string; person_id: string; created_by: string; created_at?: string;
        }
      >;
      ai_plan_applications: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string; ai_run_id: string;
          applied_by: string; operation_hash: string; status: "applied" | "conflict" | "failed";
          receipt: Json; created_at: string;
        },
        {
          id: string; workspace_id: string; project_id: string; ai_run_id: string;
          applied_by: string; operation_hash: string; status: "applied" | "conflict" | "failed";
          receipt: Json; created_at?: string;
        }
      >;
      ai_command_proposals: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string | null; ai_run_id: string;
          requested_by: string; title: string; summary: string; commands: Json;
          command_hash: string; expires_at: string; created_at: string;
        },
        {
          id: string; workspace_id: string; project_id?: string | null; ai_run_id: string;
          requested_by: string; title: string; summary?: string; commands: Json;
          command_hash: string; expires_at: string; created_at?: string;
        }
      >;
      ai_command_reviews: TableDefinition<
        {
          id: string; workspace_id: string; proposal_id: string; decision: "approved" | "rejected";
          proposal_hash: string; reviewed_by: string; review_note: string; created_at: string;
        },
        {
          id: string; workspace_id: string; proposal_id: string; decision: "approved" | "rejected";
          proposal_hash: string; reviewed_by: string; review_note?: string; created_at?: string;
        }
      >;
      ai_command_executions: TableDefinition<
        {
          id: string; workspace_id: string; project_id: string | null; proposal_id: string;
          review_id: string; proposal_hash: string; executed_by: string; receipt: Json; created_at: string;
        },
        {
          id: string; workspace_id: string; project_id?: string | null; proposal_id: string;
          review_id: string; proposal_hash: string; executed_by: string; receipt: Json; created_at?: string;
        }
      >;
      ai_suggestions: TableDefinition<
        {
          id: string; workspace_id: string; ai_run_id: string; project_id: string | null; suggestion_type: string;
          title: string; rationale: string; payload: Json; confidence: number | null;
          status: "proposed" | "accepted" | "rejected" | "applied"; public_safe: boolean;
          reviewed_by: string | null; reviewed_at: string | null; applied_at: string | null; created_at: string;
        },
        {
          id?: string; workspace_id: string; ai_run_id: string; project_id?: string | null; suggestion_type: string;
          title: string; rationale?: string; payload?: Json; confidence?: number | null;
          status?: "proposed" | "accepted" | "rejected" | "applied"; public_safe?: boolean;
          reviewed_by?: string | null; reviewed_at?: string | null; applied_at?: string | null; created_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      begin_platform_elevation: {
        Args: { p_workspace_id: string; p_reason: string };
        Returns: { membership_id: string; expires_at: string }[];
      };
      apply_ai_plan_draft: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_run_id: string;
          p_application_id: string;
          p_operations: Json;
        };
        Returns: Json;
      };
      apply_ai_plan_draft_v2: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_run_id: string;
          p_application_id: string;
          p_operations: Json;
        };
        Returns: Json;
      };
      apply_ai_plan_draft_v3: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_run_id: string;
          p_application_id: string;
          p_operations: Json;
        };
        Returns: Json;
      };
      complete_ai_run: {
        Args: {
          p_workspace_id: string;
          p_run_id: string;
          p_output: Json;
          p_input_tokens: number | null;
          p_output_tokens: number | null;
        };
        Returns: boolean;
      };
      complete_and_store_portfolio_brief: {
        Args: {
          p_workspace_id: string; p_run_id: string; p_output: Json;
          p_input_tokens: number | null; p_output_tokens: number | null;
          p_snapshot_version: string; p_latest_record_updated_at: string; p_model: string;
        };
        Returns: string;
      };
      create_workspace: { Args: { p_name: string; p_slug?: string | null }; Returns: string };
      set_active_workspace: { Args: { p_workspace_id: string | null }; Returns: boolean };
      create_workspace_invitation: { Args: { p_workspace_id: string; p_email: string; p_role: WorkspaceRole }; Returns: string };
      revoke_workspace_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
      set_workspace_member_role: { Args: { p_workspace_id: string; p_user_id: string; p_role: WorkspaceRole }; Returns: boolean };
      remove_workspace_member: { Args: { p_workspace_id: string; p_user_id: string }; Returns: boolean };
      list_workspace_members: {
        Args: { p_workspace_id: string };
        Returns: { user_id: string; email: string; full_name: string; role: WorkspaceRole; membership_kind: MembershipKind; created_at: string }[];
      };
      list_workspace_invitations: {
        Args: { p_workspace_id: string };
        Returns: { id: string; email: string; role: WorkspaceRole; status: InvitationStatus; invited_by_name: string; created_at: string; expires_at: string }[];
      };
      accept_pending_invitations: { Args: Record<PropertyKey, never>; Returns: number };
      current_user_is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      end_platform_elevation: { Args: { p_workspace_id: string }; Returns: boolean };
      fail_ai_run: {
        Args: {
          p_workspace_id: string;
          p_run_id: string;
          p_error_code: string;
          p_error_message: string;
        };
        Returns: boolean;
      };
      resolve_dashboard_share: { Args: { p_token_hash: string }; Returns: Json | null };
      resolve_project_share: { Args: { p_token_hash: string }; Returns: Json | null };
      open_project_share: { Args: { p_token_hash: string; p_password: string | null; p_session_hash: string; p_ttl_seconds: number }; Returns: Json };
      read_project_share_session: { Args: { p_session_hash: string }; Returns: Json | null };
      get_project_share: { Args: { p_project_id: string; p_workspace_id: string }; Returns: Json | null };
      upsert_project_share: { Args: { p_project_id: string; p_workspace_id: string; p_token: string | null; p_password: string | null; p_expires_at: string | null; p_clear_password: boolean }; Returns: Json };
      revoke_project_share: { Args: { p_project_id: string; p_workspace_id: string }; Returns: undefined };
      start_ai_run: {
        Args: {
          p_workspace_id: string;
          p_project_id: string | null;
          p_feature: string;
          p_model: string;
          p_prompt_version: string;
          p_input_refs: Json;
        };
        Returns: string;
      };
      start_ai_command_run: {
        Args: {
          p_workspace_id: string;
          p_project_id: string | null;
          p_model: string;
          p_prompt_version: string;
          p_input_refs: Json;
        };
        Returns: string;
      };
      create_ai_command_proposal: {
        Args: {
          p_workspace_id: string;
          p_project_id: string | null;
          p_run_id: string;
          p_proposal_id: string;
          p_commands: Json;
        };
        Returns: Json;
      };
      review_ai_command_proposal: {
        Args: {
          p_workspace_id: string;
          p_proposal_id: string;
          p_review_id: string;
          p_expected_hash: string;
          p_decision: "approved" | "rejected";
          p_review_note: string;
        };
        Returns: Json;
      };
      execute_ai_command_proposal: {
        Args: {
          p_workspace_id: string;
          p_proposal_id: string;
          p_execution_id: string;
          p_expected_hash: string;
        };
        Returns: Json;
      };
      get_ai_command_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: { name: string; category: string; executable: boolean; description: string }[];
      };
      update_milestone_plan: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_milestone_id: string;
          p_expected_version: number;
          p_title: string;
          p_description: string;
          p_status: MilestoneStatus;
          p_target_date: string | null;
          p_workstream_ids: string[];
          p_assignee_ids: string[];
        };
        Returns: Json;
      };
      replace_planning_clients: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_object_type: "workstream" | "milestone";
          p_object_id: string;
          p_person_ids: string[];
        };
        Returns: Json;
      };
      register_project_brand_asset: {
        Args: {
          p_workspace_id: string; p_project_id: string; p_asset_kind: ProjectBrandAssetKind;
          p_file_name: string; p_storage_path: string; p_mime_type: string; p_byte_size: number;
          p_is_primary?: boolean; p_metadata?: Json;
        };
        Returns: string;
      };
      archive_project_brand_asset: {
        Args: { p_workspace_id: string; p_project_id: string; p_asset_id: string };
        Returns: string;
      };
      create_work_item_dependency: {
        Args: { p_workspace_id: string; p_project_id: string; p_predecessor_id: string; p_successor_id: string; p_lag_days: number };
        Returns: Json;
      };
      update_work_item_dependency: {
        Args: { p_workspace_id: string; p_project_id: string; p_predecessor_id: string; p_successor_id: string; p_expected_version: number; p_lag_days: number };
        Returns: Json;
      };
      delete_work_item_dependency: {
        Args: { p_workspace_id: string; p_project_id: string; p_predecessor_id: string; p_successor_id: string; p_expected_version: number };
        Returns: Json;
      };
      delete_plan_work_item: {
        Args: { p_workspace_id: string; p_project_id: string; p_item_id: string; p_expected_version: number };
        Returns: Json;
      };
      duplicate_plan_work_item: {
        Args: { p_workspace_id: string; p_project_id: string; p_item_id: string; p_expected_version: number };
        Returns: Json;
      };
      duplicate_plan_milestone: {
        Args: { p_workspace_id: string; p_project_id: string; p_milestone_id: string; p_expected_version: number };
        Returns: Json;
      };
      duplicate_project_planning_event: {
        Args: { p_workspace_id: string; p_project_id: string; p_event_id: string; p_expected_version: number };
        Returns: Json;
      };
      delete_plan_milestone: {
        Args: { p_workspace_id: string; p_project_id: string; p_milestone_id: string; p_expected_version: number };
        Returns: Json;
      };
      delete_plan_workstream: {
        Args: { p_workspace_id: string; p_project_id: string; p_workstream_id: string; p_expected_version: number };
        Returns: Json;
      };
      reorder_plan_workstreams: {
        Args: { p_workspace_id: string; p_project_id: string; p_ordered_ids: string[]; p_expected_versions: number[] };
        Returns: Json;
      };
      move_plan_work_item_schedule: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_item_id: string;
          p_expected_version: number;
          p_workstream_id: string | null;
          p_start_date: string | null;
          p_due_date: string | null;
          p_shift_dependents: boolean;
        };
        Returns: Json;
      };
      move_plan_work_item_schedule_with_receipt: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_item_id: string;
          p_expected_version: number;
          p_workstream_id: string | null;
          p_start_date: string | null;
          p_due_date: string | null;
          p_shift_dependents: boolean;
        };
        Returns: Json;
      };
      upsert_workspace_team_group: { Args: { p_workspace_id: string; p_group_id: string | null; p_expected_version: number | null; p_name: string; p_description: string; p_color: string; p_person_ids: string[] }; Returns: string };
      replace_work_item_planning_assignments: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_expected_version: number; p_person_ids: string[]; p_group_ids: string[] }; Returns: number };
      update_work_item_plan_with_owners: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_expected_version: number; p_title: string; p_description: string; p_status: Database["public"]["Enums"]["work_item_status"]; p_priority: Database["public"]["Enums"]["priority_level"]; p_workstream_id: string | null; p_milestone_id: string | null; p_starts_at: string | null; p_due_at: string | null; p_progress: number; p_color: string | null; p_lane_color_shade: number; p_person_ids: string[]; p_group_ids: string[] }; Returns: Json };
      upsert_work_item_note: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_note_id: string | null; p_expected_version: number | null; p_body: string }; Returns: Json };
      delete_work_item_note: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_note_id: string; p_expected_version: number }; Returns: string };
      upsert_milestone_note: { Args: { p_workspace_id: string; p_project_id: string; p_milestone_id: string; p_note_id: string | null; p_expected_version: number | null; p_body: string }; Returns: Json };
      delete_milestone_note: { Args: { p_workspace_id: string; p_project_id: string; p_milestone_id: string; p_note_id: string; p_expected_version: number }; Returns: string };
      upsert_planning_event_note: { Args: { p_workspace_id: string; p_project_id: string; p_event_id: string; p_note_id: string | null; p_expected_version: number | null; p_body: string }; Returns: Json };
      delete_planning_event_note: { Args: { p_workspace_id: string; p_project_id: string; p_event_id: string; p_note_id: string; p_expected_version: number }; Returns: string };
      upsert_work_item_checklist_item: {
        Args: {
          p_workspace_id: string; p_project_id: string; p_work_item_id: string;
          p_checklist_item_id: string | null; p_expected_version: number | null;
          p_name: string; p_is_done: boolean; p_sort_key: string; p_person_ids: string[];
          p_note: string; p_progress: number;
        };
        Returns: Json;
      };
      upsert_plan_object_link: { Args: { p_workspace_id: string; p_project_id: string; p_object_type: "work_item" | "milestone" | "event" | "task" | "deliverable"; p_object_id: string; p_link_id: string | null; p_expected_version: number | null; p_url: string; p_label: string }; Returns: Json };
      delete_plan_object_link: { Args: { p_workspace_id: string; p_link_id: string; p_expected_version: number }; Returns: Json };
      upsert_project_deliverable: { Args: { p_workspace_id: string; p_project_id: string; p_deliverable_id: string | null; p_expected_version: number | null; p_title: string; p_description: string; p_delivery_date: string; p_progress: number; p_color: string }; Returns: Json };
      delete_project_deliverable: { Args: { p_workspace_id: string; p_id: string; p_expected_version: number }; Returns: Json };
      upsert_deliverable_note: { Args: { p_workspace_id: string; p_project_id: string; p_deliverable_id: string; p_note_id: string | null; p_expected_version: number | null; p_body: string }; Returns: Json };
      delete_deliverable_note: { Args: { p_workspace_id: string; p_project_id: string; p_deliverable_id: string; p_note_id: string; p_expected_version: number }; Returns: string };
      create_plan_dependency: { Args: { p_workspace_id: string; p_project_id: string; p_predecessor_type: "work_item" | "deliverable"; p_predecessor_id: string; p_successor_type: "work_item" | "deliverable"; p_successor_id: string; p_lag_days?: number }; Returns: Json };
      delete_plan_dependency: { Args: { p_workspace_id: string; p_project_id: string; p_id: string; p_expected_version: number }; Returns: Json };
      delete_work_item_checklist_item: {
        Args: {
          p_workspace_id: string; p_project_id: string; p_work_item_id: string;
          p_checklist_item_id: string; p_expected_version: number;
        };
        Returns: string;
      };
      upsert_planning_event: { Args: { p_workspace_id: string; p_project_id: string | null; p_event_id: string | null; p_expected_version: number | null; p_title: string; p_description: string; p_starts_at: string; p_ends_at: string | null; p_all_day: boolean; p_timezone: string; p_color: string; p_person_ids: string[]; p_group_ids: string[] }; Returns: string };
      upsert_project_phase: { Args: { p_workspace_id: string; p_project_id: string; p_phase_id: string | null; p_expected_version: number | null; p_name: string; p_description: string; p_starts_on: string; p_ends_on: string; p_color: string; p_workstream_ids: string[] }; Returns: Json };
      upsert_project_phase_serialized: { Args: { p_workspace_id: string; p_project_id: string; p_phase_id: string | null; p_expected_version: number | null; p_name: string; p_description: string; p_starts_on: string; p_ends_on: string; p_color: string; p_workstream_ids: string[] }; Returns: Json };
      resize_contiguous_project_phase_boundary: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_phase_id: string;
          p_expected_version: number;
          p_edge: "start" | "end";
          p_boundary_date: string;
          p_adjacent_phase_id: string | null;
          p_adjacent_expected_version: number | null;
        };
        Returns: Json;
      };
      upsert_project_planning_event: { Args: { p_workspace_id: string; p_project_id: string; p_event_id: string | null; p_expected_version: number | null; p_title: string; p_description: string; p_starts_at: string; p_ends_at: string | null; p_all_day: boolean; p_timezone: string; p_color: string; p_workstream_ids: string[]; p_person_ids: string[]; p_group_ids: string[] }; Returns: Json };
      upsert_person_time_off: { Args: { p_workspace_id: string; p_person_id: string; p_id: string | null; p_expected_version: number | null; p_starts_on: string; p_ends_on: string; p_note: string }; Returns: Json };
      delete_person_time_off: { Args: { p_workspace_id: string; p_id: string; p_expected_version: number }; Returns: Json };
    };
    Enums: {
      workspace_role: WorkspaceRole;
      membership_kind: MembershipKind;
      invitation_status: InvitationStatus;
      project_status: ProjectStatus;
      health_status: HealthStatus;
      workstream_status: WorkstreamStatus;
      milestone_status: MilestoneStatus;
      work_item_status: WorkItemStatus;
      priority_level: PriorityLevel;
      project_update_kind: "note" | "status" | "weekly" | "milestone";
      risk_status: "open" | "mitigating" | "accepted" | "resolved" | "closed";
      decision_status: "proposed" | "decided" | "superseded";
      dashboard_audience: "internal" | "share_safe";
      dashboard_section_type: "overview" | "projects" | "workstreams" | "milestones" | "work_items" | "updates" | "risks" | "decisions" | "ai_summary";
      ai_run_status: "queued" | "running" | "completed" | "failed" | "canceled";
      ai_suggestion_status: "proposed" | "accepted" | "rejected" | "applied";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
