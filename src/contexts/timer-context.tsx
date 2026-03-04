"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import {
  getActiveTimeEntryForUser,
  startTimeEntry,
  pauseTimeEntry,
  endTimeEntry,
  type TimeEntry,
} from "@/lib/time-entries";

export type TimerStatus = "idle" | "running" | "paused";

interface TimerContextValue {
  activeEntry: TimeEntry | null;
  status: TimerStatus;
  lastRequestId: string | null;
  lastRequestTitle: string;
  /** Time string frozen at the moment of pause (HH:MM:SS) */
  pausedDisplayTime: string;
  isLoading: boolean;
  start: (
    requestId: string,
    taskTitle: string
  ) => Promise<{ data: TimeEntry | null; error: string | null }>;
  pause: (displayTime?: string) => Promise<void>;
  resume: () => Promise<{ data: TimeEntry | null; error: string | null }>;
  stop: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [lastRequestTitle, setLastRequestTitle] = useState<string>("");
  const [pausedDisplayTime, setPausedDisplayTime] = useState<string>("00:00:00");
  const [isLoading, setIsLoading] = useState(false);

  // On mount restore any active session from DB
  useEffect(() => {
    if (!profile?.id) return;
    getActiveTimeEntryForUser(profile.id).then((result) => {
      if (result) {
        setActiveEntry(result.entry);
        setLastRequestId(result.entry.request_id);
        setLastRequestTitle(result.requestTitle);
        setStatus("running");
      }
    });
  }, [profile?.id]);

  const start = useCallback(
    async (requestId: string, taskTitle: string) => {
      if (!profile?.id) return { data: null, error: "Usuário não autenticado" };
      setIsLoading(true);
      const result = await startTimeEntry(requestId, profile.id);
      setIsLoading(false);
      if (!result.error && result.data) {
        setActiveEntry(result.data);
        setLastRequestId(requestId);
        setLastRequestTitle(taskTitle);
        setStatus("running");
        setPausedDisplayTime("00:00:00");
      }
      return result;
    },
    [profile]
  );

  const pause = useCallback(
    async (displayTime?: string) => {
      if (!activeEntry) return;
      setIsLoading(true);
      await pauseTimeEntry(activeEntry.id);
      setIsLoading(false);
      setPausedDisplayTime(displayTime ?? "00:00:00");
      setActiveEntry(null);
      setStatus("paused");
      // lastRequestId + lastRequestTitle stay set so resume() can restart
    },
    [activeEntry]
  );

  const resume = useCallback(async () => {
    if (!lastRequestId || !lastRequestTitle) return { data: null, error: "Nenhuma tarefa pausada" };
    return start(lastRequestId, lastRequestTitle);
  }, [lastRequestId, lastRequestTitle, start]);

  const stop = useCallback(async () => {
    if (activeEntry) {
      setIsLoading(true);
      await endTimeEntry(activeEntry.id);
      setIsLoading(false);
    }
    setActiveEntry(null);
    setLastRequestId(null);
    setLastRequestTitle("");
    setPausedDisplayTime("00:00:00");
    setStatus("idle");
  }, [activeEntry]);

  return (
    <TimerContext.Provider
      value={{
        activeEntry,
        status,
        lastRequestId,
        lastRequestTitle,
        pausedDisplayTime,
        isLoading,
        start,
        pause,
        resume,
        stop,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}
