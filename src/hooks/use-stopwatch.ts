"use client";

import { useEffect, useState } from "react";

function formatStopwatch(startedAt: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(startedAt).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

export function useStopwatch(startedAt: string | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return startedAt ? formatStopwatch(startedAt, now) : "00:00:00";
}
