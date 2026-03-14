import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the OAuth callback from Supabase Auth.
 *
 * 1. Exchanges the authorization `code` for a session.
 * 2. Stores the Google provider_token and provider_refresh_token in the database.
 * 3. Redirects to the `redirectTo` destination on success or /login on failure.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Get the session to extract Google provider tokens
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.provider_token) {
    // Calculate token expiry (Google access tokens typically last 1 hour)
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Store Google tokens in the database for later use
    const { error: tokenError } = await supabase
      .from("google_tokens")
      .upsert(
        {
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token ?? null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (tokenError) {
      console.error("Failed to store Google tokens:", tokenError.message);
    }
  }

  return NextResponse.redirect(new URL(redirectTo, origin));
}
