import Link from "next/link";
import { fmt } from "@/lib/money";
import { formatPeriodLabel, shiftPeriod } from "@/lib/dues";
import { ChevronLeft, ChevronRight } from "@/components/bid-ledger/icons";

/**
 * "What's actually left after we pay the bills this month" — combines the
 * reserve fund's own numbers with the Expenses tab's actual entered totals,
 * which the Yearly/Monthly Outlook tables below deliberately never do (they
 * stay pure reserve math). This is explicitly a snapshot, not a ledger: the
 * reserve balance is always "as of today" (there's no month-by-month
 * historical reserve balance stored anywhere), only the operating expense
 * side is genuinely tied to the month being viewed. Real HOA bylaws often
 * keep reserve and operating funds in legally separate accounts, too — this
 * combines them for a quick read, not as a statement that they're one pot.
 */
export function ReserveCashSummary({
  period,
  currentReserveBalance,
  monthlyContribution,
  operatingExpenseTotal,
}: {
  period: string;
  currentReserveBalance: number;
  monthlyContribution: number;
  operatingExpenseTotal: number;
}) {
  const combinedBalance = currentReserveBalance + monthlyContribution - operatingExpenseTotal;

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-ink-soft">Cash position after operating expenses</div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/reserve?cashPeriod=${shiftPeriod(period, -1)}`}
            className="text-ink-soft hover:text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-[8rem] text-center font-medium text-ink">{formatPeriodLabel(period)}</span>
          <Link
            href={`/reserve?cashPeriod=${shiftPeriod(period, 1)}`}
            className="text-ink-soft hover:text-ink"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <div className="mb-1 text-xs text-ink-soft">+ Reserve contribution</div>
          <p className="font-mono text-lg text-check-green">{fmt(monthlyContribution)}</p>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-soft">− Operating expenses</div>
          <p className="font-mono text-lg text-danger">
            {operatingExpenseTotal > 0 ? fmt(operatingExpenseTotal) : "—"}
          </p>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-soft">Combined balance</div>
          <p className="font-mono text-2xl font-bold text-ink">{fmt(combinedBalance)}</p>
        </div>
        <Link
          href={`/expenses?period=${period}`}
          className="ml-auto text-xs text-ink-soft underline hover:text-ink"
        >
          View expense detail →
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-tight text-ink-soft">
        Today&apos;s reserve balance plus one month&apos;s contribution, minus {formatPeriodLabel(period)}&apos;s
        actual entered operating expenses — a quick combined snapshot, not a historical ledger (many HOAs keep
        reserve and operating funds in separate accounts). The Outlook below reflects reserve activity only.
      </p>
    </div>
  );
}
