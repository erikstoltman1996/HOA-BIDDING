import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ReserveTrackerService, type CommunityAsset } from "@/lib/ReserveTrackerService";
import { AppHeader } from "@/components/AppHeader";
import { ArrowRight, ClipboardList, PiggyBank, Vote } from "@/components/bid-ledger/icons";

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

  const [{ data: org }, { data: project }, { data: residents }, { data: openPolls }, { data: settings }] =
    await Promise.all([
      supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
      supabase.from("projects").select("*").eq("org_id", profile.org_id).maybeSingle(),
      supabase.from("residents").select("id").eq("org_id", profile.org_id),
      supabase.from("board_polls").select("id").eq("org_id", profile.org_id).eq("status", "open"),
      supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
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

  return (
    <div className="min-h-screen w-full bg-paper">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <div className="mb-8">
          <h1 className="mb-1 font-serif text-3xl text-ink">
            Welcome{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-ink-soft">Where would you like to go?</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <HomeCard
            href="/project"
            icon={<ClipboardList size={22} className="text-gold" />}
            title="Bid Ledger"
            description="Compare contractor bids, gather board input, and track contractor progress."
            stat={
              project
                ? `${project.title || "Untitled project"} · ${bidCount} bid${bidCount === 1 ? "" : "s"}${
                    latestCheckin
                      ? ` · ${latestCheckin.responded} of ${latestCheckin.total} replied`
                      : ""
                  }`
                : "No project set up yet"
            }
          />
          <HomeCard
            href="/community"
            icon={<Vote size={22} className="text-gold" />}
            title="Community Decisions"
            description="Residents and informal input on upcoming board decisions."
            stat={`${residents?.length ?? 0} resident${(residents?.length ?? 0) === 1 ? "" : "s"} · ${
              openPolls?.length ?? 0
            } open poll${(openPolls?.length ?? 0) === 1 ? "" : "s"}`}
          />
          <HomeCard
            href="/reserve"
            icon={<PiggyBank size={22} className="text-gold" />}
            title="Reserve Fund"
            description="10-year outlook and funding health for the capital reserve."
            stat={
              percentFundedToday !== null
                ? `${percentFundedToday.toFixed(0)}% funded today`
                : "Not set up yet"
            }
            alert={percentFundedToday !== null && percentFundedToday < 70}
          />
        </div>

        {isAdmin && (
          <p className="mt-8 text-xs text-ink-soft">
            You&apos;re a board admin — you can edit bids, send check-ins, manage residents and
            polls, and update the reserve fund from each section above.
          </p>
        )}
      </main>
    </div>
  );
}

function HomeCard({
  href,
  icon,
  title,
  description,
  stat,
  alert,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  stat: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-rule bg-paper-card p-6 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
    >
      <div className="mb-3 flex items-center justify-between">
        {icon}
        <ArrowRight size={16} className="text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
      </div>
      <h2 className="mb-1 font-serif text-lg text-ink">{title}</h2>
      <p className="mb-4 flex-1 text-sm text-ink-soft">{description}</p>
      <p
        className="font-mono text-xs"
        style={{ color: alert ? "#B8863B" : "#5B6578" }}
      >
        {stat}
      </p>
    </Link>
  );
}
