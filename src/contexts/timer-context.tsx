"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useAuth } from "./auth-context";
import {
  fetchOpenTimeEntriesForUser,
  getActiveTimeEntryForUser,
  startTimeEntry,
  pauseTimeEntry,
  endTimeEntry,
  type TimeEntry,
} from "@/lib/time-entries";
import { formatStopwatch, isLongRunningTimer } from "@/lib/timer-rules";
import {
  TimerEndDialog,
  type TimerEndReason,
  type TimerEndRequest,
} from "@/components/timer/timer-end-dialog";

export type TimerStatus = "idle" | "running" | "paused";

interface TimerNotice {
  type: "success" | "error";
  message: string;
}

interface TimerContextValue {
  activeEntry: TimeEntry | null;
  status: TimerStatus;
  lastRequestId: string | null;
  lastRequestTitle: string;
  /** Time string frozen at the moment of pause (HH:MM:SS) */
  pausedDisplayTime: string;
  isLoading: boolean;
  /**
   * Liga o cronômetro. Um por vez: o que estiver ligado em outra solicitação é
   * pausado antes (com a pergunta da hora real se tiver passado de 4h ou virado o dia).
   */
  start: (
    requestId: string,
    taskTitle: string
  ) => Promise<{ data: TimeEntry | null; error: string | null }>;
  /** Devolve o ended_at gravado, ou null se a pessoa cancelou (o cronômetro segue ligado). */
  pause: () => Promise<string | null>;
  resume: () => Promise<{ data: TimeEntry | null; error: string | null }>;
  /** Devolve o ended_at gravado, ou null se não havia registro ligado ou a pessoa cancelou. */
  stop: () => Promise<string | null>;
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
  const [endRequest, setEndRequest] = useState<TimerEndRequest | null>(null);
  const endResolver = useRef<((endedAt: string | null) => void) | null>(null);
  const [notice, setNotice] = useState<TimerNotice | null>(null);

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

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);

  /** Fim do registro: agora, ou o horário que a pessoa informar se o cronômetro ficou ligado demais. */
  const chooseEndTime = useCallback(
    (
      entry: TimeEntry,
      requestTitle: string,
      reason: TimerEndReason,
      nextTitle?: string
    ): Promise<string | null> => {
      if (!isLongRunningTimer(entry.started_at)) {
        return Promise.resolve(new Date().toISOString());
      }
      return new Promise((resolve) => {
        // Pergunta anterior ainda aberta (clique duplo, outra aba do card): ela conta como cancelada.
        endResolver.current?.(null);
        endResolver.current = resolve;
        setEndRequest({ startedAt: entry.started_at, requestTitle, reason, nextTitle });
      });
    },
    []
  );

  const handleEndResolved = useCallback((endedAt: string | null) => {
    const resolve = endResolver.current;
    endResolver.current = null;
    setEndRequest(null);
    resolve?.(endedAt);
  }, []);

  const start = useCallback(
    async (requestId: string, taskTitle: string) => {
      if (!profile?.id) return { data: null, error: "Usuário não autenticado" };

      setIsLoading(true);
      const open = await fetchOpenTimeEntriesForUser(profile.id);
      setIsLoading(false);

      if (open.some(({ entry }) => entry.request_id === requestId)) {
        return {
          data: null,
          error: "Já existe um registro ativo. Pause ou finalize antes de iniciar.",
        };
      }

      // Um cronômetro por vez: fecha o que estiver ligado em outra solicitação.
      const pausedTitles: string[] = [];
      for (const { entry, requestTitle } of open) {
        const endedAt = await chooseEndTime(entry, requestTitle, "switch", taskTitle);
        if (!endedAt) return { data: null, error: null }; // cancelou: nada muda
        setIsLoading(true);
        const { error } = await pauseTimeEntry(entry.id, endedAt);
        setIsLoading(false);
        if (error) {
          setNotice({ type: "error", message: `Não consegui pausar o cronômetro de “${requestTitle}”.` });
          return { data: null, error };
        }
        pausedTitles.push(requestTitle);
      }

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
      if (pausedTitles.length > 0) {
        setNotice({
          type: "success",
          message:
            pausedTitles.length === 1
              ? `Pausei o cronômetro de “${pausedTitles[0]}”.`
              : `Pausei ${pausedTitles.length} cronômetros que estavam ligados.`,
        });
      }
      return result;
    },
    [profile, chooseEndTime]
  );

  const pause = useCallback(async () => {
    if (!activeEntry) return null;
    const endedAt = await chooseEndTime(activeEntry, lastRequestTitle, "pause");
    if (!endedAt) return null;
    setIsLoading(true);
    const { error } = await pauseTimeEntry(activeEntry.id, endedAt);
    setIsLoading(false);
    if (error) {
      setNotice({ type: "error", message: "Não consegui pausar o cronômetro. Tente de novo." });
      return null;
    }
    setPausedDisplayTime(formatStopwatch(activeEntry.started_at, new Date(endedAt).getTime()));
    setActiveEntry(null);
    setStatus("paused");
    // lastRequestId + lastRequestTitle stay set so resume() can restart
    return endedAt;
  }, [activeEntry, lastRequestTitle, chooseEndTime]);

  const resume = useCallback(async () => {
    if (!lastRequestId || !lastRequestTitle) return { data: null, error: "Nenhuma tarefa pausada" };
    return start(lastRequestId, lastRequestTitle);
  }, [lastRequestId, lastRequestTitle, start]);

  const stop = useCallback(async () => {
    let endedAt: string | null = null;
    if (activeEntry) {
      endedAt = await chooseEndTime(activeEntry, lastRequestTitle, "stop");
      if (!endedAt) return null;
      setIsLoading(true);
      const { error } = await endTimeEntry(activeEntry.id, endedAt);
      setIsLoading(false);
      if (error) {
        setNotice({ type: "error", message: "Não consegui finalizar o cronômetro. Tente de novo." });
        return null;
      }
    }
    setActiveEntry(null);
    setLastRequestId(null);
    setLastRequestTitle("");
    setPausedDisplayTime("00:00:00");
    setStatus("idle");
    return endedAt;
  }, [activeEntry, lastRequestTitle, chooseEndTime]);

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
      <TimerEndDialog request={endRequest} onResolve={handleEndResolved} />
      {notice && (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={`fixed left-1/2 top-4 z-[80] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-start gap-3 rounded-md border bg-white px-4 py-3 text-sm shadow-xl dark:bg-[#04202f] ${
            notice.type === "success"
              ? "border-emerald-200 text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-200"
              : "border-red-200 text-red-900 dark:border-red-800/60 dark:text-red-200"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          )}
          <span className="min-w-0 flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Fechar aviso"
            className="rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}
