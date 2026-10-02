import { z } from "zod";

/**
 * Knowledge-graph contracts shared by the Lane app, Eve tools and the MCP
 * server. Transport-neutral: no database client, no environment, no mutation.
 *
 * Extraction follows the Structured Outputs rules in ./contracts.ts: every
 * field is REQUIRED in the wire schema (nullable instead of optional), no
 * z.record(), bounded arrays and strings. The model's output is untrusted data
 * and is verified again after parsing (quotes must be substrings of the chunk).
 */

// ── Extraction (per chunk) ──────────────────────────────────────────────────
export const KG_ENTITY_TYPES = [
  "person_role", "organization", "product", "feature", "touchpoint", "channel",
  "pain", "need", "behavior", "goal", "metric", "concept", "process", "other",
] as const;

export const KG_RELATIONS = [
  "experiences", "uses", "blocks", "causes", "improves", "part_of", "precedes",
  "depends_on", "mentions", "measures", "owns", "wants", "related_to",
] as const;

const Label = z.string().trim().min(1).max(120);

export const KgExtractedEntityWireSchema = z.object({
  name: Label,
  type: z.enum(KG_ENTITY_TYPES),
  description: z.string().trim().max(300),
  aliases: z.array(Label).max(5),
}).strict();

export const KgExtractedRelationWireSchema = z.object({
  source: Label,
  target: Label,
  relation: z.enum(KG_RELATIONS),
  // EXTRACTED: stated in the text (quote required). INFERRED: a reasonable
  // reading the text does not state outright.
  provenance: z.enum(["EXTRACTED", "INFERRED"]),
  quote: z.string().max(400).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();

export const KgInsightCandidateWireSchema = z.object({
  title: z.string().trim().min(1).max(200),
  statement: z.string().trim().max(600),
  kind: z.enum(["factual", "interpreted"]),
  impact: z.number().int().min(1).max(5),
  quote: z.string().trim().min(1).max(400),
}).strict();

export const KgExtractionWireSchema = z.object({
  entities: z.array(KgExtractedEntityWireSchema).max(25),
  relations: z.array(KgExtractedRelationWireSchema).max(40),
  insightCandidates: z.array(KgInsightCandidateWireSchema).max(5),
}).strict();
export type KgExtraction = z.infer<typeof KgExtractionWireSchema>;

export const KgCommunitySummaryWireSchema = z.object({
  label: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(600),
}).strict();

// ── graphify import (graph.json) ────────────────────────────────────────────
// graphify writes networkx node-link JSON. Only what we use is validated;
// everything is untrusted text (labels are sanitised before storage).
const GraphifyId = z.union([z.string().min(1).max(300), z.number()]).transform(String);
export const GraphifyGraphSchema = z.object({
  directed: z.boolean().optional(),
  nodes: z.array(z.object({
    id: GraphifyId,
    label: z.string().max(500).optional(),
    name: z.string().max(500).optional(),
    type: z.string().max(80).optional(),
    kind: z.string().max(80).optional(),
    description: z.string().max(4000).optional(),
    community: z.union([z.string(), z.number()]).optional(),
  }).passthrough()).max(20_000),
  links: z.array(z.object({
    source: GraphifyId,
    target: GraphifyId,
    relation: z.string().max(120).optional(),
    label: z.string().max(120).optional(),
    type: z.string().max(120).optional(),
    confidence: z.string().max(40).optional(),
    provenance: z.string().max(40).optional(),
    weight: z.number().optional(),
  }).passthrough()).max(100_000).optional(),
  edges: z.array(z.object({
    source: GraphifyId,
    target: GraphifyId,
    relation: z.string().max(120).optional(),
    label: z.string().max(120).optional(),
    type: z.string().max(120).optional(),
    confidence: z.string().max(40).optional(),
    provenance: z.string().max(40).optional(),
    weight: z.number().optional(),
  }).passthrough()).max(100_000).optional(),
}).passthrough();
export type GraphifyGraph = z.infer<typeof GraphifyGraphSchema>;

// ── Retrieval result (what tools hand to a model) ───────────────────────────
export const KgCitationSchema = z.object({
  ref: z.string().regex(/^S\d{1,3}$/),
  sourceId: z.string().uuid(),
  sourceTitle: z.string().max(300),
  chunkId: z.string().uuid(),
  locator: z.string().max(120),
});
export type KgCitation = z.infer<typeof KgCitationSchema>;

export const KgContextBundleSchema = z.object({
  query: z.string().max(500),
  mode: z.enum(["hybrid", "keyword"]),
  /** Excerpts wrapped in <source_document untrusted> tags, each tagged [S#]. */
  context: z.string().max(20_000),
  citations: z.array(KgCitationSchema).max(40),
  entities: z.array(z.object({ id: z.string().uuid(), label: z.string(), type: z.string() })).max(40),
  tokenEstimate: z.number().int().nonnegative(),
});
export type KgContextBundle = z.infer<typeof KgContextBundleSchema>;
