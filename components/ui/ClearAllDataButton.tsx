"use client";

import { useState } from "react";

/**
 * A two-step "clear everything" control shared by the Reserve, Expenses,
 * and Dues Manage panels — irreversible, so it's gated behind an explicit
 * second click rather than firing on the first one. No native browser
 * confirm() dialog, just an inline warning that has to be read and
 * confirmed before anything happens.
 */
export function ClearAllDataButton({
  label,
  confirmMessage,
  onConfirm,
}: {
  label: string;
  confirmMessage: string;
  onConfirm: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "clearing" | "error">("idle");
  const [error, setError] = useState("");

  async function handleConfirm() {
    setStatus("clearing");
    setError("");
    try {
      await onConfirm();
      // No "done" state to show — the list this button lives under goes
      // empty, which is its own confirmation.
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not clear this data");
    }
  }

  return (
    <div className="mt-4 border-t border-rule pt-3">
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="text-xs text-danger hover:opacity-80">
          {label}
        </button>
      ) : (
        <div className="rounded border border-danger/40 bg-paper p-2.5">
          <p className="mb-2 text-xs text-ink">{confirmMessage}</p>
          {status === "error" && <p className="mb-2 text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === "clearing"}
              className="rounded border border-danger bg-danger px-2.5 py-1 text-xs font-medium text-paper-card hover:opacity-90 disabled:opacity-60"
            >
              {status === "clearing" ? "Clearing…" : "Yes, delete everything"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={status === "clearing"}
              className="rounded border border-rule px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
