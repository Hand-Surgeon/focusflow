import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectTop3 } from "@/lib/ai/service";
import type { Task } from "@/types/database";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all pending/in-progress tasks
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["PENDING", "IN_PROGRESS"])
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typedTasks = (tasks ?? []) as Task[];

    if (typedTasks.length === 0) {
      return NextResponse.json({
        top3: [],
        motivation: "No pending tasks! Time to brain dump some ideas?",
      });
    }

    // If 3 or fewer tasks, return them all
    if (typedTasks.length <= 3) {
      return NextResponse.json({
        top3: typedTasks.map((t, i) => ({
          task_id: t.id,
          task: t,
          reason: "Only a few tasks - focus on these!",
          suggested_order: i + 1,
        })),
        motivation: "Small list, big impact! You got this!",
      });
    }

    const aiResult = await selectTop3(typedTasks);

    // Enrich with full task data
    const enrichedTop3 = aiResult.top3.map((item) => ({
      ...item,
      task: typedTasks.find((t) => t.id === item.task_id) ?? null,
    }));

    return NextResponse.json({
      top3: enrichedTop3,
      motivation: aiResult.motivation,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
