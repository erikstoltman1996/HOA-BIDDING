"use client";

import { useRef, useState, useTransition } from "react";
import { submitContractorUpdate } from "@/app/contractor/[token]/actions";
import { Button } from "@/components/ui/Button";
import { Check } from "@/components/bid-ledger/icons";

const STATUS_OPTIONS: Array<{ value: "on_track" | "ahead" | "delayed"; label: string }> = [
  { value: "on_track", label: "On track" },
  { value: "ahead", label: "Ahead of schedule" },
  { value: "delayed", label: "Delayed" },
];

export function ContractorUpdateForm({
  token,
  projectTitle,
  contractorName,
}: {
  token: string;
  projectTitle: string;
  contractorName: string;
}) {
  const [percent, setPercent] = useState(50);
  const [status, setStatus] = useState<"on_track" | "ahead" | "delayed">("on_track");
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await submitContractorUpdate(token, formData);
        setState("done");
        formRef.current?.reset();
        setPercent(50);
        setStatus("on_track");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Could not submit update");
      }
    });
  }

  if (state === "done") {
    return (
      <div className="text-center text-sm text-ink">
        <Check size={20} className="mx-auto mb-2 text-check-green" />
        <p className="font-serif text-lg">Update posted</p>
        <p className="text-ink-soft">Thanks — the board will see this right away.</p>
        <button
          onClick={() => setState("idle")}
          className="mt-4 text-xs text-ink-soft underline hover:text-ink"
        >
          Post another update
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.15em" }}>
        Weekly Update
      </div>
      <h1 className="mb-1 font-serif text-2xl text-ink">{projectTitle}</h1>
      <p className="mb-4 text-sm text-ink-soft">{contractorName}</p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="percent_complete" className="mb-1 block text-xs text-ink-soft">
            % complete: <span className="font-mono font-semibold text-ink">{percent}%</span>
          </label>
          <input
            id="percent_complete"
            name="percent_complete"
            type="range"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-soft">Status</label>
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="radio"
                  name="timeline_status"
                  value={opt.value}
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="issues_text" className="mb-1 block text-xs text-ink-soft">
            Issues or blockers {status === "delayed" && "(what's causing the delay?)"}
          </label>
          <textarea
            id="issues_text"
            name="issues_text"
            rows={3}
            className="w-full rounded border border-rule bg-paper-card p-2 text-sm text-ink outline-none focus:border-ink"
            placeholder="Anything the board should know…"
          />
        </div>

        <div>
          <label htmlFor="next_milestone_date" className="mb-1 block text-xs text-ink-soft">
            Next milestone / expected date
          </label>
          <input
            id="next_milestone_date"
            name="next_milestone_date"
            type="date"
            className="rounded border border-rule bg-paper-card px-2 py-1.5 text-sm text-ink outline-none focus:border-ink"
          />
        </div>

        <div>
          <label htmlFor="photos" className="mb-1 block text-xs text-ink-soft">
            Photos (optional, up to 6)
          </label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            className="w-full text-sm text-ink-soft"
          />
        </div>

        {error && <p className="text-xs text-red-700">{error}</p>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Posting…" : "Post update"}
        </Button>
      </form>
    </div>
  );
}
