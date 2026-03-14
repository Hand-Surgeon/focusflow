"use client";

import { useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";

interface CompletionRewardProps {
  triggerCount: number;
  streakCount: number;
}

export function CompletionReward({
  triggerCount,
  streakCount,
}: CompletionRewardProps): null {
  const lastCount = useRef(triggerCount);

  const fireConfetti = useCallback(() => {
    // Base confetti burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"],
    });

    // Extra celebration for streaks
    if (streakCount >= 3) {
      setTimeout(() => {
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#f97316", "#eab308"],
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#22c55e", "#3b82f6"],
        });
      }, 250);
    }
  }, [streakCount]);

  useEffect(() => {
    if (triggerCount > lastCount.current) {
      fireConfetti();
      lastCount.current = triggerCount;
    }
  }, [triggerCount, fireConfetti]);

  return null;
}

interface StreakDisplayProps {
  currentStreak: number;
}

export function StreakDisplay({
  currentStreak,
}: StreakDisplayProps): React.JSX.Element | null {
  if (currentStreak < 2) return null;

  const getStreakEmoji = (count: number): string => {
    if (count >= 10) return "🔥🔥🔥";
    if (count >= 7) return "🔥🔥";
    if (count >= 3) return "🔥";
    return "⚡";
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
      <span>{getStreakEmoji(currentStreak)}</span>
      <span>{currentStreak} day streak!</span>
    </div>
  );
}
