import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/client";
import { fetchUpcomingEvents, eventToTaskData } from "@/lib/google/calendar";
import type { TaskQuadrant } from "@/types/database";

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
    const events = await fetchUpcomingEvents(token, {
      maxResults: 50,
      daysAhead: 7,
    });

    if (events.length === 0) {
      return NextResponse.json({
        synced: 0,
        skipped: 0,
        message: "No upcoming events found",
      });
    }

    // Check which events are already synced
    const sourceIds = events.map((e) => e.id);
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("source_id")
      .eq("user_id", user.id)
      .eq("source_type", "CALENDAR")
      .in("source_id", sourceIds);

    const existingSourceIds = new Set(
      (existingTasks ?? []).map((t) => t.source_id),
    );

    // Filter to only new events
    const newEvents = events.filter((e) => !existingSourceIds.has(e.id));

    if (newEvents.length === 0) {
      return NextResponse.json({
        synced: 0,
        skipped: events.length,
        message: "All events already synced",
      });
    }

    // Insert new tasks from calendar events
    const tasksToInsert = newEvents.map((event) => {
      const taskData = eventToTaskData(event);
      return {
        user_id: user.id,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date,
        source_type: taskData.source_type,
        source_id: taskData.source_id,
        quadrant: "UNCLASSIFIED" as TaskQuadrant,
        status: "PENDING" as const,
        energy_cost: 3,
        position: 0,
        completed_at: null,
        ai_reason: null,
        parent_task_id: null,
      };
    });

    const { data: insertedTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error("Calendar sync insert error:", insertError);
      return NextResponse.json(
        {
          error: "Failed to create tasks from calendar events",
          detail: insertError.message,
          code: insertError.code,
          hint: insertError.hint ?? null,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      synced: insertedTasks?.length ?? 0,
      skipped: existingSourceIds.size,
      tasks: insertedTasks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar sync failed";
    console.error("Calendar sync error:", message);

    if (message.includes("access token not available") || message.includes("re-authenticate")) {
      return NextResponse.json(
        { error: "Google token expired. Please sign out and sign back in." },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
