import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { QUADRANT_LIMITS } from "@/lib/ai/smart-sync";
import type { Task, TaskQuadrant } from "@/types/database";

const VALID_QUADRANTS = new Set<string>(["Q1", "Q2", "Q3", "Q4", "UNCLASSIFIED"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { completed_quadrant: string };
    const rawQuadrant = body.completed_quadrant;

    if (!rawQuadrant || !VALID_QUADRANTS.has(rawQuadrant)) {
      return NextResponse.json({ error: "valid completed_quadrant required" }, { status: 400 });
    }

    const completed_quadrant = rawQuadrant as TaskQuadrant;

    // Check if there's room in the completed quadrant
    const { data: pendingInQuadrant } = await supabase
      .from("tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .eq("quadrant", completed_quadrant);

    const currentCount = pendingInQuadrant?.length ?? 0;
    const limit = QUADRANT_LIMITS[completed_quadrant] ?? 2;

    if (currentCount >= limit) {
      return NextResponse.json({ promoted: null, message: "Quadrant is full" });
    }

    // Find best QUEUED task for this quadrant
    const { data: queuedTasksRaw } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "QUEUED")
      .eq("quadrant", completed_quadrant)
      .order("importance_score", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1);
    const queuedTasks = queuedTasksRaw as Task[] | null;

    if (!queuedTasks?.length) {
      // Try to find from any quadrant if none in same quadrant
      const { data: anyQueuedRaw } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "QUEUED")
        .order("importance_score", { ascending: false })
        .limit(1);
      const anyQueued = anyQueuedRaw as Task[] | null;

      if (!anyQueued?.length) {
        return NextResponse.json({
          promoted: null,
          message: "대기열이 비었어요! 모든 할 일을 확인했어요 🎉",
        });
      }

      // Check if that quadrant has room
      const targetQuadrant = anyQueued[0].quadrant;
      const { data: pendingInTarget } = await supabase
        .from("tasks")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "PENDING")
        .eq("quadrant", targetQuadrant);

      const targetCount = pendingInTarget?.length ?? 0;
      const targetLimit = QUADRANT_LIMITS[targetQuadrant] ?? 2;

      if (targetCount >= targetLimit) {
        return NextResponse.json({ promoted: null, message: "All quadrants are full" });
      }

      // Promote the task
      const { data: promoted, error } = await supabase
        .from("tasks")
        .update({ status: "PENDING", updated_at: new Date().toISOString() })
        .eq("id", anyQueued[0].id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: "Failed to promote task" }, { status: 500 });
      }

      return NextResponse.json({
        promoted: promoted as Task,
        message: "잘했어요! 🎉 다음은 이건 어때요?",
      });
    }

    // Promote the best queued task in the same quadrant
    const { data: promoted, error } = await supabase
      .from("tasks")
      .update({ status: "PENDING", updated_at: new Date().toISOString() })
      .eq("id", queuedTasks[0].id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to promote task" }, { status: 500 });
    }

    return NextResponse.json({
      promoted: promoted as Task,
      message: "잘했어요! 🎉 다음은 이건 어때요?",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
