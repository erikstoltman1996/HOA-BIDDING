// Period keys are always the first of the month ("2026-08-01") so one
// dues_charges row per unit per calendar month has an unambiguous, sortable
// key. Built from local Date components (not toISOString(), which converts
// to UTC and can shift the date near month boundaries in negative-UTC-offset
// timezones) so "this period" always means the viewer's own calendar month.

export function periodKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function currentPeriod(): string {
  return periodKey(new Date());
}

export function shiftPeriod(period: string, deltaMonths: number): string {
  const [y, m] = period.split("-").map(Number);
  return periodKey(new Date(y, m - 1 + deltaMonths, 1));
}

export function formatPeriodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export interface ChargeForRate {
  status: "unpaid" | "paid" | "waived";
  amount_due: number;
}

/**
 * Collection rate = paid / (paid + unpaid). Waived charges are excluded
 * from both the numerator and the denominator entirely, so a waiver never
 * makes collection look better than it is — a deliberate choice, not an
 * oversight, since "collected" and "we chose not to collect this one" are
 * different facts about the fund.
 *
 * A zero denominator (no charges yet, or every charge waived) reads as
 * 100% — nothing outstanding — mirroring how ReserveTrackerService treats
 * a zero fully-funded balance as 100% funded rather than dividing by zero.
 */
export function calculateCollectionRate(charges: ChargeForRate[]): number {
  const counted = charges.filter((c) => c.status !== "waived");
  const totalDue = counted.reduce((sum, c) => sum + c.amount_due, 0);
  if (totalDue === 0) return 100;
  const totalPaid = counted
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + c.amount_due, 0);
  return (totalPaid / totalDue) * 100;
}
