import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processBrainDump } from "@/lib/ai/service";
import type { Task, TaskStatus } from "@/types/database";
import { z } from "zod";

const BrainDumpSchema = z.object({
  text: z.string().min(1).max(5000),
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
    const parsed = BrainDumpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const aiResult = await processBrainDump(parsed.data.text);

    // Create all extracted tasks in database
    const tasksToInsert = aiResult.tasks.map((t, index) => ({
      user_id: user.id,
      title: t.title,
      description: t.description,
      quadrant: t.quadrant,
      status: "PENDING" as TaskStatus,
      energy_cost: t.energy_cost,
      due_date: null,
      source_type: "BRAIN_DUMP" as const,
      source_id: null,
      ai_reason: `Extracted from brain dump`,
      parent_task_id: null,
      position: index + 1,
      completed_at: null,
    }));

    const { data: createdTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      extracted_count: aiResult.tasks.length,
      tasks: createdTasks as Task[],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
