"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlarmClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatElapsedLabel, resolveChosenEnd, timerDayOptions } from "@/lib/timer-rules";

export type TimerEndReason = "pause" | "stop" | "switch";

export interface TimerEndRequest {
  startedAt: string;
  requestTitle: string;
  reason: TimerEndReason;
  /** Solicitação que vai ganhar o cronômetro novo (só em "switch"). */
  nextTitle?: string;
}

/**
 * Pergunta até que horas a pessoa trabalhou quando o cronômetro passou de 4h
 * ou virou o dia. Não sugere horário: o fim real só quem trabalhou sabe.
 */
export function TimerEndDialog({
  request,
  onResolve,
}: {
  request: TimerEndRequest | null;
  /** ISO do fim escolhido, ou null quando a pessoa cancela (o cronômetro segue ligado). */
  onResolve: (endedAt: string | null) => void;
}) {
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Fixa "agora" ao abrir, para os limites não mudarem enquanto a pessoa preenche.
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  const days = useMemo(
    () => (request ? timerDayOptions(request.startedAt, openedAt) : []),
    [request, openedAt]
  );

  useEffect(() => {
    if (!request) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reinicia o formulário a cada pedido novo.
    setOpenedAt(Date.now());
    setDay(timerDayOptions(request.startedAt)[0]?.value ?? "");
    setTime("");
    setError(null);
  }, [request]);

  if (!request) return null;

  const start = new Date(request.startedAt);
  const startLabel = format(start, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR });
  const elapsedLabel = formatElapsedLabel(request.startedAt, openedAt);

  const handleSave = () => {
    const result = resolveChosenEnd(request.startedAt, day, time, Date.now());
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onResolve(result.endedAt);
  };

  const title =
    request.reason === "switch"
      ? "Antes de ligar o novo cronômetro"
      : "Esse cronômetro ficou ligado muito tempo";

  return (
    <Dialog open onOpenChange={(open) => !open && onResolve(null)}>
      <DialogContent className="sm:max-w-md" closeButtonLabel="Cancelar">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              <AlarmClock className="h-5 w-5" aria-hidden />
            </span>
            <DialogTitle className="text-left text-base leading-snug">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-left leading-relaxed">
            O cronômetro de <strong className="font-semibold text-foreground">{request.requestTitle}</strong> está
            ligado desde {startLabel} ({elapsedLabel}). Até que horas você trabalhou nessa tarefa?
            {request.reason === "switch" && request.nextTitle && (
              <>
                {" "}
                Ele fecha nesse horário e o cronômetro de{" "}
                <strong className="font-semibold text-foreground">{request.nextTitle}</strong> começa agora.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="timer-end-day">Dia</Label>
            <Select
              value={day}
              onValueChange={(value) => {
                setDay(value);
                setError(null);
              }}
            >
              <SelectTrigger id="timer-end-day" className="w-full capitalize">
                <SelectValue placeholder="Escolha o dia" />
              </SelectTrigger>
              <SelectContent>
                {days.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="capitalize">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timer-end-time">Até que horas</Label>
            <Input
              id="timer-end-time"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
              className="w-[8.5rem] font-mono tabular-nums"
              autoFocus
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onResolve(new Date().toISOString())}
            className="text-muted-foreground"
          >
            Trabalhei até agora
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onResolve(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave}>
              Salvar horário
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
