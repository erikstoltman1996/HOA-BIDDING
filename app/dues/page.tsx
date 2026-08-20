import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fetchDuesChargesForPeriod } from "@/lib/duesData";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";
import { UnitManager } from "@/components/dues/UnitManager";
import { DuesTable } from "@/components/dues/DuesTable";
import { GenerateChargesButton } from "@/components/dues/GenerateChargesButton";
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "@/lib/dues";
import { ChevronLeft, ChevronRight } from "@/components/bid-ledger/icons";

export default async function DuesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { authUser, profile } = await requireUser();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">Your account isn&apos;t linked to an HOA yet.</p>
      </div>
    );
  }

  const { period: periodParam } = await searchParams;
  const period = periodParam || currentPeriod();

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [{ data: org }, { units, charges }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    fetchDuesChargesForPeriod(supabase, profile.org_id, period),
  ]);

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
        section="Dues"
      />
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <SectionNav current="/dues" />

        <div className="mb-6 flex items-center justify-between border-b-2 border-ink pb-4">
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Dues Tracker</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/dues?period=${shiftPeriod(period, -1)}`}
              className="text-ink-soft hover:text-ink"
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </Link>
            <span className="min-w-[9rem] text-center font-medium text-ink">{formatPeriodLabel(period)}</span>
            <Link
              href={`/dues?period=${shiftPeriod(period, 1)}`}
              className="text-ink-soft hover:text-ink"
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {isAdmin && (
          <>
            <UnitManager units={units} />
            <GenerateChargesButton period={period} unitCount={units.length} />
          </>
        )}

        <DuesTable charges={charges} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
