import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ReserveTrackerService, type CommunityAsset } from "@/lib/ReserveTrackerService";
import { fetchDuesChargesForPeriod } from "@/lib/duesData";
import { currentPeriod, calculateCollectionRate, formatPeriodLabel } from "@/lib/dues";
import { fmt } from "@/lib/money";
import { DUES_COLLECTION_THRESHOLDS, healthBandColor } from "@/lib/healthBand";
import { AppHeader } from "@/components/AppHeader";
import { DuesTable } from "@/components/dues/DuesTable";
import { NewProjectButton } from "@/components/project/NewProjectButton";
import { computeBidSummary, formatBidSummary } from "@/lib/projectSummary";
import { PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL } from "@/lib/projectStatus";
import { TIMELINE_STATUS_COLOR, TIMELINE_STATUS_LABEL, type TimelineStatus } from "@/lib/timelineStatus";
import { ArrowRight, ClipboardList } from "@/components/bid-ledger/icons";

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

  const [{ data: org }, { data: projectsRaw }, { data: settings }, { units, charges }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase
      .from("projects")
      .select("*")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false }),
    supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
    fetchDuesChargesForPeriod(supabase, profile.org_id, period),
  ]);

  const projects = projectsRaw ?? [];
  // The most recently started project that isn't finished yet — the one a
  // board member most likely opened this dashboard to check on. Falls back
  // to the most recent project overall if every project is complete.
  const project = projects.find((p) => p.status !== "complete") ?? projects[0] ?? null;

  let bidSummary: { bidCount: number; bidRange: { min: number; max: number } | null } = {
    bidCount: 0,
    bidRange: null,
  };
  let latestCheckin: { responded: number; total: number } | null = null;
  let latestUpdate: {
    contractorName: string;
    percentComplete: number;
    timelineStatus: TimelineStatus;
    createdAt: string;
    nextMilestoneDate: string | null;
    photoUrl: string | null;
  } | null = null;
  let hasContractors = false;

  if (project) {
    const [summary, { data: checkinsRaw }, { data: contractors }] = await Promise.all([
      computeBidSummary(supabase, project.id),
      supabase
        .from("board_checkins")
        .select("id")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("contractors").select("id, name").eq("project_id", project.id),
    ]);
    bidSummary = summary;
    hasContractors = (contractors ?? []).length > 0;

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

    const contractorIds = (contractors ?? []).map((c) => c.id);
    if (contractorIds.length > 0) {
      const { data: updatesRaw } = await supabase
        .from("weekly_updates")
        .select("*")
        .in("contractor_id", contractorIds)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = updatesRaw?.[0];
      if (latest) {
        const { data: photos } = await supabase
          .from("photos")
          .select("url")
          .eq("update_id", latest.id)
          .limit(1);
        latestUpdate = {
          contractorName: (contractors ?? []).find((c) => c.id === latest.contractor_id)?.name ?? "Contractor",
          percentComplete: latest.percent_complete,
          timelineStatus: latest.timeline_status,
          createdAt: latest.created_at,
          nextMilestoneDate: latest.next_milestone_date,
          photoUrl: photos?.[0]?.url ?? null,
        };
      }
    }
  }

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
        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatTile
            href="/reserve"
            label="Reserve Fund"
            value={percentFundedToday !== null ? `${percentFundedToday.toFixed(0)}%` : "—"}
            sublabel="funded today"
            color={percentFundedToday !== null ? healthBandColor(percentFundedToday) : "#5B6578"}
          />
          <StatTile
            href="/dues"
            label="Dues Collection Rate"
            value={`${collectionRate.toFixed(0)}%`}
            sublabel={formatPeriodLabel(period)}
            color={healthBandColor(collectionRate, DUES_COLLECTION_THRESHOLDS)}
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

        {/* Current Project & Updates */}
        <Section
          title="Current Project & Updates"
          action={
            <div className="flex items-center gap-3">
              {projects.length > 1 && (
                <Link href="/projects" className="text-sm text-ink-soft underline hover:text-ink">
                  View all {projects.length} projects →
                </Link>
              )}
              {project && (
                <Link href={`/project/${project.id}`} className="text-sm text-ink underline hover:text-gold">
                  Open bid ledger →
                </Link>
              )}
            </div>
          }
        >
          {project ? (
            <div className="space-y-4">
              <Link
                href={`/project/${project.id}#bid-ledger`}
                className="group flex flex-col rounded-lg border border-rule bg-paper-card p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PROJECT_STATUS_COLOR[project.status] }}
                      aria-hidden
                    />
                    <span className="truncate font-serif text-lg text-ink">
                      {project.title || "Untitled project"}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink-soft">
                      {PROJECT_STATUS_LABEL[project.status]}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                  />
                </div>
                <p className="text-xs text-ink-soft">
                  {formatBidSummary(bidSummary)}
                  {latestCheckin
                    ? ` · ${latestCheckin.responded} of ${latestCheckin.total} replied to latest check-in`
                    : ""}
                </p>
              </Link>

              <Link
                href={`/project/${project.id}#updates`}
                className="group flex flex-col rounded-lg border border-rule bg-paper-card p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-serif text-lg text-ink">
                    <ClipboardList size={16} className="text-ink-soft" />
                    Latest Update
                  </span>
                  <ArrowRight
                    size={16}
                    className="text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                  />
                </div>
                {latestUpdate ? (
                  <div className="flex flex-wrap items-start gap-4">
                    {latestUpdate.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={latestUpdate.photoUrl}
                        alt="Latest progress photo"
                        className="h-16 w-16 shrink-0 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm text-ink">
                        <span className="font-medium">{latestUpdate.contractorName}</span>{" "}
                        <span className="font-mono">{latestUpdate.percentComplete}% complete</span>
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: TIMELINE_STATUS_COLOR[latestUpdate.timelineStatus] }}
                          aria-hidden
                        />
                        <span style={{ color: TIMELINE_STATUS_COLOR[latestUpdate.timelineStatus] }} className="font-medium">
                          {TIMELINE_STATUS_LABEL[latestUpdate.timelineStatus]}
                        </span>
                        · {new Date(latestUpdate.createdAt).toLocaleDateString()}
                        {latestUpdate.nextMilestoneDate
                          ? ` · Next milestone ${new Date(latestUpdate.nextMilestoneDate).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-ink-soft">
                    {hasContractors
                      ? "Waiting on the first weekly update."
                      : "No contractor added yet — add one once a bid is awarded."}
                  </p>
                )}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              No project set up yet.{" "}
              {isAdmin ? (
                <span className="inline-flex align-middle">
                  <NewProjectButton />
                </span>
              ) : (
                "Ask your board admin to start one."
              )}
            </p>
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
