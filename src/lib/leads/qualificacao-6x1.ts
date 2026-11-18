/**
 * Qualificação de leads do e-book "Fim da escala 6x1" (produto da área Trabalhista).
 * Quem baixa o e-book pelo formulário responde 5 perguntas; a soma dos pontos e duas regras
 * diretas classificam o lead em frio, morno ou quente. Usado pela página pública e pela API.
 *
 * Proposta para a área Trabalhista validar (e-mail "Produtos Wagner e Pressato", nov/2026).
 */

export type Temperatura = "frio" | "morno" | "quente";

export interface OpcaoPergunta {
  valor: string;
  rotulo: string;
  pontos: number;
}

export interface PerguntaQualificacao {
  id: string;
  titulo: string;
  ajuda?: string;
  opcoes: OpcaoPergunta[];
}

export const PRODUTO_6X1 = "ebook-fim-escala-6x1";

export const PERGUNTAS_6X1: PerguntaQualificacao[] = [
  {
    id: "exposicao",
    titulo: "Hoje, sua empresa tem colaboradores em escala 6x1 ou com jornada acima de 40 horas semanais?",
    opcoes: [
      { valor: "maioria", rotulo: "Sim, a maior parte da equipe", pontos: 3 },
      { valor: "parte", rotulo: "Sim, parte da equipe", pontos: 2 },
      { valor: "nao", rotulo: "Não", pontos: 0 },
    ],
  },
  {
    id: "porte",
    titulo: "Quantos colaboradores a empresa tem?",
    opcoes: [
      { valor: "ate-50", rotulo: "Até 50", pontos: 1 },
      { valor: "51-200", rotulo: "De 51 a 200", pontos: 2 },
      { valor: "mais-200", rotulo: "Mais de 200", pontos: 3 },
    ],
  },
  {
    id: "estagio",
    titulo: "Em que pé está a adaptação da empresa às novas jornadas?",
    opcoes: [
      { valor: "nao-comecou", rotulo: "Ainda não começamos", pontos: 3 },
      { valor: "levantando", rotulo: "Estamos levantando o impacto", pontos: 2 },
      { valor: "plano", rotulo: "Já temos um plano definido", pontos: 1 },
      { valor: "concluida", rotulo: "Já adaptamos tudo", pontos: 0 },
    ],
  },
  {
    id: "prazo",
    titulo: "Quando a empresa pretende tomar decisões sobre o tema?",
    opcoes: [
      { valor: "30-dias", rotulo: "Nos próximos 30 dias", pontos: 3 },
      { valor: "ate-dez-2026", rotulo: "Até dezembro de 2026", pontos: 2 },
      { valor: "2027", rotulo: "Em 2027", pontos: 1 },
      { valor: "nao-sei", rotulo: "Ainda não sei", pontos: 0 },
    ],
  },
  {
    id: "contato",
    titulo: "Quer conversar com o Dr. Daniel Pressatto sobre a adequação da sua empresa?",
    opcoes: [
      { valor: "sim", rotulo: "Sim, quero ser contatado", pontos: 4 },
      { valor: "depois", rotulo: "Talvez mais adiante", pontos: 1 },
      { valor: "nao", rotulo: "Não por enquanto", pontos: 0 },
    ],
  },
];

/** Pontuação máxima (16). Quente a partir de 11; frio até 5; morno no meio. */
export const PONTOS_QUENTE = 11;
export const PONTOS_FRIO_ATE = 5;

export const TEMPERATURA_ROTULO: Record<Temperatura, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

export const REGRAS_TEMPERATURA = [
  "Quente: pediu contato com o sócio, ou somou 11 pontos ou mais (de 16).",
  "Frio: não tem escala 6x1 nem jornada acima de 40 h, ou somou até 5 pontos.",
  "Morno: os demais (6 a 10 pontos, sem pedido de contato).",
];

export type RespostasQualificacao = Record<string, string>;

export interface ResultadoQualificacao {
  pontos: number;
  temperatura: Temperatura;
  /** Por que caiu nessa faixa (mostrado para a equipe, não para o lead). */
  motivo: string;
}

/** Confere se todas as perguntas foram respondidas com uma opção válida. */
export function validarRespostas(respostas: RespostasQualificacao): string | null {
  for (const pergunta of PERGUNTAS_6X1) {
    const valor = respostas[pergunta.id];
    if (!valor) return `Responda: ${pergunta.titulo}`;
    if (!pergunta.opcoes.some((o) => o.valor === valor)) return `Resposta inválida em: ${pergunta.titulo}`;
  }
  return null;
}

export function classificarLead(respostas: RespostasQualificacao): ResultadoQualificacao {
  const pontos = PERGUNTAS_6X1.reduce((soma, pergunta) => {
    const opcao = pergunta.opcoes.find((o) => o.valor === respostas[pergunta.id]);
    return soma + (opcao?.pontos ?? 0);
  }, 0);

  const semExposicao = respostas.exposicao === "nao";
  const pediuContato = respostas.contato === "sim";

  // Pedido de contato vale mais que a soma, desde que a empresa seja afetada pela mudança.
  if (pediuContato && !semExposicao) {
    return { pontos, temperatura: "quente", motivo: "Pediu para conversar com o sócio." };
  }
  if (semExposicao) {
    return {
      pontos,
      temperatura: pediuContato ? "morno" : "frio",
      motivo: pediuContato
        ? "Pediu contato, mas disse não ter escala 6x1 nem jornada acima de 40 h."
        : "Não tem escala 6x1 nem jornada acima de 40 h.",
    };
  }
  if (pontos >= PONTOS_QUENTE) return { pontos, temperatura: "quente", motivo: `Somou ${pontos} de 16 pontos.` };
  if (pontos <= PONTOS_FRIO_ATE) return { pontos, temperatura: "frio", motivo: `Somou ${pontos} de 16 pontos.` };
  return { pontos, temperatura: "morno", motivo: `Somou ${pontos} de 16 pontos.` };
}
