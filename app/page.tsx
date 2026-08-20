import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ReserveTrackerService, type CommunityAsset } from "@/lib/ReserveTrackerService";
import { fetchDuesChargesForPeriod } from "@/lib/duesData";
import { currentPeriod, calculateCollectionRate, formatPeriodLabel } from "@/lib/dues";
import { fmt } from "@/lib/money";
import { healthBandColor } from "@/lib/healthBand";
import { AppHeader } from "@/components/AppHeader";
import { DuesTable } from "@/components/dues/DuesTable";
import { ArrowRight } from "@/components/bid-ledger/icons";

export default async function HomePage() {
  const { authUser, profile } = await requireUser();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <div>
          <p className="mb-2 font-serif text-xl text-ink">No organization yet</p>
          <p className="text-sm text-ink-soft">
            Your account isn&apos;t linked to an HOA yet. Ask your board admin to invite you, or{" "}
            <Link href="/signup" className="underline">
              create a new organization
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";
  const period = currentPeriod();

  const [{ data: org }, { data: project }, { data: settings }, { units, charges }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("projects").select("*").eq("org_id", profile.org_id).maybeSingle(),
    supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
    fetchDuesChargesForPeriod(supabase, profile.org_id, period),
  ]);

  let bidCount = 0;
  let latestCheckin: { responded: number; total: number } | null = null;
  if (project) {
    const [{ count }, { data: checkinsRaw }] = await Promise.all([
      supabase.from("bids").select("id", { count: "exact", head: true }).eq("project_id", project.id),
      supabase
        .from("board_checkins")
        .select("id")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    bidCount = count ?? 0;

    if (checkinsRaw && checkinsRaw.length > 0) {
      const { data: responses } = await supabase
        .from("checkin_responses")
        .select("responded_at")
        .eq("checkin_id", checkinsRaw[0].id);
      latestCheckin = {
        total: responses?.length ?? 0,
        responded: (responses ?? []).filter((r) => r.responded_at).length,
      };
    }
  }
  const activeProjectCount = project && project.status !== "complete" ? 1 : 0;

  let percentFundedToday: number | null = null;
  if (settings) {
    const { data: reserveAssets } = await supabase
      .from("reserve_assets")
      .select("*")
      .eq("org_id", profile.org_id);
    const assets: CommunityAsset[] = (reserveAssets ?? []).map((a) => {
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
    const ffb = ReserveTrackerService.calculateFullyFundedBalance(assets);
    percentFundedToday = ReserveTrackerService.calculatePercentFunded(settings.current_balance, ffb);
  }

  const collectionRate = calculateCollectionRate(
    charges.map((c) => ({ status: c.status, amount_due: c.amountDue })),
  );

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <div className="mb-8">
          <h1 className="mb-1 font-serif text-3xl text-ink">
            Welcome{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-ink-soft">Money &amp; Funding overview for {org?.name}</p>
        </div>

        {/* Top stat row */}
        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <StatTile
            href="/reserve"
            label="Reserve fund"
            value={percentFundedToday !== null ? `${percentFundedToday.toFixed(0)}%` : "—"}
            sublabel="funded today"
            color={percentFundedToday !== null ? healthBandColor(percentFundedToday) : "#5B6578"}
          />
          <StatTile
            href="/dues"
            label="Dues collected"
            value={`${collectionRate.toFixed(0)}%`}
            sublabel={formatPeriodLabel(period)}
            color={healthBandColor(collectionRate)}
          />
          <StatTile
            href="/project"
            label="Active projects"
            value={String(activeProjectCount)}
            sublabel={activeProjectCount === 1 ? "capital project" : "capital projects"}
            color="#B8863B"
          />
        </div>

        {/* Reserves */}
        <Section
          title="Reserves"
          action={
            <Link href="/reserve" className="text-sm text-ink underline hover:text-gold">
              View full 10-year outlook →
            </Link>
          }
        >
          <div className="rounded-lg border border-rule bg-paper-card p-5 shadow-card">
            {settings ? (
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs text-ink-soft">Current balance</div>
                  <div className="font-mono text-lg text-ink">{fmt(settings.current_balance)}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft">Annual contribution</div>
                  <div className="font-mono text-lg text-ink">{fmt(settings.annual_contribution)}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-soft">Funded today</div>
                  <div
                    className="font-mono text-lg font-semibold"
                    style={{ color: percentFundedToday !== null ? healthBandColor(percentFundedToday) : "#1F2B3D" }}
                  >
                    {percentFundedToday !== null ? `${percentFundedToday.toFixed(0)}%` : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">
                Not set up yet —{" "}
                <Link href="/reserve" className="underline hover:text-ink">
                  add your reserve balance and assets
                </Link>
                .
              </p>
            )}
          </div>
        </Section>

        {/* Projects */}
        <Section title="Projects">
          {project ? (
            <Link
              href="/project"
              className="group flex flex-col rounded-lg border border-rule bg-paper-card p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-serif text-lg text-ink">{project.title || "Untitled project"}</span>
                <ArrowRight
                  size={16}
                  className="text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                />
              </div>
              <p className="text-xs text-ink-soft">
                Status: {project.status.replace("_", " ")} · {bidCount} bid{bidCount === 1 ? "" : "s"}
                {latestCheckin
                  ? ` · ${latestCheckin.responded} of ${latestCheckin.total} replied to latest check-in`
                  : ""}
              </p>
            </Link>
          ) : (
            <p className="text-sm text-ink-soft">No project set up yet.</p>
          )}
        </Section>

        {/* Dues */}
        <Section
          title="Dues"
          action={
            <Link href="/dues" className="text-sm text-ink underline hover:text-gold">
              Manage units &amp; generate charges →
            </Link>
          }
        >
          {units.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No units added yet —{" "}
              <Link href="/dues" className="underline hover:text-ink">
                add units to start tracking dues
              </Link>
              .
            </p>
          ) : (
            <DuesTable charges={charges} isAdmin={isAdmin} />
          )}
        </Section>

        <p className="text-xs text-ink-soft">
          Looking for board check-ins or resident voting?{" "}
          <Link href="/community" className="underline hover:text-ink">
            Community Decisions
          </Link>
        </p>
      </main>
    </div>
  );
}

function StatTile({
  href,
  label,
  value,
  sublabel,
  color,
}: {
  href: string;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border border-rule bg-paper-card p-6 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="mb-1 text-xs uppercase tracking-widest text-ink-soft" style={{ letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div className="font-mono text-4xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-xs text-ink-soft">{sublabel}</div>
    </Link>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
