import type { DuesSummary as DuesSummaryData } from "@/lib/dues";
import { DUES_COLLECTION_THRESHOLDS, healthBandColor } from "@/lib/healthBand";
import { fmt } from "@/lib/money";

/**
 * The at-a-glance strip for /dues and the Home dashboard's Dues section:
 * four numbers a volunteer treasurer can read in a couple seconds, ahead
 * of anything else on the page (setup forms, per-unit detail). Collection
 * rate is both color-banded AND visually larger than its neighbors — it's
 * the one number here that answers "are we okay on dues," so it should
 * dominate the way Reserve's "Funded today" does, not just be tinted
 * differently from Collected/Outstanding/Overdue, which don't have an
 * inherent good/bad threshold and stay neutral ink at the smaller size.
 */
export function DuesSummary({ summary }: { summary: DuesSummaryData }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Collection rate"
        value={`${summary.collectionRate.toFixed(0)}%`}
        color={healthBandColor(summary.collectionRate, DUES_COLLECTION_THRESHOLDS)}
        dominant
      />
      <Stat label="Collected" value={fmt(summary.totalCollected)} />
      <Stat label="Outstanding" value={fmt(summary.totalOutstanding)} />
      <Stat
        label="Overdue"
        value={
          summary.billedCount === 0
            ? "—"
            : `${summary.overdueCount} of ${summary.billedCount} units`
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  dominant = false,
}: {
  label: string;
  value: string;
  color?: string;
  dominant?: boolean;
}) {
  return (
    <div className="rounded border border-rule bg-paper-card p-3 shadow-card">
      <div className="mb-1 text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div
        className={`font-mono font-bold ${dominant ? "text-2xl" : "text-lg font-semibold"}`}
        style={color ? { color } : { color: "#1F2B3D" }}
      >
        {value}
      </div>
    </div>
  );
}
