/** Formatação de números das telas de Métricas (pt-BR). */

const intFormatter = new Intl.NumberFormat("pt-BR");
const compactFormatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return intFormatter.format(Math.round(value));
}

/** 1.234 → "1,2 mil"; abaixo de 10 mil mostra o número inteiro. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 10_000) return formatInt(value);
  return compactFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

/** Variação % entre dois valores. null quando não há base (sem histórico). */
export function deltaPercent(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDelta(delta: number | null, digits = 0): string {
  if (delta === null || Number.isNaN(delta)) return "sem histórico";
  if (Math.abs(delta) < 0.5 && digits === 0) return "estável";
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

export function formatSigned(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatInt(Math.abs(value))}`;
}

/** "agora", "há 25 min", "há 3 h", "há 2 dias". */
export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "nunca";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Segundos (tempo de Reels) → "12 s" / "1 min 05 s". */
export function formatSeconds(ms: number | null | undefined): string {
  if (!ms) return "—";
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, "0")} s`;
}
