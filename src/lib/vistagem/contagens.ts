/**
 * Quanto falta para zerar cada aba da Vistagem: os números das abas do cabeçalho. Quem conta é
 * `contagens-server.ts` (só `count`, sem trazer linhas); aqui ficam o formato e a ligação com as abas.
 */

export interface ContagensVistagem {
  /** triagem_pendente */
  triagem: number;
  /** Duplicidades ainda sem revisão (duplicidade_de preenchido e duplicidade_resultado vazio). */
  duplicidades: number;
  /** juridico_vistar (no jurídico, só das áreas da pessoa e, se ela não vista risco, sem as de risco). */
  vistagem: number;
  /** controladoria_vistar */
  conferencia: number;
  /** agendado + revisar */
  check: number;
}

export type AbaComContagem = keyof ContagensVistagem;

export const CONTAGENS_ZERADAS: ContagensVistagem = { triagem: 0, duplicidades: 0, vistagem: 0, conferencia: 0, check: 0 };

const publicacoes = (total: number) => (total === 1 ? "publicação" : "publicações");

/**
 * Aba de cada contagem, a frase do leitor de tela (e da dica ao passar o mouse) e o resumo curto que vai ao lado
 * do título quando a pessoa só enxerga uma aba. As abas Visão geral e Gestão das publicações não têm
 * número: não são fila de trabalho.
 */
export const ABAS_COM_CONTAGEM: Record<AbaComContagem, { href: string; resumo: string; descrever: (total: number) => string }> = {
  triagem: {
    href: "/operacoes-legais/vistagem/controladoria",
    resumo: "na triagem",
    descrever: (total) => `${total} ${publicacoes(total)} na Triagem Manual`,
  },
  duplicidades: {
    href: "/operacoes-legais/vistagem/duplicidades",
    resumo: "a revisar",
    descrever: (total) => `${total} ${total === 1 ? "duplicidade" : "duplicidades"} a revisar`,
  },
  vistagem: {
    href: "/operacoes-legais/vistagem/juridico",
    resumo: "para vistar",
    descrever: (total) => `${total} ${publicacoes(total)} para vistar`,
  },
  conferencia: {
    href: "/operacoes-legais/vistagem/conferencia",
    resumo: "a conferir",
    descrever: (total) => `${total} ${publicacoes(total)} a conferir`,
  },
  check: {
    href: "/operacoes-legais/vistagem/check",
    resumo: "a checar",
    descrever: (total) => `${total} ${publicacoes(total)} a checar`,
  },
};

const ABA_DO_HREF = new Map(
  (Object.keys(ABAS_COM_CONTAGEM) as AbaComContagem[]).map((aba) => [ABAS_COM_CONTAGEM[aba].href, aba] as const)
);

/** Qual contagem é a da aba (null nas abas sem número). */
export function abaDoHref(href: string): AbaComContagem | null {
  return ABA_DO_HREF.get(href) ?? null;
}

/** Lê a resposta da rota sem confiar no formato: número inválido vira zero. */
export function lerContagens(corpo: unknown): ContagensVistagem {
  const dados = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const numero = (valor: unknown) => {
    const convertido = Number(valor);
    return Number.isFinite(convertido) && convertido > 0 ? Math.floor(convertido) : 0;
  };
  return {
    triagem: numero(dados.triagem),
    duplicidades: numero(dados.duplicidades),
    vistagem: numero(dados.vistagem),
    conferencia: numero(dados.conferencia),
    check: numero(dados.check),
  };
}
