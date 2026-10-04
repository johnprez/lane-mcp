import { z } from "zod";

/**
 * Journey proposal contracts, shared by the Lane app, Eve and the MCP server.
 * Transport-neutral: no database, no environment, no mutation.
 *
 * Two layers:
 *   1. JourneyProposalItemSchema — the stored, whitelisted op list that
 *      apply_journey_proposal executes. Anything outside it cannot be applied.
 *   2. *WireSchema — what a model may return (Structured Outputs rules: every
 *      field required, nullable instead of optional, bounded). Wire output is
 *      converted to items by the app, never stored as-is.
 */

const Uuid = z.string().uuid();
const Ref = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const Name = z.string().trim().min(1).max(120);
const Title = z.string().trim().max(300);

export const JOURNEY_ROW_TYPES = [
  "text", "touchpoint", "emotion", "pain", "gain", "opportunity", "insight", "solution",
  "frontstage", "backstage", "people", "linked_work", "metric", "image", "freeform", "flow",
] as const;

export const FLOW_NODE_KINDS = ["entry", "decision", "screen", "action", "system", "note", "exit"] as const;
export const FLOW_PATH_CLASSES = ["happy", "unhappy", "alternate", "neutral"] as const;

const Coord = z.number().finite().min(-1_000_000).max(1_000_000);
/** Entry/exit link. No journeyId = this journey; targetRef = a step/card/flow made earlier in the proposal. */
const FlowLinkPayload = z.object({
  kind: z.enum(["step", "card", "flow", "journey"]),
  journeyId: Uuid.optional(),
  targetRef: Ref.optional(),
  targetId: Uuid.optional(),
}).strict();
const FlowNodeFields = {
  kind: z.enum(FLOW_NODE_KINDS),
  label: z.string().trim().max(160),
  body: z.string().max(2000).optional(),
  x: Coord.optional(),
  y: Coord.optional(),
  screenRef: Ref.optional(),
  screenId: Uuid.optional(),
  link: FlowLinkPayload.optional(),
};

const Common = { ref: Ref.optional(), rationale: z.string().max(1000).optional(), citedChunkIds: z.array(Uuid).max(10).optional() };

export const JourneyProposalItemSchema = z.discriminatedUnion("op", [
  z.object({ ...Common, op: z.literal("stage.create"), payload: z.object({ name: Name, color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict() }).strict(),
  z.object({ ...Common, op: z.literal("step.create"), payload: z.object({ name: Name, stageRef: Ref.optional(), stageId: Uuid.optional() }).strict() }).strict(),
  z.object({ ...Common, op: z.literal("row.create"), payload: z.object({ name: Name, rowType: z.enum(JOURNEY_ROW_TYPES) }).strict() }).strict(),
  z.object({
    ...Common, op: z.literal("card.create"),
    payload: z.object({
      rowRef: Ref.optional(), rowId: Uuid.optional(), stepRef: Ref.optional(), stepId: Uuid.optional(),
      title: Title, body: z.string().max(8000).optional(), emotion: z.number().int().min(-2).max(2).nullable().optional(),
      cardState: z.enum(["current", "future", "stay", "remove", "create"]).optional(), span: z.number().int().min(1).max(200).optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...Common, op: z.literal("card.update"), targetId: Uuid,
    payload: z.object({ title: Title.optional(), body: z.string().max(8000).optional(), emotion: z.number().int().min(-2).max(2).nullable().optional(), cardState: z.enum(["current", "future", "stay", "remove", "create"]).optional() }).strict(),
  }).strict(),
  z.object({ ...Common, op: z.literal("card.move"), targetId: Uuid, payload: z.object({ rowRef: Ref.optional(), rowId: Uuid.optional(), stepRef: Ref.optional(), stepId: Uuid.optional() }).strict() }).strict(),
  z.object({ ...Common, op: z.literal("card.delete"), targetId: Uuid, payload: z.object({}).strict() }).strict(),
  z.object({
    ...Common, op: z.literal("block.create"),
    payload: z.object({
      kind: z.enum(["insight", "opportunity", "solution"]), title: z.string().trim().min(1).max(300),
      statement: z.string().max(8000).optional(), description: z.string().max(8000).optional(),
      insightKind: z.enum(["factual", "interpreted"]).optional(), impact: z.number().int().min(1).max(5).optional(),
      customerValue: z.number().int().min(1).max(5).optional(), businessValue: z.number().int().min(1).max(5).optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...Common, op: z.literal("block.link"),
    payload: z.object({
      kind: z.enum(["persona", "insight", "opportunity", "solution", "goal", "metric"]),
      blockRef: Ref.optional(), blockId: Uuid.optional(), cardRef: Ref.optional(), cardId: Uuid.optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...Common, op: z.literal("work.link"),
    payload: z.object({
      sourceKind: z.enum(["card", "opportunity", "solution"]), sourceRef: Ref.optional(), sourceId: Uuid.optional(),
      targetKind: z.enum(["work_item", "checklist_item", "milestone"]), targetId: Uuid,
    }).strict(),
  }).strict(),
  // ── Flows (decision & logic maps on a step or card) ──
  z.object({
    ...Common, op: z.literal("flow.create"),
    payload: z.object({
      title: z.string().trim().min(1).max(120), description: z.string().max(2000).optional(),
      stepRef: Ref.optional(), stepId: Uuid.optional(), cardRef: Ref.optional(), cardId: Uuid.optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...Common, op: z.literal("flow.update"), targetId: Uuid,
    payload: z.object({ title: z.string().trim().min(1).max(120).optional(), description: z.string().max(2000).optional() }).strict(),
  }).strict(),
  z.object({ ...Common, op: z.literal("flow.delete"), targetId: Uuid, payload: z.object({}).strict() }).strict(),
  z.object({
    ...Common, op: z.literal("flow_node.create"),
    payload: z.object({ flowRef: Ref.optional(), flowId: Uuid.optional(), ...FlowNodeFields }).strict(),
  }).strict(),
  z.object({
    ...Common, op: z.literal("flow_node.update"), targetId: Uuid,
    payload: z.object({ ...FlowNodeFields, kind: FlowNodeFields.kind.optional(), label: FlowNodeFields.label.optional() }).strict(),
  }).strict(),
  z.object({ ...Common, op: z.literal("flow_node.delete"), targetId: Uuid, payload: z.object({}).strict() }).strict(),
  z.object({
    ...Common, op: z.literal("flow_edge.create"),
    payload: z.object({
      fromRef: Ref.optional(), fromId: Uuid.optional(), toRef: Ref.optional(), toId: Uuid.optional(),
      label: z.string().trim().max(80).optional(), pathClass: z.enum(FLOW_PATH_CLASSES).optional(),
    }).strict(),
  }).strict(),
  z.object({ ...Common, op: z.literal("flow_edge.delete"), targetId: Uuid, payload: z.object({}).strict() }).strict(),
]);
export type JourneyProposalItem = z.infer<typeof JourneyProposalItemSchema>;
export type JourneyProposalOp = JourneyProposalItem["op"];

export const JourneyProposalItemsSchema = z.array(JourneyProposalItemSchema).min(1).max(200)
  .superRefine((items, ctx) => {
    // Refs must be unique and defined before use, in order.
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const payload = item.payload as Record<string, unknown>;
      for (const key of ["stageRef", "rowRef", "stepRef", "blockRef", "cardRef", "sourceRef", "flowRef", "nodeRef", "fromRef", "toRef", "screenRef"]) {
        const ref = payload[key];
        if (typeof ref === "string" && !seen.has(ref)) ctx.addIssue({ code: "custom", path: [index, "payload", key], message: `Unknown ref ${ref}` });
      }
      const link = payload.link as { targetRef?: unknown } | undefined;
      if (typeof link?.targetRef === "string" && !seen.has(link.targetRef)) {
        ctx.addIssue({ code: "custom", path: [index, "payload", "link", "targetRef"], message: `Unknown ref ${link.targetRef}` });
      }
      if (item.ref) {
        if (seen.has(item.ref)) ctx.addIssue({ code: "custom", path: [index, "ref"], message: `Duplicate ref ${item.ref}` });
        seen.add(item.ref);
      }
    });
  });

// ── Model wire schemas ──────────────────────────────────────────────────────
/** Draft a whole journey from a description (+ optional research excerpts). */
export const JourneyDraftWireSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(600),
  stages: z.array(z.object({
    name: Name,
    steps: z.array(Name).min(1).max(6),
  }).strict()).min(1).max(8),
  rows: z.array(z.object({ name: Name, rowType: z.enum(JOURNEY_ROW_TYPES) }).strict()).min(1).max(8),
  cards: z.array(z.object({
    stage: Name,
    step: Name,
    row: Name,
    title: z.string().trim().min(1).max(160),
    body: z.string().max(600),
    emotion: z.number().int().min(-2).max(2).nullable(),
    citations: z.array(z.string().regex(/^S\d{1,3}$/)).max(3),
  }).strict()).max(80),
}).strict();
export type JourneyDraftWire = z.infer<typeof JourneyDraftWireSchema>;

/** Up to 8 cards for one stage x row cell. */
export const JourneyCellsWireSchema = z.object({
  cards: z.array(z.object({
    step: Name,
    title: z.string().trim().min(1).max(160),
    body: z.string().max(600),
    emotion: z.number().int().min(-2).max(2).nullable(),
    rationale: z.string().trim().max(300),
    citations: z.array(z.string().regex(/^S\d{1,3}$/)).max(3),
  }).strict()).max(8),
}).strict();
export type JourneyCellsWire = z.infer<typeof JourneyCellsWireSchema>;

/** Executive brief: read-only text, citations required. */
export const JourneyBriefWireSchema = z.object({
  headline: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(1200),
  findings: z.array(z.object({
    point: z.string().trim().min(1).max(400),
    citations: z.array(z.string().regex(/^(S\d{1,3}|C\d{1,4})$/)).min(1).max(4),
  }).strict()).min(1).max(8),
  risks: z.array(z.string().trim().min(1).max(300)).max(5),
  nextSteps: z.array(z.string().trim().min(1).max(300)).max(5),
}).strict();
export type JourneyBriefWire = z.infer<typeof JourneyBriefWireSchema>;
