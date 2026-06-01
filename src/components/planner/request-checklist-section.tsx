"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  toggleChecklistItem,
  type ChecklistItem,
} from "@/lib/request-checklist";

interface RequestChecklistSectionProps {
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  userId: string | null;
  sectionClass: string;
  sectionTitleClass: string;
}

export function RequestChecklistSection({
  items,
  onItemsChange,
  userId,
  sectionClass,
  sectionTitleClass,
}: RequestChecklistSectionProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const completedCount = items.filter((i) => i.completed_at).length;
  const total = items.length;
  const allDone = completedCount === total;

  const handleToggle = async (item: ChecklistItem) => {
    const nextCompleted = !item.completed_at;
    setTogglingId(item.id);
    const { error } = await toggleChecklistItem(item.id, nextCompleted, userId);
    setTogglingId(null);
    if (error) return;

    onItemsChange(
      items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              completed_at: nextCompleted ? new Date().toISOString() : null,
              completed_by_id: nextCompleted ? userId : null,
            }
          : i
      )
    );
  };

  return (
    <section aria-labelledby="checklist-heading" className={sectionClass}>
      <div className="flex items-center justify-between gap-2">
        <h4 id="checklist-heading" className={`${sectionTitleClass} flex items-center gap-2`}>
          <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
          Checklist
        </h4>
        <span
          className={cn(
            "text-xs font-medium rounded-full px-2 py-0.5",
            allDone
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {completedCount}/{total}
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const done = !!item.completed_at;
          const busy = togglingId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleToggle(item)}
                disabled={busy}
                className={cn(
                  "w-full flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors border",
                  done
                    ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/30 text-muted-foreground"
                    : "bg-white/50 dark:bg-background/40 border-white/30 dark:border-border/30 hover:bg-muted/40",
                  busy && "opacity-60"
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" aria-hidden />
                )}
                <span className={cn(done && "line-through opacity-80")}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}