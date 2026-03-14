"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Timer,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

interface FocusTimerProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onClose: () => void;
}

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds
const BREAK_DURATION = 5 * 60; // 5 minutes

type TimerPhase = "focus" | "break";

export function FocusTimer({
  task,
  onComplete,
  onClose,
}: FocusTimerProps): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<TimerPhase>("focus");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = phase === "focus" ? FOCUS_DURATION : BREAK_DURATION;
  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && phase === "focus") {
      // Focus session ended - suggest break
      if (typeof window !== "undefined" && "Notification" in window) {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification("Focus session complete!", {
              body: "Great work! Take a 5-minute break.",
              icon: "/favicon.ico",
            });
          }
        });
      }
    }
  }, [timeLeft, phase]);

  const toggleTimer = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(phase === "focus" ? FOCUS_DURATION : BREAK_DURATION);
  }, [phase]);

  const switchPhase = useCallback(() => {
    const newPhase: TimerPhase = phase === "focus" ? "break" : "focus";
    setPhase(newPhase);
    setIsRunning(false);
    setTimeLeft(newPhase === "focus" ? FOCUS_DURATION : BREAK_DURATION);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap
              className={cn(
                "size-5",
                phase === "focus" ? "text-orange-500" : "text-green-500",
              )}
            />
            <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {phase === "focus" ? "Focus Time" : "Break Time"}
            </span>
          </div>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Task info */}
        <div className="mb-6 rounded-lg bg-muted/50 p-3">
          <p className="text-sm font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          ) : null}
        </div>

        {/* Timer display */}
        <div className="mb-6 text-center">
          <p
            className={cn(
              "font-mono text-6xl font-bold tracking-tight",
              phase === "focus" ? "text-foreground" : "text-green-500",
              timeLeft === 0 && "animate-pulse",
            )}
          >
            {formatTime(timeLeft)}
          </p>
          <Progress
            value={progress}
            className="mt-4 h-2"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" onClick={resetTimer}>
            <RotateCcw className="size-4" />
          </Button>

          <Button
            size="lg"
            onClick={toggleTimer}
            className={cn(
              "gap-2 px-8",
              phase === "focus"
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-green-500 hover:bg-green-600",
            )}
          >
            {isRunning ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5" />
            )}
            {isRunning ? "Pause" : "Start"}
          </Button>

          {timeLeft === 0 ? (
            <Button variant="outline" onClick={switchPhase} className="gap-1.5">
              <Timer className="size-4" />
              {phase === "focus" ? "Break" : "Focus"}
            </Button>
          ) : null}
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600"
            onClick={() => onComplete(task.id)}
          >
            Mark Complete
          </Button>
        </div>
      </Card>
    </div>
  );
}
