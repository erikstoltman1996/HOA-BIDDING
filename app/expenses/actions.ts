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

/**
 * The nuclear option: deletes every expense category the org has — and,
 * via the expense_entries FK's on-delete-cascade, every month of amounts
 * ever entered or imported under them. Unlike undoExpenseImport(), this
 * has no memory of what it's undoing and can't be reversed once called —
 * the confirming UI (ExpenseCategoryManager) is what stands between a
 * stray click and actually losing everything, not this action.
 */
export async function clearAllExpenseData() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("expense_categories").delete().eq("org_id", admin.org_id!);
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

export interface ExpenseImportManifest {
  /** Categories this import created from scratch — safe to remove entirely
   *  on undo, but only if nothing else has been added to them since. */
  createdCategoryIds: string[];
  /** Every (category, month) this import wrote to, and whatever amount was
   *  there immediately before — null means the entry didn't exist yet, so
   *  undoing it means deleting the row rather than restoring a value. */
  entryChanges: { categoryId: string; period: string; previousAmount: number | null }[];
}

/**
 * Applies a parsed breakdown: creates any category that doesn't already
 * exist (matched by name) and upserts every month's amount for it. Called
 * only after the admin has reviewed the parsed preview and clicked Apply —
 * this itself does not re-parse or re-validate the source file.
 *
 * Returns a manifest of exactly what it touched, so a wrong-file mistake
 * can be undone with undoExpenseImport() below instead of having to
 * manually delete categories one at a time.
 */
export async function bulkApplyExpenseImport(categories: DetectedExpenseCategory[]): Promise<ExpenseImportManifest> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: existingCategories } = await supabase
    .from("expense_categories")
    .select("id, name, sort_order")
    .eq("org_id", admin.org_id!);
  const existingByName = new Map((existingCategories ?? []).map((c) => [c.name, c.id]));
  let nextOrder = (existingCategories ?? []).length;
  const createdCategoryIds: string[] = [];

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
      createdCategoryIds.push(categoryId);
    }
    for (const entry of category.entries) {
      entriesToUpsert.push({ category_id: categoryId, period: entry.period, amount: entry.amount });
    }
  }

  // Snapshot whatever's already sitting in the (category, month) cells this
  // import is about to overwrite, before overwriting them — this is what
  // makes undo a real "put it back the way it was" instead of a blind
  // delete that could also wipe out unrelated manual entries.
  const touchedCategoryIds = Array.from(new Set(entriesToUpsert.map((e) => e.category_id)));
  const { data: priorEntries } =
    touchedCategoryIds.length > 0
      ? await supabase.from("expense_entries").select("category_id, period, amount").in("category_id", touchedCategoryIds)
      : { data: [] };
  const priorByKey = new Map((priorEntries ?? []).map((e) => [`${e.category_id}|${e.period}`, e.amount]));

  const entryChanges: ExpenseImportManifest["entryChanges"] = entriesToUpsert.map((e) => ({
    categoryId: e.category_id,
    period: e.period,
    previousAmount: priorByKey.get(`${e.category_id}|${e.period}`) ?? null,
  }));

  if (entriesToUpsert.length > 0) {
    const { error } = await supabase
      .from("expense_entries")
      .upsert(entriesToUpsert, { onConflict: "category_id,period" });
    if (error) throw new Error(error.message);
  }
  refresh();
  return { createdCategoryIds, entryChanges };
}

/**
 * Reverses a bulkApplyExpenseImport() call using the manifest it returned —
 * restores each touched entry to its prior value (or deletes it if it
 * didn't exist before), and removes any category the import created from
 * scratch, but only if nothing else has been entered into it since (so
 * undo never eats manual work done after the import). Only meaningful
 * against the exact manifest just returned — there's no server-side import
 * history, so this only covers "I just imported the wrong file."
 */
export async function undoExpenseImport(manifest: ExpenseImportManifest) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const toRestore = manifest.entryChanges.filter(
    (e): e is typeof e & { previousAmount: number } => e.previousAmount !== null,
  );
  const toDelete = manifest.entryChanges.filter((e) => e.previousAmount === null);

  if (toRestore.length > 0) {
    const { error } = await supabase
      .from("expense_entries")
      .upsert(
        toRestore.map((e) => ({ category_id: e.categoryId, period: e.period, amount: e.previousAmount })),
        { onConflict: "category_id,period" },
      );
    if (error) throw new Error(error.message);
  }
  for (const e of toDelete) {
    const { error } = await supabase
      .from("expense_entries")
      .delete()
      .eq("category_id", e.categoryId)
      .eq("period", e.period);
    if (error) throw new Error(error.message);
  }

  for (const categoryId of manifest.createdCategoryIds) {
    const { count } = await supabase
      .from("expense_entries")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);
    if (!count) {
      const { error } = await supabase
        .from("expense_categories")
        .delete()
        .eq("id", categoryId)
        .eq("org_id", admin.org_id!);
      if (error) throw new Error(error.message);
    }
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
