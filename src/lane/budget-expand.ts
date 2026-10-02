// Recurrence expansion for budget cost items.
//
// Pure, and deliberately shared by BOTH the line-item editor's live preview and
// the server-side rollup, so the number a person watches while typing and the
// number the Budget tab reads back can never diverge.
//
// Nothing here is ever persisted: expansion is always presented as derived
// ("expands to $4,800 over 6 months"). Change the project's dates and every
// date-inheriting item re-derives on the next read, with no stale cache.

import type { MoneyCadence } from "./format-money";

export type BudgetCadence = MoneyCadence;

export const CADENCE_MONTHS = { monthly: 1, quarterly: 3, annual: 12 } as const;
export const CADENCE_DAYS = { weekly: 7, biweekly: 14 } as const;

/**
 * Hard ceiling on how many occurrences one item may contribute. 520 = ten years
 * of weeks, which is past any real project. It is also one of the two numbers
 * keeping the TypeScript rollup inside Number.MAX_SAFE_INTEGER:
 * 900 items x 520 occurrences x $100M = 4.68e15 < 9.007e15.
 */
export const MAX_OCCURRENCES = 520;

export type ExpansionStatus =
  /** One-time cost: exactly one occurrence, no dates to resolve. */
  | "fixed"
  /** Stepped across a resolved start/end range. */
  | "expanded"
  /** The item carries an explicit occurrence count, which wins over the range. */
  | "count_override"
  /** No resolvable end (and no count) — contributes zero planned money. */
  | "unbounded"
  /** The range would produce more than MAX_OCCURRENCES; clamped. */
  | "capped";

export type ExpansionItem = {
  cadence: BudgetCadence;
  incurredOn: string | null;
  recurrenceStartOn: string | null;
  recurrenceEndOn: string | null;
  occurrenceCount: number | null;
};

export type ExpansionProject = {
  startsOn: string | null;
  dueOn: string | null;
};

export type Expansion = {
  /** How many times this cost is incurred. 0 means "we refuse to guess". */
  occurrences: number;
  status: ExpansionStatus;
  /** First occurrence, `YYYY-MM-DD`, or null when unresolvable. */
  rangeStartOn: string | null;
  /** Last occurrence, `YYYY-MM-DD`, or null when unresolvable. */
  rangeEndOn: string | null;
  /** True when either bound was inherited from the project rather than the item. */
  usesProjectDates: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * Dates are `YYYY-MM-DD` parsed at UTC noon, matching the rest of the planner.
 * Noon keeps a date immune to the +/-12h shifts that break naive midnight parsing.
 */
function toUtcNoon(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * Month arithmetic with end-of-month clamping, always measured from the ORIGINAL
 * start so the series never drifts: Jan 31 + 1mo is Feb 28/29 (not Mar 2 or Mar 3),
 * and Jan 31 + 2mo is back to Mar 31.
 */
export function addMonths(base: Date, months: number): Date {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(year, month + months, 1, 12, 0, 0, 0));
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0, 12, 0, 0, 0),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, daysInTarget));
  return firstOfTarget;
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

function isDayCadence(cadence: BudgetCadence): cadence is keyof typeof CADENCE_DAYS {
  return cadence === "weekly" || cadence === "biweekly";
}

function isMonthCadence(cadence: BudgetCadence): cadence is keyof typeof CADENCE_MONTHS {
  return cadence === "monthly" || cadence === "quarterly" || cadence === "annual";
}

/** The nth occurrence (0-indexed) of a cadence starting at `start`. */
export function occurrenceOn(start: Date, cadence: BudgetCadence, index: number): Date {
  if (isDayCadence(cadence)) return addDays(start, CADENCE_DAYS[cadence] * index);
  if (isMonthCadence(cadence)) return addMonths(start, CADENCE_MONTHS[cadence] * index);
  return start;
}

/**
 * How many occurrences of `cadence` starting at `start` land on or before `end`.
 * Whole periods only — no pro-rating. Subscriptions bill whole periods, and
 * pro-rating would manufacture fractional cents for no product gain.
 */
function countOccurrences(start: Date, end: Date, cadence: BudgetCadence): number {
  if (end.getTime() < start.getTime()) return 0;
  if (isDayCadence(cadence)) {
    return Math.floor(daysBetween(start, end) / CADENCE_DAYS[cadence]) + 1;
  }
  if (isMonthCadence(cadence)) {
    // Stepped rather than divided, because end-of-month clamping makes month
    // arithmetic non-uniform. Bounded at MAX_OCCURRENCES + 1 so an absurd range
    // terminates promptly and still reports (via the extra count) that it
    // overflowed the cap.
    let count = 0;
    while (count <= MAX_OCCURRENCES && occurrenceOn(start, cadence, count).getTime() <= end.getTime()) {
      count += 1;
    }
    return count;
  }
  return 1;
}

/**
 * Resolves one item to a number of occurrences.
 *
 * Order (settled with the user):
 *   1. one_time                       -> 1, "fixed"
 *   2. resolve start/end, item dates winning over the project's
 *   3. explicit occurrenceCount       -> min(count, 520), "count_override"
 *   4. either bound still null        -> 0, "unbounded"  (contributes $0 planned)
 *   5. step the range                 -> "expanded", or "capped" at 520
 *
 * Step 4 is the important one: a $800/mo item in a project with no dates has no
 * defensible total, so we render "needs an end date or a count" rather than
 * inventing money. Its recorded ACTUAL still counts in full.
 */
export function expandItem(item: ExpansionItem, project: ExpansionProject): Expansion {
  if (item.cadence === "one_time") {
    return {
      occurrences: 1,
      status: "fixed",
      rangeStartOn: item.incurredOn,
      rangeEndOn: item.incurredOn,
      usesProjectDates: false,
    };
  }

  const startValue = item.recurrenceStartOn ?? project.startsOn;
  const endValue = item.recurrenceEndOn ?? project.dueOn;
  const usesProjectDates =
    (item.recurrenceStartOn == null && project.startsOn != null) ||
    (item.recurrenceEndOn == null && project.dueOn != null);
  const start = startValue ? toUtcNoon(startValue) : null;
  const end = endValue ? toUtcNoon(endValue) : null;

  if (item.occurrenceCount != null) {
    const occurrences = Math.max(0, Math.min(Math.trunc(item.occurrenceCount), MAX_OCCURRENCES));
    const last = start && occurrences > 0 ? occurrenceOn(start, item.cadence, occurrences - 1) : null;
    return {
      occurrences,
      status: "count_override",
      rangeStartOn: start ? toDateString(start) : null,
      rangeEndOn: last ? toDateString(last) : null,
      usesProjectDates: usesProjectDates && item.recurrenceStartOn == null,
    };
  }

  if (!start || !end) {
    return {
      occurrences: 0,
      status: "unbounded",
      rangeStartOn: start ? toDateString(start) : null,
      rangeEndOn: end ? toDateString(end) : null,
      usesProjectDates,
    };
  }

  const raw = countOccurrences(start, end, item.cadence);
  const capped = raw > MAX_OCCURRENCES;
  const occurrences = capped ? MAX_OCCURRENCES : raw;
  const last = occurrences > 0 ? occurrenceOn(start, item.cadence, occurrences - 1) : null;
  return {
    occurrences,
    status: capped ? "capped" : "expanded",
    rangeStartOn: toDateString(start),
    rangeEndOn: last ? toDateString(last) : toDateString(start),
    usesProjectDates,
  };
}

/**
 * Whether an item's own range reaches outside the project window. Such costs are
 * counted in full (a prepaid annual licence signed before kickoff is real money);
 * the UI badges them rather than zeroing them.
 */
export function fallsOutsideProject(expansion: Expansion, project: ExpansionProject): boolean {
  if (!project.startsOn && !project.dueOn) return false;
  const { rangeStartOn, rangeEndOn } = expansion;
  if (project.startsOn && rangeStartOn && rangeStartOn < project.startsOn) return true;
  if (project.dueOn && rangeEndOn && rangeEndOn > project.dueOn) return true;
  return false;
}
