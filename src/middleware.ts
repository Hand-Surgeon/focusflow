import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that do not require authentication
const PUBLIC_ROUTES = ["/login", "/api/auth/callback", "/"];

/**
 * Checks whether the given pathname is a public route that does not require
 * authentication.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(route);
  });
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Always refresh the session first so cookies stay up-to-date.
  let response: NextResponse;
  try {
    response = await updateSession(request);
  } catch {
    // If session refresh fails (e.g. Supabase unreachable), allow the
    // request to proceed so the page does not endlessly reload.
    response = NextResponse.next({ request });
  }

  const { pathname } = request.nextUrl;

  // Allow public routes without authentication check.
  if (isPublicRoute(pathname)) {
    return response;
  }

  // For protected routes, verify the user is authenticated.
  // We read the Supabase auth token cookie directly to avoid creating
  // another Supabase client instance (updateSession already refreshed it).
  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));

  if (!hasAuthCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Public static assets (svg, png, jpg, ico, webp, woff, woff2, js, css, json)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|js|css|json)).*)",
  ],
};
