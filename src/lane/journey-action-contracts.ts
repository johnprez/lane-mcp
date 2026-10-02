import { z } from "zod";

import { JOURNEY_ROW_TYPES, JourneyProposalItemsSchema, type JourneyProposalOp } from "./journey-contracts";

/**
 * MCP write + read contracts for journeys and the knowledge graph, shared by
 * the hosted MCP server, the /api/mcp/{journey,kg,apply-journey,ingest}
 * endpoints, and the standalone local MCP server (vendored via sync.sh).
 *
 * Mirrors the action-contracts / project-action-contracts split: zod only — no
 * database, no environment, no mutation. Writes stay proposals: `propose`
 * stores a reviewable proposal (no record changes), `apply` executes an
 * already-reviewed one through apply_journey_proposal, and `ingest_url` only
 * registers a source for indexing.
 */

const Id = z.string().uuid();

export const KG_INGEST_DEPTHS = ["full", "keyword_only"] as const;
export const KG_SCOPE_KINDS = ["workspace", "project", "journey"] as const;

/** Where a knowledge source is filed. A workspace scope has a null anchor. */
export const KgScopeSchema = z.object({
  kind: z.enum(KG_SCOPE_KINDS),
  anchorId: Id.nullable(),
}).strict().superRefine((scope, ctx) => {
  if (scope.kind !== "workspace" && !scope.anchorId) {
    ctx.addIssue({ code: "custom", path: ["anchorId"], message: `A ${scope.kind} scope needs its ${scope.kind} id as anchorId.` });
  }
});
export type KgScope = z.infer<typeof KgScopeSchema>;

export const JourneyProposeActionSchema = z.object({
  kind: z.literal("propose"),
  workspaceId: Id,
  journeyId: Id,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000),
  items: JourneyProposalItemsSchema,
}).strict();

// ── Informed approval ───────────────────────────────────────────────────────
/** Every op a journey proposal item can carry (mirrors JourneyProposalItemSchema). */
export const JOURNEY_PROPOSAL_OPS = [
  "stage.create", "step.create", "row.create",
  "card.create", "card.update", "card.move", "card.delete",
  "block.create", "block.link", "work.link",
] as const satisfies readonly JourneyProposalOp[];

/** sha256 hex of the stored items (create_journey_proposal's `itemsHash`). */
export const JourneyItemsHashSchema = z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "Use the itemsHash returned when the proposal was stored or previewed.");

/**
 * What the user is approving: one entry per op with how many pending items of
 * that op will apply. An array (not a record) so it stays Structured-Outputs
 * friendly. The server recomputes it from the stored items and refuses on any
 * difference, so the approval card can never under-describe the apply.
 */
export const JourneyOpCountsSchema = z.array(z.object({
  op: z.enum(JOURNEY_PROPOSAL_OPS),
  count: z.number().int().min(1).max(200),
}).strict()).min(1).max(JOURNEY_PROPOSAL_OPS.length).refine(
  (entries) => new Set(entries.map((entry) => entry.op)).size === entries.length,
  "List each op once.",
);
export type JourneyOpCounts = z.infer<typeof JourneyOpCountsSchema>;

export function isDeleteOp(op: string): boolean {
  return /\.(delete|remove|archive)$/i.test(op);
}

/** The pending items an apply of `itemIds` (null = every pending item) would touch. */
export function pendingJourneyItems<T extends { id: string; status: string }>(items: readonly T[], itemIds: readonly string[] | null): T[] {
  const wanted = itemIds ? new Set(itemIds) : null;
  return items.filter((item) => item.status === "pending" && (!wanted || wanted.has(item.id)));
}

/** Op counts for a list of items, in canonical op order. */
export function journeyOpCounts(items: ReadonlyArray<{ op: string }>): Array<{ op: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.op, (counts.get(item.op) ?? 0) + 1);
  const order = (op: string) => {
    const index = (JOURNEY_PROPOSAL_OPS as readonly string[]).indexOf(op);
    return index === -1 ? JOURNEY_PROPOSAL_OPS.length : index;
  };
  return [...counts.entries()].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)).map(([op, count]) => ({ op, count }));
}

/** "3 card.create, 2 card.delete" */
export function formatJourneyOpCounts(counts: ReadonlyArray<{ op: string; count: number }>): string {
  return counts.map((entry) => `${entry.count} ${entry.op}`).join(", ");
}

/** True when two op-count lists describe exactly the same changes. */
export function sameJourneyOpCounts(a: ReadonlyArray<{ op: string; count: number }>, b: ReadonlyArray<{ op: string; count: number }>): boolean {
  const left = new Map(a.map((entry) => [entry.op, entry.count]));
  const right = new Map(b.map((entry) => [entry.op, entry.count]));
  if (left.size !== a.length || right.size !== b.length || left.size !== right.size) return false;
  for (const [op, count] of left) if (right.get(op) !== count) return false;
  return true;
}

export const JourneyApplyActionSchema = z.object({
  kind: z.literal("apply"),
  proposalId: Id,
  /** Apply only these items; omit to apply every pending item. */
  itemIds: z.array(Id).min(1).max(200).optional(),
  /**
   * The hash returned by propose / apply-preview. Required to apply (preview
   * may omit it): it binds the apply to exactly the items that were reviewed.
   */
  itemsHash: JourneyItemsHashSchema.optional(),
}).strict();

export const KgIngestUrlActionSchema = z.object({
  kind: z.literal("ingest_url"),
  workspaceId: Id,
  scope: KgScopeSchema,
  url: z.string().trim().max(2048).regex(/^https?:\/\/\S+$/i, "Use a full http(s) link."),
  title: z.string().trim().max(300).optional(),
  depth: z.enum(KG_INGEST_DEPTHS),
}).strict();

// ── Create (skeleton only) ──────────────────────────────────────────────────
/** Mirrors the create_journey RPC's journey_type check (and journey-input's journeyTypes). */
export const JOURNEY_TYPES = ["customer", "service_blueprint", "jtbd", "story_map", "lifecycle", "custom"] as const;
export const JOURNEY_VISIBILITIES = ["workspace", "restricted"] as const;
/** create_journey RPC limits: stages ≤ 50, rows ≤ 40, steps ≤ 200 in total. */
export const JOURNEY_CREATE_LIMITS = { stages: 50, rows: 40, steps: 200, stepsPerStage: 50 } as const;
/** The `template` recorded for an agent-built map (an existing template id, see templates.ts). */
export const AGENT_JOURNEY_TEMPLATE_ID = "blank";

const SkeletonName = z.string().trim().min(1).max(120);

/**
 * Exactly the RPC's p_structure shape (and templates.ts JourneyTemplateStructure):
 * stages carry step NAMES as strings; rows carry a name + rowType. No cards —
 * cards go into a propose_journey_changes proposal on the new journey.
 */
export const JourneyCreateStructureSchema = z.object({
  stages: z.array(z.object({
    name: SkeletonName,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    steps: z.array(SkeletonName).min(1).max(JOURNEY_CREATE_LIMITS.stepsPerStage).describe("Step names, in order."),
  }).strict()).min(1).max(JOURNEY_CREATE_LIMITS.stages),
  rows: z.array(z.object({
    name: SkeletonName,
    rowType: z.enum(JOURNEY_ROW_TYPES),
    isLineOfVisibility: z.boolean().optional(),
  }).strict()).min(1).max(JOURNEY_CREATE_LIMITS.rows),
}).strict().refine(
  (structure) => structure.stages.reduce((sum, stage) => sum + stage.steps.length, 0) <= JOURNEY_CREATE_LIMITS.steps,
  { message: `Keep the map to ${JOURNEY_CREATE_LIMITS.steps} steps in total.`, path: ["stages"] },
);
export type JourneyCreateStructure = z.infer<typeof JourneyCreateStructureSchema>;

/** What create_journey (Eve) approves and the journey gateway executes. */
export const JourneyCreateInputSchema = z.object({
  workspaceId: Id,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  journeyType: z.enum(JOURNEY_TYPES),
  visibility: z.enum(JOURNEY_VISIBILITIES).default("workspace"),
  structure: JourneyCreateStructureSchema,
}).strict();
export type JourneyCreateInput = z.infer<typeof JourneyCreateInputSchema>;

/** Gateway body: the create input tagged so it can't be confused with an apply. */
export const JourneyCreateRequestSchema = JourneyCreateInputSchema.extend({ kind: z.literal("create_journey") }).strict();

/** "Discover (2 steps), Buy (1 step)" — the approval card's skeleton line. */
export function formatJourneySkeletonStages(stages: ReadonlyArray<{ name: string; steps: readonly unknown[] }>): string {
  return stages.map((stage) => `${stage.name} (${stage.steps.length} step${stage.steps.length === 1 ? "" : "s"})`).join(", ");
}

export const JourneyActionSchema = z.discriminatedUnion("kind", [
  JourneyProposeActionSchema,
  JourneyApplyActionSchema,
  KgIngestUrlActionSchema,
  JourneyCreateRequestSchema,
]);
export type JourneyAction = z.infer<typeof JourneyActionSchema>;
export type JourneyActionKind = JourneyAction["kind"];

/** Body of the write endpoints: one action plus an optional dry-run flag. */
export const JourneyActionRequestSchema = z.object({
  action: JourneyActionSchema,
  preview: z.boolean().optional(),
}).strict();
export type JourneyActionRequest = z.infer<typeof JourneyActionRequestSchema>;

/**
 * MCP tool inputs: the action fields flattened (no `kind`) plus `preview`.
 * Shared so the hosted and local servers expose byte-identical tool shapes.
 */
const Preview = z.boolean().optional().describe("When true, validate and show what WOULD happen without storing, applying or registering anything.");
export const ProposeJourneyToolInput = JourneyProposeActionSchema.omit({ kind: true }).extend({ preview: Preview });
export const ApplyJourneyToolInput = JourneyApplyActionSchema.omit({ kind: true }).extend({
  itemsHash: JourneyItemsHashSchema.optional().describe("Required unless preview:true — the itemsHash from lane_propose_journey_changes or an apply preview."),
  preview: Preview,
});
export const IngestUrlToolInput = KgIngestUrlActionSchema.omit({ kind: true }).extend({ preview: Preview });
export const CreateJourneyToolInput = JourneyCreateInputSchema.extend({ preview: Preview });

// ── Reads ───────────────────────────────────────────────────────────────────
export const JourneyReadRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), workspaceId: Id }).strict(),
  z.object({ op: z.literal("get"), journeyId: Id }).strict(),
]);
export type JourneyReadRequest = z.infer<typeof JourneyReadRequestSchema>;

export const KgReadRequestSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("search"),
    workspaceId: Id,
    query: z.string().trim().min(1).max(500),
    projectId: Id.optional(),
    journeyId: Id.optional(),
  }).strict(),
  z.object({ op: z.literal("explain"), nodeId: Id, toNodeId: Id.optional() }).strict(),
  z.object({ op: z.literal("sources"), workspaceId: Id }).strict(),
]);
export type KgReadRequest = z.infer<typeof KgReadRequestSchema>;
