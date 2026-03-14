import { createClient } from "@/lib/supabase/server";

/**
 * Retrieves the Google OAuth access token from the google_tokens table.
 * If the token is expired and a refresh_token exists, refreshes it automatically.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("No active session");
  }

  // Read the stored Google token from the database
  const { data: tokenRow, error: tokenError } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .single();

  if (tokenError || !tokenRow) {
    throw new Error(
      "Google access token not available. Please sign out and sign back in with Google.",
    );
  }

  // Check if the token is still valid (with 5-minute buffer)
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() - Date.now() < 5 * 60 * 1000 : true;

  if (!isExpired) {
    return tokenRow.access_token;
  }

  // Token is expired — try to refresh
  if (!tokenRow.refresh_token) {
    throw new Error(
      "Google access token expired and no refresh token available. Please sign out and sign back in.",
    );
  }

  const refreshed = await refreshGoogleToken(tokenRow.refresh_token);

  // Update the stored token
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return refreshed.access_token;
}

/**
 * Refreshes a Google access token using the refresh token.
 */
async function refreshGoogleToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required for token refresh.",
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    throw new Error(`Google token refresh failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return data;
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
