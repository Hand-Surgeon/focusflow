"use client";

import { useRef, useState, useCallback } from "react";
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
  onMove?: (taskId: string, quadrant: TaskQuadrant) => void;
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

const SWIPE_THRESHOLD = 80;
const DEAD_ZONE = 10;

interface QuadrantOption {
  quadrant: TaskQuadrant;
  label: string;
  color: string;
  bgColor: string;
}

const allQuadrantOptions: QuadrantOption[] = [
  { quadrant: "Q1", label: "긴급", color: "bg-red-500", bgColor: "text-white" },
  { quadrant: "Q2", label: "중요", color: "bg-blue-500", bgColor: "text-white" },
  { quadrant: "Q3", label: "위임", color: "bg-yellow-500", bgColor: "text-white" },
  { quadrant: "Q4", label: "여유", color: "bg-green-500", bgColor: "text-white" },
];

export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
  onMove,
}: TaskCardProps): React.JSX.Element {
  const isCompleted = task.status === "COMPLETED";
  const isOverdue =
    task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

  const [translateX, setTranslateX] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchRef = useRef<{
    startX: number;
    currentX: number;
    isSwiping: boolean;
    direction: "left" | "right" | null;
  }>({
    startX: 0,
    currentX: 0,
    isSwiping: false,
    direction: null,
  });

  const snapBack = useCallback((): void => {
    setIsTransitioning(true);
    setTranslateX(0);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent): void => {
      const touch = e.touches[0];
      touchRef.current = {
        startX: touch.clientX,
        currentX: touch.clientX,
        isSwiping: false,
        direction: null,
      };
      setIsTransitioning(false);
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent): void => {
      const touch = e.touches[0];
      const ref = touchRef.current;
      ref.currentX = touch.clientX;
      const deltaX = touch.clientX - ref.startX;

      // Dead zone check
      if (!ref.isSwiping && Math.abs(deltaX) < DEAD_ZONE) {
        return;
      }

      if (!ref.isSwiping) {
        ref.isSwiping = true;
        ref.direction = deltaX > 0 ? "right" : "left";
      }

      // Only allow swiping in the initial direction
      if (ref.direction === "right" && deltaX < 0) {
        setTranslateX(0);
        return;
      }
      if (ref.direction === "left" && deltaX > 0) {
        setTranslateX(0);
        return;
      }

      setTranslateX(deltaX);
    },
    [],
  );

  const handleTouchEnd = useCallback((): void => {
    const ref = touchRef.current;
    const deltaX = ref.currentX - ref.startX;

    if (!ref.isSwiping) {
      snapBack();
      return;
    }

    if (ref.direction === "right" && deltaX >= SWIPE_THRESHOLD) {
      // Complete action
      onComplete(task.id);
      snapBack();
    } else if (ref.direction === "left" && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      // Keep card open at threshold to show quadrant buttons
      // Card stays translated; user taps a quadrant button
      // If onMove is not provided, snap back
      if (!onMove) {
        snapBack();
      }
      // Otherwise leave card in swiped position for quadrant selection
    } else {
      snapBack();
    }

    ref.isSwiping = false;
  }, [onComplete, onMove, task.id, snapBack]);

  const handleQuadrantSelect = useCallback(
    (quadrant: TaskQuadrant): void => {
      onMove?.(task.id, quadrant);
      snapBack();
    },
    [onMove, task.id, snapBack],
  );

  const filteredQuadrants = allQuadrantOptions.filter(
    (opt) => opt.quadrant !== task.quadrant,
  );

  const swipeDirection = translateX > 0 ? "right" : translateX < 0 ? "left" : null;
  const swipeProgress = Math.min(Math.abs(translateX) / SWIPE_THRESHOLD, 1);

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ touchAction: "pan-y" }}
    >
      {/* Right swipe background: complete action */}
      {swipeDirection === "right" && (
        <div
          className="absolute inset-0 flex items-center pl-4"
          style={{
            backgroundColor: `rgba(34, 197, 94, ${0.2 + swipeProgress * 0.6})`,
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className={cn(
                "size-5 text-green-600 transition-transform",
                swipeProgress >= 1 && "scale-125",
              )}
            />
            <span
              className={cn(
                "text-sm font-semibold text-green-700 transition-opacity",
                swipeProgress >= 1 ? "opacity-100" : "opacity-60",
              )}
            >
              완료
            </span>
          </div>
        </div>
      )}

      {/* Left swipe background: quadrant move buttons */}
      {swipeDirection === "left" && (
        <div className="absolute inset-0 flex items-center justify-end gap-2 pr-3">
          {filteredQuadrants.map((opt) => (
            <button
              key={opt.quadrant}
              type="button"
              onClick={() => handleQuadrantSelect(opt.quadrant)}
              className={cn(
                "flex size-10 items-center justify-center rounded-full transition-transform",
                opt.color,
                opt.bgColor,
                swipeProgress >= 1 ? "scale-100" : "scale-75 opacity-60",
              )}
              aria-label={`Move to ${opt.quadrant} (${opt.label})`}
            >
              <span className="text-xs font-bold">{opt.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Card content layer */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isTransitioning ? "transform 0.3s ease" : "none",
        }}
      >
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
      </div>
    </div>
  );
}
