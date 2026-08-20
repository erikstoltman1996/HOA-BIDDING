"use client";

import { useState } from "react";
import { parseFinancialImportFile } from "@/app/reserve/actions";
import type { ParsedFinancialImport } from "@/lib/financialImportParser";
import { Button } from "@/components/ui/Button";
import { fmt } from "@/lib/money";

/**
 * Uploads a monthly income/expense export (CSV or XLSX) and shows what the
 * parser could find in it — never writes anything until the admin reviews
 * the preview and explicitly clicks Apply. See lib/financialImportParser.ts
 * for the detection logic and app/reserve/actions.ts's
 * parseFinancialImportFile for why the file itself is never persisted.
 */
export function FinancialImport({
  onApply,
}: {
  onApply: (detectedBalance: number | null, detectedContribution: number | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "parsing" | "done" | "error">("idle");
  const [result, setResult] = useState<ParsedFinancialImport | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setStatus("parsing");
    setError("");
    setApplied(false);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await parseFinancialImportFile(formData);
      setResult(parsed);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not read that file");
    }
  }

  function apply() {
    if (!result) return;
    onApply(result.detectedBalance?.value ?? null, result.detectedContribution?.value ?? null);
    setApplied(true);
  }

  const hasAnything = !!(result?.detectedBalance || result?.detectedContribution);

  return (
    <div className="rounded border border-rule bg-paper-card shadow-card p-3">
      <p className="mb-2 text-xs text-ink-soft">
        Upload a monthly income/expense export (CSV or XLSX) to pre-fill the balance and
        contribution above. Nothing is saved until you review this and click Apply — and the
        file itself is never stored, only these two numbers get extracted from it.
      </p>
      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFile}
        className="text-xs text-ink-soft file:mr-3 file:rounded file:border file:border-rule file:bg-paper file:px-2 file:py-1 file:text-xs file:text-ink hover:file:border-ink"
      />

      {status === "parsing" && <p className="mt-2 text-xs text-ink-soft">Reading file…</p>}
      {status === "error" && <p className="mt-2 text-xs text-danger">{error}</p>}

      {status === "done" && result && (
        <div className="mt-3 space-y-1.5 rounded border border-rule bg-paper p-3 text-sm">
          <div>
            <span className="text-ink-soft">Detected balance: </span>
            {result.detectedBalance ? (
              <span className="font-mono text-ink">
                {fmt(result.detectedBalance.value)}{" "}
                <span className="text-xs text-ink-soft">(as of {result.detectedBalance.asOfLabel})</span>
              </span>
            ) : (
              <span className="text-ink-soft">not found</span>
            )}
          </div>
          <div>
            <span className="text-ink-soft">Detected annual contribution: </span>
            {result.detectedContribution ? (
              <span className="font-mono text-ink">
                {fmt(result.detectedContribution.value)}{" "}
                <span className="text-xs text-ink-soft">
                  (based on {result.detectedContribution.monthsFound} month
                  {result.detectedContribution.monthsFound === 1 ? "" : "s"}
                  {result.detectedContribution.annualized ? ", extrapolated to a full year" : ""})
                </span>
              </span>
            ) : (
              <span className="text-ink-soft">not found</span>
            )}
          </div>

          {result.warnings.map((w) => (
            <p key={w} className="text-xs text-gold-text">
              {w}
            </p>
          ))}

          {hasAnything && (
            <Button type="button" variant="outline" onClick={apply} disabled={applied} className="mt-1">
              {applied ? "Applied — edit above if needed" : "Apply detected values"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
