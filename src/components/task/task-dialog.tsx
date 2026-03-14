"use client";

import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EnergySelect } from "@/components/task/energy-indicator";
import type { Task, TaskQuadrant } from "@/types/database";

const TaskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  quadrant: z.enum(["Q1", "Q2", "Q3", "Q4", "UNCLASSIFIED"]),
  energy_cost: z.number().int().min(1).max(5),
  due_date: z.string().optional(),
});

export type TaskFormData = z.infer<typeof TaskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultQuadrant?: TaskQuadrant;
  onSave: (data: TaskFormData) => void;
}

const quadrantOptions: {
  value: TaskQuadrant;
  label: string;
  color: string;
  activeColor: string;
}[] = [
  {
    value: "Q1",
    label: "Q1: Do First",
    color: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400",
    activeColor:
      "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500 dark:bg-red-950/30 dark:text-red-400",
  },
  {
    value: "Q2",
    label: "Q2: Schedule",
    color:
      "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400",
    activeColor:
      "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500 dark:bg-blue-950/30 dark:text-blue-400",
  },
  {
    value: "Q3",
    label: "Q3: Delegate",
    color:
      "border-yellow-300 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400",
    activeColor:
      "border-yellow-500 bg-yellow-50 text-yellow-700 ring-1 ring-yellow-500 dark:bg-yellow-950/30 dark:text-yellow-400",
  },
  {
    value: "Q4",
    label: "Q4: Eliminate",
    color:
      "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400",
    activeColor:
      "border-gray-500 bg-gray-50 text-gray-700 ring-1 ring-gray-500 dark:bg-gray-900/30 dark:text-gray-400",
  },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultQuadrant,
  onSave,
}: TaskDialogProps): React.JSX.Element {
  const isEditMode = Boolean(task);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quadrant, setQuadrant] = useState<TaskQuadrant>("UNCLASSIFIED");
  const [energyCost, setEnergyCost] = useState(3);
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = useCallback(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setQuadrant(task.quadrant);
      setEnergyCost(task.energy_cost);
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
    } else {
      setTitle("");
      setDescription("");
      setQuadrant(defaultQuadrant ?? "UNCLASSIFIED");
      setEnergyCost(3);
      setDueDate("");
    }
    setErrors({});
  }, [task, defaultQuadrant]);

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, resetForm]);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();

    const formData = {
      title: title.trim(),
      description: description.trim() || undefined,
      quadrant,
      energy_cost: energyCost,
      due_date: dueDate || undefined,
    };

    const result = TaskFormSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    onSave(result.data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your task details below."
              : "Create a new task to add to your matrix."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors((prev) => ({ ...prev, title: "" }));
                }
              }}
              aria-invalid={Boolean(errors.title)}
              autoFocus
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title}</p>
            ) : null}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="task-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="task-description"
              placeholder="Add details (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Quadrant - Color buttons */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quadrant</label>
            <div className="grid grid-cols-2 gap-2">
              {quadrantOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setQuadrant(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all",
                    quadrant === opt.value ? opt.activeColor : opt.color,
                    "hover:opacity-80",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Energy Cost */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Energy Cost</label>
            <EnergySelect value={energyCost} onChange={setEnergyCost} />
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label htmlFor="task-due-date" className="text-sm font-medium">
              Due Date
            </label>
            <Input
              id="task-due-date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEditMode ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
