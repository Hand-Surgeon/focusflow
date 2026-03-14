import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAccessToken } from "@/lib/google/client";
import { fetchUpcomingEvents } from "@/lib/google/calendar";
import { searchEmails } from "@/lib/google/gmail";
import { smartClassify, splitPendingAndQueued, type SmartSyncItem } from "@/lib/ai/smart-sync";
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

    // Fetch calendar (30 days) and email (30 days) in parallel
    const [calendarEvents, emails] = await Promise.all([
      fetchUpcomingEvents(token, { maxResults: 50, daysAhead: 30 }),
      searchEmails(token, {
        maxResults: 30,
        query: "newer_than:30d -category:promotions -category:social -category:updates",
      }),
    ]);

    // Check which items are already synced
    const calendarSourceIds = calendarEvents.map((e) => e.id);
    const emailSourceIds = emails.map((e) => e.id);
    const allSourceIds = [...calendarSourceIds, ...emailSourceIds];

    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("source_id")
      .eq("user_id", user.id)
      .in("source_type", ["CALENDAR", "EMAIL"])
      .in("source_id", allSourceIds);

    const existingSourceIds = new Set((existingTasks ?? []).map((t) => t.source_id));

    // Build items for AI classification (only new ones)
    const items: SmartSyncItem[] = [];

    for (const event of calendarEvents) {
      if (existingSourceIds.has(event.id)) continue;
      items.push({
        source_type: "CALENDAR",
        source_id: event.id,
        title: event.summary || "Untitled Event",
        description: event.description?.slice(0, 300) ?? null,
        due_date: event.start.dateTime ?? event.start.date ?? null,
      });
    }

    for (const email of emails) {
      if (existingSourceIds.has(email.id)) continue;
      items.push({
        source_type: "EMAIL",
        source_id: email.id,
        title: email.subject,
        description: email.snippet.slice(0, 300) || null,
        due_date: null,
        sender: email.sender,
        snippet: email.snippet,
      });
    }

    if (items.length === 0) {
      return NextResponse.json({
        synced: 0,
        queued: 0,
        daily_summary: "새로운 항목이 없어요. 모든 게 최신 상태입니다! ✨",
        message: "All items already synced",
      });
    }

    // Run Gemini ADHD coach classification
    const classifyResult = await smartClassify(items);

    // Get current pending counts per quadrant
    const { data: currentPending } = await supabase
      .from("tasks")
      .select("quadrant")
      .eq("user_id", user.id)
      .eq("status", "PENDING")
      .neq("quadrant", "UNCLASSIFIED");

    const pendingCounts: Record<string, number> = {};
    for (const t of currentPending ?? []) {
      pendingCounts[t.quadrant] = (pendingCounts[t.quadrant] ?? 0) + 1;
    }

    // Split into visible (PENDING) and hidden (QUEUED)
    const { pending, queued } = splitPendingAndQueued(classifyResult.items, pendingCounts);

    // Build source_id -> original item map for task creation
    const itemMap = new Map(items.map((i) => [i.source_id, i]));

    // Create tasks
    const tasksToInsert = [...pending, ...queued].map((classified) => {
      const original = itemMap.get(classified.source_id);
      const isPending = pending.includes(classified);
      return {
        user_id: user.id,
        title:
          original?.source_type === "EMAIL"
            ? `[Email] ${original.title}`
            : (original?.title ?? "Untitled"),
        description: original?.description ?? null,
        due_date: original?.due_date ?? null,
        source_type: original?.source_type ?? ("CALENDAR" as const),
        source_id: classified.source_id,
        quadrant: classified.quadrant as TaskQuadrant,
        status: isPending ? ("PENDING" as const) : ("QUEUED" as const),
        energy_cost: classified.energy_cost,
        position: 0,
        completed_at: null,
        ai_reason: classified.ai_reason,
        parent_task_id: null,
        importance_score: classified.importance_score,
        nudge_message: classified.nudge_message,
        estimated_minutes: classified.estimated_minutes,
      };
    });

    const { data: insertedTasksRaw, error: insertError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();
    const insertedTasks = insertedTasksRaw as Task[] | null;

    if (insertError) {
      console.error("Smart sync insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save tasks", detail: insertError.message },
        { status: 500 },
      );
    }

    // Create email_metadata for EMAIL tasks
    const emailTasks = (insertedTasks ?? []).filter((t) => t.source_type === "EMAIL");
    for (const task of emailTasks) {
      const original = items.find((i) => i.source_id === task.source_id);
      if (original) {
        await supabase.from("email_metadata").insert({
          task_id: task.id,
          sender: original.sender ?? "Unknown",
          subject: original.title,
          received_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      synced: pending.length,
      queued: queued.length,
      total: (insertedTasks ?? []).length,
      daily_summary: classifyResult.daily_summary,
      tasks: insertedTasks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Smart sync failed";
    console.error("Smart sync error:", message);

    if (message.includes("access token not available") || message.includes("re-authenticate")) {
      return NextResponse.json(
        { error: "Google 토큰이 만료됐어요. 로그아웃 후 다시 로그인해 주세요." },
        { status: 401 },
      );
    }

    if (message.includes("429") || message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json(
        {
          error:
            "Gemini AI 요청 한도를 초과했어요. Google AI Studio에서 API 키의 사용량을 확인하거나, 잠시 후 다시 시도해 주세요. (https://aistudio.google.com)",
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
