"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fetchExpensesForPeriod } from "@/lib/expensesData";
import { toCsv } from "@/lib/csv";
import { parseExpenseBreakdown, type DetectedExpenseCategory, type ParsedExpenseBreakdown } from "@/lib/financialImportParser";
import { fileToGrid } from "@/lib/fileToGrid";

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/");
}

// --- Categories -------------------------------------------------------

export async function addExpenseCategory(name: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .eq("org_id", admin.org_id!)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("expense_categories")
    .insert({ org_id: admin.org_id!, name, sort_order: nextOrder });
  if (error) throw new Error(error.message);
  refresh();
}

export async function removeExpenseCategory(categoryId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_categories")
    .delete()
    .eq("id", categoryId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  refresh();
}

// --- Entries ------------------------------------------------------------

export async function setExpenseAmount(categoryId: string, period: string, amount: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expense_entries")
    .upsert({ category_id: categoryId, period, amount }, { onConflict: "category_id,period" });
  if (error) throw new Error(error.message);
  refresh();
}

// --- Bulk import ----------------------------------------------------------

/**
 * Parses an uploaded bookkeeping export into a full category x month
 * breakdown — see lib/financialImportParser.ts's parseExpenseBreakdown for
 * the detection logic. Pure parse-and-preview: nothing is written here,
 * and the file itself is never persisted (same as the reserve importer).
 */
export async function parseExpenseImportFile(formData: FormData, startYear: number): Promise<ParsedExpenseBreakdown> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");
  const grid = await fileToGrid(file);
  return parseExpenseBreakdown(grid, startYear);
}

/**
 * Applies a parsed breakdown: creates any category that doesn't already
 * exist (matched by name) and upserts every month's amount for it. Called
 * only after the admin has reviewed the parsed preview and clicked Apply —
 * this itself does not re-parse or re-validate the source file.
 */
export async function bulkApplyExpenseImport(categories: DetectedExpenseCategory[]) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: existingCategories } = await supabase
    .from("expense_categories")
    .select("id, name, sort_order")
    .eq("org_id", admin.org_id!);
  const existingByName = new Map((existingCategories ?? []).map((c) => [c.name, c.id]));
  let nextOrder = (existingCategories ?? []).length;

  const entriesToUpsert: { category_id: string; period: string; amount: number }[] = [];

  for (const category of categories) {
    let categoryId = existingByName.get(category.label);
    if (!categoryId) {
      const { data: inserted, error } = await supabase
        .from("expense_categories")
        .insert({ org_id: admin.org_id!, name: category.label, sort_order: nextOrder++ })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      categoryId = inserted.id;
      existingByName.set(category.label, categoryId);
    }
    for (const entry of category.entries) {
      entriesToUpsert.push({ category_id: categoryId, period: entry.period, amount: entry.amount });
    }
  }

  if (entriesToUpsert.length > 0) {
    const { error } = await supabase
      .from("expense_entries")
      .upsert(entriesToUpsert, { onConflict: "category_id,period" });
    if (error) throw new Error(error.message);
  }
  refresh();
}

// --- Export ----------------------------------------------------------------

/** Any org member can export — this is read-only, same as viewing the table. */
export async function exportExpensesCsv(period: string): Promise<string> {
  const { profile } = await requireUser();
  if (!profile.org_id) throw new Error("No organization");
  const supabase = await createClient();
  const { entries } = await fetchExpensesForPeriod(supabase, profile.org_id, period);
  return toCsv(
    ["Category", "Amount"],
    entries.map((e) => [e.categoryLabel, e.amount ?? ""]),
  );
}
