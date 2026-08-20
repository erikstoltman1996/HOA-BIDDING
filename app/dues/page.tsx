import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fetchDuesChargesForPeriod } from "@/lib/duesData";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";
import { UnitManager } from "@/components/dues/UnitManager";
import { DuesTable } from "@/components/dues/DuesTable";
import { DuesSummary } from "@/components/dues/DuesSummary";
import { GenerateChargesButton } from "@/components/dues/GenerateChargesButton";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { currentPeriod, formatPeriodLabel, shiftPeriod, summarizeDues } from "@/lib/dues";
import { ChevronLeft, ChevronRight } from "@/components/bid-ledger/icons";
import { exportDuesCsv } from "./actions";

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

  // A plain closure can't cross the Server->Client boundary as a prop — only
  // an actual Server Action can. This inline "use server" wrapper is how you
  // bind an argument (here, the period from the URL) onto one for a Client
  // Component that takes a zero-arg callback.
  async function exportThisPeriod() {
    "use server";
    return exportDuesCsv(period);
  }

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

        <DuesSummary summary={summarizeDues(charges.map((c) => ({ status: c.status, amount_due: c.amountDue })))} />

        <div className="mb-6 flex justify-end">
          <ExportCsvButton
            action={exportThisPeriod}
            filename={`dues-${period}.csv`}
            label={`Export ${formatPeriodLabel(period)} CSV`}
          />
        </div>

        {isAdmin && (
          <>
            <GenerateChargesButton period={period} unitCount={units.length} />
            <details className="group mb-6">
              <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                Manage units
              </summary>
              <div className="mt-2">
                <UnitManager units={units} />
              </div>
            </details>
          </>
        )}

        <DuesTable charges={charges} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
