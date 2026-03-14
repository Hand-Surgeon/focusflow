import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export interface SessionResult {
  response: NextResponse;
  isAuthenticated: boolean;
}

/**
 * Refreshes the Supabase auth session by reading/writing cookies on the
 * request and response. This must run in the Next.js middleware to keep
 * sessions alive across page navigations.
 *
 * Returns a SessionResult containing the NextResponse and auth status.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          supabaseResponse = NextResponse.next({
            request,
          });

          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session so it does not expire.
  // IMPORTANT: Avoid using getSession() for authorization -- use
  // getUser() or getClaims() instead as they validate against the
  // Supabase Auth server.
  let isAuthenticated = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {
    // If Supabase is unreachable or the token is invalid, return the
    // response as-is so the page still renders instead of crashing.
  }

  return { response: supabaseResponse, isAuthenticated };
}
