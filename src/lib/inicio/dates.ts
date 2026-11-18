/** Datas da tela inicial: tudo em dia de calendário (YYYY-MM-DD), no horário de Brasília. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayInBrasilia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Dias de `today` até o próximo aniversário de `date` (0 = hoje). Quem nasceu
 * em 29/02 comemora em 28/02 nos anos sem dia 29. Data inválida devolve null.
 */
export function daysUntilAnniversary(date: string, today: string): number | null {
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const year = Number(today.slice(0, 4));
  if (!month || !day || !year || month > 12 || day > 31) return null;
  const todayMs = utcDay(year, Number(today.slice(5, 7)), Number(today.slice(8, 10)));
  const inYear = (targetYear: number) =>
    utcDay(targetYear, month, month === 2 && day === 29 && !isLeapYear(targetYear) ? 28 : day);
  const next = inYear(year) >= todayMs ? inYear(year) : inYear(year + 1);
  return Math.round((next - todayMs) / DAY_MS);
}

/** Dias corridos entre duas datas (positivo quando `to` é depois). */
export function daysBetween(from: string, to: string): number {
  const ms = (iso: string) => utcDay(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10)));
  return Math.round((ms(to) - ms(from)) / DAY_MS);
}

/** "2 anos e 3 meses", "8 meses", "menos de 1 mês". */
export function tenureLabel(admissionDate: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(admissionDate) || admissionDate > today) return null;
  let months =
    (Number(today.slice(0, 4)) - Number(admissionDate.slice(0, 4))) * 12 +
    (Number(today.slice(5, 7)) - Number(admissionDate.slice(5, 7)));
  if (Number(today.slice(8, 10)) < Number(admissionDate.slice(8, 10))) months -= 1;
  if (months < 1) return "menos de 1 mês";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsText = years > 0 ? `${years} ${years === 1 ? "ano" : "anos"}` : "";
  const monthsText = rest > 0 ? `${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return [yearsText, monthsText].filter(Boolean).join(" e ");
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "17 dez" (com o ano quando não é o de `today`). */
export function shortDate(iso: string, today?: string): string {
  const label = `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ""}`;
  return today && iso.slice(0, 4) !== today.slice(0, 4) ? `${label} ${iso.slice(0, 4)}` : label;
}

/** "Bom dia" até 11h59, "Boa tarde" até 17h59, depois "Boa noite" (horário de Brasília). */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now)
  );
  if (hour < 12) return "Bom dia";
  return hour < 18 ? "Boa tarde" : "Boa noite";
}
