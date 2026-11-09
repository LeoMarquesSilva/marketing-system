/**
 * Árvore de tarefas do VIOS (fluxo automático): o que cada tipo de tarefa cria
 * sozinho ao ser criado ou concluído. Vem da tabela vios_fluxos_tarefas do SAMA,
 * que o robô relê toda semana na tela processos-etapas-tree.php do VIOS.
 */

import type { EtiquetaAgendamento } from "./agendamento";

/** Quem o robô coloca em cada tarefa criada junto (mesma regra do sama-rpa). */
export type PapelNoFluxo = "revisor" | "protocolar" | "responsavel";

/** O robô mantém essa pessoa no 3. PROTOCOLAR, junto do responsável. */
export const PESSOA_FIXA_PROTOCOLAR = "Samuel Willian Silva";

/**
 * De onde a tarefa filha conta a data (aba "Fluxo Automático - Criação" do tipo pai no VIOS): do dia em que
 * o VIOS a cria (atual), da data para conclusão da tarefa pai (pai) ou da data base da tarefa pai (pai_base).
 */
export type BaseDaData = "atual" | "pai" | "pai_base" | "outro";

/** Aba "Prazos" do tipo no VIOS: N dias, "Prazo Negativo" (conta para trás) e dias úteis ou corridos. */
export interface RegraDePrazo {
  dias: number;
  negativo: boolean;
  corridos: boolean;
}

/** Um tipo de tarefa na árvore (linha de vios_fluxos_tarefas). */
export interface TipoNaArvore {
  nome: string;
  prazo: string | null;
  criacao: number[];
  conclusao: number[];
  /** Null: o robô ainda não leu a aba Prazos deste tipo. */
  regraPrazo?: RegraDePrazo | null;
  /** De onde cada filha (id) conta a data; null: o robô ainda não leu a aba de criação. */
  baseDasFilhas?: Map<number, BaseDaData> | null;
  /** Quem o VIOS põe nas tarefas do tipo (SAMA vios_tipos_tarefa); null: o catálogo não leu. */
  responsabilidade?: ResponsabilidadeDoTipo | null;
  /** Prazo, Providência ou Compromisso pelas etiquetas do tipo (vios_tipos_tarefa); null: sem etiqueta de classe. */
  classe?: EtiquetaAgendamento | null;
}

/**
 * Cadastro do tipo no VIOS › Responsabilidade: quem o VIOS põe em toda tarefa desse tipo. O robô usa no lançamento
 * para decidir quem fica em cada tarefa do fluxo (sama-rpa regras-fluxo.js); o Orquestra, para prever o mesmo.
 */
export interface ResponsabilidadeDoTipo {
  /** Pessoas fixas do tipo (ex.: VERIFICAR ATA = Larissa). */
  fixos: string[];
  /** Marcações do cadastro; null enquanto o catálogo só leu os fixos (SAMA sem a 0060 ou sem a nova leitura). */
  regras: { advogado: boolean; auxiliar: boolean; estagiario: boolean; coordenador: boolean; grupo: boolean } | null;
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
  /** Como o VIOS data esta tarefa; null quando a regra não foi lida (o Orquestra usa a conta antiga). */
  regra: (RegraDePrazo & { base: BaseDaData }) | null;
  /** Quem o VIOS põe neste tipo; null quando não foi lido (fica o responsável da vistagem, como o robô faz). */
  responsabilidade: ResponsabilidadeDoTipo | null;
  /** Classe do tipo no VIOS (dá a cor no fluxo: Providência azul-claro); ausente ou null quando não foi lida. */
  classe?: EtiquetaAgendamento | null;
  /** As que esta cria junto, com as regras delas (fluxo dentro do fluxo: Embargos › 2. REVISAR). */
  filhas: TarefaDoFluxo[];
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

/** O VIOS encadeia poucos níveis (Recurso › Embargos › Revisar); o limite só protege de ciclo na árvore. */
const NIVEIS_DO_FLUXO = 4;

/**
 * A árvore como vale para uma pasta: o VIOS só cria os tipos disponíveis para a área dela ("disponível para as áreas"
 * na árvore de tarefas). O RECURSO ESPECIAL tem dois INFORMAR CLIENTE + INTERESSE RECURSAL + GUIA, o 414 e o 426; a
 * pasta Cível só recebe o 414. `tiposDaArea` são os ids da lista de tarefas da área no catálogo; sem ela, fica a árvore inteira.
 */
export function arvoreDaArea(arvore: Map<number, TipoNaArvore>, tiposDaArea: (string | number)[] | null): Map<number, TipoNaArvore> {
  if (!tiposDaArea?.length) return arvore;
  const naArea = new Set(tiposDaArea.map(Number));
  return new Map(
    [...arvore].map(([id, tipo]) => [
      id,
      { ...tipo, criacao: tipo.criacao.filter((filho) => naArea.has(filho)), conclusao: tipo.conclusao.filter((filho) => naArea.has(filho)) },
    ])
  );
}

/** Fluxo de um tipo de tarefa (id do VIOS); null se o VIOS não cria nada junto nem depois. */
export function montarFluxo(id: string, arvore: Map<number, TipoNaArvore>): FluxoDaTarefa | null {
  const tipo = arvore.get(Number(id));
  if (!tipo) return null;
  const nomeDe = (filho: number) => arvore.get(filho)?.nome ?? `Tipo ${filho}`;
  const filhasDe = (pai: TipoNaArvore, nivel: number, acima: Set<number>): TarefaDoFluxo[] =>
    pai.criacao.map((filho): TarefaDoFluxo => {
      const dados = arvore.get(filho);
      const nome = nomeDe(filho);
      const base = pai.baseDasFilhas?.get(filho) ?? null;
      return {
        id: String(filho),
        nome,
        prazo: dados?.prazo ?? null,
        papel: papelNoFluxo(nome),
        tambemCria: (dados?.criacao ?? []).map(nomeDe),
        aoConcluir: (dados?.conclusao ?? []).map(nomeDe),
        regra: dados?.regraPrazo && base ? { ...dados.regraPrazo, base } : null,
        responsabilidade: dados?.responsabilidade ?? null,
        classe: dados?.classe ?? null,
        filhas:
          dados && nivel < NIVEIS_DO_FLUXO && !acima.has(filho) ? filhasDe(dados, nivel + 1, new Set([...acima, filho])) : [],
      };
    });
  const criacao = filhasDe(tipo, 1, new Set([Number(id)]));
  const conclusao = tipo.conclusao.map((filho) => ({ id: String(filho), nome: nomeDe(filho), prazo: arvore.get(filho)?.prazo ?? null }));
  return criacao.length || conclusao.length ? { criacao, conclusao } : null;
}

/**
 * Tarefa de Prazo sem prazo próprio no VIOS: ela não cria 3. PROTOCOLAR, mas cria tarefas que têm o seu (a SENTENÇA
 * cria os Embargos e o Recurso Ordinário, cada um com Revisar e Protocolar). Essas contam da data dela: não há fatal a pedir.
 */
export function semPrazoProprio(fluxo: FluxoDaTarefa | null | undefined): boolean {
  if (!fluxo || cadeiaDoFluxo(fluxo)) return false;
  return fluxo.criacao.some((tarefa) => tarefa.filhas.some((filha) => filha.papel === "protocolar"));
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
