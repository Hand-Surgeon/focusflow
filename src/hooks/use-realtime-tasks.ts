"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/types/database";

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

interface UseRealtimeTasksOptions {
  userId: string;
  onInsert?: (task: Task) => void;
  onUpdate?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

export function useRealtimeTasks({
  userId,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeTasksOptions): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>["channel"]
  > | null>(null);

  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  // Keep refs current without re-subscribing
  useEffect(() => {
    onInsertRef.current = onInsert;
  }, [onInsert]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`tasks:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onInsertRef.current?.(payload.new as Task);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onUpdateRef.current?.(payload.new as Task);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id;
          if (deletedId) onDeleteRef.current?.(deletedId);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setStatus("disconnected");
        } else {
          setStatus("connecting");
        }
      });

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return status;
}

export function useRealtimeTaskState(
  initialTasks: Task[],
  userId: string,
): {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  realtimeStatus: RealtimeStatus;
} {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleInsert = useCallback((task: Task) => {
    setTasks((prev) => {
      // Avoid duplicate if optimistic update already added it
      if (prev.some((t) => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  const handleUpdate = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }, []);

  const handleDelete = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const realtimeStatus = useRealtimeTasks({
    userId,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  });

  return { tasks, setTasks, realtimeStatus };
}
