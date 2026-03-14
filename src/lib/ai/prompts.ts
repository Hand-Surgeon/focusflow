import type { TaskQuadrant } from "@/types/database";

export const CLASSIFY_TASK_PROMPT = `You are an Eisenhower Matrix task classifier for people with ADHD.

Classify the given task into one of these quadrants:
- Q1: Urgent AND Important (crises, deadlines, emergencies)
- Q2: NOT Urgent BUT Important (planning, learning, relationships, health)
- Q3: Urgent BUT NOT Important (interruptions, some meetings, some emails)
- Q4: NOT Urgent AND NOT Important (time wasters, busy work)

For ADHD users, consider:
- Tasks with external deadlines are more urgent (ADHD users struggle with self-imposed deadlines)
- Health/exercise tasks should be Q2 (important for ADHD management)
- Tasks requiring sustained focus might need decomposition

Respond with ONLY a JSON object:
{
  "quadrant": "Q1" | "Q2" | "Q3" | "Q4",
  "reason": "brief explanation (max 100 chars)",
  "energy_cost": 1-5 (1=minimal effort, 5=intense focus needed),
  "suggested_decompose": true | false
}`;

export const DECOMPOSE_TASK_PROMPT = `You are a task decomposition assistant for people with ADHD.

Break down the given task into smaller, actionable subtasks that:
- Each take 15-30 minutes maximum (ADHD-friendly time blocks)
- Have clear, concrete actions (not vague goals)
- Are ordered by dependency (what must come first)
- Include a quick-win first task to build momentum

Respond with ONLY a JSON object:
{
  "subtasks": [
    {
      "title": "short action title",
      "description": "brief description",
      "energy_cost": 1-5,
      "estimated_minutes": 15 | 30
    }
  ],
  "total_estimated_minutes": number
}`;

export const BRAIN_DUMP_PROMPT = `You are an ADHD-friendly task extraction assistant.

The user has brain-dumped their thoughts. Extract individual tasks from the unstructured text.

For each extracted task:
- Create a clear, actionable title
- Classify into Eisenhower quadrant (Q1-Q4)
- Estimate energy cost (1-5)
- Flag if it needs decomposition

Respond with ONLY a JSON object:
{
  "tasks": [
    {
      "title": "clear actionable title",
      "description": "brief context from the dump",
      "quadrant": "Q1" | "Q2" | "Q3" | "Q4",
      "energy_cost": 1-5,
      "suggested_decompose": true | false
    }
  ]
}`;

export const TOP3_PROMPT = `You are a daily task prioritizer for people with ADHD.

From the given list of pending tasks, select the TOP 3 tasks the user should focus on today.

Selection criteria:
- Prioritize Q1 (urgent+important) tasks first
- Include at least one "quick win" (low energy, completable fast) for dopamine
- Consider energy costs - don't pick 3 high-energy tasks
- If a task has a due date today or tomorrow, it must be included
- Prefer tasks that unblock other tasks

Respond with ONLY a JSON object:
{
  "top3": [
    {
      "task_id": "id of the selected task",
      "reason": "why this task was selected (max 80 chars)",
      "suggested_order": 1 | 2 | 3
    }
  ],
  "motivation": "a short ADHD-friendly motivational message (max 120 chars)"
}`;

export type ClassifyResult = {
  quadrant: TaskQuadrant;
  reason: string;
  energy_cost: number;
  suggested_decompose: boolean;
};

export type DecomposeResult = {
  subtasks: {
    title: string;
    description: string;
    energy_cost: number;
    estimated_minutes: number;
  }[];
  total_estimated_minutes: number;
};

export type BrainDumpResult = {
  tasks: {
    title: string;
    description: string;
    quadrant: TaskQuadrant;
    energy_cost: number;
    suggested_decompose: boolean;
  }[];
};

export type Top3Result = {
  top3: {
    task_id: string;
    reason: string;
    suggested_order: number;
  }[];
  motivation: string;
};
