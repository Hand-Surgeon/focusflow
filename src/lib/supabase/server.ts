import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in server-side contexts
 * (Server Components, Route Handlers, Server Actions).
 *
 * Uses the `getAll` / `setAll` cookie methods recommended by @supabase/ssr.
 * The `setAll` handler silently catches errors when called in read-only
 * contexts (e.g., Server Components where response headers are already sent).
 */
export async function createClient(): Promise<
  ReturnType<typeof createServerClient<Database>>
> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll(): { name: string; value: string }[] {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: Record<string, unknown>;
          }[],
        ): void {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll can be called from a Server Component where cookies
            // cannot be modified. The middleware will handle token refresh
            // in that case, so this error is safe to ignore.
          }
        },
      },
    },
  );
}
