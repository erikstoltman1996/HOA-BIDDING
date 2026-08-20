import "server-only";
import type { createClient } from "@/lib/supabase/server";

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

export interface ExpenseEntryRow {
  /** null when this category has no entry yet for the period. */
  id: string | null;
  categoryId: string;
  categoryLabel: string;
  amount: number | null;
}

/**
 * Loads an org's expense categories and merges in whatever expense_entries
 * exist for the given period — every category always appears (unlike
 * dues, where a unit without a generated charge is simply omitted), since
 * "not entered yet" is itself meaningful information for expenses: an
 * admin scanning the table should see every category they track, not just
 * the ones they've already filled in.
 */
export async function fetchExpensesForPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  period: string,
): Promise<{ categories: ExpenseCategoryRow[]; entries: ExpenseEntryRow[] }> {
  const { data: categoriesRaw } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("org_id", orgId)
    .order("sort_order");
  const categories: ExpenseCategoryRow[] = categoriesRaw ?? [];
  const categoryIds = categories.map((c) => c.id);

  const { data: entriesRaw } = categoryIds.length
    ? await supabase.from("expense_entries").select("*").eq("period", period).in("category_id", categoryIds)
    : { data: [] };
  const entryByCategory = new Map((entriesRaw ?? []).map((e) => [e.category_id, e]));

  const entries: ExpenseEntryRow[] = categories.map((c) => {
    const e = entryByCategory.get(c.id);
    return {
      id: e?.id ?? null,
      categoryId: c.id,
      categoryLabel: c.name,
      amount: e?.amount ?? null,
    };
  });

  return { categories, entries };
}
