"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import type { Task } from "@/types/database";

interface BrainDumpProps {
  onTasksCreated: (tasks: Task[]) => void;
}

export function BrainDump({ onTasksCreated }: BrainDumpProps): React.JSX.Element {
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/ai/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error ?? "Failed to process brain dump");
        return;
      }

      const data: { extracted_count: number; tasks: Task[] } =
        await response.json();
      onTasksCreated(data.tasks);
      setText("");
      setIsExpanded(false);
      toast.success(`${data.extracted_count} tasks extracted!`);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsProcessing(false);
    }
  }, [text, isProcessing, onTasksCreated]);

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full gap-2 border-dashed"
        onClick={() => setIsExpanded(true)}
      >
        <Brain className="size-4" />
        Brain Dump
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Brain className="size-5 text-purple-500" />
        <h3 className="text-sm font-semibold">Brain Dump</h3>
        <span className="text-xs text-muted-foreground">
          Just type everything on your mind. AI will sort it out.
        </span>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Meeting with client tomorrow, need to buy groceries, finish the report by Friday, call dentist, review PR #234..."
        className="mb-3 min-h-[100px] resize-none"
        maxLength={5000}
        autoFocus
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.length}/5000
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setIsExpanded(false);
            }}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!text.trim() || isProcessing}
            className="gap-1.5"
          >
            {isProcessing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {isProcessing ? "Processing..." : "Extract Tasks"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
