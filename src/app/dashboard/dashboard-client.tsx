"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, Archive, CheckCircle2, RefreshCw, Wifi, WifiOff, Sparkles, X, RotateCcw, Clock, ArrowUpCircle, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/header";
import { EisenhowerMatrix } from "@/components/task/eisenhower-matrix";
import { TaskDialog, type TaskFormData } from "@/components/task/task-dialog";
import { BrainDump } from "@/components/adhd/brain-dump";
import { Top3Panel } from "@/components/adhd/top3-panel";
import { FocusTimer } from "@/components/adhd/focus-timer";
import {
  CompletionReward,
  StreakDisplay,
} from "@/components/adhd/completion-reward";
import { useRealtimeTaskState } from "@/hooks/use-realtime-tasks";
import type { Task, User, TaskQuadrant } from "@/types/database";

interface DashboardClientProps {
  user: User;
  initialTasks: Task[];
}

export function DashboardClient({
  user,
  initialTasks,
}: DashboardClientProps): React.JSX.Element {
  const { tasks, setTasks, realtimeStatus } = useRealtimeTaskState(initialTasks, user.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultQuadrant, setDefaultQuadrant] =
    useState<TaskQuadrant>("UNCLASSIFIED");
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [completionCount, setCompletionCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [smartSyncing, setSmartSyncing] = useState(false);
  const [dailySummary, setDailySummary] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(() =>
    initialTasks.filter((t) => t.status === "QUEUED").length,
  );

  // Derived state
  const completedTasks = tasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => {
      const aDate = a.completed_at ?? a.updated_at;
      const bDate = b.completed_at ?? b.updated_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

  const queuedTasks = tasks
    .filter((t) => t.status === "QUEUED")
    .sort((a, b) => (b.importance_score ?? 0) - (a.importance_score ?? 0));

  const handleCreateTask = useCallback((quadrant: TaskQuadrant) => {
    setEditingTask(null);
    setDefaultQuadrant(quadrant);
    setDialogOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditingTask(task);
    setDefaultQuadrant(task.quadrant);
    setDialogOpen(true);
  }, []);

  const handleSaveTask = useCallback(
    async (formData: TaskFormData) => {
      try {
        if (editingTask) {
          // Optimistic update
          const optimisticTask: Task = {
            ...editingTask,
            ...formData,
            description: formData.description ?? null,
            due_date: formData.due_date
              ? new Date(formData.due_date).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          };
          setTasks((prev) =>
            prev.map((t) => (t.id === editingTask.id ? optimisticTask : t)),
          );

          const response = await fetch(`/api/tasks/${editingTask.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formData,
              due_date: formData.due_date
                ? new Date(formData.due_date).toISOString()
                : null,
            }),
          });

          if (!response.ok) {
            // Revert on failure
            setTasks((prev) =>
              prev.map((t) => (t.id === editingTask.id ? editingTask : t)),
            );
            const err = await response
              .json()
              .catch(() => ({ error: "Update failed" }));
            toast.error(err.error ?? "Failed to update task");
            return;
          }

          const updatedTask: Task = await response.json();
          setTasks((prev) =>
            prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
          );
          toast.success("Task updated");
        } else {
          const response = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...formData,
              due_date: formData.due_date
                ? new Date(formData.due_date).toISOString()
                : null,
            }),
          });

          if (!response.ok) {
            const err = await response
              .json()
              .catch(() => ({ error: "Create failed" }));
            toast.error(err.error ?? "Failed to create task");
            return;
          }

          const newTask: Task = await response.json();
          setTasks((prev) => [...prev, newTask]);
          toast.success("Task created");
        }
      } catch {
        toast.error("An unexpected error occurred");
      }
    },
    [editingTask],
  );

  const handleCompleteTask = useCallback(async (taskId: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: "COMPLETED" as const,
              completed_at: new Date().toISOString(),
            }
          : t,
      ),
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        // Revert
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: "PENDING" as const, completed_at: null }
              : t,
          ),
        );
        toast.error("Failed to complete task");
        return;
      }

      const data = await response.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
      setCompletionCount((c) => c + 1);
      if (data.streak?.current_streak) {
        setCurrentStreak(data.streak.current_streak);
      }
      toast.success(data.streak?.message ?? "Task completed!");

      // Recommend next task from queue
      try {
        const completedTask = tasks.find((t) => t.id === taskId);
        if (completedTask) {
          const recResponse = await fetch("/api/ai/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ completed_quadrant: completedTask.quadrant }),
          });
          const recData = await recResponse.json();

          if (recData.promoted) {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === recData.promoted.id ? recData.promoted : t,
              ),
            );
            setQueueCount((prev) => Math.max(0, prev - 1));
            toast.success(recData.message, {
              description:
                recData.promoted.nudge_message ?? recData.promoted.title,
              duration: 5000,
            });
          }
        }
      } catch {
        // Silent fail for recommendation - not critical
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "PENDING" as const, completed_at: null }
            : t,
        ),
      );
      toast.error("Failed to complete task");
    }
  }, []);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const taskToDelete = tasks.find((t) => t.id === taskId);
      if (!taskToDelete) return;

      // Optimistic removal
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // Revert
          setTasks((prev) => [...prev, taskToDelete]);
          toast.error("Failed to delete task");
          return;
        }

        toast.success("Task deleted");
      } catch {
        setTasks((prev) => [...prev, taskToDelete]);
        toast.error("Failed to delete task");
      }
    },
    [tasks],
  );

  const handleTaskMove = useCallback(
    async (taskId: string, newQuadrant: TaskQuadrant) => {
      const originalTask = tasks.find((t) => t.id === taskId);
      if (!originalTask || originalTask.quadrant === newQuadrant) return;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, quadrant: newQuadrant } : t,
        ),
      );

      try {
        const response = await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quadrant: newQuadrant }),
        });

        if (!response.ok) {
          // Revert
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, quadrant: originalTask.quadrant }
                : t,
            ),
          );
          toast.error("Failed to move task");
          return;
        }

        const updatedTask: Task = await response.json();
        setTasks((prev) =>
          prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
        );
        toast.success(`Moved to ${newQuadrant}`);
      } catch {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, quadrant: originalTask.quadrant }
              : t,
          ),
        );
        toast.error("Failed to move task");
      }
    },
    [tasks],
  );

  const handleBrainDumpCreated = useCallback((newTasks: Task[]) => {
    setTasks((prev) => [...prev, ...newTasks]);
  }, []);

  const handleFocusTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) setFocusTask(task);
    },
    [tasks],
  );

  const handleFocusComplete = useCallback(
    (taskId: string) => {
      setFocusTask(null);
      handleCompleteTask(taskId);
    },
    [handleCompleteTask],
  );

  const handleSmartSync = useCallback(async () => {
    setSmartSyncing(true);
    try {
      const response = await fetch("/api/ai/smart-sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Smart Sync failed");
        return;
      }

      if (data.daily_summary) {
        setDailySummary(data.daily_summary);
      }

      if (data.tasks?.length > 0) {
        setTasks((prev) => [...prev, ...data.tasks]);
      }

      // Count queued tasks
      const queuedCount = (data.tasks ?? []).filter(
        (t: Task) => t.status === "QUEUED",
      ).length;
      setQueueCount((prev) => prev + queuedCount);

      if (data.synced > 0 || data.queued > 0) {
        toast.success(`${data.synced}개 표시, ${data.queued}개 대기 중`);
      } else {
        toast.info(data.message ?? "새로운 항목이 없어요");
      }
    } catch {
      toast.error("Smart Sync failed");
    } finally {
      setSmartSyncing(false);
    }
  }, []);

  const handleArchiveTask = useCallback(async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "ARCHIVED" as const } : t,
      ),
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (!response.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "COMPLETED" as const } : t,
          ),
        );
        toast.error("Failed to archive task");
        return;
      }

      toast.success("Task archived");
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "COMPLETED" as const } : t,
        ),
      );
      toast.error("Failed to archive task");
    }
  }, []);

  const handleReviveTask = useCallback(async (taskId: string) => {
    const taskToRevive = tasks.find((t) => t.id === taskId);
    if (!taskToRevive) return;

    // Optimistic update — move back to PENDING with original quadrant
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: "PENDING" as const, completed_at: null }
          : t,
      ),
    );

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PENDING",
          completed_at: null,
        }),
      });

      if (!response.ok) {
        // Revert
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? taskToRevive : t,
          ),
        );
        toast.error("Failed to revive task");
        return;
      }

      const updatedTask: Task = await response.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      );
      toast.success("Task revived! Back in the matrix.");
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? taskToRevive : t,
        ),
      );
      toast.error("Failed to revive task");
    }
  }, [tasks]);

  // Dismiss a QUEUED task — marks DISMISSED so Smart Sync won't import it again
  const handleDismissTask = useCallback(async (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "DISMISSED" as const } : t)),
    );
    setQueueCount((prev) => Math.max(0, prev - 1));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISMISSED" }),
      });

      if (!response.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "QUEUED" as const } : t)),
        );
        setQueueCount((prev) => prev + 1);
        toast.error("삭제 실패");
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "QUEUED" as const } : t)),
      );
      setQueueCount((prev) => prev + 1);
      toast.error("삭제 실패");
    }
  }, []);

  // Dismiss all currently QUEUED tasks at once
  const handleBulkDismissQueue = useCallback(async () => {
    const queued = tasks.filter((t) => t.status === "QUEUED");
    if (queued.length === 0) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.status === "QUEUED" ? { ...t, status: "DISMISSED" as const } : t)),
    );
    setQueueCount(0);

    try {
      await Promise.all(
        queued.map((t) =>
          fetch(`/api/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "DISMISSED" }),
          }),
        ),
      );
      toast.success(`${queued.length}개를 삭제했어요. 다음 싱크에서 제외됩니다.`);
    } catch {
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.status === "DISMISSED" && queued.some((q) => q.id === t.id) ? { ...t, status: "QUEUED" as const } : t)),
      );
      setQueueCount(queued.length);
      toast.error("일괄 삭제 실패");
    }
  }, [tasks]);

  // Manually promote a QUEUED task to PENDING (add to matrix)
  const handlePromoteTask = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "PENDING" as const } : t)),
    );
    setQueueCount((prev) => Math.max(0, prev - 1));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING" }),
      });

      if (!response.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "QUEUED" as const } : t)),
        );
        setQueueCount((prev) => prev + 1);
        toast.error("매트릭스에 추가 실패");
        return;
      }

      toast.success("매트릭스에 추가했어요!");
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "QUEUED" as const } : t)),
      );
      setQueueCount((prev) => prev + 1);
      toast.error("매트릭스에 추가 실패");
    }
  }, [tasks]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={{
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
        }}
      />

      <CompletionReward
        triggerCount={completionCount}
        streakCount={currentStreak}
      />

      {focusTask ? (
        <FocusTimer
          task={focusTask}
          onComplete={handleFocusComplete}
          onClose={() => setFocusTask(null)}
        />
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
              <span
                title={
                  realtimeStatus === "connected"
                    ? "Real-time sync active"
                    : realtimeStatus === "connecting"
                      ? "Connecting..."
                      : "Disconnected"
                }
              >
                {realtimeStatus === "connected" ? (
                  <Wifi className="size-4 text-green-500" />
                ) : realtimeStatus === "connecting" ? (
                  <Wifi className="size-4 animate-pulse text-yellow-500" />
                ) : (
                  <WifiOff className="size-4 text-destructive" />
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage your tasks with the Eisenhower Matrix
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StreakDisplay currentStreak={currentStreak} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSmartSync}
              disabled={smartSyncing}
              className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border-violet-500/30 hover:from-violet-500/20 hover:to-blue-500/20"
            >
              {smartSyncing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-violet-500" />
              )}
              <span>Smart Sync</span>
            </Button>
            <Button onClick={() => handleCreateTask("UNCLASSIFIED")}>
              <Plus className="size-4" />
              <span>Add Task</span>
            </Button>
          </div>
        </div>

        {dailySummary ? (
          <Card className="mb-6 border-violet-500/20 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20">
            <div className="flex items-start gap-3 px-4 py-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-violet-500" />
              <div>
                <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-400">
                  AI Coach
                </h3>
                <p className="text-sm text-muted-foreground">{dailySummary}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto shrink-0"
                onClick={() => setDailySummary(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </Card>
        ) : null}

        {/* ADHD Quick Actions */}
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Top3Panel
            onTaskFocus={handleFocusTask}
            onTaskComplete={handleCompleteTask}
          />
          <div className="space-y-4">
            <BrainDump onTasksCreated={handleBrainDumpCreated} />
          </div>
        </div>

        <Tabs defaultValue="matrix">
          <TabsList>
            <TabsTrigger value="matrix">매트릭스</TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              <Clock className="size-3.5" />
              대기 중
              {queuedTasks.length > 0 && (
                <span className="ml-1 rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                  {queuedTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              완료 ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="mt-4">
            <EisenhowerMatrix
              tasks={tasks}
              queueCount={queueCount}
              onTaskComplete={handleCompleteTask}
              onTaskEdit={handleEditTask}
              onTaskDelete={handleDeleteTask}
              onTaskMove={handleTaskMove}
              onCreateTask={handleCreateTask}
            />
          </TabsContent>

          <TabsContent value="queue" className="mt-4">
            {queuedTasks.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-8 text-center">
                <Clock className="mb-2 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  대기 중인 항목이 없어요
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Smart Sync를 실행하면 AI가 중요한 항목을 여기에 모아둬요
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">
                    AI 코치가 중요도 순으로 정리했어요. 준비되면 매트릭스에 추가하세요.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDismissQueue}
                    className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3" />
                    전체 삭제
                  </Button>
                </div>
                {queuedTasks.map((task) => {
                  const quadrantColors: Record<string, string> = {
                    Q1: "bg-red-50 border-red-200 text-red-700",
                    Q2: "bg-blue-50 border-blue-200 text-blue-700",
                    Q3: "bg-yellow-50 border-yellow-200 text-yellow-700",
                    Q4: "bg-green-50 border-green-200 text-green-700",
                    UNCLASSIFIED: "bg-gray-50 border-gray-200 text-gray-600",
                  };
                  const quadrantLabels: Record<string, string> = {
                    Q1: "즉시 처리",
                    Q2: "계획",
                    Q3: "위임",
                    Q4: "여유시간",
                    UNCLASSIFIED: "미분류",
                  };
                  const colorClass = quadrantColors[task.quadrant ?? "UNCLASSIFIED"] ?? quadrantColors.UNCLASSIFIED;
                  const quadrantLabel = quadrantLabels[task.quadrant ?? "UNCLASSIFIED"] ?? "미분류";

                  return (
                    <Card key={task.id} size="sm" className="py-3">
                      <div className="flex items-start justify-between gap-3 px-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
                              {task.quadrant} · {quadrantLabel}
                            </span>
                            {task.importance_score != null && (
                              <span className="text-[10px] text-muted-foreground">
                                중요도 {task.importance_score}/10
                              </span>
                            )}
                            {task.estimated_minutes != null && (
                              <span className="text-[10px] text-muted-foreground">
                                약 {task.estimated_minutes}분
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium">{task.title}</p>
                          {task.nudge_message && (
                            <p className="flex items-start gap-1 text-xs text-violet-600">
                              <Brain className="mt-0.5 size-3 shrink-0" />
                              {task.nudge_message}
                            </p>
                          )}
                          {task.ai_reason && (
                            <p className="text-xs text-muted-foreground">{task.ai_reason}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePromoteTask(task.id)}
                            className="gap-1 text-xs border-violet-300 text-violet-600 hover:bg-violet-50"
                          >
                            <ArrowUpCircle className="size-3.5" />
                            추가
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDismissTask(task.id)}
                            aria-label="무시"
                            title="삭제 — 다음 싱크에서 제외"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completedTasks.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="mb-2 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  완료한 일이 없어요
                </p>
                <p className="text-xs text-muted-foreground/70">
                  매트릭스에서 완료한 항목이 여기에 쌓여요
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <Card key={task.id} size="sm" className="py-2.5 opacity-75">
                    <div className="flex items-center justify-between px-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium line-through">
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          완료{" "}
                          {task.completed_at
                            ? formatDistanceToNow(new Date(task.completed_at), {
                                addSuffix: true,
                              })
                            : "방금"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleReviveTask(task.id)}
                          aria-label="다시 활성화"
                          title="매트릭스로 되살리기"
                        >
                          <RotateCcw className="size-3.5 text-violet-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleArchiveTask(task.id)}
                          aria-label="보관"
                          title="보관"
                        >
                          <Archive className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultQuadrant={defaultQuadrant}
        onSave={handleSaveTask}
      />
    </div>
  );
}
