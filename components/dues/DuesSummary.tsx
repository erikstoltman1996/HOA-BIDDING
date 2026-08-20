import type { DuesSummary as DuesSummaryData } from "@/lib/dues";
import { DUES_COLLECTION_THRESHOLDS, healthBandColor } from "@/lib/healthBand";
import { fmt } from "@/lib/money";

/**
 * The at-a-glance strip for /dues and the Home dashboard's Dues section:
 * four numbers a volunteer treasurer can read in a couple seconds, ahead
 * of anything else on the page (setup forms, per-unit detail). Only the
 * collection rate is color-banded — it's the one number here with an
 * inherent good/bad threshold; raw dollar totals and a plain overdue
 * count don't, so they stay neutral ink.
 */
export function DuesSummary({ summary }: { summary: DuesSummaryData }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Collection rate"
        value={`${summary.collectionRate.toFixed(0)}%`}
        color={healthBandColor(summary.collectionRate, DUES_COLLECTION_THRESHOLDS)}
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-rule bg-paper-card p-3 shadow-card">
      <div className="mb-1 text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="font-mono text-lg font-semibold" style={color ? { color } : { color: "#1F2B3D" }}>
        {value}
      </div>
    </div>
  );
}
