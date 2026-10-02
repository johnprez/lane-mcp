// The app's first currency primitive. Every money value in Lane is an integer
// number of USD minor units (cents) and is formatted exactly once, at the edge.
// USD only by decision — there is no currency column and no FX anywhere.

export type MoneyCentsMode = "auto" | "always" | "never";

// One memoized Intl.NumberFormat per (min, max) fraction-digit pair. Building an
// Intl formatter is the expensive part; a budget page formats hundreds of values.
const formatters = new Map<string, Intl.NumberFormat>();
function currencyFormatter(minimumFractionDigits: number, maximumFractionDigits: number) {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits,
      maximumFractionDigits,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

const MINUS = "−"; // U+2212 MINUS SIGN — aligns with digits; the ASCII hyphen does not.

function safeCents(cents: number): number {
  return Number.isFinite(cents) ? Math.round(cents) : 0;
}

/**
 * `$48,000` / `$1,249.99`.
 *
 * - `"auto"` (default) drops `.00` but keeps cents whenever they are non-zero, so
 *   rolled-up KPIs stay uncluttered while an exact invoice stays exact.
 * - `"always"` pins two decimals (use where a column must align digit-for-digit).
 * - `"never"` rounds to whole dollars.
 */
export function formatMoney(cents: number, options: { cents?: MoneyCentsMode } = {}): string {
  const value = safeCents(cents);
  const mode = options.cents ?? "auto";
  if (mode === "never") return currencyFormatter(0, 0).format(Math.round(value / 100));
  if (mode === "always") return currencyFormatter(2, 2).format(value / 100);
  return currencyFormatter(0, value % 100 === 0 ? 0 : 2).format(value / 100);
}

/** `$4.8k` / `$1.2M`. For dense chips and tight legends only — never for a KPI. */
export function formatMoneyCompact(cents: number): string {
  const value = safeCents(cents);
  const sign = value < 0 ? MINUS : "";
  const abs = Math.abs(value);
  if (abs < 1_000_00) return `${sign}${formatMoney(abs)}`;
  const units: Array<{ cents: number; suffix: string }> = [
    { cents: 1_000_000_000_00, suffix: "B" },
    { cents: 1_000_000_00, suffix: "M" },
    { cents: 1_000_00, suffix: "k" },
  ];
  for (const unit of units) {
    if (abs < unit.cents) continue;
    const scaled = abs / unit.cents;
    const text = scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
    return `${sign}$${text}${unit.suffix}`;
  }
  return `${sign}${formatMoney(abs)}`;
}

/** `+$400` / `−$400`. Signed, with a real minus sign, for variance columns. */
export function formatMoneyDelta(cents: number, options: { cents?: MoneyCentsMode } = {}): string {
  const value = safeCents(cents);
  if (value === 0) return formatMoney(0, options);
  const magnitude = formatMoney(Math.abs(value), options);
  return value > 0 ? `+${magnitude}` : `${MINUS}${magnitude}`;
}

/** Cadence keys, duplicated from the DB `check` constraint so this module stays pure. */
export type MoneyCadence = "one_time" | "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

const CADENCE_ABBREVIATION: Record<MoneyCadence, string> = {
  one_time: "",
  weekly: "wk",
  biweekly: "2wk",
  monthly: "mo",
  quarterly: "qtr",
  annual: "yr",
};

const CADENCE_LABEL: Record<MoneyCadence, string> = {
  one_time: "One-time",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const CADENCE_PERIOD_NOUN: Record<MoneyCadence, string> = {
  one_time: "time",
  weekly: "week",
  biweekly: "2 weeks",
  monthly: "month",
  quarterly: "quarter",
  annual: "year",
};

export function cadenceLabel(cadence: MoneyCadence): string {
  return CADENCE_LABEL[cadence] ?? CADENCE_LABEL.one_time;
}

export function cadencePeriodNoun(cadence: MoneyCadence): string {
  return CADENCE_PERIOD_NOUN[cadence] ?? CADENCE_PERIOD_NOUN.one_time;
}

/**
 * `$800/mo`. A rate is never a total — this is the only shape a per-occurrence
 * amount may take outside the aligned money gutter.
 */
export function formatRate(cents: number, cadence: MoneyCadence): string {
  const amount = formatMoney(cents);
  const abbreviation = CADENCE_ABBREVIATION[cadence] ?? "";
  return abbreviation ? `${amount}/${abbreviation}` : amount;
}

/**
 * Parses what a person types into a money field → integer cents.
 * Accepts `$1,234.56`, `1234.56`, `.5`, `1 234`. Rejects negatives (every amount
 * Lane stores is `>= 0`), anything non-numeric, and more than two decimal places
 * is rounded rather than refused. Returns null when there is nothing usable.
 */
export function parseMoneyInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$,\s ]/g, "").trim();
  if (cleaned === "") return null;
  if (!/^\d*(\.\d*)?$/.test(cleaned)) return null;
  if (cleaned === ".") return null;
  // Parsed off the decimal string rather than `parseFloat(x) * 100`, which is
  // not exact for money: 1.005 * 100 is 100.49999999999999, so the obvious
  // implementation silently rounds a cent away.
  const [whole, fraction = ""] = cleaned.split(".");
  const dollars = whole === "" ? 0 : Number.parseInt(whole, 10);
  if (!Number.isSafeInteger(dollars)) return null;
  const padded = `${fraction}000`.slice(0, 3);
  const cents = Number.parseInt(padded.slice(0, 2), 10) + (Number.parseInt(padded[2], 10) >= 5 ? 1 : 0);
  return dollars * 100 + cents;
}

/** `56.9%` / `78%` / `—` when there is no denominator to divide by. */
export function formatPercent(value: number | null | undefined, options: { fallback?: string } = {}): string {
  if (value == null || !Number.isFinite(value)) return options.fallback ?? "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/**
 * Formats a **dollar** float (not cents). Only for legacy call sites that already
 * hold floating-point dollars — AI spend, which arrives from the model-pricing
 * math as a float. New code should carry cents and use `formatMoney`.
 */
export function formatCostDollars(value: number): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return currencyFormatter(2, 2).format(Number.isFinite(value) ? value : 0);
}
