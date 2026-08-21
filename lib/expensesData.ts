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

/**
 * The month to land on when the page loads with no ?period= in the URL.
 * Defaulting to the real calendar month is wrong for an org whose actual
 * entered/imported data lives in other months (e.g. an admin who just
 * bulk-imported a January–June export in August) — every fresh visit to
 * /expenses would land on a month that's genuinely empty, which reads as
 * "my data disappeared" even though nothing is wrong. Landing on the most
 * recent month that actually has a number in it fixes that; only an org
 * with no expense data at all falls back to the current calendar month.
 */
export async function fetchMostRecentExpensePeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<string | null> {
  const { data: categoriesRaw } = await supabase.from("expense_categories").select("id").eq("org_id", orgId);
  const categoryIds = (categoriesRaw ?? []).map((c) => c.id);
  if (categoryIds.length === 0) return null;

  const { data } = await supabase
    .from("expense_entries")
    .select("period")
    .in("category_id", categoryIds)
    .order("period", { ascending: false })
    .limit(1);
  return data?.[0]?.period ?? null;
}

/**
 * Just the total for one period, across every category — used by the
 * Reserve Fund page's cash-position summary, which only needs the one
 * number, not the full category breakdown fetchExpensesForPeriod builds.
 */
export async function fetchOperatingExpenseTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  period: string,
): Promise<number> {
  const { data: categoriesRaw } = await supabase.from("expense_categories").select("id").eq("org_id", orgId);
  const categoryIds = (categoriesRaw ?? []).map((c) => c.id);
  if (categoryIds.length === 0) return 0;

  const { data } = await supabase
    .from("expense_entries")
    .select("amount")
    .eq("period", period)
    .in("category_id", categoryIds);
  return (data ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
}
