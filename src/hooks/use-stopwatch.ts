"use client";

import { useEffect, useState } from "react";
import { formatStopwatch, longTimerWarning } from "@/lib/timer-rules";

/** Tempo ao vivo (HH:MM:SS) e o aviso de cronômetro esquecido (passou de 4h ou virou o dia). */
export function useStopwatchState(startedAt: string | null): {
  display: string;
  warning: string | null;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return { display: "00:00:00", warning: null };
  return { display: formatStopwatch(startedAt, now), warning: longTimerWarning(startedAt, now) };
}

export function useStopwatch(startedAt: string | null): string {
  return useStopwatchState(startedAt).display;
}
