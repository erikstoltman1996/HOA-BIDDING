"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { ReserveTrackerService, type CommunityAsset } from "@/lib/ReserveTrackerService";
import { toCsv } from "@/lib/csv";
import { parseFinancialImport, type ParsedFinancialImport } from "@/lib/financialImportParser";
import { fileToGrid } from "@/lib/fileToGrid";

export async function updateReserveSettings(currentBalance: number, annualContribution: number) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reserve_settings").upsert({
    org_id: admin.org_id!,
    current_balance: currentBalance,
    annual_contribution: annualContribution,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/reserve");
}

export async function addReserveAsset(
  name: string,
  expectedLifespanYears: number,
  replacementCost: number,
  currentAgeYears: number,
) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("reserve_assets").insert({
    org_id: admin.org_id!,
    name,
    expected_lifespan_years: expectedLifespanYears,
    replacement_cost: replacementCost,
    current_age_years: currentAgeYears,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/reserve");
}

export async function removeReserveAsset(assetId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reserve_assets")
    .delete()
    .eq("id", assetId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  revalidatePath("/reserve");
}

/**
 * The nuclear option, same idea as clearAllExpenseData: deletes the org's
 * reserve_settings row (balance/contribution reset to unset, not just
 * zeroed — the page already treats a missing row as "not set up yet") and
 * every tracked asset. Irreversible; the confirming UI (AssetManager) is
 * what stands between a stray click and actually losing everything.
 */
export async function clearAllReserveData() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error: settingsError } = await supabase
    .from("reserve_settings")
    .delete()
    .eq("org_id", admin.org_id!);
  if (settingsError) throw new Error(settingsError.message);
  const { error: assetsError } = await supabase.from("reserve_assets").delete().eq("org_id", admin.org_id!);
  if (assetsError) throw new Error(assetsError.message);
  revalidatePath("/reserve");
  revalidatePath("/");
}

// --- Export ----------------------------------------------------------------

/** Any org member can export — this is read-only, same as viewing the page.
 *  Uses the saved balance/assets only — no what-if expenditure, since that's
 *  a live browser-only scenario that's never persisted (see the comment atop
 *  ReserveTrackerPanel.tsx). */
export async function exportReserveOutlookCsv(): Promise<string> {
  const { profile } = await requireUser();
  if (!profile.org_id) throw new Error("No organization");
  const supabase = await createClient();
  const [{ data: settings }, { data: assetsRaw }] = await Promise.all([
    supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
    supabase.from("reserve_assets").select("*").eq("org_id", profile.org_id),
  ]);

  const assets: CommunityAsset[] = (assetsRaw ?? []).map((a) => {
    const usefulLifeYears = a.expected_lifespan_years;
    const remainingUsefulLifeYears = Math.max(
      0,
      Math.min(usefulLifeYears, usefulLifeYears - a.current_age_years),
    );
    return {
      id: a.id,
      name: a.name,
      replacementCost: a.replacement_cost,
      usefulLifeYears,
      remainingUsefulLifeYears,
    };
  });

  const result = ReserveTrackerService.run({
    currentReserveBalance: settings?.current_balance ?? 0,
    assets,
    annualContribution: settings?.annual_contribution ?? 0,
  });

  return toCsv(
    ["Year", "Start", "Contributions", "Interest", "Replacements", "End", "Fully Funded", "% Funded"],
    result.tenYearOutlook.map((y) => [
      y.year,
      y.startingBalance,
      y.contributions,
      y.interestEarned,
      y.plannedExpenditures,
      y.endingBalance,
      y.fullyFundedBalance,
      y.percentFunded.toFixed(1),
    ]),
  );
}

// --- Financial data import ---------------------------------------------

/**
 * Parses an uploaded bookkeeping export (CSV or XLSX) into a proposed
 * current balance and annual reserve contribution — see
 * lib/financialImportParser.ts for the actual detection logic. This is a
 * pure parse-and-preview step: nothing is written to reserve_settings
 * here, and the uploaded file itself is never persisted anywhere — it's
 * read into memory, converted to a grid, parsed, and discarded.
 */
export async function parseFinancialImportFile(formData: FormData): Promise<ParsedFinancialImport> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");
  const grid = await fileToGrid(file);
  return parseFinancialImport(grid);
}
