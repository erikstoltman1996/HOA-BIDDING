"use client";

import { useTransition } from "react";
import { markChargePaid, markChargeUnpaid, waiveCharge } from "@/app/dues/actions";
import { fmt } from "@/lib/money";
import { Check, AlertCircle, MinusCircle } from "@/components/bid-ledger/icons";

export interface DuesChargeRow {
  id: string;
  unitLabel: string;
  ownerName: string;
  amountDue: number;
  status: "unpaid" | "paid" | "waived";
  paidDate: string | null;
}

const STATUS_ORDER: Record<DuesChargeRow["status"], number> = {
  unpaid: 0,
  waived: 1,
  paid: 2,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Shared between the /dues management page and the Home dashboard.
 * Unpaid sorted to the top per spec — that's what needs attention.
 */
export function DuesTable({
  charges,
  isAdmin,
}: {
  charges: DuesChargeRow[];
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const sorted = [...charges].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.unitLabel.localeCompare(b.unitLabel);
  });

  if (sorted.length === 0) {
    return <p className="text-xs text-ink-soft">No charges for this period yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-rule bg-paper-card shadow-card">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {["Unit", "Owner", "Amount", "Status"].map((h) => (
              <th
                key={h}
                className={`border-b-2 border-ink p-2 text-xs font-medium text-ink-soft ${
                  h === "Amount" ? "text-right" : "text-left"
                }`}
              >
                {h}
              </th>
            ))}
            {isAdmin && <th className="border-b-2 border-ink p-2" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id}>
              <td className="border-t border-rule p-2 text-ink">{c.unitLabel}</td>
              <td className="border-t border-rule p-2 text-ink-soft">{c.ownerName}</td>
              <td className="border-t border-rule p-2 text-right font-mono text-ink">{fmt(c.amountDue)}</td>
              <td className="border-t border-rule p-2">
                {c.status === "paid" && (
                  <span className="flex items-center gap-1 text-check-green">
                    <Check size={14} /> Paid{c.paidDate ? ` ${c.paidDate}` : ""}
                  </span>
                )}
                {c.status === "unpaid" && (
                  <span className="flex items-center gap-1 text-danger">
                    <AlertCircle size={14} /> Unpaid
                  </span>
                )}
                {c.status === "waived" && (
                  <span className="flex items-center gap-1 text-ink-soft">
                    <MinusCircle size={14} /> Waived
                  </span>
                )}
              </td>
              {isAdmin && (
                <td className="border-t border-rule p-2 text-right">
                  <div className="flex justify-end gap-2 text-xs">
                    {c.status !== "paid" && (
                      <button
                        onClick={() => startTransition(() => markChargePaid(c.id, todayIso()))}
                        disabled={isPending}
                        className="text-check-green hover:opacity-80"
                      >
                        Mark paid
                      </button>
                    )}
                    {c.status !== "unpaid" && (
                      <button
                        onClick={() => startTransition(() => markChargeUnpaid(c.id))}
                        disabled={isPending}
                        className="text-danger hover:opacity-80"
                      >
                        Mark unpaid
                      </button>
                    )}
                    {c.status !== "waived" && (
                      <button
                        onClick={() => startTransition(() => waiveCharge(c.id))}
                        disabled={isPending}
                        className="text-ink-soft hover:text-ink"
                      >
                        Waive
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
