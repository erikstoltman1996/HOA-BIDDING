import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { fetchExpensesForPeriod } from "@/lib/expensesData";
import { summarizeExpenses } from "@/lib/expenses";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";
import { ExpenseCategoryManager } from "@/components/expenses/ExpenseCategoryManager";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { ExpensesSummary } from "@/components/expenses/ExpensesSummary";
import { ExpenseImport } from "@/components/expenses/ExpenseImport";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { currentPeriod, formatPeriodLabel, shiftPeriod } from "@/lib/dues";
import { exportExpensesCsv } from "./actions";
import { ChevronLeft, ChevronRight } from "@/components/bid-ledger/icons";

export default async function ExpensesPage({
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

  const [{ data: org }, { categories, entries }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    fetchExpensesForPeriod(supabase, profile.org_id, period),
  ]);

  const summary = summarizeExpenses(entries);

  // A plain closure can't cross the Server->Client boundary as a prop — only
  // an actual Server Action can. This inline "use server" wrapper is how you
  // bind an argument (here, the period from the URL) onto one for a Client
  // Component that takes a zero-arg callback.
  async function exportThisPeriod() {
    "use server";
    return exportExpensesCsv(period);
  }

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
        section="Expenses"
      />
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <SectionNav current="/expenses" />

        <div className="mb-6 flex items-center justify-between border-b-2 border-ink pb-4">
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Operating Expenses</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={`/expenses?period=${shiftPeriod(period, -1)}`}
              className="text-ink-soft hover:text-ink"
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </Link>
            <span className="min-w-[9rem] text-center font-medium text-ink">{formatPeriodLabel(period)}</span>
            <Link
              href={`/expenses?period=${shiftPeriod(period, 1)}`}
              className="text-ink-soft hover:text-ink"
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        <ExpensesSummary summary={summary} />

        <div className="mb-6 flex justify-end">
          <ExportCsvButton
            action={exportThisPeriod}
            filename={`expenses-${period}.csv`}
            label={`Export ${formatPeriodLabel(period)} CSV`}
          />
        </div>

        {isAdmin && (
          <>
            <details className="group mb-6">
              <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                Manage categories
              </summary>
              <div className="mt-2">
                <ExpenseCategoryManager categories={categories} />
              </div>
            </details>
            <details className="group mb-6">
              <summary className="flex cursor-pointer select-none items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
                <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                Import from a bookkeeping export
              </summary>
              <div className="mt-2">
                <ExpenseImport />
              </div>
            </details>
          </>
        )}

        <ExpenseTable
          period={period}
          rows={entries.map((e) => ({ categoryId: e.categoryId, categoryLabel: e.categoryLabel, amount: e.amount }))}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
