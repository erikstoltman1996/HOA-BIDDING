"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

function refresh() {
  revalidatePath("/dues");
  revalidatePath("/");
}

// --- Units --------------------------------------------------------------

export async function addUnit(
  label: string,
  ownerName: string,
  ownerEmail: string,
  monthlyDuesAmount: number,
) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({
    org_id: admin.org_id!,
    label,
    owner_name: ownerName,
    owner_email: ownerEmail || null,
    monthly_dues_amount: monthlyDuesAmount,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function updateUnit(
  unitId: string,
  label: string,
  ownerName: string,
  ownerEmail: string,
  monthlyDuesAmount: number,
) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({
      label,
      owner_name: ownerName,
      owner_email: ownerEmail || null,
      monthly_dues_amount: monthlyDuesAmount,
    })
    .eq("id", unitId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  refresh();
}

export async function removeUnit(unitId: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .delete()
    .eq("id", unitId)
    .eq("org_id", admin.org_id!);
  if (error) throw new Error(error.message);
  refresh();
}

// --- Charges --------------------------------------------------------------

/**
 * Creates one dues_charges row per unit for the given period, at that
 * unit's current monthly_dues_amount. Idempotent — units that already have
 * a charge for this period (the unique (unit_id, period) constraint) are
 * skipped, so this is safe to click more than once, or after adding a new
 * unit mid-month.
 */
export async function generateChargesForPeriod(period: string) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: units } = await supabase
    .from("units")
    .select("id, monthly_dues_amount")
    .eq("org_id", admin.org_id!);
  if (!units || units.length === 0) return;

  const { data: existing } = await supabase
    .from("dues_charges")
    .select("unit_id")
    .eq("period", period)
    .in("unit_id", units.map((u) => u.id));
  const existingUnitIds = new Set((existing ?? []).map((c) => c.unit_id));

  const toInsert = units
    .filter((u) => !existingUnitIds.has(u.id))
    .map((u) => ({ unit_id: u.id, period, amount_due: u.monthly_dues_amount }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("dues_charges").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  refresh();
}

export async function markChargePaid(chargeId: string, paidDate: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dues_charges")
    .update({ status: "paid", paid_date: paidDate })
    .eq("id", chargeId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function markChargeUnpaid(chargeId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dues_charges")
    .update({ status: "unpaid", paid_date: null })
    .eq("id", chargeId);
  if (error) throw new Error(error.message);
  refresh();
}

export async function waiveCharge(chargeId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("dues_charges")
    .update({ status: "waived", paid_date: null })
    .eq("id", chargeId);
  if (error) throw new Error(error.message);
  refresh();
}
