import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { SectionNav } from "@/components/SectionNav";
import { NewProjectButton } from "@/components/project/NewProjectButton";
import { computeBidSummary, formatBidSummary } from "@/lib/projectSummary";
import { PROJECT_STATUS_COLOR, PROJECT_STATUS_LABEL } from "@/lib/projectStatus";
import { ArrowRight } from "@/components/bid-ledger/icons";

export default async function ProjectsPage() {
  const { authUser, profile } = await requireUser();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">Your account isn&apos;t linked to an HOA yet.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [{ data: org }, { data: projectsRaw }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("projects").select("*").eq("org_id", profile.org_id).order("created_at", { ascending: false }),
  ]);

  const projects = projectsRaw ?? [];
  const summaries = await Promise.all(projects.map((p) => computeBidSummary(supabase, p.id)));

  return (
    <div className="min-h-screen w-full">
      <AppHeader
        orgName={org?.name ?? ""}
        userLabel={`${profile.name || authUser.email} · ${profile.role.replace("_", " ")}`}
        section="Bid Ledger"
      />
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <SectionNav current="/projects" />

        <div className="mb-6 flex items-center justify-between border-b-2 border-ink pb-4">
          <h1 className="font-serif text-2xl text-ink sm:text-3xl">Projects</h1>
          {isAdmin && <NewProjectButton />}
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No projects yet.{" "}
            {isAdmin ? "Click “New project” to start comparing bids." : "Ask your board admin to start one."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((p, i) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="group flex flex-col rounded-lg border border-rule bg-paper-card p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-gold hover:shadow-card-hover"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: PROJECT_STATUS_COLOR[p.status] }}
                      aria-hidden
                    />
                    <span className="truncate font-serif text-lg text-ink">{p.title || "Untitled project"}</span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="shrink-0 text-ink-soft transition-transform group-hover:translate-x-0.5 group-hover:text-gold"
                  />
                </div>
                <div className="mb-1 text-xs font-medium text-ink-soft">{PROJECT_STATUS_LABEL[p.status]}</div>
                <p className="text-xs text-ink-soft">{formatBidSummary(summaries[i])}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
