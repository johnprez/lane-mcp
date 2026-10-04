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
export type ProjectAccessLevel = "view" | "edit";
// A text column + check constraint in Postgres, not an enum, so adding a cadence
// later is a check swap rather than an enum migration.
export type BudgetCadence = "one_time" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

// Journeys (20260916120000+). Text columns + check constraints in Postgres,
// not enums, so each union widens with a check swap.
export type JourneyType = "customer" | "service_blueprint" | "jtbd" | "story_map" | "lifecycle" | "custom";
export type JourneyStatus = "draft" | "active" | "validated" | "retired";
export type JourneyState = "current" | "future";
export type JourneyVisibility = "workspace" | "restricted";
export type JourneyAccessLevel = "view" | "edit";
export type JourneyRowType =
  | "text" | "touchpoint" | "emotion" | "pain" | "gain" | "opportunity" | "insight" | "solution"
  | "frontstage" | "backstage" | "people" | "linked_work" | "metric" | "image" | "freeform" | "flow" | "screens";
export type JourneyCardState = "current" | "future" | "stay" | "remove" | "create";
export type JourneyCanvasObjectKind = "sticky" | "shape" | "text" | "frame" | "image";
export type KgSourceStatus =
  | "pending" | "parsing" | "chunking" | "embedding" | "extracting" | "resolving"
  | "done" | "keyword_indexed" | "failed" | "paused_budget" | "canceled";
export type JourneyBlockKind = "persona" | "insight" | "opportunity" | "solution" | "goal" | "metric";

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
      notifications: TableDefinition<
        { id: number; workspace_id: string; project_id: string | null; recipient_user_id: string; actor_user_id: string | null; type: string; entity_type: string | null; entity_id: string | null; title: string; body: string | null; metadata: Json; read_at: string | null; emailed_at: string | null; created_at: string },
        { id?: number; workspace_id: string; project_id?: string | null; recipient_user_id: string; actor_user_id?: string | null; type: string; entity_type?: string | null; entity_id?: string | null; title: string; body?: string | null; metadata?: Json; read_at?: string | null; emailed_at?: string | null; created_at?: string },
        { read_at?: string | null; emailed_at?: string | null }
      >;
      profiles: TableDefinition<
        Timestamped & { id: string; full_name: string; avatar_url: string | null; timezone: string; active_workspace_id: string | null },
        { id: string; full_name?: string; avatar_url?: string | null; timezone?: string; active_workspace_id?: string | null; created_at?: string; updated_at?: string }
      >;
      workspaces: TableDefinition<
        Timestamped & { id: string; name: string; slug: string; created_by: string; account_id: string | null; archived_at: string | null },
        { id?: string; name: string; slug: string; created_by: string; account_id?: string | null; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      accounts: TableDefinition<
        Timestamped & { id: string; owner_user_id: string; name: string },
        { id?: string; owner_user_id: string; name?: string; created_at?: string; updated_at?: string }
      >;
      account_people: TableDefinition<
        Timestamped & { id: string; account_id: string; full_name: string; email: string; level: string | null; default_allocation_percent: number; notes: string; availability_note: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; account_id: string; full_name: string; email: string; level?: string | null; default_allocation_percent?: number; notes?: string; availability_note?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      account_person_time_off: TableDefinition<
        Timestamped & { id: string; account_id: string; account_person_id: string; starts_on: string; ends_on: string; note: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; account_id: string; account_person_id: string; starts_on: string; ends_on: string; note?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
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
      workspace_admin_settings: TableDefinition<
        Timestamped & {
          workspace_id: string; response_profile_enabled: boolean; member_limit: number | null;
          ask_lane_attachment_max_bytes: number | null; ask_lane_attachment_max_count: number | null;
        },
        {
          workspace_id: string; response_profile_enabled?: boolean; member_limit?: number | null;
          ask_lane_attachment_max_bytes?: number | null; ask_lane_attachment_max_count?: number | null;
          created_at?: string; updated_at?: string;
        }
      >;
      ai_workflow_models: TableDefinition<
        { workflow_id: string; model: string | null; reasoning: string | null; updated_by: string | null; updated_at: string },
        { workflow_id: string; model?: string | null; reasoning?: string | null; updated_by?: string | null; updated_at?: string }
      >;
      projects: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_key: string; name: string; description: string;
          status: ProjectStatus; health: HealthStatus; health_source: "auto" | "manual"; priority: PriorityLevel; owner_id: string | null;
          starts_on: string | null; due_on: string | null; version: number; created_by: string; archived_at: string | null;
        },
        {
          id?: string; workspace_id: string; project_key: string; name: string; description?: string;
          status?: ProjectStatus; health?: HealthStatus; health_source?: "auto" | "manual"; priority?: PriorityLevel; owner_id?: string | null;
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
      project_brand_profiles: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; tokens: Json; guidelines_md: string;
          export_design_md: string; source_asset_id: string | null; use_for_exports: boolean; use_for_plan: boolean;
          logo_data_url: string | null; ai_run_id: string | null; snapshot_version: string; version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; tokens?: Json; guidelines_md?: string;
          export_design_md?: string; source_asset_id?: string | null; use_for_exports?: boolean; use_for_plan?: boolean;
          logo_data_url?: string | null; ai_run_id?: string | null; snapshot_version?: string; version?: number; created_by: string;
          created_at?: string; updated_at?: string;
        }
      >;
      brand_templates: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; name: string; description: string; tokens: Json;
          guidelines_md: string; export_design_md: string; logo_data_url: string | null;
          version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; name: string; description?: string; tokens?: Json;
          guidelines_md?: string; export_design_md?: string; logo_data_url?: string | null;
          version?: number; created_by: string; created_at?: string; updated_at?: string;
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
          assignee_id: string | null; owner_person_id: string | null; starts_at: string | null; due_at: string | null; completed_at: string | null;
          blocked_reason: string | null; estimate_minutes: number | null; progress: number; sort_key: string; board_sort_key?: string | null; color?: string | null; lane_color_shade?: number;
          version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; workstream_id?: string | null; milestone_id?: string | null;
          title: string; description?: string; status?: WorkItemStatus; priority?: PriorityLevel;
          assignee_id?: string | null; owner_person_id?: string | null; starts_at?: string | null; due_at?: string | null; completed_at?: string | null;
          blocked_reason?: string | null; estimate_minutes?: number | null; progress?: number; sort_key?: string; board_sort_key?: string | null; color?: string | null; lane_color_shade?: number;
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
      plan_shared_lanes: TableDefinition<
        { id: string; workspace_id: string; project_id: string; source_project_id: string; source_workstream_id: string | null; kind: "workstream" | "milestones" | "deliverables"; sort_key: string; created_by: string; created_at: string },
        { id?: string; workspace_id: string; project_id: string; source_project_id: string; source_workstream_id?: string | null; kind?: "workstream" | "milestones" | "deliverables"; sort_key?: string; created_by: string; created_at?: string }
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
          latest_record_updated_at: string; model: string; artifact: Json; citation_links: Json; created_at: string;
        },
        {
          id?: string; workspace_id: string; user_id: string; ai_run_id: string;
          briefing_date: string; generated_at?: string; snapshot_version: string;
          latest_record_updated_at: string; model: string; artifact: Json; citation_links?: Json; created_at?: string;
        }
      >;
      access_set_briefings: TableDefinition<
        {
          id: string; workspace_id: string; project_set_key: string; project_ids: string[];
          ai_run_id: string | null; briefing_date: string; generated_at: string; snapshot_version: string;
          latest_record_updated_at: string; model: string; artifact: Json; citation_links: Json; created_at: string;
        },
        {
          id?: string; workspace_id: string; project_set_key: string; project_ids: string[];
          ai_run_id?: string | null; briefing_date: string; generated_at?: string; snapshot_version: string;
          latest_record_updated_at: string; model: string; artifact: Json; citation_links?: Json; created_at?: string;
        }
      >;
      workspace_role_catalog: TableDefinition<
        Timestamped & { id: string; workspace_id: string; name: string; description: string; color: string; sort_key: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; name: string; description?: string; color?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
      >;
      workspace_people: TableDefinition<
        Timestamped & { id: string; workspace_id: string; full_name: string; email: string | null; person_kind: "team_member" | "client"; role_title: string; organization_name: string; default_allocation_percent: number; level: string | null; notes: string; availability_note: string; account_person_id: string | null; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; full_name: string; email?: string | null; person_kind?: "team_member" | "client"; role_title?: string; organization_name?: string; default_allocation_percent?: number; level?: string | null; notes?: string; availability_note?: string; account_person_id?: string | null; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
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
        Timestamped & { id: string; workspace_id: string; project_id: string; name: string; description: string; color: string; sort_key: string; version: number; created_by: string; archived_at: string | null },
        { id?: string; workspace_id: string; project_id: string; name: string; description?: string; color?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string; archived_at?: string | null }
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
          name: string; is_done: boolean; in_progress?: boolean; completed_at: string | null; completed_by: string | null;
          note: string; progress: number; due_at: string | null;
          sort_key: string; version: number; created_by: string; created_at: string; updated_at: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; work_item_id: string;
          name: string; is_done?: boolean; in_progress?: boolean; completed_at?: string | null; completed_by?: string | null;
          note?: string; progress?: number; due_at?: string | null;
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
      // Project budget (20260910120000). Money is bigint USD cents in Postgres;
      // typed as `number` here because the TypeScript rollup sums it as a JS
      // number — the row ceilings in the migration are what keep that exact.
      project_budgets: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string; total_amount_cents: number; notes: string; version: number; created_by: string },
        { id?: string; workspace_id: string; project_id: string; total_amount_cents?: number; notes?: string; version?: number; created_by: string; created_at?: string; updated_at?: string }
      >;
      budget_buckets: TableDefinition<
        Timestamped & { id: string; workspace_id: string; project_id: string; budget_id: string; name: string; color: string; allocated_amount_cents: number; notes: string; sort_key: string; version: number; created_by: string },
        { id?: string; workspace_id: string; project_id: string; budget_id: string; name: string; color?: string; allocated_amount_cents?: number; notes?: string; sort_key?: string; version?: number; created_by: string; created_at?: string; updated_at?: string }
      >;
      budget_items: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; project_id: string; bucket_id: string;
          name: string; vendor: string; notes: string;
          planned_amount_cents: number; actual_amount_cents: number | null;
          cadence: BudgetCadence; incurred_on: string | null;
          recurrence_start_on: string | null; recurrence_end_on: string | null;
          occurrence_count: number | null; sort_key: string; version: number; created_by: string;
        },
        {
          id?: string; workspace_id: string; project_id: string; bucket_id: string;
          name: string; vendor?: string; notes?: string;
          planned_amount_cents?: number; actual_amount_cents?: number | null;
          cadence?: BudgetCadence; incurred_on?: string | null;
          recurrence_start_on?: string | null; recurrence_end_on?: string | null;
          occurrence_count?: number | null; sort_key?: string; version?: number; created_by: string;
          created_at?: string; updated_at?: string;
        }
      >;
      // Journeys (20260916120000, 20260917120000). Select-only to
      // `authenticated`; every write goes through the journey RPCs below.
      journeys: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; title: string; description: string;
          journey_type: JourneyType; status: JourneyStatus; state: JourneyState;
          future_of_journey_id: string | null; visibility: JourneyVisibility;
          owner_user_id: string | null; template: string; level: number;
          parent_step_id: string | null; persona_id: string | null; sort_key: string; version: number;
          created_by: string; archived_at: string | null;
        }
      >;
      journey_access: TableDefinition<
        { workspace_id: string; journey_id: string; user_id: string; access_level: JourneyAccessLevel; created_by: string; created_at: string }
      >;
      journey_project_links: TableDefinition<
        { id: string; workspace_id: string; journey_id: string; project_id: string; created_by: string; created_at: string }
      >;
      journey_share_links: TableDefinition<
        { id: string; workspace_id: string; journey_id: string; token_hash: string; token_prefix: string; include_evidence: boolean; include_screens: boolean; include_flows: boolean; expires_at: string | null; revoked_at: string | null; created_by: string; created_at: string; last_accessed_at: string | null; access_count: number }
      >;
      journey_events: TableDefinition<
        { id: number; workspace_id: string; journey_id: string; actor_user_id: string | null; entity_type: string; entity_id: string | null; action: string; metadata: Json; created_at: string }
      >;
      journey_stages: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string; name: string; description: string; color: string; sort_key: string; version: number; created_by: string }
      >;
      journey_steps: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string; stage_id: string; name: string; description: string; width: number; sort_key: string; version: number; created_by: string }
      >;
      journey_rows: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; name: string; row_type: JourneyRowType;
          is_line_of_visibility: boolean; color: string; height: number; collapsed: boolean;
          config: Json; sort_key: string; version: number; created_by: string;
        }
      >;
      journey_cards: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; row_id: string; step_id: string;
          span: number; title: string; body: string; card_state: JourneyCardState;
          emotion: number | null; person_id: string | null; role_id: string | null;
          color: string | null; x: number | null; y: number | null; meta: Json;
          sort_key: string; version: number; created_by: string;
        }
      >;
      journey_canvas_objects: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; kind: JourneyCanvasObjectKind;
          x: number; y: number; w: number; h: number; rotation: number; content: string;
          color: string; style: Json; z_index: number; version: number; created_by: string;
        }
      >;
      journey_connectors: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string;
          from_card_id: string | null; from_object_id: string | null;
          to_card_id: string | null; to_object_id: string | null;
          label: string; line_style: "solid" | "dashed"; version: number; created_by: string;
        }
      >;
      // Journey building blocks (20260921120000). journey_id = HOME journey
      // (access follows it); NULL = the workspace library.
      journey_personas: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; name: string; description: string; quote: string; color: string; attributes: Json; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_insights: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; title: string; statement: string; insight_kind: "factual" | "interpreted"; impact: number; reliability: "low" | "medium" | "high"; tags: string[]; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_opportunities: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; title: string; description: string; opportunity_status: "idea" | "exploring" | "committed" | "done" | "parked"; customer_value: number; business_value: number; scoring_model: "value" | "rice" | "ice" | "custom"; score_inputs: Json; score: number | null; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_solutions: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; title: string; description: string; solution_status: "idea" | "planned" | "in_progress" | "shipped" | "dropped"; effort: number | null; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_goals: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; title: string; description: string; target_on: string | null; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_metrics: TableDefinition<
        Timestamped & { id: string; workspace_id: string; journey_id: string | null; goal_id: string | null; name: string; description: string; unit: string; direction: "up" | "down"; baseline: number | null; target: number | null; sort_key: string; version: number; created_by: string; archived_at: string | null }
      >;
      journey_metric_values: TableDefinition<
        { id: string; workspace_id: string; metric_id: string; value: number; observed_on: string; note: string; created_by: string; created_at: string }
      >;
      journey_block_links: TableDefinition<
        { id: string; workspace_id: string; journey_id: string; card_id: string | null; step_id: string | null; persona_id: string | null; insight_id: string | null; opportunity_id: string | null; solution_id: string | null; goal_id: string | null; metric_id: string | null; created_by: string; created_at: string }
      >;
      journey_opportunity_solutions: TableDefinition<
        { workspace_id: string; opportunity_id: string; solution_id: string; created_by: string; created_at: string }
      >;
      // Journey -> real work (20260923120000). Read linked work ONLY through
      // get_journey_linked_work (redacted DTO); this table is for counts/joins.
      journey_work_links: TableDefinition<
        { id: string; workspace_id: string; journey_id: string; card_id: string | null; opportunity_id: string | null; solution_id: string | null; project_id: string; target_kind: "work_item" | "checklist_item" | "milestone"; work_item_id: string | null; checklist_item_id: string | null; milestone_id: string | null; created_by: string; created_at: string }
      >;
      // Journey evidence + comments (20260924120000).
      journey_evidence: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; card_id: string | null; insight_id: string | null;
          evidence_kind: "url" | "note" | "image" | "file" | "quote"; title: string; url: string | null; body: string;
          source_label: string; storage_path: string | null; mime_type: string | null; byte_size: number | null;
          embed: Json; kg_chunk_id: string | null; version: number; created_by: string;
        }
      >;
      journey_screens: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; step_id: string | null; card_id: string | null;
          title: string; caption: string; source_kind: "upload" | "figma"; storage_path: string | null; thumb_path: string | null;
          mime_type: string | null; byte_size: number | null; width: number | null; height: number | null; figma_url: string | null;
          sort_key: string; version: number; created_by: string;
        }
      >;
      // Journey flows (20261008120000). Select-only; writes go through the RPCs.
      journey_flows: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; step_id: string | null; card_id: string | null;
          title: string; description: string; sort_key: string; version: number; created_by: string;
        }
      >;
      journey_flow_nodes: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; flow_id: string;
          kind: "entry" | "decision" | "screen" | "action" | "system" | "note" | "exit";
          label: string; body: string; x: number; y: number; w: number | null; screen_id: string | null;
          link_kind: "step" | "card" | "flow" | "journey" | null; target_journey_id: string | null;
          target_step_id: string | null; target_card_id: string | null; target_flow_id: string | null;
          version: number; created_by: string;
        }
      >;
      journey_flow_edges: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; flow_id: string; from_node_id: string; to_node_id: string;
          label: string; path_class: "happy" | "unhappy" | "alternate" | "neutral";
          source_side: "n" | "e" | "s" | "w" | null; target_side: "n" | "e" | "s" | "w" | null;
          sort_key: string; version: number; created_by: string;
        }
      >;
      journey_comments: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; journey_id: string; card_id: string | null; parent_id: string | null;
          body: string; mentions: string[]; resolved_at: string | null; resolved_by: string | null;
          edited_at: string | null; version: number; created_by: string;
        }
      >;
      // Platform feature flags (20260930120000). Readable by everyone signed in;
      // written only by set_platform_feature_flag (platform admins, audited).
      platform_feature_flags: TableDefinition<
        { key: string; enabled: boolean; updated_by: string | null; updated_at: string }
      >;
      platform_feature_flag_events: TableDefinition<
        { id: number; flag_key: string; enabled: boolean; actor_user_id: string | null; reason: string; created_at: string }
      >;
      // Knowledge graph (20260927120000+). Select-only, scope-gated.
      kg_scopes: TableDefinition<
        { id: string; workspace_id: string; scope_kind: "workspace" | "project" | "journey"; project_id: string | null; journey_id: string | null; created_by: string | null; created_at: string }
      >;
      kg_sources: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; scope_id: string; source_kind: "upload" | "url" | "note" | "lane_record" | "graphify_import";
          title: string; uri: string | null; storage_path: string | null; mime_type: string | null; byte_size: number | null;
          checksum: string | null; inline_text: string | null; lane_ref_type: string | null; lane_ref_id: string | null;
          status: KgSourceStatus; depth: "full" | "keyword_only"; error_message: string | null; page_count: number | null;
          chunk_count: number; token_count: number; cost_usd: number; last_ingested_at: string | null; version: number; created_by: string | null;
        }
      >;
      kg_chunks: TableDefinition<
        { id: string; workspace_id: string; scope_id: string; source_id: string; ordinal: number; content: string; content_hash: string; token_count: number; locator: Json; embedding: string | null; embedding_model: string | null; created_at: string }
      >;
      kg_nodes: TableDefinition<
        Timestamped & { id: string; workspace_id: string; scope_id: string; canonical_key: string; label: string; node_type: string; description: string; aliases: string[]; embedding: string | null; embedding_model: string | null; community_id: string | null; mention_count: number }
      >;
      kg_edges: TableDefinition<
        Timestamped & { id: string; workspace_id: string; scope_id: string; source_node_id: string; target_node_id: string; relation: string; provenance: "EXTRACTED" | "INFERRED" | "AMBIGUOUS"; score: number; weight: number }
      >;
      kg_edge_evidence: TableDefinition<
        { workspace_id: string; scope_id: string; edge_id: string; chunk_id: string; quote: string; created_at: string }
      >;
      kg_node_refs: TableDefinition<
        { node_id: string; workspace_id: string; scope_id: string; ref_type: "project" | "work_item" | "milestone" | "journey" | "card" | "insight" | "person"; project_id: string | null; work_item_id: string | null; milestone_id: string | null; journey_id: string | null; card_id: string | null; insight_id: string | null; person_id: string | null; created_at: string }
      >;
      kg_node_links: TableDefinition<
        { id: string; workspace_id: string; node_a_id: string; scope_a_id: string; node_b_id: string; scope_b_id: string; relation: "same_as" | "related_to"; created_by: string | null; created_at: string }
      >;
      kg_communities: TableDefinition<
        Timestamped & { id: string; workspace_id: string; scope_id: string; label: string; summary: string | null; member_count: number; signature: string; summarized_at: string | null; summary_model: string | null }
      >;
      kg_jobs: TableDefinition<
        Timestamped & {
          id: string; workspace_id: string; scope_id: string; source_id: string | null;
          job_kind: "ingest" | "sync_lane" | "communities" | "summarize" | "graphify_import";
          status: "queued" | "running" | "done" | "failed" | "paused_budget" | "canceled"; stage: string | null; progress: number; attempts: number;
          lease_owner: string | null; lease_expires_at: string | null; run_id: string | null; estimate: Json; error_message: string | null;
          requested_by: string | null; finished_at: string | null;
        }
      >;
      kg_job_steps: TableDefinition<
        { id: number; workspace_id: string; job_id: string; step: string; status: "running" | "done" | "failed" | "skipped"; started_at: string; finished_at: string | null; input_tokens: number; output_tokens: number; cost_usd: number; detail: Json }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      // Project budget writes (20260911120000). `?` marks only the arguments the
      // SQL actually declares a default for.
      upsert_project_budget: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_expected_version: number | null;
          p_total_amount_cents: number;
          p_notes: string;
        };
        Returns: Json;
      };
      upsert_budget_bucket: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_bucket_id: string | null;
          p_expected_version: number | null;
          p_name: string;
          p_color: string;
          p_allocated_amount_cents: number;
          p_sort_key: string;
          p_notes: string;
        };
        Returns: Json;
      };
      seed_project_budget_buckets: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_names: string[];
          p_total_amount_cents?: number | null;
        };
        Returns: Json;
      };
      upsert_budget_item: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_bucket_id: string;
          p_item_id: string | null;
          p_expected_version: number | null;
          p_name: string;
          p_vendor: string;
          p_notes: string;
          p_planned_amount_cents: number;
          p_actual_amount_cents: number | null;
          p_cadence: BudgetCadence;
          p_incurred_on: string | null;
          p_recurrence_start_on: string | null;
          p_recurrence_end_on: string | null;
          p_occurrence_count: number | null;
          p_sort_key: string;
        };
        Returns: Json;
      };
      delete_budget_bucket: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_bucket_id: string;
          p_move_items_to_bucket_id?: string | null;
        };
        Returns: Json;
      };
      delete_budget_item: {
        Args: { p_workspace_id: string; p_project_id: string; p_item_id: string };
        Returns: Json;
      };
      reorder_budget_buckets: {
        Args: { p_workspace_id: string; p_project_id: string; p_bucket_ids: string[] };
        Returns: Json;
      };
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
          p_citation_links?: Json;
        };
        Returns: string;
      };
      create_workspace: { Args: { p_name: string; p_slug?: string | null }; Returns: string };
      set_active_workspace: { Args: { p_workspace_id: string | null }; Returns: boolean };
      create_workspace_invitation: { Args: { p_workspace_id: string; p_email: string; p_role: WorkspaceRole; p_project_grants?: Json }; Returns: string };
      my_project_access: { Args: { p_project_id: string }; Returns: string };
      my_assigned_work: {
        Args: { p_workspace_id: string };
        Returns: {
          kind: string;
          id: string;
          title: string;
          activity_id: string | null;
          activity_title: string | null;
          project_id: string | null;
          project_name: string | null;
          due_on: string | null;
          status: string | null;
          is_done: boolean;
        }[];
      };
      complete_checklist_item: { Args: { p_project_id: string; p_checklist_item_id: string; p_done?: boolean }; Returns: boolean };
      set_work_item_owner: { Args: { p_project_id: string; p_work_item_id: string; p_owner_person_id?: string | null }; Returns: boolean };
      list_accomplishments: {
        Args: { p_workspace_id: string; p_since: string };
        Returns: {
          id: number;
          created_at: string;
          actor_name: string;
          entity_type: string;
          label: string | null;
          project_id: string;
          project_name: string;
        }[];
      };
      list_project_activity: {
        Args: {
          p_project_id: string;
          p_search?: string | null;
          p_category?: string | null;
          p_actor?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_limit?: number | null;
          p_before_created?: string | null;
          p_before_id?: number | null;
        };
        Returns: {
          id: number;
          created_at: string;
          actor_user_id: string | null;
          actor_name: string;
          actor_email: string | null;
          entity_type: string;
          entity_id: string | null;
          action: string;
          category: string;
          metadata: Json;
        }[];
      };
      accessible_project_ids_for_user: { Args: { p_user_id: string; p_workspace_id: string }; Returns: string[] };
      set_project_access: { Args: { p_workspace_id: string; p_project_id: string; p_user_id: string; p_level: ProjectAccessLevel }; Returns: boolean };
      remove_project_access: { Args: { p_workspace_id: string; p_project_id: string; p_user_id: string }; Returns: boolean };
      list_project_access: {
        Args: { p_workspace_id: string };
        Returns: { project_id: string; user_id: string; email: string; full_name: string; access_level: ProjectAccessLevel; created_at: string }[];
      };
      revoke_workspace_invitation: { Args: { p_invitation_id: string }; Returns: boolean };
      set_workspace_member_role: { Args: { p_workspace_id: string; p_user_id: string; p_role: WorkspaceRole }; Returns: boolean };
      remove_workspace_member: { Args: { p_workspace_id: string; p_user_id: string }; Returns: boolean };
      add_workspace_member: { Args: { p_workspace_id: string; p_user_id: string; p_role: WorkspaceRole }; Returns: boolean };
      list_workspace_members: {
        Args: { p_workspace_id: string };
        Returns: { user_id: string; email: string; full_name: string; role: WorkspaceRole; membership_kind: MembershipKind; created_at: string }[];
      };
      list_workspace_invitations: {
        Args: { p_workspace_id: string };
        Returns: { id: string; email: string; role: WorkspaceRole; status: InvitationStatus; invited_by_name: string; created_at: string; expires_at: string }[];
      };
      accept_pending_invitations: { Args: Record<PropertyKey, never>; Returns: number };
      transfer_workspace_owner: { Args: { p_workspace_id: string; p_new_owner_user_id: string }; Returns: boolean };
      set_workspace_admin_settings: { Args: { p_workspace_id: string; p_response_profile_enabled: boolean; p_member_limit: number | null; p_ask_lane_attachment_max_bytes?: number | null; p_ask_lane_attachment_max_count?: number | null }; Returns: boolean };
      set_workflow_model: { Args: { p_workflow_id: string; p_model: string | null; p_reasoning: string | null }; Returns: boolean };
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
      reorder_plan_lanes: {
        Args: { p_workspace_id: string; p_project_id: string; p_order: Json };
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
      move_plan_work_item_order: {
        Args: {
          p_workspace_id: string;
          p_project_id: string;
          p_item_id: string;
          p_expected_version: number;
          p_workstream_id: string | null;
          p_sort_key: string;
        };
        Returns: Json;
      };
      upsert_workspace_team_group: { Args: { p_workspace_id: string; p_project_id: string; p_group_id: string | null; p_expected_version: number | null; p_name: string; p_description: string; p_color: string; p_person_ids: string[] }; Returns: string };
      archive_workspace_team_group: { Args: { p_workspace_id: string; p_project_id: string; p_group_id: string; p_expected_version: number }; Returns: string };
      upsert_project_brand_profile: { Args: { p_workspace_id: string; p_project_id: string; p_expected_version: number | null; p_tokens: Json; p_guidelines_md: string; p_use_for_exports: boolean; p_use_for_plan: boolean; p_source_asset_id: string | null; p_logo_data_url: string | null }; Returns: Json };
      set_project_export_design: { Args: { p_workspace_id: string; p_project_id: string; p_export_design_md: string }; Returns: Json };
      start_brand_analysis_run: { Args: { p_workspace_id: string; p_project_id: string; p_model: string; p_input_refs: Json }; Returns: string };
      complete_and_store_brand_analysis: { Args: { p_workspace_id: string; p_run_id: string; p_project_id: string; p_output: Json; p_tokens: Json; p_guidelines_md: string; p_source_asset_id: string | null; p_input_tokens: number; p_output_tokens: number }; Returns: Json };
      replace_work_item_planning_assignments: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_expected_version: number; p_person_ids: string[]; p_group_ids: string[] }; Returns: number };
      clear_project: { Args: { p_workspace_id: string; p_project_id: string; p_expected_version: number }; Returns: Json };
      update_work_item_plan_with_owners: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_expected_version: number; p_title: string; p_description: string; p_status: Database["public"]["Enums"]["work_item_status"]; p_priority: Database["public"]["Enums"]["priority_level"]; p_workstream_id: string | null; p_milestone_id: string | null; p_starts_at: string | null; p_due_at: string | null; p_progress: number; p_color: string | null; p_lane_color_shade: number; p_person_ids: string[]; p_group_ids: string[] }; Returns: Json };
      bulk_update_work_items: { Args: { p_workspace_id: string; p_project_id: string; p_ids: string[]; p_set: Json }; Returns: Json };
      move_work_item_on_board: { Args: { p_workspace_id: string; p_project_id: string; p_work_item_id: string; p_status: Database["public"]["Enums"]["work_item_status"]; p_board_sort_key: string }; Returns: Json };
      move_checklist_task_on_board: { Args: { p_workspace_id: string; p_project_id: string; p_task_id: string; p_state: string }; Returns: Json };
      bulk_create_work_item_checklist_items: { Args: { p_workspace_id: string; p_project_id: string; p_lane_id: string | null; p_create_missing: boolean; p_tasks: Json }; Returns: Json };
      bulk_create_work_item_dependencies: { Args: { p_workspace_id: string; p_project_id: string; p_edges: Json }; Returns: Json };
      save_brand_template: { Args: { p_workspace_id: string; p_template_id: string | null; p_expected_version: number | null; p_name: string; p_description: string; p_tokens: Json; p_guidelines_md: string; p_export_design_md: string; p_logo_data_url: string | null }; Returns: Json };
      delete_brand_template: { Args: { p_workspace_id: string; p_template_id: string; p_expected_version: number }; Returns: Json };
      archive_project_planning_event: { Args: { p_workspace_id: string; p_id: string; p_expected_version: number }; Returns: Json };
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
          p_note: string; p_progress: number; p_due_at?: string | null;
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
      upsert_account_person: { Args: { p_account_id: string; p_id: string | null; p_expected_version: number | null; p_full_name: string; p_email: string | null; p_level: string | null; p_allocation: number; p_notes: string; p_availability_note: string }; Returns: Json };
      archive_account_person: { Args: { p_account_id: string; p_id: string; p_expected_version: number }; Returns: Json };
      record_eve_run: { Args: { p_model: string; p_input_tokens: number; p_output_tokens: number; p_turn_ref?: string | null }; Returns: string };
      upsert_account_person_time_off: { Args: { p_account_id: string; p_account_person_id: string; p_id: string | null; p_expected_version: number | null; p_starts_on: string; p_ends_on: string; p_note: string }; Returns: Json };
      delete_account_person_time_off: { Args: { p_account_id: string; p_id: string; p_expected_version: number }; Returns: Json };
      // Journey writes (20260918120000, 20260919120000). Every one returns a
      // receipt instead of raising on throttle ({throttled:true}) or a stale
      // version ({conflict:true}).
      my_journey_access: { Args: { p_journey_id: string }; Returns: "admin" | "manage" | "edit" | "view" | "none" };
      create_journey: {
        Args: {
          p_workspace_id: string; p_title: string; p_description: string; p_journey_type: JourneyType;
          p_visibility: JourneyVisibility; p_template: string; p_structure: Json;
          p_future_of_journey_id?: string | null; p_parent_step_id?: string | null;
        };
        Returns: Json;
      };
      update_journey: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_expected_version: number;
          p_title: string; p_description: string; p_journey_type: JourneyType; p_status: JourneyStatus;
        };
        Returns: Json;
      };
      set_journey_sharing: {
        Args: { p_workspace_id: string; p_journey_id: string; p_expected_version: number; p_visibility: JourneyVisibility; p_owner_user_id: string | null };
        Returns: Json;
      };
      set_journey_archived: { Args: { p_workspace_id: string; p_journey_id: string; p_archived: boolean }; Returns: Json };
      delete_journey: { Args: { p_workspace_id: string; p_journey_id: string }; Returns: string };
      set_journey_access: {
        Args: { p_workspace_id: string; p_journey_id: string; p_user_id: string; p_access_level: JourneyAccessLevel | null };
        Returns: Json;
      };
      link_journey_project: { Args: { p_workspace_id: string; p_journey_id: string; p_project_id: string }; Returns: Json };
      unlink_journey_project: { Args: { p_workspace_id: string; p_journey_id: string; p_project_id: string }; Returns: string };
      upsert_journey_stage: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_stage_id: string | null; p_expected_version: number | null;
          p_name: string; p_description: string; p_color: string; p_sort_key: string;
        };
        Returns: Json;
      };
      upsert_journey_step: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_step_id: string | null; p_expected_version: number | null;
          p_stage_id: string | null; p_name: string; p_description: string; p_sort_key: string;
        };
        Returns: Json;
      };
      upsert_journey_row: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_row_id: string | null; p_expected_version: number | null;
          p_name: string; p_row_type: JourneyRowType; p_is_line_of_visibility: boolean; p_color: string;
          p_collapsed: boolean; p_config: Json; p_sort_key: string;
        };
        Returns: Json;
      };
      upsert_journey_card: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_card_id: string | null; p_expected_version: number | null;
          p_row_id: string | null; p_step_id: string | null; p_span: number | null; p_sort_key: string | null;
          p_title: string; p_body: string; p_card_state: JourneyCardState; p_emotion: number | null;
          p_person_id: string | null; p_role_id: string | null; p_color: string | null; p_meta: Json;
        };
        Returns: Json;
      };
      upsert_journey_canvas_object: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_object_id: string | null; p_expected_version: number | null;
          p_kind: JourneyCanvasObjectKind | null; p_x: number | null; p_y: number | null; p_w: number | null; p_h: number | null;
          p_content: string; p_color: string; p_style: Json;
        };
        Returns: Json;
      };
      upsert_journey_connector: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_connector_id: string | null; p_expected_version: number | null;
          p_from_card_id: string | null; p_from_object_id: string | null; p_to_card_id: string | null; p_to_object_id: string | null;
          p_label: string; p_line_style: "solid" | "dashed";
        };
        Returns: Json;
      };
      delete_journey_entity: {
        Args: { p_workspace_id: string; p_journey_id: string; p_entity: "stage" | "step" | "row" | "card" | "object" | "connector" | "flow"; p_id: string };
        Returns: string;
      };
      duplicate_journey_as_future: { Args: { p_workspace_id: string; p_journey_id: string; p_title?: string | null }; Returns: Json };
      create_journey_share: {
        Args: { p_workspace_id: string; p_journey_id: string; p_token_hash: string; p_token_prefix: string; p_include_evidence: boolean; p_expires_at: string | null; p_include_screens?: boolean; p_include_flows?: boolean };
        Returns: Json;
      };
      revoke_journey_share: { Args: { p_workspace_id: string; p_share_id: string }; Returns: string };
      read_journey_share: { Args: { p_token_hash: string }; Returns: Json };
      apply_journey_canvas_ops: { Args: { p_workspace_id: string; p_journey_id: string; p_ops: Json }; Returns: Json };
      // Journey building blocks + work links (20260922120000, 20260923120000).
      upsert_journey_block: {
        Args: { p_workspace_id: string; p_kind: JourneyBlockKind; p_id: string | null; p_expected_version: number | null; p_home_journey_id: string | null; p_fields: Json };
        Returns: Json;
      };
      delete_journey_block: { Args: { p_workspace_id: string; p_kind: JourneyBlockKind; p_id: string }; Returns: string };
      link_journey_block: {
        Args: { p_workspace_id: string; p_journey_id: string; p_kind: JourneyBlockKind; p_block_id: string; p_card_id?: string | null; p_step_id?: string | null };
        Returns: Json;
      };
      unlink_journey_block: { Args: { p_workspace_id: string; p_journey_id: string; p_link_id: string }; Returns: string };
      set_journey_opportunity_solution: {
        Args: { p_workspace_id: string; p_opportunity_id: string; p_solution_id: string; p_linked: boolean };
        Returns: Json;
      };
      record_journey_metric_value: {
        Args: { p_workspace_id: string; p_metric_id: string; p_value: number; p_observed_on: string | null; p_note: string };
        Returns: Json;
      };
      delete_journey_metric_value: { Args: { p_workspace_id: string; p_value_id: string }; Returns: string };
      link_journey_work: {
        Args: { p_workspace_id: string; p_journey_id: string; p_source_kind: "card" | "opportunity" | "solution"; p_source_id: string; p_target_kind: "work_item" | "checklist_item" | "milestone"; p_target_id: string };
        Returns: Json;
      };
      unlink_journey_work: { Args: { p_workspace_id: string; p_journey_id: string; p_link_id: string }; Returns: string };
      get_journey_linked_work: { Args: { p_journey_id: string }; Returns: Json };
      // Journey evidence, assets, comments (20260924120000, 20260925120000).
      add_journey_evidence: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_card_id: string | null; p_insight_id: string | null;
          p_kind: "url" | "note" | "quote"; p_title: string; p_url: string | null; p_body: string; p_source_label: string; p_embed?: Json;
        };
        Returns: Json;
      };
      update_journey_evidence: {
        Args: { p_workspace_id: string; p_journey_id: string; p_evidence_id: string; p_expected_version: number; p_title: string; p_body: string; p_source_label: string };
        Returns: Json;
      };
      delete_journey_evidence: { Args: { p_workspace_id: string; p_journey_id: string; p_evidence_id: string }; Returns: Json };
      register_journey_asset: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_card_id: string | null; p_insight_id: string | null;
          p_kind: "image" | "file"; p_title: string; p_storage_path: string; p_mime_type: string; p_byte_size: number; p_source_label?: string;
        };
        Returns: Json;
      };
      // Journey screens (20261007120000).
      register_journey_screen: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_step_id: string | null; p_card_id: string | null; p_title: string; p_caption: string;
          p_storage_path: string; p_thumb_path: string | null; p_mime_type: string; p_byte_size: number; p_width: number | null; p_height: number | null; p_sort_key?: string;
        };
        Returns: Json;
      };
      add_journey_figma_screen: {
        Args: { p_workspace_id: string; p_journey_id: string; p_step_id: string | null; p_card_id: string | null; p_title: string; p_caption: string; p_figma_url: string; p_sort_key?: string };
        Returns: Json;
      };
      update_journey_screen: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_screen_id: string; p_expected_version: number; p_title: string; p_caption: string;
          p_step_id: string | null; p_card_id: string | null; p_sort_key: string;
        };
        Returns: Json;
      };
      delete_journey_screen: { Args: { p_workspace_id: string; p_journey_id: string; p_screen_id: string }; Returns: Json };
      relocate_journey_screens: {
        Args: { p_workspace_id: string; p_journey_id: string; p_scope: "card" | "row" | "step" | "stage"; p_id: string; p_target_step_id?: string | null };
        Returns: Json;
      };
      // Journey flows (20261008120000).
      upsert_journey_flow: {
        Args: {
          p_workspace_id: string; p_journey_id: string; p_flow_id: string | null; p_expected_version: number | null;
          p_step_id: string | null; p_card_id: string | null; p_title: string; p_description: string; p_sort_key: string;
        };
        Returns: Json;
      };
      apply_journey_flow_edits: { Args: { p_workspace_id: string; p_journey_id: string; p_flow_id: string; p_edits: Json }; Returns: Json };
      apply_journey_flow_ops: { Args: { p_workspace_id: string; p_journey_id: string; p_flow_id: string; p_ops: Json }; Returns: Json };
      read_journey_flow: { Args: { p_workspace_id: string; p_journey_id: string; p_flow_id: string }; Returns: Json };
      resolve_journey_flow_links: { Args: { p_workspace_id: string; p_journey_id: string; p_flow_id?: string | null }; Returns: Json };
      journey_flow_inbound: { Args: { p_workspace_id: string; p_journey_id: string }; Returns: Json };
      relocate_journey_flows: {
        Args: { p_workspace_id: string; p_journey_id: string; p_scope: "card" | "row" | "step" | "stage"; p_id: string; p_target_step_id?: string | null };
        Returns: Json;
      };
      list_journey_asset_orphans: { Args: { p_limit?: number }; Returns: Json };
      clear_journey_asset_orphans: { Args: { p_ids: number[] }; Returns: number };
      add_journey_comment: {
        Args: { p_workspace_id: string; p_journey_id: string; p_card_id: string | null; p_parent_id: string | null; p_body: string; p_mentions: string[] };
        Returns: Json;
      };
      edit_journey_comment: {
        Args: { p_workspace_id: string; p_journey_id: string; p_comment_id: string; p_expected_version: number; p_body: string };
        Returns: Json;
      };
      resolve_journey_comment: { Args: { p_workspace_id: string; p_journey_id: string; p_comment_id: string; p_resolved: boolean }; Returns: Json };
      delete_journey_comment: { Args: { p_workspace_id: string; p_journey_id: string; p_comment_id: string }; Returns: string };
      // Knowledge graph (20260928120000, 20260930120000).
      knowledge_graph_status: { Args: { p_workspace_id: string }; Returns: Json };
      set_platform_feature_flag: { Args: { p_key: string; p_enabled: boolean; p_reason?: string }; Returns: Json };
      set_workspace_kg_enabled: { Args: { p_workspace_id: string; p_enabled: boolean }; Returns: Json };
      set_workspace_kg_limits: {
        Args: { p_workspace_id: string; p_monthly_usd_cap: number; p_max_pages_per_source: number; p_max_sources_per_day: number };
        Returns: Json;
      };
      ensure_kg_scope: { Args: { p_workspace_id: string; p_kind: "workspace" | "project" | "journey"; p_anchor_id: string | null }; Returns: string };
      register_kg_source: {
        Args: {
          p_workspace_id: string; p_scope_id: string; p_kind: "upload" | "url" | "note" | "graphify_import"; p_title: string;
          p_uri: string | null; p_storage_path: string | null; p_mime_type: string | null; p_byte_size: number | null;
          p_checksum: string | null; p_inline_text: string | null; p_depth: "full" | "keyword_only"; p_estimate?: Json;
        };
        Returns: Json;
      };
      delete_kg_source: { Args: { p_workspace_id: string; p_source_id: string }; Returns: Json };
      resume_kg_job: { Args: { p_workspace_id: string; p_job_id: string }; Returns: Json };
      cancel_kg_job: { Args: { p_workspace_id: string; p_job_id: string }; Returns: Json };
      merge_kg_nodes: { Args: { p_workspace_id: string; p_keep_id: string; p_drop_id: string }; Returns: Json };
      mark_kg_nodes_distinct: { Args: { p_workspace_id: string; p_edge_id: string }; Returns: Json };
      link_kg_nodes: { Args: { p_workspace_id: string; p_node_a: string; p_node_b: string; p_relation?: "same_as" | "related_to" }; Returns: Json };
      kg_search: {
        Args: { p_scope_ids: string[]; p_query_text: string; p_query_embedding?: string | null; p_limit?: number };
        Returns: Array<{ chunk_id: string; source_id: string; scope_id: string; source_title: string; content: string; locator: Json; score: number; vector_rank: number | null; text_rank: number | null }>;
      };
      decide_kg_insight_candidate: {
        Args: { p_workspace_id: string; p_candidate_id: string; p_decision: "accept" | "attach" | "dismiss"; p_existing_insight_id?: string | null; p_journey_id?: string | null };
        Returns: Json;
      };
      kg_neighborhood: { Args: { p_node_ids: string[]; p_hops?: number; p_limit?: number }; Returns: Json };
      kg_path: { Args: { p_from: string; p_to: string; p_max_hops?: number }; Returns: Json };
      claim_kg_job: { Args: { p_owner: string; p_lease_seconds: number; p_job_id?: string | null }; Returns: Json };
      finish_kg_job: { Args: { p_job_id: string; p_owner: string; p_status: "done" | "failed" | "paused_budget" | "queued"; p_error?: string | null }; Returns: undefined };
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
      project_access_level: ProjectAccessLevel;
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
