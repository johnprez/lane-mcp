import { z } from "zod";

import { JourneyProposalItemsSchema } from "./journey-contracts";

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

export const JourneyApplyActionSchema = z.object({
  kind: z.literal("apply"),
  proposalId: Id,
  /** Apply only these items; omit to apply every pending item. */
  itemIds: z.array(Id).min(1).max(200).optional(),
}).strict();

export const KgIngestUrlActionSchema = z.object({
  kind: z.literal("ingest_url"),
  workspaceId: Id,
  scope: KgScopeSchema,
  url: z.string().trim().max(2048).regex(/^https?:\/\/\S+$/i, "Use a full http(s) link."),
  title: z.string().trim().max(300).optional(),
  depth: z.enum(KG_INGEST_DEPTHS),
}).strict();

export const JourneyActionSchema = z.discriminatedUnion("kind", [
  JourneyProposeActionSchema,
  JourneyApplyActionSchema,
  KgIngestUrlActionSchema,
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
export const ApplyJourneyToolInput = JourneyApplyActionSchema.omit({ kind: true }).extend({ preview: Preview });
export const IngestUrlToolInput = KgIngestUrlActionSchema.omit({ kind: true }).extend({ preview: Preview });

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
