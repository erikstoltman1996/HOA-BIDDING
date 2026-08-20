"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Download } from "@/components/bid-ledger/icons";

/**
 * Triggers a Server Action that returns CSV text, then hands it to the
 * browser as a download — no new dependency, just Blob + a throwaway <a>.
 * Shared by /dues, /reserve, and the bid ledger so all three "Export CSV"
 * buttons behave identically.
 */
export function ExportCsvButton({
  action,
  filename,
  label = "Export CSV",
}: {
  action: () => Promise<string>;
  filename: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const csv = await action();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <Download size={14} /> {isPending ? "Exporting…" : label}
    </Button>
  );
}
