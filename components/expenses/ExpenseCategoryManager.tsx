"use client";

import { useState, useTransition } from "react";
import { addExpenseCategory, removeExpenseCategory } from "@/app/expenses/actions";
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
    </div>
  );
}
