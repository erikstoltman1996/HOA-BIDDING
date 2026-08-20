import type { ExpensesSummary as ExpensesSummaryData } from "@/lib/expenses";
import { fmt } from "@/lib/money";

/**
 * The at-a-glance strip for /expenses: what's been spent this period, and
 * whether the books for the month are actually complete. No health-band
 * color here — unlike dues collection rate or reserve percent-funded, a
 * raw expense total has no inherent good/bad threshold without a budget
 * to compare it against (this app doesn't have a budgeting concept), so
 * it stays neutral ink. Still sized as the dominant figure on the page,
 * same as every other section's primary number.
 */
export function ExpensesSummary({ summary }: { summary: ExpensesSummaryData }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded border border-rule bg-paper-card p-3 shadow-card">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Total this period</div>
        <div className="font-mono text-2xl font-bold text-ink">{fmt(summary.totalThisPeriod)}</div>
      </div>
      <div className="rounded border border-rule bg-paper-card p-3 shadow-card">
        <div className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Entered</div>
        <div className="font-mono text-lg font-semibold text-ink">
          {summary.totalCategories === 0
            ? "—"
            : `${summary.categoriesEntered} of ${summary.totalCategories} categories`}
        </div>
      </div>
    </div>
  );
}
