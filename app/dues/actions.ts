"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { fetchDuesChargesForPeriod } from "@/lib/duesData";
import { toCsv } from "@/lib/csv";
import { parseDuesBreakdown, type DetectedDuesUnit, type ParsedDuesBreakdown } from "@/lib/financialImportParser";
import { fileToGrid } from "@/lib/fileToGrid";
import type { DuesChargeStatus } from "@/types/database";

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

/**
 * The nuclear option, same idea as clearAllExpenseData: deletes every unit
 * for the org, which cascades (via the dues_charges FK) to every charge
 * ever generated or imported for them, across all time. Irreversible; the
 * confirming UI (UnitManager) is what stands between a stray click and
 * actually losing everything.
 */
export async function clearAllDuesData() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("units").delete().eq("org_id", admin.org_id!);
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

// --- Bulk import ------------------------------------------------------------

/**
 * Parses an uploaded bookkeeping export into a per-unit, per-month dues
 * breakdown — see lib/financialImportParser.ts's parseDuesBreakdown for the
 * detection logic. Pure parse-and-preview: nothing is written here, and the
 * file itself is never persisted (same as the reserve/expense importers).
 */
export async function parseDuesImportFile(formData: FormData, startYear: number): Promise<ParsedDuesBreakdown> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file uploaded");
  const grid = await fileToGrid(file);
  return parseDuesBreakdown(grid, startYear);
}

/** The most frequent value in a list — used as a new unit's default
 *  monthly_dues_amount, since a single point figure has to be picked from
 *  a real, sometimes-messy cash-received history (a late fee, a partial
 *  payment, a unit that pays a different rate all land in the same list).
 *  Ties keep whichever value was seen first. Empty input has no sensible
 *  default, so it's left for the admin to set on the Units screen instead
 *  of guessing 0. */
function mostCommon(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = v;
    }
  }
  return best;
}

export interface DuesImportManifest {
  /** Units this import created from scratch — safe to remove entirely on
   *  undo, but only if nothing else has been charged to them since. */
  createdUnitIds: string[];
  /** Every (unit, month) this import wrote to, and whatever charge was
   *  there immediately before — null means no charge existed yet, so
   *  undoing it means deleting the row rather than restoring it. */
  chargeChanges: {
    unitId: string;
    period: string;
    previous: { amountDue: number; status: DuesChargeStatus; paidDate: string | null } | null;
  }[];
}

/**
 * Applies a parsed dues breakdown: creates any unit that doesn't already
 * exist (matched by label) and upserts a dues_charges row for every month
 * found. A month with a real amount received is recorded paid at that
 * amount (paid_date set to the first of that month — the closest thing to
 * an actual payment date a monthly cash-basis file gives); an explicit $0
 * month is recorded unpaid, billed at the unit's own rate (its
 * monthly_dues_amount, either already on file or — for a brand-new unit —
 * the most common non-zero amount found for it in this same file). A
 * month with no value at all in the source file gets no charge row,
 * exactly matching what parseDuesBreakdown already left out of `entries`.
 */
export async function bulkApplyDuesImport(units: DetectedDuesUnit[]): Promise<DuesImportManifest> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: existingUnits } = await supabase
    .from("units")
    .select("id, label, monthly_dues_amount")
    .eq("org_id", admin.org_id!);
  const existingByLabel = new Map((existingUnits ?? []).map((u) => [u.label, u]));
  const createdUnitIds: string[] = [];
  const rateByUnitId = new Map<string, number>();

  for (const u of existingUnits ?? []) {
    rateByUnitId.set(u.id, u.monthly_dues_amount);
  }

  const chargesToUpsert: { unit_id: string; period: string; amount_due: number; status: DuesChargeStatus; paid_date: string | null }[] =
    [];

  for (const unit of units) {
    let existing = existingByLabel.get(unit.label);
    if (!existing) {
      const rate = mostCommon(unit.entries.filter((e) => e.amount > 0).map((e) => e.amount)) ?? 0;
      const { data: inserted, error } = await supabase
        .from("units")
        .insert({ org_id: admin.org_id!, label: unit.label, owner_name: "", monthly_dues_amount: rate })
        .select("id, label, monthly_dues_amount")
        .single();
      if (error) throw new Error(error.message);
      existing = inserted;
      existingByLabel.set(unit.label, existing);
      createdUnitIds.push(existing.id);
      rateByUnitId.set(existing.id, rate);
    }
    const unitId = existing.id;
    const rate = rateByUnitId.get(unitId) ?? 0;

    for (const entry of unit.entries) {
      const isPaid = entry.amount > 0;
      chargesToUpsert.push({
        unit_id: unitId,
        period: entry.period,
        amount_due: isPaid ? entry.amount : rate,
        status: isPaid ? "paid" : "unpaid",
        paid_date: isPaid ? entry.period : null,
      });
    }
  }

  // Snapshot whatever's already charged for the (unit, month) cells this
  // import is about to overwrite — same reasoning as bulkApplyExpenseImport:
  // makes undo a real "put it back the way it was," not a blind delete
  // that could also erase manually-recorded payments.
  const touchedUnitIds = Array.from(new Set(chargesToUpsert.map((c) => c.unit_id)));
  const { data: priorCharges } =
    touchedUnitIds.length > 0
      ? await supabase
          .from("dues_charges")
          .select("unit_id, period, amount_due, status, paid_date")
          .in("unit_id", touchedUnitIds)
      : { data: [] };
  const priorByKey = new Map((priorCharges ?? []).map((c) => [`${c.unit_id}|${c.period}`, c]));

  const chargeChanges: DuesImportManifest["chargeChanges"] = chargesToUpsert.map((c) => {
    const prior = priorByKey.get(`${c.unit_id}|${c.period}`);
    return {
      unitId: c.unit_id,
      period: c.period,
      previous: prior ? { amountDue: prior.amount_due, status: prior.status, paidDate: prior.paid_date } : null,
    };
  });

  if (chargesToUpsert.length > 0) {
    const { error } = await supabase
      .from("dues_charges")
      .upsert(chargesToUpsert, { onConflict: "unit_id,period" });
    if (error) throw new Error(error.message);
  }
  refresh();
  return { createdUnitIds, chargeChanges };
}

/**
 * Reverses a bulkApplyDuesImport() call using the manifest it returned —
 * restores each touched charge to its prior state (or deletes it if none
 * existed before), and removes any unit the import created from scratch,
 * but only if nothing else has been charged to it since. Only meaningful
 * against the exact manifest just returned — same one-shot scope as
 * undoExpenseImport.
 */
export async function undoDuesImport(manifest: DuesImportManifest) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const toRestore = manifest.chargeChanges.filter(
    (c): c is typeof c & { previous: NonNullable<(typeof c)["previous"]> } => c.previous !== null,
  );
  const toDelete = manifest.chargeChanges.filter((c) => c.previous === null);

  if (toRestore.length > 0) {
    const { error } = await supabase.from("dues_charges").upsert(
      toRestore.map((c) => ({
        unit_id: c.unitId,
        period: c.period,
        amount_due: c.previous.amountDue,
        status: c.previous.status,
        paid_date: c.previous.paidDate,
      })),
      { onConflict: "unit_id,period" },
    );
    if (error) throw new Error(error.message);
  }
  for (const c of toDelete) {
    const { error } = await supabase.from("dues_charges").delete().eq("unit_id", c.unitId).eq("period", c.period);
    if (error) throw new Error(error.message);
  }

  for (const unitId of manifest.createdUnitIds) {
    const { count } = await supabase
      .from("dues_charges")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId);
    if (!count) {
      const { error } = await supabase.from("units").delete().eq("id", unitId).eq("org_id", admin.org_id!);
      if (error) throw new Error(error.message);
    }
  }
  refresh();
}

// --- Export ----------------------------------------------------------------

/** Any org member can export — this is read-only, same as viewing the table. */
export async function exportDuesCsv(period: string): Promise<string> {
  const { profile } = await requireUser();
  if (!profile.org_id) throw new Error("No organization");
  const supabase = await createClient();
  const { charges } = await fetchDuesChargesForPeriod(supabase, profile.org_id, period);
  return toCsv(
    ["Unit", "Owner", "Amount Due", "Status", "Paid Date"],
    charges.map((c) => [c.unitLabel, c.ownerName, c.amountDue, c.status, c.paidDate ?? ""]),
  );
}
