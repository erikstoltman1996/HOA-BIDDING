"use client";

import { useState, useTransition } from "react";
import { generateChargesForPeriod } from "@/app/dues/actions";
import { Button } from "@/components/ui/Button";
import { formatPeriodLabel } from "@/lib/dues";

export function GenerateChargesButton({ period, unitCount }: { period: string; unitCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <div className="mb-6 flex items-center gap-3">
      <Button
        variant="outline"
        disabled={isPending || unitCount === 0}
        onClick={() =>
          startTransition(async () => {
            await generateChargesForPeriod(period);
            setDone(true);
          })
        }
      >
        {isPending ? "Generating…" : `Generate ${formatPeriodLabel(period)} charges`}
      </Button>
      <span className="text-xs text-ink-soft">
        {unitCount === 0
          ? "Add a unit first."
          : done
            ? "Done — existing charges for this period were left as-is."
            : "Creates one charge per unit at their monthly amount. Safe to click more than once."}
      </span>
    </div>
  );
}
