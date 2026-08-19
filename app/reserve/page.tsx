import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ReserveTrackerPanel } from "@/components/reserve/ReserveTrackerPanel";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ReservePage() {
  const { authUser, profile } = await requireUser();
  const supabase = await createClient();

  if (!profile.org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-8 text-center">
        <p className="text-sm text-ink-soft">Your account isn&apos;t linked to an HOA yet.</p>
      </div>
    );
  }

  const [{ data: org }, { data: settings }, { data: assets }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", profile.org_id).single(),
    supabase.from("reserve_settings").select("*").eq("org_id", profile.org_id).maybeSingle(),
    supabase.from("reserve_assets").select("*").eq("org_id", profile.org_id).order("name"),
  ]);

  const isAdmin = profile.role === "admin";

  return (
    <div className="min-h-screen w-full p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs text-ink-soft">
            <Link href="/" className="underline hover:text-ink">
              ← Home
            </Link>{" "}
            · {org?.name} · {profile.name || authUser.email} ({profile.role.replace("_", " ")})
          </div>
          <SignOutButton />
        </div>

        <Link href="/project" className="mb-6 inline-block text-sm text-ink underline hover:text-gold">
          ← Back to project
        </Link>

        <ReserveTrackerPanel
          isAdmin={isAdmin}
          initialBalance={settings?.current_balance ?? 0}
          initialContribution={settings?.annual_contribution ?? 0}
          initialAssets={assets ?? []}
        />
      </div>
    </div>
  );
}
