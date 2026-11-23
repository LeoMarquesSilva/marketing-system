import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Regras do cronômetro do Planner para não repetir os cronômetros esquecidos
 * que rodaram a noite toda (5 casos de 18h a 22h, apagados em 16/11/2026).
 */

/** A partir daqui o cronômetro provavelmente foi esquecido ligado. */
export const LONG_TIMER_MS = 4 * 60 * 60 * 1000;

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Passou de 4h ligado ou começou em outro dia: pedir a hora real ao pausar. */
export function isLongRunningTimer(startedAt: string, now: number = Date.now()): boolean {
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return false;
  if (now - start.getTime() >= LONG_TIMER_MS) return true;
  return !sameLocalDay(start, new Date(now));
}

/** Aviso mostrado no cronômetro ao vivo; null enquanto está tudo normal. */
export function longTimerWarning(startedAt: string, now: number = Date.now()): string | null {
  if (!isLongRunningTimer(startedAt, now)) return null;
  const start = new Date(startedAt);
  if (now - start.getTime() >= LONG_TIMER_MS) return "Ligado há mais de 4h. Esqueceu de pausar?";
  return `Ligado desde ${format(start, "dd/MM 'às' HH:mm", { locale: ptBR })}. Esqueceu de pausar?`;
}

/** HH:MM:SS entre o início e um instante. */
export function formatStopwatch(startedAt: string, now: number): string {
  const elapsed = Math.max(0, now - new Date(startedAt).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

/** "21h 46min" entre o início e um instante. */
export function formatElapsedLabel(startedAt: string, now: number): string {
  const totalMinutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

export interface TimerDayOption {
  /** yyyy-MM-dd no fuso do navegador */
  value: string;
  /** "terça, 20/10" */
  label: string;
}

/** Dias possíveis para o fim do registro, do dia do início até hoje. */
export function timerDayOptions(startedAt: string, now: number = Date.now()): TimerDayOption[] {
  const start = new Date(startedAt);
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(now);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const days: TimerDayOption[] = [];
  while (cursor <= last && days.length < 62) {
    days.push({
      value: format(cursor, "yyyy-MM-dd"),
      label: format(cursor, "EEE, dd/MM", { locale: ptBR }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Monta o ended_at a partir do dia e da hora escolhidos, conferindo os limites. */
export function resolveChosenEnd(
  startedAt: string,
  day: string,
  time: string,
  now: number = Date.now()
): { endedAt: string } | { error: string } {
  if (!day || !/^\d{2}:\d{2}$/.test(time)) {
    return { error: "Informe até que horas você trabalhou nessa tarefa." };
  }
  const chosen = new Date(`${day}T${time}:00`);
  if (Number.isNaN(chosen.getTime())) {
    return { error: "Data ou hora inválida." };
  }
  const start = new Date(startedAt);
  if (chosen.getTime() <= start.getTime()) {
    return {
      error: `O horário precisa ser depois do início (${format(start, "dd/MM 'às' HH:mm", { locale: ptBR })}).`,
    };
  }
  if (chosen.getTime() > now) {
    return { error: "O horário não pode ser depois de agora." };
  }
  return { endedAt: chosen.toISOString() };
}
