"use client";

import { useState } from "react";
import { setExpenseAmount } from "@/app/expenses/actions";
import { useDebouncedCallback } from "@/lib/useDebouncedCallback";
import { fmt, money } from "@/lib/money";

export interface ExpenseTableRow {
  categoryId: string;
  categoryLabel: string;
  amount: number | null;
}

/**
 * Every category always has a row here, even with no amount entered yet
 * for this period — "not entered" is itself information (see
 * lib/expensesData.ts), so the table isn't filtered down to only what's
 * already been filled in.
 */
export function ExpenseTable({
  period,
  rows,
  isAdmin,
}: {
  period: string;
  rows: ExpenseTableRow[];
  isAdmin: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.categoryId, r.amount === null ? "" : String(r.amount)])),
  );
  const debouncedSave = useDebouncedCallback((_key: string, fn: () => void) => fn(), 500);

  function handleChange(categoryId: string, value: string) {
    setValues((v) => ({ ...v, [categoryId]: value }));
    const parsed = money(value);
    if (parsed !== null) {
      debouncedSave(categoryId, () => setExpenseAmount(categoryId, period, parsed));
    }
  }

  if (rows.length === 0) {
    return <p className="text-xs text-ink-soft">No expense categories added yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-rule bg-paper-card shadow-card">
      <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 400 }}>
        <thead>
          <tr>
            <th className="border-b-2 border-ink p-2 text-left text-xs font-medium text-ink-soft">Category</th>
            <th className="border-b-2 border-ink p-2 text-right text-xs font-medium text-ink-soft">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoryId}>
              <td className="border-t border-rule p-2 text-ink">{r.categoryLabel}</td>
              <td className="border-t border-rule p-2 text-right">
                {isAdmin ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-mono text-ink-soft">$</span>
                    <input
                      value={values[r.categoryId] ?? ""}
                      onChange={(e) => handleChange(r.categoryId, e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-24 bg-transparent text-right font-mono text-ink outline-none"
                    />
                  </div>
                ) : (
                  <span className="font-mono text-ink">{r.amount !== null ? fmt(r.amount) : "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
