// Acompanhamento de pautas: mesma regra do SIOE (financeiro-bp, marketingPautas.ts).
// Pauta = tarefa principal "MATERIAL MARKETING - REELS/POST/ARTIGO" do VIOS;
// conta como entregue quando a tarefa principal é concluída.

export const MARKETING_PAUTA_TASK = "MATERIAL MARKETING - REELS/POST/ARTIGO";
export const PAUTAS_GOAL_PER_MONTH = 10;
const REVIEW_TASK = "2. REVISAR";
const PROTOCOL_TASK = "3. PROTOCOLAR";

export type PautaStage = "aguardando_envio" | "em_revisao" | "em_protocolo" | "finalizada" | "cancelada";

export type SioeTaskRow = {
  ci: number;
  ci_processo: number | null;
  cliente: string | null;
  tarefa: string;
  tarefa_pai: string | null;
  status: string;
  data_conclusao: string | null;
  data_para_conclusao: string | null;
  responsavel: string | null;
  usuario_conclusao: string | null;
  area_conclusao: string | null;
};

export type Pauta = {
  ci: number;
  relatedCis: number[];
  sioeArea: string | null;
  stage: PautaStage;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
};

export type FollowupChannel = "teams" | "email" | "whatsapp" | "pessoalmente" | "outro";

export type FollowupEntry = {
  id: string;
  channel: FollowupChannel;
  note: string | null;
  returnDue: string | null;
  sentAt: string;
  sentByName: string | null;
};

export type FollowupStatus =
  | "cobrar"
  | "retorno_vencido"
  | "aguardando_retorno"
  | "no_prazo"
  | "entregue_apos_cobranca"
  | "entregue";

const clean = (value: string | null | undefined) => value?.trim() || null;
const civil = (value: string | null | undefined) => value?.slice(0, 10) || null;
const is = (row: SioeTaskRow | null, status: string) =>
  row?.status.trim().toLocaleLowerCase("pt-BR") === status.toLocaleLowerCase("pt-BR");

function stageFor(main: SioeTaskRow, review: SioeTaskRow | null, protocol: SioeTaskRow | null): PautaStage {
  if (is(main, "Cancelada")) return "cancelada";
  if (!is(main, "Concluída")) return "aguardando_envio";
  if (review && !is(review, "Concluída") && !is(review, "Cancelada")) return "em_revisao";
  if (protocol && !is(protocol, "Concluída") && !is(protocol, "Cancelada")) return "em_protocolo";
  return "finalizada";
}

export function buildPautas(rows: SioeTaskRow[]): Pauta[] {
  const byProcess = new Map<string, SioeTaskRow[]>();
  for (const row of rows) {
    const key = String(row.ci_processo ?? `sem-processo-${row.ci}`);
    byProcess.set(key, [...(byProcess.get(key) ?? []), row]);
  }
  const pautas: Pauta[] = [];
  for (const processRows of byProcess.values()) {
    const ordered = [...processRows].sort((a, b) => a.ci - b.ci);
    for (let index = 0; index < ordered.length; index += 1) {
      const main = ordered[index];
      if (main.tarefa.trim() !== MARKETING_PAUTA_TASK || clean(main.tarefa_pai)) continue;
      const children: SioeTaskRow[] = [];
      for (let cursor = index + 1; cursor < ordered.length; cursor += 1) {
        const candidate = ordered[cursor];
        if (candidate.tarefa.trim() === MARKETING_PAUTA_TASK && !clean(candidate.tarefa_pai)) break;
        if (candidate.tarefa_pai?.trim() === MARKETING_PAUTA_TASK) children.push(candidate);
      }
      const review = children.find((row) => row.tarefa.trim() === REVIEW_TASK) ?? null;
      const protocol = children.find((row) => row.tarefa.trim() === PROTOCOL_TASK) ?? null;
      const area = clean(main.area_conclusao) || clean(main.cliente);
      pautas.push({
        ci: main.ci,
        relatedCis: [main.ci, ...children.map((row) => row.ci)],
        sioeArea: area ? area.replace(/^Grupo\s+/i, "").replace(/^Área\s+/i, "").trim() : null,
        stage: stageFor(main, review, protocol),
        dueDate: civil(main.data_para_conclusao),
        completedAt: civil(main.data_conclusao),
        completedBy: clean(main.responsavel) || clean(main.usuario_conclusao),
      });
    }
  }
  return pautas.sort((a, b) => a.ci - b.ci);
}

export function isPautaDelivered(pauta: Pauta): boolean {
  return pauta.stage !== "cancelada" && pauta.stage !== "aguardando_envio";
}

export function monthBounds(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

/** Situação da pauta para quem cobra. Entrega segue a regra do SIOE. */
export function followupStatus(pauta: Pauta, followups: FollowupEntry[], today: string): FollowupStatus {
  if (isPautaDelivered(pauta)) {
    const chasedBefore = followups.some(
      (entry) => !pauta.completedAt || entry.sentAt.slice(0, 10) <= pauta.completedAt,
    );
    return chasedBefore ? "entregue_apos_cobranca" : "entregue";
  }
  if (!pauta.dueDate || pauta.dueDate >= today) return followups.length ? "aguardando_retorno" : "no_prazo";
  if (!followups.length) return "cobrar";
  const last = [...followups].sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  if (last.returnDue && last.returnDue < today) return "retorno_vencido";
  return "aguardando_retorno";
}

/** Pautas entregues no mês (data de conclusão da tarefa principal), como no indicador do SIOE. */
export function countDeliveredInMonth(pautas: Pauta[], month: string): number {
  const { start, end } = monthBounds(month);
  return pautas.filter(
    (pauta) => pauta.stage !== "cancelada" && pauta.completedAt && pauta.completedAt >= start && pauta.completedAt <= end,
  ).length;
}

/** Entram no quadro: pautas com prazo no mês e as vencidas de meses anteriores ainda sem entrega. */
export function pautasForBoard(pautas: Pauta[], month: string, today: string): Pauta[] {
  const { start, end } = monthBounds(month);
  return pautas.filter((pauta) => {
    if (pauta.stage === "cancelada" || !pauta.dueDate) return false;
    if (pauta.dueDate >= start && pauta.dueDate <= end) return true;
    if (pauta.completedAt && pauta.completedAt >= start && pauta.completedAt <= end) return true;
    return pauta.stage === "aguardando_envio" && pauta.dueDate < start && pauta.dueDate < today;
  });
}
