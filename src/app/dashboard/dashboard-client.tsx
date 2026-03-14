"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, Archive, CheckCircle2, Calendar, Mail, RefreshCw, Wifi, WifiOff } from "lucide-react";
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
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [scanningEmail, setScanningEmail] = useState(false);

  // Derived state
  const completedTasks = tasks
    .filter((t) => t.status === "COMPLETED")
    .sort((a, b) => {
      const aDate = a.completed_at ?? a.updated_at;
      const bDate = b.completed_at ?? b.updated_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

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

  const handleCalendarSync = useCallback(async () => {
    setSyncingCalendar(true);
    try {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Calendar sync failed");
        return;
      }

      if (data.synced > 0 && data.tasks) {
        const newTasks: Task[] = data.tasks;
        setTasks((prev) => [...prev, ...newTasks]);
        toast.success(`${data.synced} calendar events imported`);
      } else {
        toast.info(data.message ?? "No new events to sync");
      }
    } catch {
      toast.error("Calendar sync failed");
    } finally {
      setSyncingCalendar(false);
    }
  }, []);

  const handleEmailScan = useCallback(async () => {
    setScanningEmail(true);
    try {
      const response = await fetch("/api/email/scan", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error ?? "Email scan failed");
        return;
      }

      if (data.created > 0) {
        // Refresh tasks to get the newly created email tasks
        const tasksResponse = await fetch("/api/tasks");
        if (tasksResponse.ok) {
          const allTasks: Task[] = await tasksResponse.json();
          setTasks(allTasks);
        }
        toast.success(`${data.created} emails imported as tasks`);
      } else {
        toast.info(data.message ?? "No new actionable emails");
      }
    } catch {
      toast.error("Email scan failed");
    } finally {
      setScanningEmail(false);
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
              onClick={handleCalendarSync}
              disabled={syncingCalendar}
            >
              {syncingCalendar ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Calendar className="size-4" />
              )}
              <span className="hidden sm:inline">Calendar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailScan}
              disabled={scanningEmail}
            >
              {scanningEmail ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              <span className="hidden sm:inline">Email</span>
            </Button>
            <Button onClick={() => handleCreateTask("UNCLASSIFIED")}>
              <Plus className="size-4" />
              <span>Add Task</span>
            </Button>
          </div>
        </div>

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
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="mt-4">
            <EisenhowerMatrix
              tasks={tasks}
              onTaskComplete={handleCompleteTask}
              onTaskEdit={handleEditTask}
              onTaskDelete={handleDeleteTask}
              onTaskMove={handleTaskMove}
              onCreateTask={handleCreateTask}
            />
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {completedTasks.length === 0 ? (
              <Card className="flex flex-col items-center justify-center p-8 text-center">
                <CheckCircle2 className="mb-2 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No completed tasks yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Complete tasks from your matrix to see them here
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
                          Completed{" "}
                          {task.completed_at
                            ? formatDistanceToNow(new Date(task.completed_at), {
                                addSuffix: true,
                              })
                            : "recently"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleArchiveTask(task.id)}
                        aria-label="Archive task"
                        title="Archive"
                      >
                        <Archive className="size-3.5 text-muted-foreground" />
                      </Button>
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
