import { mesmoHorario } from "./agenda";
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
 */

export const JANELA_DIAS = 120;
const DIA_MS = 24 * 60 * 60 * 1000;
const PESO_STATUS: Record<AudienciaNoVios["status"], number> = { aberta: 0, concluida: 1, cancelada: 2 };

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

export function conferirPautaComVios(audiencias: Audiencia[], tarefas: AudienciaNoVios[], agora: Date): ResultadoDaConferencia {
  const auds = audiencias.filter((a) => a.situacao === "designada" || a.situacao === "cancelada");
  const porCnj = new Map<string, AudienciaNoVios[]>();
  for (const t of tarefas) porCnj.set(t.cnj, [...(porCnj.get(t.cnj) ?? []), t]);

  const candidatos: { a: Audiencia; t: AudienciaNoVios; chave: number[] }[] = [];
  for (const a of auds) {
    for (const t of porCnj.get(a.cnj) ?? []) {
      const distancia = Math.abs(new Date(a.inicio).getTime() - new Date(t.inicio).getTime());
      if (distancia > JANELA_DIAS * DIA_MS) continue;
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

  const tribunais = new Set(audiencias.map((a) => a.tribunal).filter(Boolean));
  const soNoVios = tarefas
    .filter((t) => !usadas.has(t.tarefaCi) && t.status === "aberta" && new Date(t.inicio).getTime() >= agora.getTime())
    .filter((t) => tribunais.has(tribunalDoCnj(t.cnj)))
    .sort((x, y) => x.inicio.localeCompare(y.inicio));
  return { tarefaDa, soNoVios };
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
