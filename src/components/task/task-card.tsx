"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EnergyIndicator } from "@/components/task/energy-indicator";
import type { Task, TaskQuadrant, SourceType } from "@/types/database";

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const quadrantColors: Record<TaskQuadrant, string> = {
  Q1: "border-l-red-500",
  Q2: "border-l-blue-500",
  Q3: "border-l-yellow-500",
  Q4: "border-l-gray-400",
  UNCLASSIFIED: "border-l-muted-foreground",
};

const sourceLabels: Record<SourceType, string> = {
  MANUAL: "Manual",
  CALENDAR: "Calendar",
  EMAIL: "Email",
  BRAIN_DUMP: "Brain Dump",
};

export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
}: TaskCardProps): React.JSX.Element {
  const isCompleted = task.status === "COMPLETED";
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

  return (
    <Card
      size="sm"
      className={cn(
        "group relative border-l-[3px] py-2.5 transition-shadow hover:shadow-sm",
        quadrantColors[task.quadrant],
        isCompleted && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2 px-3">
        {/* Complete button */}
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          disabled={isCompleted}
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            isCompleted
              ? "text-green-500"
              : "text-muted-foreground hover:text-green-500",
          )}
          aria-label={isCompleted ? "Task completed" : "Mark as complete"}
        >
          <CheckCircle2
            className={cn("size-4", isCompleted && "fill-green-500")}
          />
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate text-sm font-medium",
                isCompleted && "line-through",
              )}
            >
              {task.title}
            </span>
            {task.ai_reason ? (
              <Tooltip>
                <TooltipTrigger>
                  <Sparkles className="size-3 shrink-0 text-purple-500" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="max-w-[200px]">{task.ai_reason}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <EnergyIndicator level={task.energy_cost} size="sm" />

            {task.due_date ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs text-muted-foreground",
                  isOverdue && "font-medium text-red-500",
                )}
              >
                <Clock className="size-3" />
                {formatDistanceToNow(new Date(task.due_date), {
                  addSuffix: true,
                })}
              </span>
            ) : null}

            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
              {sourceLabels[task.source_type]}
            </Badge>
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus:opacity-100"
            aria-label="Task actions"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil className="size-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="size-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
