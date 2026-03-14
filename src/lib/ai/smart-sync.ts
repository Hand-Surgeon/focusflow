import { getGeminiModel } from "./gemini";
import type { TaskQuadrant } from "@/types/database";

export type SmartSyncItem = {
  source_type: "CALENDAR" | "EMAIL";
  source_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  sender?: string;
  snippet?: string;
};

export type ClassifiedItem = {
  source_id: string;
  quadrant: TaskQuadrant;
  importance_score: number;
  ai_reason: string;
  nudge_message: string;
  energy_cost: number;
  estimated_minutes: number;
};

export type SmartSyncResult = {
  items: ClassifiedItem[];
  daily_summary: string;
};

const SMART_SYNC_PROMPT = `You are an ADHD-specialized personal assistant and coach. Your job is to analyze someone's calendar events and emails, then select ONLY what truly needs their attention.

ADHD COACHING PRINCIPLES:
- Too many tasks cause decision paralysis. Show FEWER, not more.
- Time blindness is real. Frame deadlines in relative terms.
- Task initiation is the hardest part. Make each task feel small and doable.
- Dopamine motivation works. Give encouraging, specific reasons WHY this matters.

YOUR TASK:
1. FILTER: From all the calendar events and emails provided, select only items that genuinely need attention (maximum 20 items total, up to 5 per quadrant).
   - SKIP: routine recurring meetings with no preparation needed, newsletters, promotional emails, FYI-only CCs, automated notifications
   - KEEP: deadlines, important meetings requiring preparation, action-required emails, health appointments, interviews, presentations

2. CROSS-REFERENCE: Connect related items. If an email discusses a meeting topic, or multiple items relate to the same project, consider them together for importance.

3. CLASSIFY into Eisenhower Matrix:
   - Q1 (urgent+important): Deadlines within 3 days, urgent action items, critical meetings tomorrow
   - Q2 (important+not urgent): Important but >3 days away, self-improvement, health, strategic planning
   - Q3 (urgent+not important): Can be delegated, routine urgent items, quick replies needed
   - Q4 (not urgent+not important): Low-priority but worth handling when free - simple replies, optional events, light reading

4. For EACH selected item provide (in Korean):
   - quadrant: "Q1" | "Q2" | "Q3" | "Q4"
   - importance_score: 1-10 (10 = most critical)
   - ai_reason: Why this matters (Korean, 1 sentence, max 80 chars)
   - nudge_message: ADHD-friendly motivation (Korean, warm encouraging tone, max 100 chars)
   - energy_cost: 1-5 (1=minimal effort, 5=intense focus)
   - estimated_minutes: realistic time estimate

5. Generate daily_summary (Korean): A warm, motivating daily overview.
   - Acknowledge it might feel overwhelming
   - Be specific about what to tackle first
   - Example tone: "오늘 정말 중요한 건 3개뿐이에요. 하나씩 해볼까요? 💪"

Respond with ONLY a JSON object:
{
  "items": [
    {
      "source_id": "original source_id from input",
      "quadrant": "Q1",
      "importance_score": 8,
      "ai_reason": "내일 10명 참석 회의, 자료 준비 필요",
      "nudge_message": "15분만 준비하면 내일 회의 여유롭게 갈 수 있어요 💪",
      "energy_cost": 3,
      "estimated_minutes": 30
    }
  ],
  "daily_summary": "오늘 정말 신경 쓸 건 3개뿐이에요. 나머지는 제가 정리해뒀어요! 하나씩 해볼까요? 😊"
}`;

export async function smartClassify(items: SmartSyncItem[]): Promise<SmartSyncResult> {
  if (items.length === 0) {
    return { items: [], daily_summary: "동기화할 새로운 항목이 없어요. 잘 관리하고 계시네요! 👏" };
  }

  const context = items.map((item) => ({
    source_type: item.source_type,
    source_id: item.source_id,
    title: item.title,
    description: item.description,
    due_date: item.due_date,
    sender: item.sender ?? undefined,
    snippet: item.snippet ?? undefined,
  }));

  const result = await getGeminiModel().generateContent([
    SMART_SYNC_PROMPT,
    `Today: ${new Date().toISOString().split("T")[0]}\n\nItems to analyze:\n${JSON.stringify(context, null, 2)}`,
  ]);

  const text = result.response.text();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
  const jsonStr = (jsonMatch[1] ?? text).trim();
  return JSON.parse(jsonStr) as SmartSyncResult;
}

// Quadrant limits for visible tasks
export const QUADRANT_LIMITS: Record<string, number> = {
  Q1: 5,
  Q2: 5,
  Q3: 5,
  Q4: 5,
};

// Determine which items should be PENDING (visible) vs QUEUED (hidden)
export function splitPendingAndQueued(
  items: ClassifiedItem[],
  existingPendingCounts: Record<string, number>,
): { pending: ClassifiedItem[]; queued: ClassifiedItem[] } {
  // Sort by importance_score descending within each quadrant
  const sorted = [...items].sort((a, b) => b.importance_score - a.importance_score);

  const pending: ClassifiedItem[] = [];
  const queued: ClassifiedItem[] = [];
  const counts = { ...existingPendingCounts };

  for (const item of sorted) {
    const limit = QUADRANT_LIMITS[item.quadrant] ?? 2;
    const current = counts[item.quadrant] ?? 0;

    if (current < limit) {
      pending.push(item);
      counts[item.quadrant] = current + 1;
    } else {
      queued.push(item);
    }
  }

  return { pending, queued };
}
