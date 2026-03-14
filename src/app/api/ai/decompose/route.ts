import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decomposeTask } from "@/lib/ai/service";
import type { Task, TaskStatus } from "@/types/database";
import { z } from "zod";

const DecomposeSchema = z.object({
  task_id: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const parsed = DecomposeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Fetch the parent task
    const { data: parentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", parsed.data.task_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const parent = parentTask as Task;
    const aiResult = await decomposeTask(parent.title, parent.description);

    // Create subtasks in the database
    const subtasks = aiResult.subtasks.map((sub, index) => ({
      user_id: user.id,
      title: sub.title,
      description: sub.description,
      quadrant: parent.quadrant,
      status: "PENDING" as TaskStatus,
      energy_cost: sub.energy_cost,
      due_date: parent.due_date,
      source_type: parent.source_type,
      source_id: null,
      ai_reason: `Decomposed from: ${parent.title}`,
      parent_task_id: parent.id,
      position: index + 1,
      completed_at: null,
    }));

    const { data: createdSubtasks, error: insertError } = await supabase
      .from("tasks")
      .insert(subtasks)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      parent_task_id: parent.id,
      subtasks: createdSubtasks as Task[],
      total_estimated_minutes: aiResult.total_estimated_minutes,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
