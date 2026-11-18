/**
 * Rotina do VIOS no robô (sama-rpa, /catalogo): relê no VIOS os tipos de tarefa, o fluxo automático (o que cada
 * tarefa cria e com que prazo), as etiquetas, os responsáveis, as matérias e o catálogo de tarefas por pasta.
 * Roda sozinha todo domingo às 22h (cron 'vios-catalogo' do SAMA) e pelo "Atualizar agora" das Configurações.
 * Aqui ficam só as leituras das respostas, sem servidor (testadas em rotina-vios.test.ts).
 */

/** Estado da rotina na memória do robô (GET /catalogo). Volta ao zero quando o robô é reiniciado (Implantar). */
export interface RotinaNoRobo {
  rodando: boolean;
  inicio: string | null;
  fim: string | null;
  /** Tipos de tarefa lidos no fluxo nesta rodada (null = ainda não chegou nessa parte, ou falhou). */
  fluxos: number | null;
  erroFluxos: string | null;
  /** Erro do catálogo de tarefas por pasta (a parte que vem depois do fluxo). */
  erro: string | null;
}

export interface SituacaoDoFluxoVios {
  /** Última leitura do fluxo gravada no SAMA (vios_fluxos_tarefas.atualizado_em). */
  lidoEm: string | null;
  tipos: number;
  /** null = não deu para perguntar ao robô; o motivo vem em `semRobo`. */
  robo: RotinaNoRobo | null;
  semRobo: string | null;
}

/** Resposta de um pedido do pg_net, como a função vios_catalogo_resposta do SAMA devolve. */
export interface RespostaDoPgNet {
  status: number | null;
  conteudo: unknown;
  tempo_esgotado: boolean;
  erro: string | null;
}

export type FaseDaRotina =
  | { fase: "sem_robo"; motivo: string }
  /** O robô está lendo o fluxo (a primeira parte da rotina). */
  | { fase: "lendo_fluxo"; desde: string | null }
  /** O fluxo já foi gravado nesta rodada; o robô segue nas matérias e no catálogo das pastas. */
  | { fase: "lendo_catalogo"; desde: string | null }
  | { fase: "falhou"; em: string | null; parte: "fluxo" | "catálogo das pastas"; erro: string }
  | { fase: "parado"; terminouEm: string | null };

/** Com a leitura mais velha que isto, a tela avisa que a rotina de domingo pode ter falhado. */
export const LEITURA_ATRASADA_MS = 8 * 24 * 60 * 60 * 1000;

const texto = (valor: unknown): string | null => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

const objeto = (valor: unknown): Record<string, unknown> | null =>
  valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;

/** Estado da rotina na resposta do robô: { ok, catalogo } no GET; { ok, jaRodando, catalogo } no POST. */
export function rotinaDaResposta(conteudo: unknown): RotinaNoRobo | null {
  const catalogo = objeto(objeto(conteudo)?.catalogo);
  if (!catalogo) return null;
  return {
    rodando: catalogo.rodando === true,
    inicio: texto(catalogo.inicio),
    fim: texto(catalogo.fim),
    fluxos: typeof catalogo.fluxos === "number" ? catalogo.fluxos : null,
    erroFluxos: texto(catalogo.erroFluxos),
    erro: texto(catalogo.erro),
  };
}

/** Por que um pedido ao robô não deu certo, ou null quando ele respondeu bem (2xx). */
export function falhaDoPedido(resposta: RespostaDoPgNet): string | null {
  if (resposta.tempo_esgotado) return "O robô não respondeu a tempo.";
  if (resposta.erro) return `Não foi possível falar com o robô: ${resposta.erro}`;
  const status = resposta.status ?? 0;
  if (status >= 200 && status < 300) return null;
  if (status === 401) return "O pedido foi recusado (401): os segredos do SAMA e do robô não batem.";
  const detalhe = texto(objeto(resposta.conteudo)?.erro) ?? texto(resposta.conteudo);
  return `O robô respondeu ${status || "sem status"}${detalhe ? `: ${detalhe}` : ""}.`;
}

/** Em que pé está a rotina, para o cartão das Configurações. */
export function faseDaRotina(situacao: SituacaoDoFluxoVios): FaseDaRotina {
  const robo = situacao.robo;
  if (!robo) return { fase: "sem_robo", motivo: situacao.semRobo ?? "Sem resposta do robô." };
  if (robo.rodando) {
    const lido = situacao.lidoEm ? Date.parse(situacao.lidoEm) : Number.NaN;
    const inicio = robo.inicio ? Date.parse(robo.inicio) : Number.NaN;
    return lido >= inicio ? { fase: "lendo_catalogo", desde: robo.inicio } : { fase: "lendo_fluxo", desde: robo.inicio };
  }
  if (robo.erroFluxos) return { fase: "falhou", em: robo.inicio, parte: "fluxo", erro: robo.erroFluxos };
  if (robo.erro) return { fase: "falhou", em: robo.inicio, parte: "catálogo das pastas", erro: robo.erro };
  return { fase: "parado", terminouEm: robo.fim };
}

/** A leitura do fluxo está mais velha que uma semana e um dia (a rotina de domingo não gravou). */
export function leituraAtrasada(lidoEm: string | null, agora = Date.now()): boolean {
  if (!lidoEm) return true;
  const lido = Date.parse(lidoEm);
  return Number.isNaN(lido) || agora - lido > LEITURA_ATRASADA_MS;
}
