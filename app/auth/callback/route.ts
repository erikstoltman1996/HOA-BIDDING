import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles both the email-confirmation link (password signup) and the
 * magic-link login/signup redirect. Exchanges the auth code for a session,
 * then — if this is a brand-new admin who hasn't been linked to an org yet
 * (org_name was stashed in user_metadata at signup) — creates their
 * organization via the create_org_and_admin RPC before sending them in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/project";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      const orgName = (user.user_metadata?.org_name as string | undefined)?.trim();
      const adminName = (user.user_metadata?.name as string | undefined)?.trim();
      if (orgName) {
        const { error: rpcError } = await supabase.rpc("create_org_and_admin", {
          p_org_name: orgName,
          p_admin_name: adminName || "",
        });
        if (rpcError) {
          return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(rpcError.message)}`);
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
