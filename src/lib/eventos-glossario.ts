/**
 * O que cada termo financeiro dos eventos quer dizer. Um texto só, usado nas
 * dicas (ícone "?") de todas as telas, para o mesmo nome nunca ter dois sentidos.
 */

export interface EventTerm {
  title: string;
  description: string;
}

export const EVENT_TERMS = {
  orcamento: {
    title: "Orçamento do evento",
    description:
      "As despesas do evento, uma por linha. Cada linha tem o valor previsto, o cotado com o fornecedor, o realizado e a situação do pagamento.",
  },
  verba: {
    title: "Verba aprovada",
    description:
      "Teto autorizado para gastar no evento. É definida no cadastro do evento; lançar despesas não muda esse valor.",
  },
  previsto: {
    title: "Previsto",
    description:
      "Quanto se planeja gastar com a despesa antes de fechar com o fornecedor. A soma das linhas é o previsto do evento.",
  },
  cotado: {
    title: "Cotado",
    description:
      "Valor da proposta que o fornecedor mandou. Serve para comparar com o previsto antes de aprovar a compra.",
  },
  realizado: {
    title: "Realizado",
    description:
      "O que de fato saiu do caixa, pela nota fiscal ou pelo comprovante. É o número mais confiável para planejar o ano seguinte.",
  },
  diferenca: {
    title: "Diferença",
    description:
      "Realizado menos previsto. Positivo: gastou mais que o planejado. Negativo: sobrou dinheiro.",
  },
  saldo: {
    title: "Saldo da verba",
    description: "Verba aprovada menos o realizado: quanto ainda dá para gastar sem passar do teto.",
  },
  pagamento: {
    title: "Pagamento",
    description:
      "Pendente: nada pago ainda. Parcial: parte paga, como sinal ou parcelas. Pago: quitado.",
  },
  serie: {
    title: "Série",
    description:
      "O mesmo evento ao longo dos anos (Dia das Mães 2025, 2026, 2027…). É o que permite comparar uma edição com a anterior e prever a próxima.",
  },
  valorDoAno: {
    title: "Valor do ano",
    description:
      "O realizado da edição daquele ano. Quando a edição ainda não tem realizado lançado, aparece o previsto.",
  },
  base: {
    title: "Base da projeção",
    description:
      "Ponto de partida para o próximo ano, tirado da edição mais recente com número: o realizado; na falta dele, o previsto; na falta dos dois, a verba aprovada.",
  },
  porPessoa: {
    title: "R$ por pessoa",
    description:
      "Realizado do ano-base dividido pelos participantes reais. Só aparece quando os dois foram lançados no evento.",
  },
  previsao: {
    title: "Previsão",
    description:
      "Base de cada série com o reajuste aplicado. Séries sem nenhum valor lançado ficam fora da soma.",
  },
  reajuste: {
    title: "Reajuste",
    description:
      "Percentual aplicado sobre a base de cada série, para cobrir inflação ou aumento de público. Vale para a previsão na tela e na planilha baixada.",
  },
  baseHistorica: {
    title: "Base do último ano",
    description:
      "Soma, por série, do que foi gasto no último ano com dado: o realizado e, quando a edição ainda não tem realizado, o previsto.",
  },
} satisfies Record<string, EventTerm>;

export type EventTermKey = keyof typeof EVENT_TERMS;
