/**
 * Árvore de tarefas do VIOS (fluxo automático): o que cada tipo de tarefa cria
 * sozinho ao ser criado ou concluído. Vem da tabela vios_fluxos_tarefas do SAMA,
 * que o robô relê toda semana na tela processos-etapas-tree.php do VIOS.
 */

/** Quem o robô coloca em cada tarefa criada junto (mesma regra do sama-rpa). */
export type PapelNoFluxo = "revisor" | "protocolar" | "responsavel";

/** O robô mantém essa pessoa no 3. PROTOCOLAR, junto do responsável. */
export const PESSOA_FIXA_PROTOCOLAR = "Samuel Willian Silva";

/** Um tipo de tarefa na árvore (linha de vios_fluxos_tarefas). */
export interface TipoNaArvore {
  nome: string;
  prazo: string | null;
  criacao: number[];
  conclusao: number[];
}

export interface TarefaDoFluxo {
  id: string;
  nome: string;
  /** Prazo como o VIOS mostra na árvore ("2 dias"). */
  prazo: string | null;
  papel: PapelNoFluxo;
  /** Outras tarefas que esta cria junto (o VIOS encadeia). */
  tambemCria: string[];
  /** Tarefas que esta cria quando for concluída (ex.: 4. VALIDAR PROTOCOLO). */
  aoConcluir: string[];
}

export interface FluxoDaTarefa {
  /** Criadas junto com a tarefa; o robô troca os responsáveis destas. */
  criacao: TarefaDoFluxo[];
  /** Criadas pelo VIOS quando a tarefa for concluída (responsável padrão do VIOS). */
  conclusao: { id: string; nome: string; prazo: string | null }[];
}

/** Dias úteis do Enviar até o Revisar e o Protocolar, conforme o fluxo da tarefa. */
export interface CadeiaDoPrazo {
  revisar: number | null;
  protocolar: number;
}

/** Fluxo padrão (2. REVISAR em 1 dia e 3. PROTOCOLAR em 2): Enviar D-3, Revisar D-2, Protocolar D-1. */
export const CADEIA_PADRAO: CadeiaDoPrazo = { revisar: 1, protocolar: 2 };

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** "2. REVISAR" fica com o revisor, "3. PROTOCOLAR" com o responsável e o Samuel, o resto com o responsável. */
export function papelNoFluxo(nome: string): PapelNoFluxo {
  const n = semAcento(nome);
  if (/^\d+(\.\d+)*\.?\s*-?\s*REVISAR\b/.test(n)) return "revisor";
  if (/^\d+(\.\d+)*\.?\s*-?\s*PROTOCOLAR\b/.test(n)) return "protocolar";
  return "responsavel";
}

/** "2 dias" → 2; sem prazo → null. */
export function diasDoPrazo(prazo: string | null | undefined): number | null {
  const achado = /(\d+)\s*dias?\b/i.exec(prazo ?? "");
  return achado ? Number(achado[1]) : null;
}

/** Fluxo de um tipo de tarefa (id do VIOS); null se o VIOS não cria nada junto nem depois. */
export function montarFluxo(id: string, arvore: Map<number, TipoNaArvore>): FluxoDaTarefa | null {
  const tipo = arvore.get(Number(id));
  if (!tipo) return null;
  const nomeDe = (filho: number) => arvore.get(filho)?.nome ?? `Tipo ${filho}`;
  const criacao = tipo.criacao.map((filho): TarefaDoFluxo => {
    const dados = arvore.get(filho);
    const nome = nomeDe(filho);
    return {
      id: String(filho),
      nome,
      prazo: dados?.prazo ?? null,
      papel: papelNoFluxo(nome),
      tambemCria: (dados?.criacao ?? []).map(nomeDe),
      aoConcluir: (dados?.conclusao ?? []).map(nomeDe),
    };
  });
  const conclusao = tipo.conclusao.map((filho) => ({ id: String(filho), nome: nomeDe(filho), prazo: arvore.get(filho)?.prazo ?? null }));
  return criacao.length || conclusao.length ? { criacao, conclusao } : null;
}

/** Cadeia do Prazo pelo fluxo: null quando o VIOS não cria 3. PROTOCOLAR para a tarefa. */
export function cadeiaDoFluxo(fluxo: FluxoDaTarefa | null | undefined): CadeiaDoPrazo | null {
  const protocolar = fluxo?.criacao.find((tarefa) => tarefa.papel === "protocolar");
  if (!protocolar) return null;
  const revisar = fluxo?.criacao.find((tarefa) => tarefa.papel === "revisor");
  return {
    protocolar: diasDoPrazo(protocolar.prazo) ?? CADEIA_PADRAO.protocolar,
    revisar: revisar ? diasDoPrazo(revisar.prazo) ?? CADEIA_PADRAO.revisar : null,
  };
}
