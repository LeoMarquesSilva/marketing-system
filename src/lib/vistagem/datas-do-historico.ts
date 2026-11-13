/**
 * Datas dos históricos da Vistagem (da publicação e das Configurações): agrupados por dia, no horário de São Paulo,
 * com "Hoje" e "Ontem" no título do dia.
 */
const FUSO = "America/Sao_Paulo";

/** Dia do momento (AAAA-MM-DD), em São Paulo. */
export function diaDoMomento(momento: string | number): string {
  return new Date(momento).toLocaleDateString("sv-SE", { timeZone: FUSO });
}

/** Hora do momento ("14:49"), em São Paulo. */
export function horaDoMomento(momento: string | number): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(new Date(momento));
}

/** Data e hora completas ("13/11/2026, 14:49"), para o título ao passar o mouse. */
export function dataHoraDoMomento(momento: string | number): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(momento)
  );
}

/** "Hoje · sexta-feira, 13/11", "Ontem · quinta-feira, 12/11" ou "quarta-feira, 11/11". `agora` em milissegundos. */
export function tituloDoDia(dia: string, agora: number): string {
  const [ano, mes, numero] = dia.split("-").map(Number);
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(ano, mes - 1, numero)));
  const data = `${semana}, ${String(numero).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
  if (dia === diaDoMomento(agora)) return `Hoje · ${data}`;
  if (dia === diaDoMomento(agora - 86_400_000)) return `Ontem · ${data}`;
  return data;
}

/** Itens em ordem agrupados pelo dia do momento de cada um, na mesma ordem. */
export function agruparPorDia<T>(itens: T[], momento: (item: T) => string): [string, T[]][] {
  const dias = new Map<string, T[]>();
  for (const item of itens) {
    const dia = diaDoMomento(momento(item));
    dias.set(dia, [...(dias.get(dia) ?? []), item]);
  }
  return [...dias.entries()];
}
