"use client";

import { useState } from "react";
import Link from "next/link";
import { bulkApplyDuesImport, parseDuesImportFile, undoDuesImport } from "@/app/dues/actions";
import type { DuesImportManifest } from "@/app/dues/actions";
import type { ParsedDuesBreakdown } from "@/lib/financialImportParser";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { formatPeriodLabel } from "@/lib/dues";

/**
 * Uploads a monthly income export and bulk-imports whatever dues/
 * assessment income it finds — one row per unit, one charge per month —
 * instead of generating charges and marking them paid one at a time.
 * Reads the same file the Reserve and Expenses importers do (see
 * lib/financialImportParser.ts's parseDuesBreakdown for the detection
 * logic): a real amount received that month is recorded paid at that
 * amount; an explicit $0 is recorded unpaid; a month with no value at all
 * gets no charge, same as leaving it blank today.
 */
export function DuesImport() {
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(String(currentYear));
  const [status, setStatus] = useState<
    "idle" | "parsing" | "done" | "applying" | "applied" | "undoing" | "undone" | "error"
  >("idle");
  const [result, setResult] = useState<ParsedDuesBreakdown | null>(null);
  const [manifest, setManifest] = useState<DuesImportManifest | null>(null);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsedYear = Number(startYear);
    const year = Number.isFinite(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : currentYear;
    setStatus("parsing");
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await parseDuesImportFile(formData, year);
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not read that file");
    }
  }

  async function apply() {
    if (!result || result.units.length === 0) return;
    setStatus("applying");
    try {
      const appliedManifest = await bulkApplyDuesImport(result.units);
      setManifest(appliedManifest);
      setStatus("applied");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save the imported units");
    }
  }

  async function undo() {
    if (!manifest) return;
    setStatus("undoing");
    try {
      await undoDuesImport(manifest);
      setStatus("undone");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not remove that import");
    }
  }

  const totalEntries = result?.units.reduce((sum, u) => sum + u.entries.length, 0) ?? 0;
  const importedPeriods = result
    ? Array.from(new Set(result.units.flatMap((u) => u.entries.map((e) => e.period)))).sort()
    : [];

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-3">
      <p className="mb-2 text-xs text-ink-soft">
        Upload a QuickBooks transaction export or a monthly income spreadsheet (CSV or XLSX) to
        bulk-import units and their monthly dues, instead of generating charges and marking them
        paid one at a time. A real amount received is recorded paid; an explicit $0 is recorded
        unpaid. Nothing is saved until you review the list below and click Apply — the file itself
        is never stored.
      </p>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <div className="w-32">
          <Label htmlFor="dues-import-year">Spreadsheet&apos;s year</Label>
          <Input
            id="dues-import-year"
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            className="font-mono"
          />
          <p className="mt-0.5 text-[10px] leading-tight text-ink-soft">
            Only used for month-column spreadsheets — ignored for a QuickBooks transaction list,
            which already has real dates.
          </p>
        </div>
        <div>
          <Label htmlFor="dues-import-file">File</Label>
          <input
            id="dues-import-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="text-xs text-ink-soft file:mr-3 file:rounded file:border file:border-rule file:bg-paper file:px-2 file:py-1 file:text-xs file:text-ink hover:file:border-ink"
          />
        </div>
      </div>

      {status === "parsing" && <p className="mt-2 text-xs text-ink-soft">Reading file…</p>}
      {status === "error" && <p className="mt-2 text-xs text-danger">{error}</p>}
      {status === "undone" && (
        <p className="mt-2 text-xs text-ink-soft">
          Import removed — every unit and charge it added is back to how it was before.
        </p>
      )}

      {(status === "done" || status === "applying" || status === "applied" || status === "undoing") && result && (
        <div className="mt-3 rounded border border-rule bg-paper p-3 text-sm">
          {result.warnings.map((w) => (
            <p key={w} className="mb-2 text-xs text-gold-text">
              {w}
            </p>
          ))}

          {result.units.length === 0 ? (
            <p className="text-xs text-ink-soft">Nothing recognizable found — add units manually below.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink-soft">
                Found {result.units.length} unit{result.units.length === 1 ? "" : "s"}, {totalEntries} month
                {totalEntries === 1 ? "" : "s"} of charges total. Review before applying:
              </p>
              <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto text-xs">
                {result.units.map((u) => {
                  const first = u.entries[0];
                  const last = u.entries[u.entries.length - 1];
                  const paidCount = u.entries.filter((e) => e.amount > 0).length;
                  return (
                    <li key={u.label} className="flex items-center justify-between gap-2">
                      <span className="text-ink">{u.label}</span>
                      <span className="text-ink-soft">
                        {u.entries.length === 0
                          ? "no months found"
                          : `${formatPeriodLabel(first.period)}${
                              u.entries.length > 1 ? ` – ${formatPeriodLabel(last.period)}` : ""
                            } (${u.entries.length}, ${paidCount} paid)`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={apply}
                  disabled={status === "applying" || status === "applied" || status === "undoing"}
                >
                  {status === "applied" || status === "undoing"
                    ? "Applied"
                    : status === "applying"
                      ? "Applying…"
                      : "Apply — import all units & charges"}
                </Button>
                {(status === "applied" || status === "undoing") && (
                  <button
                    type="button"
                    onClick={undo}
                    disabled={status === "undoing"}
                    className="text-xs text-danger hover:opacity-80 disabled:opacity-60"
                  >
                    {status === "undoing" ? "Removing…" : "Wrong file? Undo this import"}
                  </button>
                )}
              </div>

              {status === "applied" && importedPeriods.length > 0 && (
                <div className="mt-3 border-t border-rule pt-3">
                  <p className="mb-1.5 text-xs text-ink-soft">
                    Imported into {importedPeriods.length} month{importedPeriods.length === 1 ? "" : "s"} — the
                    table below only shows whichever one month you&apos;re currently viewing, so jump straight to
                    one of these to see the charges:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {importedPeriods.map((p) => (
                      <Link
                        key={p}
                        href={`/dues?period=${p}`}
                        className="rounded border border-rule bg-paper-card px-2 py-1 text-xs text-ink hover:border-ink"
                      >
                        {formatPeriodLabel(p)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
