// Project budget rollups. Pure — flat RLS-read rows in, a derived view out.
//
// This DB has no view, materialized view, or rollup function anywhere, by house
// rule: rollups are computed in TypeScript so a schema change can never silently
// re-derive money behind an optimistic-concurrency version bump. `buildProjectPlan`
// in ./model.ts is the same shape of module.

import {
  expandItem,
  fallsOutsideProject,
  type BudgetCadence,
  type ExpansionStatus,
} from "./budget-expand";

export type { BudgetCadence };

// ── Caps ────────────────────────────────────────────────────────────────────
// These are a matched set with the SQL in 20260911120000_project_budget_rpcs.sql
// (which raises 54000) and the loader's enforceLimit in project-budget.server.ts.
// Raising ANY of them without the others turns the tab into a PlannerDataError —
// and raising the money ceilings means moving these sums to BigInt, because the
// binding constraint is Number.MAX_SAFE_INTEGER (9.007e15), not bigint:
//   900 items x 520 occurrences x $100M = 4.68e15 cents, which still fits.
export const MAX_ITEM_CENTS = 10_000_000_000; // $100,000,000 per line item
export const MAX_TOTAL_CENTS = 100_000_000_000_000; // $1,000,000,000,000 per project / bucket
export const MAX_BUCKETS_PER_PROJECT = 60;
export const MAX_ITEMS_PER_BUCKET = 300;
export const MAX_ITEMS_PER_PROJECT = 900;

/** Matches the budget_buckets.color column default in 20260910120000. */
export const DEFAULT_BUCKET_COLOR = "#5368f4";

/** One-click starters offered on the empty state. Buckets are otherwise free-form. */
export const STARTER_BUCKETS = [
  "Research",
  "Licenses & subscriptions",
  "Technology",
  "Travel",
  "Team & events",
] as const;

export const budgetCadences = [
  "one_time",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annual",
] as const;

// ── Inputs (snake_case, straight off PostgREST) ──────────────────────────────

export type ProjectBudgetRow = {
  id: string;
  total_amount_cents: number;
  notes: string;
  version: number;
};

export type BudgetBucketRow = {
  id: string;
  name: string;
  color: string;
  allocated_amount_cents: number;
  notes: string;
  sort_key: string;
  version: number;
  created_at?: string;
};

export type BudgetItemRow = {
  id: string;
  bucket_id: string;
  name: string;
  vendor: string;
  notes: string;
  planned_amount_cents: number;
  actual_amount_cents: number | null;
  cadence: BudgetCadence;
  incurred_on: string | null;
  recurrence_start_on: string | null;
  recurrence_end_on: string | null;
  occurrence_count: number | null;
  sort_key: string;
  version: number;
  created_at?: string;
};

export type ProjectBudgetSource = {
  project: { id: string; name?: string; startsOn: string | null; dueOn: string | null };
  budget: ProjectBudgetRow | null;
  buckets: BudgetBucketRow[];
  items: BudgetItemRow[];
};

// ── Outputs (camelCase view model) ───────────────────────────────────────────

export type BudgetItemView = {
  id: string;
  bucketId: string;
  name: string;
  vendor: string;
  notes: string;
  cadence: BudgetCadence;
  /** What one occurrence costs. NEVER the total — see plannedCents. */
  plannedPerOccurrenceCents: number;
  occurrences: number;
  expansionStatus: ExpansionStatus;
  usesProjectDates: boolean;
  outsideProjectDates: boolean;
  rangeStartOn: string | null;
  rangeEndOn: string | null;
  incurredOn: string | null;
  recurrenceStartOn: string | null;
  recurrenceEndOn: string | null;
  occurrenceCount: number | null;
  /** per-occurrence x occurrences. 0 while the recurrence is unbounded. */
  plannedCents: number;
  /** Total paid to date, not per occurrence. null = not recorded yet. */
  actualCents: number | null;
  /** (actual ?? 0) - planned. Negative = under, positive = over. */
  varianceCents: number;
  sortKey: string;
  version: number;
};

export type BudgetBucketView = {
  id: string;
  name: string;
  color: string;
  notes: string;
  allocatedCents: number;
  plannedCents: number;
  actualCents: number;
  /** allocated - actual. Signed: negative means the bucket is over its allocation. */
  remainingCents: number;
  /** allocated - planned: allocation not yet committed to a line item. Signed. */
  unplannedHeadroomCents: number;
  /** actual / allocated. null — not 0, not Infinity — when nothing is allocated. */
  utilizationPercent: number | null;
  isOverBudget: boolean;
  itemCount: number;
  itemsMissingActual: number;
  hasUnboundedRecurring: boolean;
  items: BudgetItemView[];
  sortKey: string;
  version: number;
};

export type BudgetWarning = "no_total" | "over_allocated" | "over_budget" | "unbounded_recurring";

export type ProjectBudget = {
  projectId: string;
  /** False until someone sets a total — distinct from a total of $0. */
  exists: boolean;
  budgetId: string | null;
  version: number | null;
  notes: string;
  totalCents: number;
  allocatedCents: number;
  plannedCents: number;
  actualCents: number;
  /** total - allocated. Negative means the buckets over-allocate the total. */
  unallocatedCents: number;
  /** total - actual. Signed; never clamped at zero. */
  remainingCents: number;
  /** actual / total. null when no total is set. Never capped at 100. */
  utilizationPercent: number | null;
  itemCount: number;
  itemsMissingActual: number;
  buckets: BudgetBucketView[];
  warnings: BudgetWarning[];
  projectStartsOn: string | null;
  projectDueOn: string | null;
  hasProjectDates: boolean;
};

function byOrder(a: { sort_key: string; created_at?: string; name: string }, b: typeof a): number {
  if (a.sort_key !== b.sort_key) return a.sort_key < b.sort_key ? -1 : 1;
  const aCreated = a.created_at ?? "";
  const bCreated = b.created_at ?? "";
  if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function percentOf(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function buildItem(row: BudgetItemRow, project: ProjectBudgetSource["project"]): BudgetItemView {
  const expansion = expandItem(
    {
      cadence: row.cadence,
      incurredOn: row.incurred_on,
      recurrenceStartOn: row.recurrence_start_on,
      recurrenceEndOn: row.recurrence_end_on,
      occurrenceCount: row.occurrence_count,
    },
    { startsOn: project.startsOn, dueOn: project.dueOn },
  );
  const perOccurrence = Math.max(0, row.planned_amount_cents ?? 0);
  const plannedCents = perOccurrence * expansion.occurrences;
  const actualCents = row.actual_amount_cents == null ? null : Math.max(0, row.actual_amount_cents);
  return {
    id: row.id,
    bucketId: row.bucket_id,
    name: row.name,
    vendor: row.vendor ?? "",
    notes: row.notes ?? "",
    cadence: row.cadence,
    plannedPerOccurrenceCents: perOccurrence,
    occurrences: expansion.occurrences,
    expansionStatus: expansion.status,
    usesProjectDates: expansion.usesProjectDates,
    outsideProjectDates: fallsOutsideProject(expansion, { startsOn: project.startsOn, dueOn: project.dueOn }),
    rangeStartOn: expansion.rangeStartOn,
    rangeEndOn: expansion.rangeEndOn,
    incurredOn: row.incurred_on,
    recurrenceStartOn: row.recurrence_start_on,
    recurrenceEndOn: row.recurrence_end_on,
    occurrenceCount: row.occurrence_count,
    plannedCents,
    actualCents,
    varianceCents: (actualCents ?? 0) - plannedCents,
    sortKey: row.sort_key,
    version: row.version,
  };
}

/**
 * Rolls a project's budget up from flat rows.
 *
 * Two rules drive every number here:
 *  - An item with no recorded actual counts as **0 in every sum** and increments
 *    `itemsMissingActual`, so the UI can say "actuals incomplete (3 of 11)"
 *    instead of implying nothing has been spent.
 *  - Over-budget is a signed negative remaining plus a boolean. Nothing is
 *    clamped at zero and utilization is never capped at 100%.
 */
export function buildProjectBudget(source: ProjectBudgetSource): ProjectBudget {
  const { project, budget } = source;
  const itemsByBucket = new Map<string, BudgetItemRow[]>();
  for (const row of source.items) {
    const list = itemsByBucket.get(row.bucket_id);
    if (list) list.push(row);
    else itemsByBucket.set(row.bucket_id, [row]);
  }

  let allocatedCents = 0;
  let plannedCents = 0;
  let actualCents = 0;
  let itemCount = 0;
  let itemsMissingActual = 0;
  let anyUnbounded = false;

  const buckets: BudgetBucketView[] = [...source.buckets].sort(byOrder).map((bucketRow) => {
    const rows = (itemsByBucket.get(bucketRow.id) ?? []).slice().sort(byOrder);
    const items = rows.map((row) => buildItem(row, project));

    let bucketPlanned = 0;
    let bucketActual = 0;
    let bucketMissingActual = 0;
    let bucketUnbounded = false;
    for (const item of items) {
      bucketPlanned += item.plannedCents;
      if (item.actualCents == null) bucketMissingActual += 1;
      else bucketActual += item.actualCents;
      if (item.expansionStatus === "unbounded") bucketUnbounded = true;
    }

    const allocated = Math.max(0, bucketRow.allocated_amount_cents ?? 0);
    allocatedCents += allocated;
    plannedCents += bucketPlanned;
    actualCents += bucketActual;
    itemCount += items.length;
    itemsMissingActual += bucketMissingActual;
    anyUnbounded = anyUnbounded || bucketUnbounded;

    return {
      id: bucketRow.id,
      name: bucketRow.name,
      color: bucketRow.color,
      notes: bucketRow.notes ?? "",
      allocatedCents: allocated,
      plannedCents: bucketPlanned,
      actualCents: bucketActual,
      remainingCents: allocated - bucketActual,
      unplannedHeadroomCents: allocated - bucketPlanned,
      utilizationPercent: percentOf(bucketActual, allocated),
      isOverBudget: allocated > 0 && bucketActual > allocated,
      itemCount: items.length,
      itemsMissingActual: bucketMissingActual,
      hasUnboundedRecurring: bucketUnbounded,
      items,
      sortKey: bucketRow.sort_key,
      version: bucketRow.version,
    };
  });

  const totalCents = Math.max(0, budget?.total_amount_cents ?? 0);
  const unallocatedCents = totalCents - allocatedCents;

  const warnings: BudgetWarning[] = [];
  if (totalCents <= 0 && (buckets.length > 0 || itemCount > 0)) warnings.push("no_total");
  if (unallocatedCents < 0) warnings.push("over_allocated");
  if (totalCents > 0 && actualCents > totalCents) warnings.push("over_budget");
  if (anyUnbounded) warnings.push("unbounded_recurring");

  return {
    projectId: project.id,
    exists: budget != null,
    budgetId: budget?.id ?? null,
    version: budget?.version ?? null,
    notes: budget?.notes ?? "",
    totalCents,
    allocatedCents,
    plannedCents,
    actualCents,
    unallocatedCents,
    remainingCents: totalCents - actualCents,
    utilizationPercent: percentOf(actualCents, totalCents),
    itemCount,
    itemsMissingActual,
    buckets,
    warnings,
    projectStartsOn: project.startsOn,
    projectDueOn: project.dueOn,
    hasProjectDates: Boolean(project.startsOn && project.dueOn),
  };
}

/** Every item in the project, flattened for the "All costs" table view. */
export function flattenBudgetItems(
  budget: ProjectBudget,
): Array<BudgetItemView & { bucketName: string; bucketColor: string }> {
  return budget.buckets.flatMap((bucket) =>
    bucket.items.map((item) => ({ ...item, bucketName: bucket.name, bucketColor: bucket.color })),
  );
}

/**
 * The sentence read out for the Rail (role="img") and reused by the MCP/Ask Lane
 * summary, so screen-reader users and agents get the identical framing.
 */
export function describeBudget(budget: ProjectBudget, formatMoney: (cents: number) => string): string {
  if (!budget.exists || budget.totalCents <= 0) {
    return budget.buckets.length === 0
      ? "No budget has been set for this project."
      : `No total budget is set. ${formatMoney(budget.allocatedCents)} is allocated across ${budget.buckets.length} ${budget.buckets.length === 1 ? "category" : "categories"} and ${formatMoney(budget.actualCents)} is spent.`;
  }
  const share = Math.round((budget.actualCents / budget.totalCents) * 100);
  return `Of a ${formatMoney(budget.totalCents)} total, ${formatMoney(budget.allocatedCents)} is allocated across ${budget.buckets.length} ${budget.buckets.length === 1 ? "category" : "categories"} and ${formatMoney(budget.actualCents)} is spent — ${share}% of the total.`;
}
