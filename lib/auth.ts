import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Throws if there's no logged-in user. Returns the auth user + their public.users row. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !profile) throw new Error("No profile found for this account");

  return { authUser: user, profile };
}

/** Throws unless the logged-in user is an org admin. Returns their profile. */
export async function requireAdmin() {
  const { profile } = await requireUser();
  if (profile.role !== "admin") throw new Error("Admins only");
  return profile;
}
