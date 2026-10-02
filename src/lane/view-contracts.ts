import { z } from "zod";

/**
 * Transport-neutral contract for Ask Lane's tool-driven generative UI.
 *
 * Two schemas travel this seam:
 *   - {@link LaneViewRequestSchema} is the *model input* — narrow, so the model
 *     only ever picks a view and (for data-bound views) an entity id. It never
 *     authors numbers for a data-bound view.
 *   - {@link LaneViewSchema} is the *hydrated output* the client renderer draws.
 *     For data-bound views the server fills in real, server-computed values; for
 *     content views the payload is the model's own narrative, passed through.
 *
 * Like {@link ./contracts.ts}, this file has no database client, no environment
 * variables, and no side effects. The `render_view` tool imports it to validate
 * both ends of its own boundary; the Ask Lane renderer imports it to re-validate
 * the payload before drawing (a mismatch degrades to a receipt card).
 */

const ShortText = z.string().trim().min(1).max(160);
const BodyText = z.string().trim().min(1).max(2_000);
const CellText = z.string().trim().max(160);
const IdSchema = z.string().uuid();
const NullableIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

// --------------------------------------------------------------------------
// Content views — model-authored. No ground truth to violate, so the model
// writes these directly and they pass through hydration unchanged.
// --------------------------------------------------------------------------

const MetricGridBody = {
  title: ShortText.optional(),
  items: z
    .array(
      z
        .object({
          label: ShortText,
          value: ShortText,
          note: ShortText.optional(),
        })
        .strict(),
    )
    .min(1)
    .max(8),
};

const ComparisonTableBody = {
  title: ShortText.optional(),
  columns: z.array(ShortText).min(2).max(6),
  rows: z
    .array(z.object({ cells: z.array(CellText).min(2).max(6) }).strict())
    .min(1)
    .max(12),
};

const CalloutBody = {
  tone: z.enum(["info", "warn", "critical"]),
  eyebrow: ShortText.optional(),
  title: ShortText,
  body: BodyText,
};

const StepsBody = {
  title: ShortText.optional(),
  steps: z
    .array(z.object({ title: ShortText, detail: ShortText.optional() }).strict())
    .min(1)
    .max(10),
};

const MetricGridViewSchema = z.object({ view: z.literal("metric_grid"), ...MetricGridBody }).strict();
const ComparisonTableViewSchema = z
  .object({ view: z.literal("comparison_table"), ...ComparisonTableBody })
  .strict();
const CalloutViewSchema = z.object({ view: z.literal("callout"), ...CalloutBody }).strict();
const StepsViewSchema = z.object({ view: z.literal("steps"), ...StepsBody }).strict();

// --------------------------------------------------------------------------
// Data-bound views — request carries only an id/scope; the server hydrates the
// numbers. These request members deliberately do not accept metric values.
// --------------------------------------------------------------------------

const ProjectSignalsRequestSchema = z
  .object({ view: z.literal("project_signals"), projectId: IdSchema })
  .strict();
const ProjectOverviewRequestSchema = z
  .object({ view: z.literal("project_overview"), projectId: IdSchema })
  .strict();
const MilestonesRequestSchema = z
  .object({ view: z.literal("milestones"), projectId: IdSchema })
  .strict();
const PortfolioHealthRequestSchema = z
  .object({ view: z.literal("portfolio_health"), workspaceId: IdSchema.optional() })
  .strict();
const AvailabilityRequestSchema = z
  // Pass `projectId` for one project, or omit it (optionally with `workspaceId`)
  // to answer portfolio-wide "who's out / any PTO conflicts" across all projects.
  .object({ view: z.literal("availability"), projectId: IdSchema.optional(), workspaceId: IdSchema.optional() })
  .strict();
const DeliverablesRequestSchema = z
  .object({ view: z.literal("deliverables"), projectId: IdSchema })
  .strict();
const ActivitiesRequestSchema = z
  .object({ view: z.literal("activities"), projectId: IdSchema })
  .strict();
const WorkloadRequestSchema = z
  // Pass `projectId` for one project, or omit it (optionally with `workspaceId`)
  // to roll workload up across the workspace.
  .object({ view: z.literal("workload"), projectId: IdSchema.optional(), workspaceId: IdSchema.optional() })
  .strict();
const AttentionRequestSchema = z
  .object({ view: z.literal("attention"), projectId: IdSchema })
  .strict();
const ActivityLogRequestSchema = z
  .object({ view: z.literal("activity_log"), projectId: IdSchema, limit: z.number().int().min(1).max(100).optional() })
  .strict();
const TimelineRequestSchema = z
  .object({ view: z.literal("timeline"), projectId: IdSchema })
  .strict();
const RisksDecisionsRequestSchema = z
  .object({ view: z.literal("risks_decisions"), projectId: IdSchema })
  .strict();
// Journeys + knowledge. Each takes only an id; the server reads the real
// journey / proposal / graph under the caller's RLS token.
const JourneyMapRequestSchema = z
  .object({ view: z.literal("journey_map"), journeyId: IdSchema })
  .strict();
const JourneyProposalRequestSchema = z
  .object({ view: z.literal("journey_proposal"), proposalId: IdSchema })
  .strict();
const KgNeighborhoodRequestSchema = z
  .object({ view: z.literal("kg_neighborhood"), nodeId: IdSchema })
  .strict();
const KgSourcesStatusRequestSchema = z
  .object({ view: z.literal("kg_sources_status"), workspaceId: IdSchema })
  .strict();

export const LaneViewRequestSchema = z.discriminatedUnion("view", [
  ProjectSignalsRequestSchema,
  ProjectOverviewRequestSchema,
  MilestonesRequestSchema,
  PortfolioHealthRequestSchema,
  AvailabilityRequestSchema,
  DeliverablesRequestSchema,
  ActivitiesRequestSchema,
  WorkloadRequestSchema,
  AttentionRequestSchema,
  ActivityLogRequestSchema,
  TimelineRequestSchema,
  RisksDecisionsRequestSchema,
  JourneyMapRequestSchema,
  JourneyProposalRequestSchema,
  KgNeighborhoodRequestSchema,
  KgSourcesStatusRequestSchema,
  MetricGridViewSchema,
  ComparisonTableViewSchema,
  CalloutViewSchema,
  StepsViewSchema,
]);

// --------------------------------------------------------------------------
// Hydrated output shapes for the data-bound views. These mirror the pure
// insight types (`ProjectInsightMetrics`, `PortfolioSummary`) closely enough
// that the parsed payload can be handed straight to the existing components.
// --------------------------------------------------------------------------

const HealthSchema = z.enum(["unknown", "on_track", "at_risk", "off_track"]);
const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);

const MetricMilestoneSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    targetDate: NullableIsoDate,
    daysOverdue: z.number().nullable(),
    daysUntil: z.number().nullable(),
  })
  .strict();

const MetricScheduleSlipSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    dueOn: z.string(),
    progress: z.number().nullable(),
    daysOverdue: z.number(),
    laggingBehindSchedule: z.boolean(),
  })
  .strict();

const PlanStatsSchema = z
  .object({
    total: z.number(),
    completed: z.number(),
    progress: z.number(),
    blocked: z.number(),
    unassigned: z.number(),
    unscheduled: z.number(),
  })
  .strict();

/** Structurally compatible with `ProjectInsightMetrics` from insights/metrics. */
export const ProjectMetricsSchema = z
  .object({
    projectId: z.string(),
    health: HealthSchema,
    derivedHealth: HealthSchema,
    stats: PlanStatsSchema,
    overdueMilestones: z.array(MetricMilestoneSchema),
    upcomingMilestones: z.array(MetricMilestoneSchema),
    nextMilestone: MetricMilestoneSchema.nullable(),
    blockedItems: z.array(z.object({ id: z.string(), title: z.string() }).strict()),
    unassignedItems: z.array(z.object({ id: z.string(), title: z.string() }).strict()),
    unscheduledItems: z.array(z.object({ id: z.string(), title: z.string() }).strict()),
    completedItems: z.array(z.object({ id: z.string(), title: z.string() }).strict()),
    scheduleSlips: z.array(MetricScheduleSlipSchema),
    atRiskScore: z.number(),
    atRiskLevel: SeveritySchema,
    expectedProgress: z.number().nullable(),
    inProgressShare: z.number(),
  })
  .strict();

const MilestoneLiteSchema = z
  .object({
    id: z.string(),
    title: ShortText,
    status: z.enum(["planned", "in_progress", "completed", "missed", "canceled"]),
    targetDate: NullableIsoDate,
  })
  .strict();

const DeliverableLiteSchema = z
  .object({
    id: z.string(),
    title: ShortText,
    deliveryDate: NullableIsoDate,
    progress: z.number().int().min(0).max(100),
  })
  .strict();

const OverviewReadSchema = z
  .object({ eyebrow: ShortText, title: ShortText, detail: z.string().trim().max(2_000) })
  .strict();

const PortfolioSummarySchema = z
  .object({
    activeProjects: z.number(),
    needAttention: z.number(),
    atRisk: z.number(),
    offTrack: z.number(),
    blockedItems: z.number(),
    slippedMilestones: z.number(),
    unassignedReady: z.number(),
    unscheduled: z.number(),
    avgProgress: z.number(),
  })
  .strict();

const PortfolioRowSchema = z
  .object({
    id: z.string(),
    name: ShortText,
    key: z.string(),
    status: z.string(),
    health: HealthSchema,
    progress: z.number(),
    blocked: z.number(),
    unassigned: z.number(),
    nextMilestoneTitle: ShortText.nullable(),
    nextMilestoneDate: NullableIsoDate,
    needsReview: z.boolean(),
  })
  .strict();

const ProjectSignalsViewSchema = z
  .object({
    view: z.literal("project_signals"),
    projectId: z.string(),
    projectName: ShortText,
    metrics: ProjectMetricsSchema,
  })
  .strict();

const ProjectOverviewViewSchema = z
  .object({
    view: z.literal("project_overview"),
    projectId: z.string(),
    projectName: ShortText,
    health: HealthSchema,
    progress: z.number(),
    read: OverviewReadSchema,
    milestones: z.array(MilestoneLiteSchema).max(8),
    deliverables: z.array(DeliverableLiteSchema).max(8),
  })
  .strict();

const MilestonesViewSchema = z
  .object({
    view: z.literal("milestones"),
    projectId: z.string(),
    projectName: ShortText,
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    milestones: z.array(MilestoneLiteSchema).max(24),
  })
  .strict();

const PortfolioHealthViewSchema = z
  .object({
    view: z.literal("portfolio_health"),
    summary: PortfolioSummarySchema,
    projects: z.array(PortfolioRowSchema).max(8),
  })
  .strict();

const IsoDateReq = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const PersonOutSchema = z
  .object({ personName: ShortText, role: z.string().trim().max(160), startsOn: IsoDateReq, endsOn: IsoDateReq, note: z.string().trim().max(600), current: z.boolean() })
  .strict();
const PtoConflictLiteSchema = z
  .object({
    personName: ShortText,
    activityTitle: ShortText,
    activityId: z.string(),
    // Present in workspace scope so the card can group + deep-link per project.
    projectId: z.string().optional(),
    projectName: ShortText.optional(),
    note: z.string().trim().max(600),
    startsOn: IsoDateReq,
    endsOn: IsoDateReq,
  })
  .strict();
const AvailabilityViewSchema = z
  .object({
    view: z.literal("availability"),
    scope: z.enum(["project", "workspace"]).default("project"),
    // Set for a single-project card; absent for the workspace-wide roll-up.
    projectId: z.string().optional(),
    projectName: ShortText.optional(),
    today: IsoDateReq,
    out: z.array(PersonOutSchema).max(100),
    conflicts: z.array(PtoConflictLiteSchema).max(100),
  })
  .strict();

const DeliverableRowSchema = z
  .object({
    id: z.string(),
    title: ShortText,
    deliveryDate: NullableIsoDate,
    progress: z.number().int().min(0).max(100),
    status: z.enum(["done", "overdue", "due_soon", "on_track"]),
  })
  .strict();
const DeliverablesViewSchema = z
  .object({
    view: z.literal("deliverables"),
    projectId: z.string(),
    projectName: ShortText,
    today: IsoDateReq,
    deliverables: z.array(DeliverableRowSchema).max(50),
  })
  .strict();

// Activities view — the project's work items grouped by lane, each with its
// checklist tasks, mirroring the in-app Tasks board (progress + assignee
// avatars). Titles allow up to 300 chars (the app's limit) so real data never
// fails hydration; initials are short.
const LongTitle = z.string().trim().min(1).max(300);
const AvatarLiteSchema = z.object({ name: ShortText, initials: z.string().trim().max(4) }).strict();
const ActivityTaskLiteSchema = z
  .object({
    id: z.string(),
    name: LongTitle,
    isDone: z.boolean(),
    progress: z.number().int().min(0).max(100),
    assignees: z.array(AvatarLiteSchema).max(12),
  })
  .strict();
const ActivityRowSchema = z
  .object({
    id: z.string(),
    title: LongTitle,
    laneName: ShortText,
    status: z.enum(["backlog", "ready", "in_progress", "blocked", "done", "canceled"]),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]),
    progress: z.number().int().min(0).max(100),
    dueDate: NullableIsoDate,
    owners: z.array(AvatarLiteSchema).max(12),
    tasks: z.array(ActivityTaskLiteSchema).max(30),
    taskDone: z.number().int().min(0),
    taskTotal: z.number().int().min(0),
  })
  .strict();
const ActivitiesViewSchema = z
  .object({
    view: z.literal("activities"),
    projectId: z.string(),
    projectName: ShortText,
    today: IsoDateReq,
    activities: z.array(ActivityRowSchema).max(80),
  })
  .strict();

const WorkloadPersonSchema = z
  .object({
    name: ShortText,
    role: z.string().trim().max(160),
    activeCount: z.number().int().min(0),
    load: z.enum(["under", "balanced", "high", "over"]),
    outSoon: z.object({ startsOn: IsoDateReq, endsOn: IsoDateReq }).strict().nullable(),
  })
  .strict();
const WorkloadViewSchema = z
  .object({
    view: z.literal("workload"),
    scope: z.enum(["project", "workspace"]).default("project"),
    projectId: z.string().optional(),
    projectName: ShortText.optional(),
    today: IsoDateReq,
    people: z.array(WorkloadPersonSchema).max(200),
  })
  .strict();
const AttentionViewSchema = z
  .object({
    view: z.literal("attention"),
    projectId: z.string(),
    projectName: ShortText,
    metrics: ProjectMetricsSchema,
  })
  .strict();
const ActivityLogEntrySchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    actorName: ShortText,
    action: z.string().trim().max(80),
    entityType: z.string().trim().max(80),
    category: z.string().trim().max(40),
    label: z.string().trim().max(200).nullable(),
  })
  .strict();
const ActivityLogViewSchema = z
  .object({
    view: z.literal("activity_log"),
    projectId: z.string(),
    projectName: ShortText,
    entries: z.array(ActivityLogEntrySchema).max(100),
  })
  .strict();

const Color = z.string().trim().max(40).nullable();
const TimelineActivitySchema = z
  .object({
    id: z.string(),
    title: ShortText,
    startsOn: NullableIsoDate,
    dueOn: NullableIsoDate,
    status: z.string().trim().max(40),
    progress: z.number().int().min(0).max(100),
  })
  .strict();
const TimelineLaneSchema = z
  .object({ name: ShortText, color: Color, activities: z.array(TimelineActivitySchema).max(200) })
  .strict();
const TimelinePhaseSchema = z
  .object({ name: ShortText, color: Color, startsOn: IsoDateReq, endsOn: IsoDateReq })
  .strict();
const TimelineMilestoneSchema = z
  .object({ id: z.string(), title: ShortText, targetDate: IsoDateReq, status: z.string().trim().max(40) })
  .strict();
const TimelineViewSchema = z
  .object({
    view: z.literal("timeline"),
    projectId: z.string(),
    projectName: ShortText,
    today: IsoDateReq,
    start: IsoDateReq,
    end: IsoDateReq,
    lanes: z.array(TimelineLaneSchema).max(60),
    phases: z.array(TimelinePhaseSchema).max(60),
    milestones: z.array(TimelineMilestoneSchema).max(120),
    undatedCount: z.number().int().min(0),
  })
  .strict();

const RiskLiteSchema = z
  .object({
    id: z.string(),
    title: ShortText,
    status: z.string().trim().max(40),
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    score: z.number().int().min(0).max(25),
    dueOn: NullableIsoDate,
  })
  .strict();
const DecisionLiteSchema = z
  .object({ id: z.string(), title: ShortText, status: z.string().trim().max(40), decidedAt: NullableIsoDate })
  .strict();
const RisksDecisionsViewSchema = z
  .object({
    view: z.literal("risks_decisions"),
    projectId: z.string(),
    projectName: ShortText,
    risks: z.array(RiskLiteSchema).max(100),
    decisions: z.array(DecisionLiteSchema).max(100),
  })
  .strict();

// --------------------------------------------------------------------------
// Journeys + knowledge (hydrated). Card titles may legitimately be empty, so
// they allow "" up to the app's 300-char limit. Excerpts and quotes are
// untrusted source text: the renderer prints them as text, never as markup.
// --------------------------------------------------------------------------

const JourneyText = z.string().max(300);
const EmotionValue = z.number().min(-2).max(2).nullable();

const JourneyMapViewSchema = z
  .object({
    view: z.literal("journey_map"),
    journeyId: z.string(),
    title: JourneyText,
    journeyType: z.string().max(40),
    status: z.string().max(40),
    canEdit: z.boolean(),
    stages: z.array(z.object({ id: z.string(), name: JourneyText, stepIds: z.array(z.string()).max(200) }).strict()).max(50),
    steps: z.array(z.object({ id: z.string(), name: JourneyText }).strict()).max(200),
    rows: z.array(z.object({ id: z.string(), name: JourneyText, rowType: z.string().max(40) }).strict()).max(40),
    cards: z
      .array(z.object({ id: z.string(), ref: z.string().max(8), title: JourneyText, rowId: z.string(), stepId: z.string(), emotion: EmotionValue }).strict())
      .max(150),
    emotion: z.array(z.object({ step: JourneyText, value: EmotionValue }).strict()).max(200),
    linkedProjects: z.array(z.object({ id: z.string(), name: JourneyText }).strict()).max(100),
  })
  .strict();

const JourneyProposalItemViewSchema = z
  .object({
    id: z.string(),
    op: z.string().max(40),
    label: z.string().max(400),
    detail: z.string().max(600),
    rationale: z.string().max(1_000),
    status: z.string().max(40),
  })
  .strict();
const JourneyProposalViewSchema = z
  .object({
    view: z.literal("journey_proposal"),
    proposalId: z.string(),
    journeyId: z.string(),
    title: z.string().max(200),
    summary: z.string().max(4_000),
    status: z.string().max(40),
    // Binds the user's Accept to exactly the items they reviewed.
    itemsHash: z.string().regex(/^[0-9a-f]{64}$/),
    expiresAt: z.string().max(40),
    items: z.array(JourneyProposalItemViewSchema).max(200),
  })
  .strict();

const KgQuoteSchema = z
  .object({ quote: z.string().max(600), source: z.string().max(300), locator: z.string().max(120) })
  .strict();
const KgNeighborhoodViewSchema = z
  .object({
    view: z.literal("kg_neighborhood"),
    node: z
      .object({ id: z.string(), label: z.string().max(300), type: z.string().max(60), description: z.string().max(1_000) })
      .strict(),
    relations: z
      .array(
        z
          .object({
            relation: z.string().max(60),
            provenance: z.string().max(20),
            direction: z.enum(["in", "out"]),
            other: z.string().max(300),
            quotes: z.array(KgQuoteSchema).max(3),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

const KgSourcesStatusViewSchema = z
  .object({
    view: z.literal("kg_sources_status"),
    workspaceId: z.string(),
    sources: z
      .array(
        z
          .object({
            id: z.string(),
            title: z.string().max(300),
            kind: z.string().max(40),
            status: z.string().max(40),
            chunks: z.number().int().min(0),
            addedAt: z.string().max(40),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export const LaneViewSchema = z.discriminatedUnion("view", [
  ProjectSignalsViewSchema,
  ProjectOverviewViewSchema,
  MilestonesViewSchema,
  PortfolioHealthViewSchema,
  AvailabilityViewSchema,
  DeliverablesViewSchema,
  ActivitiesViewSchema,
  WorkloadViewSchema,
  AttentionViewSchema,
  ActivityLogViewSchema,
  TimelineViewSchema,
  RisksDecisionsViewSchema,
  JourneyMapViewSchema,
  JourneyProposalViewSchema,
  KgNeighborhoodViewSchema,
  KgSourcesStatusViewSchema,
  MetricGridViewSchema,
  ComparisonTableViewSchema,
  CalloutViewSchema,
  StepsViewSchema,
]);

export type LaneViewRequest = z.infer<typeof LaneViewRequestSchema>;
export type LaneView = z.infer<typeof LaneViewSchema>;
export type LaneViewKind = LaneView["view"];

/** Parse untrusted `render_view` output before Ask Lane may draw it. */
export function parseLaneView(input: unknown): LaneView {
  return LaneViewSchema.parse(input);
}
