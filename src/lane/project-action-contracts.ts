import { z } from "zod";

const Id = z.string().uuid();
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const ProjectValues = {
  workspaceId: Id,
  name: z.string().trim().min(1).max(160),
  projectKey: z.string().trim().min(2).max(10).regex(/^[A-Za-z][A-Za-z0-9]{1,9}$/),
  description: z.string().trim().max(8_000).default(""),
  status: z.enum(["planned", "active", "paused", "completed"]),
  health: z.enum(["unknown", "on_track", "at_risk", "off_track"]),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  startDate: DateOnly,
  dueDate: DateOnly,
} as const;

export const LaneProjectActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("project.create"), ...ProjectValues }),
  z.object({
    action: z.literal("project.update"),
    projectId: Id,
    expectedVersion: z.number().int().positive(),
    ...ProjectValues,
  }),
  z.object({
    action: z.literal("project.delete"),
    workspaceId: Id,
    projectId: Id,
    expectedVersion: z.number().int().positive(),
    confirmationName: z.string().trim().min(1).max(160),
  }),
]);

export const LanePlanExportRequestSchema = z.object({
  projectId: Id,
  format: z.enum(["pdf", "pptx", "xls", "xlsx"]),
  title: z.string().trim().min(1).max(200).default("Project plan"),
  includeGantt: z.literal(true).default(true),
  useProjectBrandAssets: z.boolean().default(true),
});

export type LaneProjectAction = z.infer<typeof LaneProjectActionSchema>;
export type LanePlanExportRequest = z.infer<typeof LanePlanExportRequestSchema>;
