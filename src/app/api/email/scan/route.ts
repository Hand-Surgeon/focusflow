import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/client";
import { searchEmails, emailToTaskData } from "@/lib/google/gmail";
import type { Task, TaskQuadrant } from "@/types/database";

export async function POST(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getGoogleAccessToken();
    const emails = await searchEmails(token, {
      maxResults: 20,
      query: "is:unread newer_than:3d -category:promotions -category:social",
    });

    if (emails.length === 0) {
      return NextResponse.json({
        scanned: 0,
        created: 0,
        message: "No actionable emails found",
      });
    }

    // Check which emails are already imported
    const sourceIds = emails.map((e) => e.id);
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("source_id")
      .eq("user_id", user.id)
      .eq("source_type", "EMAIL")
      .in("source_id", sourceIds);

    const existingSourceIds = new Set(
      (existingTasks ?? []).map((t) => t.source_id),
    );

    const newEmails = emails.filter((e) => !existingSourceIds.has(e.id));

    if (newEmails.length === 0) {
      return NextResponse.json({
        scanned: emails.length,
        created: 0,
        message: "All emails already imported",
      });
    }

    // Insert tasks and email metadata
    const results: Array<{ taskId: string; subject: string }> = [];

    for (const email of newEmails) {
      const taskData = emailToTaskData(email);

      // Insert the task
      const { data: task, error: taskError } = (await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description,
          source_type: taskData.source_type,
          source_id: taskData.source_id,
          quadrant: "UNCLASSIFIED" as TaskQuadrant,
          status: "PENDING" as const,
          energy_cost: 2,
          position: 0,
          due_date: null,
          completed_at: null,
          ai_reason: null,
          parent_task_id: null,
        })
        .select()
        .single()) as { data: Task | null; error: unknown };

      if (taskError || !task) {
        console.error("Email task insert error:", taskError);
        continue;
      }

      // Insert email metadata
      await supabase.from("email_metadata").insert({
        task_id: task.id,
        sender: taskData.emailMetadata.sender,
        subject: taskData.emailMetadata.subject,
        received_at: taskData.emailMetadata.received_at,
      });

      results.push({ taskId: task.id, subject: taskData.emailMetadata.subject });
    }

    return NextResponse.json({
      scanned: emails.length,
      created: results.length,
      tasks: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email scan failed";
    console.error("Email scan error:", message);

    if (message.includes("access token not available") || message.includes("re-authenticate")) {
      return NextResponse.json(
        { error: "Google token expired. Please sign out and sign back in." },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
