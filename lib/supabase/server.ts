import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth cookie via Next's cookies() API.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll was called from a Server Component — safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}

/**
 * Admin client using the service-role key. Bypasses RLS entirely — never
 * expose this to the browser. Used only for: seeding, sending invites, and
 * the token-based check-in response route (where the caller isn't logged in
 * and access is instead gated by validating a signed token).
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: the admin client never reads or writes an auth cookie
        },
      },
    },
  );
}
