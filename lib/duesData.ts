import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { UnitRow } from "@/components/dues/UnitManager";
import type { DuesChargeRow } from "@/components/dues/DuesTable";

/**
 * Loads an org's units and merges in whatever dues_charges exist for the
 * given period, producing the flat rows DuesTable expects. Shared between
 * the Home dashboard (current period only) and /dues (any period, via the
 * period navigator) so the merge logic — units without a charge yet for
 * this period are simply omitted from the table — lives in exactly one
 * place.
 */
export async function fetchDuesChargesForPeriod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  period: string,
): Promise<{ units: UnitRow[]; charges: DuesChargeRow[] }> {
  const { data: unitsRaw } = await supabase.from("units").select("*").eq("org_id", orgId).order("label");
  const units: UnitRow[] = unitsRaw ?? [];
  const unitIds = units.map((u) => u.id);

  const { data: chargesRaw } = unitIds.length
    ? await supabase.from("dues_charges").select("*").eq("period", period).in("unit_id", unitIds)
    : { data: [] };

  const chargesByUnit = new Map((chargesRaw ?? []).map((c) => [c.unit_id, c]));
  const charges: DuesChargeRow[] = units
    .filter((u) => chargesByUnit.has(u.id))
    .map((u) => {
      const c = chargesByUnit.get(u.id)!;
      return {
        id: c.id,
        unitLabel: u.label,
        ownerName: u.owner_name,
        amountDue: c.amount_due,
        status: c.status,
        paidDate: c.paid_date,
      };
    });

  return { units, charges };
}
