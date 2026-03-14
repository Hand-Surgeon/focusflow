"use client";

import { cn } from "@/lib/utils";
import {
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  BatteryWarning,
} from "lucide-react";

interface EnergyIndicatorProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

function getEnergyColor(level: number): string {
  if (level <= 2) return "text-green-500";
  if (level === 3) return "text-yellow-500";
  if (level === 4) return "text-orange-500";
  return "text-red-500";
}

function getEnergyIcon(
  level: number,
): React.ComponentType<{ className?: string }> {
  if (level <= 1) return Battery;
  if (level === 2) return BatteryLow;
  if (level === 3) return BatteryMedium;
  if (level === 4) return BatteryWarning;
  return BatteryFull;
}

function getEnergyLabel(level: number): string {
  const labels: Record<number, string> = {
    1: "Very Low",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Very High",
  };
  return labels[level] ?? "Unknown";
}

export function EnergyIndicator({
  level,
  size = "md",
  showLabel = false,
}: EnergyIndicatorProps): React.JSX.Element {
  const clampedLevel = Math.max(1, Math.min(5, Math.round(level)));
  const color = getEnergyColor(clampedLevel);
  const Icon = getEnergyIcon(clampedLevel);
  const iconSize = sizeMap[size] ?? sizeMap.md;

  return (
    <div
      className={cn("inline-flex items-center gap-1", color)}
      aria-label={`Energy cost: ${clampedLevel} out of 5 - ${getEnergyLabel(clampedLevel)}`}
    >
      <Icon className={iconSize} />
      <span className="text-xs font-medium">{clampedLevel}</span>
      {showLabel && (
        <span className="text-xs font-medium">
          {getEnergyLabel(clampedLevel)}
        </span>
      )}
    </div>
  );
}

interface EnergySelectProps {
  value: number;
  onChange: (value: number) => void;
}

export function EnergySelect({
  value,
  onChange,
}: EnergySelectProps): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Energy cost"
    >
      {[1, 2, 3, 4, 5].map((level) => {
        const color = getEnergyColor(level);
        const Icon = getEnergyIcon(level);
        const isSelected = value === level;

        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`Energy ${level}: ${getEnergyLabel(level)}`}
            onClick={() => onChange(level)}
            className={cn(
              "flex items-center justify-center rounded-md p-1.5 transition-all",
              isSelected
                ? cn(color, "bg-muted ring-1 ring-current")
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-5" />
          </button>
        );
      })}
    </div>
  );
}
