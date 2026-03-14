"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Target,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnergyIndicator } from "@/components/task/energy-indicator";
import type { Task } from "@/types/database";

interface Top3Item {
  task_id: string;
  task: Task | null;
  reason: string;
  suggested_order: number;
}

interface Top3Response {
  top3: Top3Item[];
  motivation: string;
}

interface Top3PanelProps {
  onTaskFocus: (taskId: string) => void;
  onTaskComplete: (taskId: string) => void;
}

export function Top3Panel({
  onTaskFocus,
  onTaskComplete,
}: Top3PanelProps): React.JSX.Element {
  const [data, setData] = useState<Top3Response | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchTop3 = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/ai/top3");
      if (!response.ok) {
        toast.error("Failed to get today's priorities");
        return;
      }
      const result: Top3Response = await response.json();
      setData(result);
      setHasLoaded(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      fetchTop3();
    }
  }, [hasLoaded, fetchTop3]);

  if (isLoading && !data) {
    return (
      <Card className="flex items-center justify-center p-6">
        <Loader2 className="mr-2 size-4 animate-spin text-purple-500" />
        <span className="text-sm text-muted-foreground">
          AI is picking your top priorities...
        </span>
      </Card>
    );
  }

  if (!data || data.top3.length === 0) {
    return (
      <Card className="p-4 text-center">
        <Target className="mx-auto mb-2 size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          No tasks yet. Add some tasks or try a Brain Dump!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-orange-500" />
          <h3 className="text-sm font-semibold">Today&apos;s Top 3</h3>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={fetchTop3}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw
            className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {data.motivation ? (
        <p className="mb-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">
          <Sparkles className="mr-1 inline size-3 text-purple-400" />
          {data.motivation}
        </p>
      ) : null}

      <div className="space-y-2">
        {data.top3.map((item, index) => {
          const task = item.task;
          if (!task) return null;

          return (
            <div
              key={item.task_id}
              className="group flex items-center gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/30"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <EnergyIndicator level={task.energy_cost} size="sm" />
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                    {task.quadrant}
                  </Badge>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {item.reason}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onTaskComplete(item.task_id)}
                  title="Complete"
                  className="text-green-600 hover:text-green-700"
                >
                  <svg
                    className="size-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onTaskFocus(item.task_id)}
                  title="Focus on this"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
