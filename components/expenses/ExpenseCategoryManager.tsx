"use client";

import { useState, useTransition } from "react";
import { addExpenseCategory, clearAllExpenseData, removeExpenseCategory } from "@/app/expenses/actions";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Plus, X } from "@/components/bid-ledger/icons";

export interface ExpenseCategoryRow {
  id: string;
  name: string;
}

export function ExpenseCategoryManager({ categories }: { categories: ExpenseCategoryRow[] }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Category name can't be empty.");
      return;
    }
    startTransition(() => {
      addExpenseCategory(name.trim());
    });
    setName("");
  }

  return (
    <div className="mb-6 rounded border border-rule bg-paper-card shadow-card p-3">
      <div className="mb-2 text-xs font-medium text-ink-soft">Expense categories</div>
      <ul className="mb-3 space-y-1">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="text-ink">{c.name}</span>
            <button
              onClick={() => startTransition(() => removeExpenseCategory(c.id))}
              className="text-rule hover:text-ink-soft"
              aria-label={`Remove ${c.name}`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="text-xs text-ink-soft">No categories added yet.</li>}
      </ul>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <Label htmlFor="category-name">Category</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Insurance, Snow Plowing, Landscaping…"
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          <Plus size={14} /> Add
        </Button>
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {categories.length > 0 && <ClearAllExpenseData categoryCount={categories.length} />}
    </div>
  );
}

/**
 * A real reset, distinct from "Undo this import" on the import panel —
 * that only reverses whatever the last import touched, while this wipes
 * every category (and, via cascade, every month of amounts ever entered
 * or imported under them) for a genuine start-from-scratch. Irreversible,
 * so it's gated behind an explicit second click rather than firing on the
 * first one — no native browser confirm() dialog, just an inline warning
 * that has to be read and confirmed before anything happens.
 */
function ClearAllExpenseData({ categoryCount }: { categoryCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "clearing" | "error">("idle");
  const [error, setError] = useState("");

  async function handleConfirm() {
    setStatus("clearing");
    setError("");
    try {
      await clearAllExpenseData();
      // No "done" state to show — the category list this component
      // renders from goes to empty, which is its own confirmation.
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not clear expense data");
    }
  }

  return (
    <div className="mt-4 border-t border-rule pt-3">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-xs text-danger hover:opacity-80"
        >
          Clear all expense data
        </button>
      ) : (
        <div className="rounded border border-danger/40 bg-paper p-2.5">
          <p className="mb-2 text-xs text-ink">
            This permanently deletes all {categoryCount} categor{categoryCount === 1 ? "y" : "ies"} and every
            month of amounts ever entered or imported under them — not just this month. This cannot be undone.
          </p>
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
