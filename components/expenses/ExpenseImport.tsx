"use client";

import { useState } from "react";
import { bulkApplyExpenseImport, parseExpenseImportFile } from "@/app/expenses/actions";
import type { ParsedExpenseBreakdown } from "@/lib/financialImportParser";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { formatPeriodLabel } from "@/lib/dues";

/**
 * Uploads a monthly income/expense export and bulk-imports its whole
 * expense section — every category, every month found — rather than just
 * the two summary numbers the reserve importer pulls out. See
 * lib/financialImportParser.ts's parseExpenseBreakdown for the detection
 * logic (label-based, degrades to "add manually" on an unrecognized
 * layout) and app/expenses/actions.ts for why a starting year has to be
 * supplied by hand: a spreadsheet labels columns with a month name, never
 * a year, so there's no way to recover it from the file alone.
 */
export function ExpenseImport() {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(String(currentYear));
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "applying" | "applied" | "error">("idle");
  const [result, setResult] = useState<ParsedExpenseBreakdown | null>(null);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const year = Number(startYear);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      setStatus("error");
      setError("Enter a valid starting year first.");
      return;
    }
    setStatus("parsing");
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await parseExpenseImportFile(formData, year);
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not read that file");
    }
  }

  async function apply() {
    if (!result || result.categories.length === 0) return;
    setStatus("applying");
    try {
      await bulkApplyExpenseImport(result.categories);
      setStatus("applied");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save the imported categories");
    }
  }

  const totalEntries = result?.categories.reduce((sum, c) => sum + c.entries.length, 0) ?? 0;

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-3">
      <p className="mb-2 text-xs text-ink-soft">
        Upload a monthly expense export (CSV or XLSX) to bulk-import categories and their
        monthly amounts, instead of adding them one at a time. Nothing is saved until you review
        the list below and click Apply — the file itself is never stored.
      </p>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="w-28">
          <Label htmlFor="expense-import-year">First column&apos;s year</Label>
          <Input
            id="expense-import-year"
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            className="font-mono"
          />
        </div>
        <div>
          <Label htmlFor="expense-import-file">File</Label>
          <input
            id="expense-import-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="text-xs text-ink-soft file:mr-3 file:rounded file:border file:border-rule file:bg-paper file:px-2 file:py-1 file:text-xs file:text-ink hover:file:border-ink"
          />
        </div>
      </div>

      {status === "parsing" && <p className="mt-2 text-xs text-ink-soft">Reading file…</p>}
      {status === "error" && <p className="mt-2 text-xs text-danger">{error}</p>}

      {(status === "done" || status === "applying" || status === "applied") && result && (
        <div className="mt-3 rounded border border-rule bg-paper p-3 text-sm">
          {result.warnings.map((w) => (
            <p key={w} className="mb-2 text-xs text-gold-text">
              {w}
            </p>
          ))}

          {result.categories.length === 0 ? (
            <p className="text-xs text-ink-soft">Nothing recognizable found — add categories manually below.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink-soft">
                Found {result.categories.length} categor{result.categories.length === 1 ? "y" : "ies"},{" "}
                {totalEntries} month{totalEntries === 1 ? "" : "s"} of amounts total. Review before applying:
              </p>
              <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto text-xs">
                {result.categories.map((c) => {
                  const first = c.entries[0];
                  const last = c.entries[c.entries.length - 1];
                  return (
                    <li key={c.label} className="flex items-center justify-between gap-2">
                      <span className="text-ink">{c.label}</span>
                      <span className="text-ink-soft">
                        {c.entries.length === 0
                          ? "no months found"
                          : c.entries.length === 1
                            ? formatPeriodLabel(first.period)
                            : `${formatPeriodLabel(first.period)} – ${formatPeriodLabel(last.period)} (${c.entries.length})`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <Button type="button" variant="outline" onClick={apply} disabled={status === "applying" || status === "applied"}>
                {status === "applied" ? "Applied" : status === "applying" ? "Applying…" : "Apply — import all categories & amounts"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
