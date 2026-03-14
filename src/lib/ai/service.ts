import { getGeminiModel, generateWithRetry } from "./gemini";
import {
  CLASSIFY_TASK_PROMPT,
  DECOMPOSE_TASK_PROMPT,
  BRAIN_DUMP_PROMPT,
  TOP3_PROMPT,
  type ClassifyResult,
  type DecomposeResult,
  type BrainDumpResult,
  type Top3Result,
} from "./prompts";
import type { Task } from "@/types/database";

function parseJsonResponse<T>(text: string): T {
  // Extract JSON from potential markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
    null,
    text,
  ];
  const jsonStr = (jsonMatch[1] ?? text).trim();
  return JSON.parse(jsonStr) as T;
}

export async function classifyTask(
  title: string,
  description?: string | null,
  dueDate?: string | null,
): Promise<ClassifyResult> {
  const context = [
    `Task: ${title}`,
    description ? `Description: ${description}` : null,
    dueDate ? `Due date: ${dueDate}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateWithRetry(getGeminiModel(), [
    CLASSIFY_TASK_PROMPT,
    context,
  ]);

  const text = result.response.text();
  return parseJsonResponse<ClassifyResult>(text);
}

export async function decomposeTask(
  title: string,
  description?: string | null,
): Promise<DecomposeResult> {
  const context = [
    `Task to decompose: ${title}`,
    description ? `Description: ${description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateWithRetry(getGeminiModel(), [
    DECOMPOSE_TASK_PROMPT,
    context,
  ]);

  const text = result.response.text();
  return parseJsonResponse<DecomposeResult>(text);
}

export async function processBrainDump(
  rawText: string,
): Promise<BrainDumpResult> {
  const result = await generateWithRetry(getGeminiModel(), [
    BRAIN_DUMP_PROMPT,
    `Brain dump text:\n${rawText}`,
  ]);

  const text = result.response.text();
  return parseJsonResponse<BrainDumpResult>(text);
}

export async function selectTop3(tasks: Task[]): Promise<Top3Result> {
  const taskList = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    quadrant: t.quadrant,
    energy_cost: t.energy_cost,
    due_date: t.due_date,
    status: t.status,
  }));

  const result = await generateWithRetry(getGeminiModel(), [
    TOP3_PROMPT,
    `Pending tasks:\n${JSON.stringify(taskList, null, 2)}`,
  ]);

  const text = result.response.text();
  return parseJsonResponse<Top3Result>(text);
}
