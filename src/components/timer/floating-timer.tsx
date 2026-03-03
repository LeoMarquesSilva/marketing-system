"use client";

import { useState } from "react";
import { Pause, Square, Play, ChevronDown, ChevronUp } from "lucide-react";
import { useTimer } from "@/contexts/timer-context";
import { useStopwatch } from "@/hooks/use-stopwatch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FloatingTimer() {
  const { activeEntry, status, lastRequestTitle, pausedDisplayTime, isLoading, pause, resume, stop } =
    useTimer();
  const liveElapsed = useStopwatch(activeEntry?.started_at ?? null);
  const [collapsed, setCollapsed] = useState(false);

  // Visible when running or paused
  if (status === "idle") return null;

  const isRunning = status === "running";
  const displayTime = isRunning ? liveElapsed : pausedDisplayTime;

  const handlePause = async () => {
    // Pass the current live elapsed so the frozen display is accurate
    await pause(liveElapsed);
  };

  return (
    <div
      className={cn(
        "fixed bottom-5 right-5 z-50",
        "flex flex-col overflow-hidden",
        "rounded-2xl border",
        isRunning
          ? "border-emerald-300/40 dark:border-emerald-700/30"
          : "border-amber-300/40 dark:border-amber-700/30",
        "bg-white/95 dark:bg-[#101f2e]/95 backdrop-blur-xl",
        "shadow-[0_8px_32px_-4px_rgba(16,31,46,0.22),0_0_0_1px_rgba(16,31,46,0.06)]",
        "transition-all duration-300 ease-out",
        "min-w-[230px]"
      )}
      role="status"
      aria-label="Cronômetro de tarefa"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        {/* Status dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {isRunning && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              isRunning ? "bg-emerald-500" : "bg-amber-400"
            )}
          />
        </span>

        <div className="flex flex-1 flex-col min-w-0">
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wider leading-none mb-0.5",
              isRunning
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {isRunning ? "Registrando" : "Pausado"}
          </span>
          <span className="text-xs font-semibold text-foreground truncate leading-tight">
            {lastRequestTitle || "Tarefa"}
          </span>
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          aria-label={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-black/5 dark:border-white/10 px-4 py-3 flex items-center gap-3">
          {/* Time display */}
          <span
            className={cn(
              "font-mono text-xl font-bold tabular-nums flex-1",
              isRunning
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300"
            )}
          >
            {displayTime}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {isRunning ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-xl text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                onClick={handlePause}
                disabled={isLoading}
                aria-label="Pausar"
                title="Pausar"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-xl text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                onClick={resume}
                disabled={isLoading}
                aria-label="Retomar"
                title="Retomar"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={stop}
              disabled={isLoading}
              aria-label="Finalizar registro"
              title="Finalizar"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
