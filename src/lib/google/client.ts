import { createClient } from "@/lib/supabase/server";

/**
 * Retrieves the Google OAuth provider_token from the current Supabase session.
 * This token is stored by Supabase when the user signs in with Google OAuth
 * and is used to call Google APIs (Calendar, Gmail) on behalf of the user.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error("No active session");
  }

  const token = session.provider_token;

  if (!token) {
    throw new Error(
      "Google access token not available. User may need to re-authenticate.",
    );
  }

  return token;
}

/**
 * Makes an authenticated request to a Google API endpoint.
 */
export async function googleFetch(
  url: string,
  token: string,
): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Google API error (${response.status}): ${body}`,
    );
  }

  return response;
}
