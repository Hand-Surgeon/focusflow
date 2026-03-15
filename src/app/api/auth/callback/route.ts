import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Handles the OAuth callback from Supabase Auth.
 *
 * Uses its own Supabase client (instead of the shared `createClient`) so that
 * auth cookies written by `exchangeCodeForSession` are captured on the
 * redirect response. The shared helper uses `cookies()` from `next/headers`,
 * which may not propagate cookies onto a `NextResponse.redirect()`.
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

  // Build the redirect response first so Supabase can write cookies onto it.
  const redirectUrl = new URL(redirectTo, origin);
  let response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(): { name: string; value: string }[] {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ): void {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: exchangeData, error } =
    await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback error:", error.message);
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Use the session directly from exchangeCodeForSession —
  // provider_token is ONLY available in this return value,
  // NOT from a subsequent getSession() call.
  const session = exchangeData.session;

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
  } else {
    console.error(
      "No provider_token in session after exchangeCodeForSession.",
      "Session exists:",
      !!session,
    );
  }

  return response;
}
