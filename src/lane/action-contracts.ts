import { z } from "zod";

const Id = z.string().uuid();
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// A planning person can be created with just a name; email is optional and, when
// present, must still be a valid address. Blank means "fill this in later".
const OptionalEmail = z.string().trim().max(320).default("").refine((value) => value === "" || z.string().email().safeParse(value).success, { message: "Enter a valid email or leave it blank." });
const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const DateTime = z.string().datetime({ offset: true });
const LinkUrl = z.string().trim().max(2000).regex(/^https?:\/\//i, "Links must start with http:// or https://.");
const LinkObjectType = z.enum(["work_item", "milestone", "event", "task", "deliverable"]);
const Base = z.object({ projectId: Id });
const WorkspaceBase = Base.extend({ workspaceId: Id });

export const LaneAgentActionSchema = z.discriminatedUnion("action", [
  Base.extend({ action: z.literal("lane.create"), name: z.string().trim().min(1).max(160), description: z.string().max(8_000).default(""), status: z.enum(["planned", "active", "paused", "completed"]).default("planned"), color: Color }),
  Base.extend({ action: z.literal("lane.update"), laneId: Id, expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(160), description: z.string().max(8_000).default(""), status: z.enum(["planned", "active", "paused", "completed"]), color: Color }),
  Base.extend({ action: z.literal("lane.delete"), laneId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("phase.create"), name: z.string().trim().min(1).max(160), description: z.string().max(8_000).default(""), startDate: DateOnly, dueDate: DateOnly, color: Color, laneIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("phase.update"), phaseId: Id, expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(160), description: z.string().max(8_000).default(""), startDate: DateOnly, dueDate: DateOnly, color: Color, laneIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("milestone.create"), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), status: z.enum(["planned", "in_progress", "completed", "missed", "canceled"]).default("planned"), targetDate: DateOnly.nullable().default(null) }),
  Base.extend({ action: z.literal("milestone.update"), milestoneId: Id, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), status: z.enum(["planned", "in_progress", "completed", "missed", "canceled"]), targetDate: DateOnly.nullable() }),
  Base.extend({ action: z.literal("milestone.delete"), milestoneId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("activity.create"), title: z.string().trim().min(1).max(300), description: z.string().max(8_000).default(""), status: z.enum(["backlog", "ready", "in_progress", "blocked", "done", "canceled"]).default("backlog"), priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"), laneId: Id.nullable().default(null), milestoneId: Id.nullable().default(null), startDate: DateOnly.nullable().default(null), dueDate: DateOnly.nullable().default(null), progress: z.number().int().min(0).max(100).default(0), color: Color.nullable().default(null), ownerPersonIds: z.array(Id).max(200).default([]), ownerGroupIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("activity.update"), activityId: Id, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(300), description: z.string().max(8_000).default(""), status: z.enum(["backlog", "ready", "in_progress", "blocked", "done", "canceled"]), priority: z.enum(["none", "low", "medium", "high", "urgent"]), laneId: Id.nullable(), milestoneId: Id.nullable(), startDate: DateOnly.nullable(), dueDate: DateOnly.nullable(), progress: z.number().int().min(0).max(100), color: Color.nullable(), ownerPersonIds: z.array(Id).max(200).default([]), ownerGroupIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("activity.delete"), activityId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("task.create"), activityId: Id, name: z.string().trim().min(1).max(300), personIds: z.array(Id).max(200).default([]), isDone: z.boolean().default(false), note: z.string().trim().max(8_000).default(""), progress: z.number().int().min(0).max(100).default(0) }),
  Base.extend({ action: z.literal("task.update"), activityId: Id, taskId: Id, expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(300), personIds: z.array(Id).max(200).default([]), isDone: z.boolean(), note: z.string().trim().max(8_000).default(""), progress: z.number().int().min(0).max(100).default(0) }),
  Base.extend({ action: z.literal("task.delete"), activityId: Id, taskId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("event.create"), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), startsAt: DateTime, endsAt: DateTime.nullable().default(null), allDay: z.boolean().default(false), timezone: z.string().trim().min(1).max(80), color: Color, laneIds: z.array(Id).max(100).default([]), personIds: z.array(Id).max(200).default([]), groupIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("event.update"), eventId: Id, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), startsAt: DateTime, endsAt: DateTime.nullable(), allDay: z.boolean(), timezone: z.string().trim().min(1).max(80), color: Color, laneIds: z.array(Id).max(100).default([]), personIds: z.array(Id).max(200).default([]), groupIds: z.array(Id).max(100).default([]) }),
  Base.extend({ action: z.literal("activityNote.create"), activityId: Id, body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("activityNote.update"), activityId: Id, noteId: Id, expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("activityNote.delete"), activityId: Id, noteId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("milestoneNote.create"), milestoneId: Id, body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("milestoneNote.update"), milestoneId: Id, noteId: Id, expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("milestoneNote.delete"), milestoneId: Id, noteId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("eventNote.create"), eventId: Id, body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("eventNote.update"), eventId: Id, noteId: Id, expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("eventNote.delete"), eventId: Id, noteId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("dependency.create"), predecessorId: Id, successorId: Id, lagDays: z.number().int().min(-365).max(365).default(0) }),
  Base.extend({ action: z.literal("dependency.update"), predecessorId: Id, successorId: Id, expectedVersion: z.number().int().positive(), lagDays: z.number().int().min(-365).max(365) }),
  Base.extend({ action: z.literal("dependency.delete"), predecessorId: Id, successorId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("planDependency.create"), predecessorType: z.enum(["work_item", "deliverable"]), predecessorId: Id, successorType: z.enum(["work_item", "deliverable"]), successorId: Id, lagDays: z.number().int().min(-365).max(365).default(0) }),
  Base.extend({ action: z.literal("planDependency.delete"), dependencyId: Id, expectedVersion: z.number().int().positive() }),
  WorkspaceBase.extend({ action: z.literal("person.create"), personKind: z.enum(["team_member", "client"]), fullName: z.string().trim().min(1).max(120), email: OptionalEmail, roleTitle: z.string().trim().max(160).default(""), organizationName: z.string().trim().max(200).default(""), level: z.enum(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12"]).nullable().default(null), allocation: z.number().int().min(0).max(100).default(100), availabilityNote: z.string().trim().max(1_000).default(""), notes: z.string().trim().max(8_000).default(""), roleIds: z.array(Id).max(12).default([]), primaryRoleId: Id.nullable().default(null), newRoleName: z.string().trim().max(120).default("") }),
  WorkspaceBase.extend({ action: z.literal("person.update"), personId: Id, expectedVersion: z.number().int().positive(), personKind: z.enum(["team_member", "client"]), fullName: z.string().trim().min(1).max(120), email: OptionalEmail, roleTitle: z.string().trim().max(160).default(""), organizationName: z.string().trim().max(200).default(""), level: z.enum(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10", "L11", "L12"]).nullable().default(null), allocation: z.number().int().min(0).max(100).default(100), availabilityNote: z.string().trim().max(1_000).default(""), notes: z.string().trim().max(8_000).default(""), roleIds: z.array(Id).max(12).default([]), primaryRoleId: Id.nullable().default(null), newRoleName: z.string().trim().max(120).default("") }),
  WorkspaceBase.extend({ action: z.literal("person.archive"), personId: Id, expectedVersion: z.number().int().positive() }),
  WorkspaceBase.extend({ action: z.literal("person.removeFromProject"), personId: Id, expectedVersion: z.number().int().positive() }),
  WorkspaceBase.extend({ action: z.literal("role.create"), name: z.string().trim().min(1).max(120), description: z.string().trim().max(8_000).default(""), color: Color }),
  WorkspaceBase.extend({ action: z.literal("role.update"), roleId: Id, expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120), description: z.string().trim().max(8_000).default(""), color: Color }),
  WorkspaceBase.extend({ action: z.literal("role.archive"), roleId: Id, expectedVersion: z.number().int().positive() }),
  WorkspaceBase.extend({ action: z.literal("group.create"), name: z.string().trim().min(1).max(120), description: z.string().trim().max(8_000).default(""), color: Color, personIds: z.array(Id).max(200).default([]) }),
  WorkspaceBase.extend({ action: z.literal("group.update"), groupId: Id, expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120), description: z.string().trim().max(8_000).default(""), color: Color, personIds: z.array(Id).max(200).default([]) }),
  WorkspaceBase.extend({ action: z.literal("group.archive"), groupId: Id, expectedVersion: z.number().int().positive() }),
  WorkspaceBase.extend({ action: z.literal("pto.create"), personId: Id, startDate: DateOnly, endDate: DateOnly, note: z.string().trim().max(8_000).default("") }),
  WorkspaceBase.extend({ action: z.literal("pto.update"), personId: Id, timeOffId: Id, expectedVersion: z.number().int().positive(), startDate: DateOnly, endDate: DateOnly, note: z.string().trim().max(8_000).default("") }),
  WorkspaceBase.extend({ action: z.literal("pto.delete"), timeOffId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("link.create"), objectType: LinkObjectType, objectId: Id, url: LinkUrl, label: z.string().trim().max(300).default("") }),
  Base.extend({ action: z.literal("link.update"), linkId: Id, expectedVersion: z.number().int().positive(), objectType: LinkObjectType, objectId: Id, url: LinkUrl, label: z.string().trim().max(300).default("") }),
  Base.extend({ action: z.literal("link.delete"), linkId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("deliverable.create"), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), deliveryDate: DateOnly, progress: z.number().int().min(0).max(100).default(0), color: Color.default("#5368f4") }),
  Base.extend({ action: z.literal("deliverable.update"), deliverableId: Id, expectedVersion: z.number().int().positive(), title: z.string().trim().min(1).max(200), description: z.string().max(8_000).default(""), deliveryDate: DateOnly, progress: z.number().int().min(0).max(100).default(0), color: Color.default("#5368f4") }),
  Base.extend({ action: z.literal("deliverable.delete"), deliverableId: Id, expectedVersion: z.number().int().positive() }),
  Base.extend({ action: z.literal("deliverableNote.create"), deliverableId: Id, body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("deliverableNote.update"), deliverableId: Id, noteId: Id, expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(8_000) }),
  Base.extend({ action: z.literal("deliverableNote.delete"), deliverableId: Id, noteId: Id, expectedVersion: z.number().int().positive() }),
]);

export type LaneAgentAction = z.infer<typeof LaneAgentActionSchema>;
