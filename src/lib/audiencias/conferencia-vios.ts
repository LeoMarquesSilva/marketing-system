import { local, mesmoHorario } from "./agenda";
import type { Audiencia, Mudanca } from "./tipos";
import type { AudienciaNoVios } from "./vios-csv";

/**
 * Conferência da pauta do PJe com as tarefas de audiência do VIOS, sem banco: cada audiência fica com no máximo
 * uma tarefa e cada tarefa com no máximo uma audiência. O PJe manda; o VIOS confere.
 *
 * Ordem do casamento, dentro do mesmo processo (CNJ) e a até 120 dias de distância:
 * 1. audiências designadas antes das canceladas (numa redesignação, a tarefa velha vai para a data nova e o
 *    alerta aparece onde a equipe vai agir);
 * 2. tarefas abertas antes das concluídas e das canceladas;
 * 3. mesmo horário antes de horário diferente;
 * 4. a mais próxima.
 * Tarefa concluída ou cancelada só casa com audiência do mesmo dia: em outro dia ela é a audiência anterior, que já
 * aconteceu ou foi redesignada (26/11/2026: a instrução de 09/12 do 0012457-97 casava com a tarefa da de 23/11, já
 * concluída, e mostrava "concluída no VIOS" em vez de "não está agendada no VIOS").
 * Perícia só casa com perícia e sessão só com sessão (27/11/2026: a instrução de 11/12 do 1001581-71 tomava a tarefa
 * PERÍCIA de 04/12, e a perícia não entrava na pauta como "a confirmar").
 */

export const JANELA_DIAS = 120;
const DIA_MS = 24 * 60 * 60 * 1000;
const PESO_STATUS: Record<AudienciaNoVios["status"], number> = { aberta: 0, concluida: 1, cancelada: 2 };

function grupoDoTipo(tipo: Audiencia["tipo"]): string {
  return tipo === "sessao" || tipo === "pericia" ? tipo : "audiencia";
}

export interface ResultadoDaConferencia {
  /** Para cada audiência conferida, a tarefa do VIOS que corresponde a ela (null = nenhuma). */
  tarefaDa: Map<string, AudienciaNoVios | null>;
  /** Tarefas abertas e futuras do VIOS, dos tribunais que o robô lê, sem audiência no PJe. */
  soNoVios: AudienciaNoVios[];
}

/** "1234567-89.2025.5.02.0001" → "TRT2"; null fora da Justiça do Trabalho. */
export function tribunalDoCnj(cnj: string): string | null {
  const partes = cnj.split(".");
  if (partes.length !== 5 || partes[2] !== "5") return null;
  const numero = Number(partes[3]);
  return numero > 0 ? `TRT${numero}` : null;
}

/**
 * Até onde o robô leu cada tribunal: a audiência mais distante que ele trouxe do PJe (o robô lê PAUTA_DIAS à frente,
 * 60 por padrão, e o Audiencias.csv vai a 1 ano). Depois disso o PJe nem foi consultado: não é "só no VIOS".
 * (Em 23/11/2026, 293 das 300 listadas como "só no VIOS" eram de depois dos 60 dias.)
 */
export function lidoAtePorTribunal(audiencias: Pick<Audiencia, "tribunal" | "origem" | "inicio">[]): Map<string, string> {
  const lidoAte = new Map<string, string>();
  for (const a of audiencias) {
    if (!a.tribunal || a.origem !== "pje") continue;
    const dia = local(a.inicio).dia;
    if (dia > (lidoAte.get(a.tribunal) ?? "")) lidoAte.set(a.tribunal, dia);
  }
  return lidoAte;
}

export function conferirPautaComVios(audiencias: Audiencia[], tarefas: AudienciaNoVios[], agora: Date): ResultadoDaConferencia {
  const auds = audiencias.filter((a) => a.situacao === "designada" || a.situacao === "cancelada");
  const porCnj = new Map<string, AudienciaNoVios[]>();
  for (const t of tarefas) porCnj.set(t.cnj, [...(porCnj.get(t.cnj) ?? []), t]);

  const candidatos: { a: Audiencia; t: AudienciaNoVios; chave: number[] }[] = [];
  for (const a of auds) {
    for (const t of porCnj.get(a.cnj) ?? []) {
      const distancia = Math.abs(new Date(a.inicio).getTime() - new Date(t.inicio).getTime());
      if (distancia > JANELA_DIAS * DIA_MS) continue;
      if (t.status !== "aberta" && local(t.inicio).dia !== local(a.inicio).dia) continue;
      if (grupoDoTipo(t.tipo) !== grupoDoTipo(a.tipo)) continue;
      candidatos.push({ a, t, chave: [a.situacao === "designada" ? 0 : 1, PESO_STATUS[t.status], mesmoHorario(a.inicio, t.inicio) ? 0 : 1, distancia] });
    }
  }
  candidatos.sort((x, y) => {
    for (let i = 0; i < x.chave.length; i += 1) if (x.chave[i] !== y.chave[i]) return x.chave[i]! - y.chave[i]!;
    return 0;
  });

  const tarefaDa = new Map<string, AudienciaNoVios | null>(auds.map((a) => [a.id, null]));
  const usadas = new Set<string>();
  for (const c of candidatos) {
    if (tarefaDa.get(c.a.id) || usadas.has(c.t.tarefaCi)) continue;
    tarefaDa.set(c.a.id, c.t);
    usadas.add(c.t.tarefaCi);
  }

  const lidoAte = lidoAtePorTribunal(audiencias);
  // O robô lê a Minha Pauta do 1º grau: sessão de julgamento (2º grau) e perícia nunca aparecem nela.
  const soNoVios = tarefas
    .filter((t) => t.tipo !== "sessao" && t.tipo !== "pericia")
    .filter((t) => !usadas.has(t.tarefaCi) && t.status === "aberta" && new Date(t.inicio).getTime() >= agora.getTime())
    .filter((t) => {
      const ate = lidoAte.get(tribunalDoCnj(t.cnj) ?? "");
      return Boolean(ate) && local(t.inicio).dia <= ate!;
    })
    .sort((x, y) => x.inicio.localeCompare(y.inicio));
  return { tarefaDa, soNoVios };
}

/**
 * As audiências designadas que o tribunal (PJe ou Jus.br) tem para cada processo, em ordem de data. Serve para a lista
 * "só no VIOS": a tarefa não casou com nada, mas o processo tem audiência em outra data (ex.: VIOS com 09/12/2026 e o
 * tribunal com 09/12/2027, ano errado no VIOS). Até 3 por processo.
 */
export function datasNoTribunal(audiencias: Pick<Audiencia, "cnj" | "origem" | "situacao" | "inicio">[]): Map<string, string[]> {
  const porCnj = new Map<string, string[]>();
  for (const a of audiencias) {
    if (a.situacao !== "designada" || (a.origem !== "pje" && a.origem !== "jusbr")) continue;
    porCnj.set(a.cnj, [...(porCnj.get(a.cnj) ?? []), a.inicio]);
  }
  for (const [cnj, inicios] of porCnj) porCnj.set(cnj, [...new Set(inicios)].sort().slice(0, 3));
  return porCnj;
}

/** Uma tarefa de uma das fontes do VIOS, com a hora em que a fonte a viu (ms). */
export interface TarefaDaFonte {
  tarefa: AudienciaNoVios;
  em: number;
}

/**
 * Junta as fontes do VIOS: os arquivos do SharePoint (Tarefas.csv, recorte curto; Audiencias.csv, se existir) e a
 * cópia do SAMA (pula tarefas). Nenhuma é completa, então soma todas; para cada CI vale a versão vista por último.
 * (1ª versão tratava o Tarefas.csv como completo e descartava o SAMA: as faltas subiram de 46 para 56 em 23/11.)
 */
export function juntarFontesDoVios(...fontes: TarefaDaFonte[][]): AudienciaNoVios[] {
  const porCi = new Map<string, TarefaDaFonte>();
  for (const fonte of fontes) {
    for (const item of fonte) {
      const atual = porCi.get(item.tarefa.tarefaCi);
      if (!atual || item.em > atual.em) porCi.set(item.tarefa.tarefaCi, item);
    }
  }
  return [...porCi.values()].map((item) => item.tarefa);
}

/**
 * Completa o número do processo das tarefas que vieram sem ele, pela CI do processo (de outras tarefas ou da pauta).
 * As que continuam sem número ficam de fora (não há como casar com o PJe).
 */
export function completarCnj(tarefas: AudienciaNoVios[], cnjPorCiProcesso: Map<string, string>): { tarefas: AudienciaNoVios[]; semCnj: number } {
  const saida: AudienciaNoVios[] = [];
  let semCnj = 0;
  for (const t of tarefas) {
    if (t.cnj) saida.push(t);
    else {
      const cnj = t.ciProcesso ? cnjPorCiProcesso.get(t.ciProcesso) : undefined;
      if (cnj) saida.push({ ...t, cnj });
      else semCnj += 1;
    }
  }
  return { tarefas: saida, semCnj };
}

/**
 * Mudança do PJe que o VIOS já mostra resolvida: horário novo já no VIOS, ou cancelada e sem tarefa aberta. Tipo,
 * vara e link o VIOS não mostra, então continuam pedindo "Conferido no VIOS".
 */
export function mudancaResolvidaNoVios(aud: Pick<Audiencia, "situacao" | "inicio" | "mudancas" | "mudancaConferidaEm">, tarefa: AudienciaNoVios | null): boolean {
  if (aud.mudancaConferidaEm || !aud.mudancas.length) return false;
  const soEssas: Mudanca[] = ["horario", "cancelada"];
  if (!aud.mudancas.every((m) => soEssas.includes(m))) return false;
  if (aud.situacao === "cancelada") return !tarefa || tarefa.status !== "aberta";
  return Boolean(tarefa && tarefa.status === "aberta" && mesmoHorario(aud.inicio, tarefa.inicio));
}
