import Link from "next/link";
import { fmt } from "@/lib/money";
import { formatPeriodLabel, shiftPeriod } from "@/lib/dues";
import { ChevronLeft, ChevronRight } from "@/components/bid-ledger/icons";

/**
 * Shows the reserve balance and a month's actual operating expenses side
 * by side — deliberately NOT summed into one "combined balance" figure.
 *
 * An earlier version did sum them (balance + one month's contribution −
 * that month's expenses), which is wrong whenever the stored balance
 * itself came from importing a bookkeeping file's ending balance for that
 * same month — that balance already has the month's expenses paid out of
 * it, so subtracting them again double-counts. There's no reliable way to
 * tell "this balance is a live right-now figure" apart from "this balance
 * already reflects the month being viewed" (reserve_settings has no
 * per-month history, just one mutable point value), so combining them can
 * never be made safe in general. Showing both numbers plainly, with an
 * "as of" timestamp on the balance, lets the reader do that judgment call
 * themselves instead of being handed a number that might be wrong.
 */
export function ReserveCashSummary({
  period,
  currentReserveBalance,
  balanceUpdatedAt,
  operatingExpenseTotal,
}: {
  period: string;
  currentReserveBalance: number;
  balanceUpdatedAt: string | null;
  operatingExpenseTotal: number;
}) {
  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-medium text-ink-soft">Reserve balance &amp; operating expenses</div>
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
          <div className="mb-1 text-xs text-ink-soft">
            Reserve balance{balanceUpdatedAt ? ` (as of ${new Date(balanceUpdatedAt).toLocaleDateString()})` : ""}
          </div>
          <p className="font-mono text-2xl font-bold text-ink">{fmt(currentReserveBalance)}</p>
        </div>
        <div>
          <div className="mb-1 text-xs text-ink-soft">{formatPeriodLabel(period)} operating expenses</div>
          <p className="font-mono text-2xl font-bold text-danger">
            {operatingExpenseTotal > 0 ? fmt(operatingExpenseTotal) : "—"}
          </p>
        </div>
        <Link
          href={`/expenses?period=${period}`}
          className="ml-auto text-xs text-ink-soft underline hover:text-ink"
        >
          View expense detail →
        </Link>
      </div>
      <p className="mt-2 text-[11px] leading-tight text-ink-soft">
        Shown side by side, not added together — if the reserve balance came from importing a bookkeeping file&apos;s
        ending balance for {formatPeriodLabel(period)}, that figure already has these expenses paid out of it, so
        combining them would double-count. Many HOAs keep reserve and operating funds in separate accounts, too.
        The Outlook below reflects reserve activity only.
      </p>
    </div>
  );
}
