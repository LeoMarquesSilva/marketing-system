"use client";

import { useState, useEffect } from "react";

function formatStopwatch(startedAt: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

export function useStopwatch(startedAt: string | null): string {
  const [display, setDisplay] = useState(() =>
    startedAt ? formatStopwatch(startedAt) : "00:00:00"
  );

  useEffect(() => {
    if (!startedAt) {
      setDisplay("00:00:00");
      return;
    }
    setDisplay(formatStopwatch(startedAt));
    const interval = setInterval(() => {
      setDisplay(formatStopwatch(startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return display;
}
