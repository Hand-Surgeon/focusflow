import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        step: "auth",
        error: userError?.message ?? "No user",
        userId: null,
      });
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("google_tokens")
      .select("user_id, expires_at, created_at, updated_at")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({
      step: "token_check",
      userId: user.id,
      tokenExists: !!tokenRow,
      tokenError: tokenError?.message ?? null,
      tokenData: tokenRow
        ? {
            user_id: tokenRow.user_id,
            expires_at: tokenRow.expires_at,
            created_at: tokenRow.created_at,
            updated_at: tokenRow.updated_at,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json({
      step: "catch",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
