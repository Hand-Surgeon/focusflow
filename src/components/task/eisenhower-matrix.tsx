"use client";

import { useState } from "react";
import React from "react";
import {
  DndContext,
  DragOverlay as DragOverlayBase,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

// @dnd-kit/core v6 DragOverlay has a Pick<> type mismatch in strict TS mode.
// The picked optional props are treated as required due to a TypeScript inference quirk.
const DragOverlay = DragOverlayBase as unknown as React.FC<{
  children?: React.ReactNode;
  adjustScale?: boolean;
  className?: string;
  style?: React.CSSProperties;
  dropAnimation?: null;
}>;
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus, ChevronDown, Inbox, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task/task-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Task, TaskQuadrant } from "@/types/database";

interface EisenhowerMatrixProps {
  tasks: Task[];
  queueCount: number;
  onTaskComplete: (taskId: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskMove: (taskId: string, newQuadrant: TaskQuadrant) => void;
  onCreateTask: (quadrant: TaskQuadrant) => void;
}

interface QuadrantConfig {
  id: TaskQuadrant;
  title: string;
  subtitle: string;
  borderColor: string;
  headerBg: string;
  headerText: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: "Q1",
    title: "Do First",
    subtitle: "Urgent + Important",
    borderColor: "border-red-500/30",
    headerBg: "bg-red-50 dark:bg-red-950/20",
    headerText: "text-red-700 dark:text-red-400",
  },
  {
    id: "Q2",
    title: "Schedule",
    subtitle: "Important, Not Urgent",
    borderColor: "border-blue-500/30",
    headerBg: "bg-blue-50 dark:bg-blue-950/20",
    headerText: "text-blue-700 dark:text-blue-400",
  },
  {
    id: "Q3",
    title: "Delegate",
    subtitle: "Urgent, Not Important",
    borderColor: "border-yellow-500/30",
    headerBg: "bg-yellow-50 dark:bg-yellow-950/20",
    headerText: "text-yellow-700 dark:text-yellow-400",
  },
  {
    id: "Q4",
    title: "When Free",
    subtitle: "Light Tasks for Free Time",
    borderColor: "border-gray-400/30",
    headerBg: "bg-gray-50 dark:bg-gray-900/20",
    headerText: "text-gray-600 dark:text-gray-400",
  },
];

const MAX_VISIBLE_TASKS = 5;

interface QuadrantDropZoneProps {
  config: QuadrantConfig;
  tasks: Task[];
  onTaskComplete: (taskId: string) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskMove: (taskId: string, quadrant: TaskQuadrant) => void;
  onCreateTask: () => void;
}

function QuadrantDropZone({
  config,
  tasks,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  onTaskMove,
  onCreateTask,
}: QuadrantDropZoneProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: config.id });

  const visibleTasks = expanded ? tasks : tasks.slice(0, MAX_VISIBLE_TASKS);
  const hiddenCount = tasks.length - MAX_VISIBLE_TASKS;
  const showExpandButton = !expanded && hiddenCount > 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border transition-colors",
        config.borderColor,
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      {/* Quadrant Header */}
      <div
        className={cn(
          "flex items-center justify-between rounded-t-xl px-3 py-2",
          config.headerBg,
        )}
      >
        <div>
          <h3 className={cn("text-sm font-semibold", config.headerText)}>
            {config.title}
          </h3>
          <p className="text-xs text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-background/80 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCreateTask}
            aria-label={`Add task to ${config.title}`}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <SortableContext
          items={visibleTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleTasks.length === 0 ? (
            <div className="flex min-h-[60px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-4">
              <p className="text-xs text-muted-foreground">No tasks yet</p>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onTaskComplete}
                onEdit={onTaskEdit}
                onDelete={onTaskDelete}
                onMove={onTaskMove}
              />
            ))
          )}
        </SortableContext>

        {showExpandButton ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="size-3" />
            {hiddenCount} more
          </button>
        ) : null}

        {expanded && hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex items-center justify-center gap-1 rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Show less
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function EisenhowerMatrix({
  tasks,
  queueCount,
  onTaskComplete,
  onTaskEdit,
  onTaskDelete,
  onTaskMove,
  onCreateTask,
}: EisenhowerMatrixProps): React.JSX.Element {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Filter out COMPLETED, ARCHIVED, and QUEUED tasks for the matrix
  const activeTasks = tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "ARCHIVED" && t.status !== "QUEUED",
  );

  function getTasksByQuadrant(quadrant: TaskQuadrant): Task[] {
    return activeTasks
      .filter((t) => t.quadrant === quadrant)
      .sort((a, b) => a.position - b.position);
  }

  const unclassifiedTasks = activeTasks
    .filter((t) => t.quadrant === "UNCLASSIFIED")
    .sort((a, b) => a.position - b.position);

  function handleDragStart(event: DragStartEvent): void {
    const draggedTask = tasks.find((t) => t.id === event.active.id);
    if (draggedTask) {
      setActiveTask(draggedTask);
    }
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveTask(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if dropped on a quadrant
    const targetQuadrant = QUADRANTS.find((q) => q.id === overId);
    if (targetQuadrant) {
      const task = tasks.find((t) => t.id === activeId);
      if (task && task.quadrant !== targetQuadrant.id) {
        onTaskMove(activeId, targetQuadrant.id);
      }
      return;
    }

    // Check if dropped on another task (find which quadrant that task belongs to)
    const targetTask = tasks.find((t) => t.id === overId);
    if (targetTask) {
      const sourceTask = tasks.find((t) => t.id === activeId);
      if (sourceTask && sourceTask.quadrant !== targetTask.quadrant) {
        onTaskMove(activeId, targetTask.quadrant);
      }
    }
  }

  return (
    <TooltipProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {QUADRANTS.map((config) => (
            <QuadrantDropZone
              key={config.id}
              config={config}
              tasks={getTasksByQuadrant(config.id)}
              onTaskComplete={onTaskComplete}
              onTaskEdit={onTaskEdit}
              onTaskDelete={onTaskDelete}
              onTaskMove={onTaskMove}
              onCreateTask={() => onCreateTask(config.id)}
            />
          ))}
        </div>

        {queueCount > 0 ? (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-violet-500/30 bg-violet-50/50 dark:bg-violet-950/10 py-2.5 px-4">
            <Clock className="size-4 text-violet-500" />
            <span className="text-sm text-muted-foreground">
              대기 중:{" "}
              <span className="font-semibold text-violet-600 dark:text-violet-400">
                {queueCount}개
              </span>
              <span className="ml-1 text-xs">
                — 완료하면 다음 할 일을 추천해드려요
              </span>
            </span>
          </div>
        ) : null}

        {/* Unclassified tasks section */}
        {unclassifiedTasks.length > 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-muted-foreground/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Inbox className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">
                Unclassified ({unclassifiedTasks.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {unclassifiedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={onTaskComplete}
                  onEdit={onTaskEdit}
                  onDelete={onTaskDelete}
                />
              ))}
            </div>
          </div>
        ) : null}

        <DragOverlay>
          {activeTask ? (
            <div className="w-[280px] rotate-3 opacity-90">
              <TaskCard
                task={activeTask}
                onComplete={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </TooltipProvider>
  );
}
