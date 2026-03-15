import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/app/dashboard/dashboard-client";
import type { Task, User } from "@/types/database";

export default async function DashboardPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Fetch user profile from users table
  let { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  // Auto-create profile if trigger failed (FK required for task creation)
  if (!userProfile) {
    const { data: created } = await supabase
      .from("users")
      .upsert({
        id: authUser.id,
        email: authUser.email ?? "",
        name: (authUser.user_metadata?.full_name as string) ?? null,
        avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
      })
      .select()
      .single();
    userProfile = created;
  }

  // Build User object from profile or auth fallback
  const user: User = (userProfile as User | null) ?? {
    id: authUser.id,
    email: authUser.email ?? "",
    name: (authUser.user_metadata?.full_name as string) ?? null,
    avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
    role: null,
    preferences: {},
    created_at: authUser.created_at,
    updated_at: authUser.updated_at ?? authUser.created_at,
  };

  // Fetch all tasks (including completed for the completed tab)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", authUser.id)
    .order("position", { ascending: true });

  return (
    <DashboardClient
      user={user}
      initialTasks={(tasks as Task[]) ?? []}
    />
  );
}
