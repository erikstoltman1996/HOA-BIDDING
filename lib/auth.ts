import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Requires a logged-in user with a matching public.users row. Redirects to
 * /login (never throws) if either is missing — a raw throw here used to
 * surface as an unhandled 500 crash page, which is exactly what a brand
 * new user hit if their signup's org-creation step didn't complete (e.g.
 * an email-confirmation link that couldn't reach /auth/callback): they'd
 * have a valid Supabase Auth session but no public.users row, and every
 * protected page would hard-crash instead of sending them somewhere
 * they could recover from.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    // Signing out clears the orphaned session so "Create an organization"
    // on the login page starts clean instead of looping back here.
    await supabase.auth.signOut();
    redirect(
      `/login?error=${encodeURIComponent(
        "We couldn't find your account setup — please sign up again.",
      )}`,
    );
  }

  return { authUser: user, profile };
}

/** Throws unless the logged-in user is an org admin. Returns their profile. */
export async function requireAdmin() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") throw new Error("Admins only");
  return profile;
}
