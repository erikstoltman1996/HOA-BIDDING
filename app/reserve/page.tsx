import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fetchMostRecentExpensePeriod, fetchOperatingExpenseTotal } from "@/lib/expensesData";
import { currentPeriod } from "@/lib/dues";
import { ReserveTrackerPanel } from "@/components/reserve/ReserveTrackerPanel";
import { ReserveCashSummary } from "@/components/reserve/ReserveCashSummary";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";
import { exportReserveOutlookCsv } from "./actions";

export default async function ReservePage({
  searchParams,
}: {
  searchParams: Promise<{ cashPeriod?: string }>;
}) {
  const { authUser, profile } = await requireUser();
  const supabase = await createClient();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">Your account isn&apos;t linked to an HOA yet.</p>
      </div>
    );
  }

  // Same "land on real data, not a blank current month" logic as /expenses —
  // see fetchMostRecentExpensePeriod's own comment.
  const { cashPeriod: cashPeriodParam } = await searchParams;
  const cashPeriod =
    cashPeriodParam || (await fetchMostRecentExpensePeriod(supabase, profile.org_id)) || currentPeriod();

  const [{ data: org }, { data: settings }, { data: assets }, operatingExpenseTotal] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
    supabase.from("reserve_assets").select("*").eq("org_id", profile.org_id).order("name"),
    fetchOperatingExpenseTotal(supabase, profile.org_id, cashPeriod),
  ]);

  const isAdmin = profile.role === "admin";
  const currentBalance = settings?.current_balance ?? 0;
  const annualContribution = settings?.annual_contribution ?? 0;

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
        section="Reserve Fund"
        maxWidthClassName="max-w-4xl"
      />
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <SectionNav current="/reserve" />

        <ReserveTrackerPanel
          isAdmin={isAdmin}
          initialBalance={currentBalance}
          initialContribution={annualContribution}
          initialAssets={assets ?? []}
          exportCsv={exportReserveOutlookCsv}
          cashSummary={
            <ReserveCashSummary
              period={cashPeriod}
              currentReserveBalance={currentBalance}
              balanceUpdatedAt={settings?.updated_at ?? null}
              operatingExpenseTotal={operatingExpenseTotal}
            />
          }
        />
      </div>
    </div>
  );
}
