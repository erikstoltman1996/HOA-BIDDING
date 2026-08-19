"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

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
