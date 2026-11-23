/**
 * Prompts do Gerador de conteúdo, montados a partir das Configurações e do
 * aprendizado. Puro: mesmo texto no pipeline, no link avulso e no "Refazer com IA".
 * O formato dos slides precisa continuar batendo com parseCarousel (content-word.ts).
 */
import {
  effectiveAvoid,
  effectiveCta,
  effectiveVoice,
  type GeneratorSettings,
} from "@/lib/content-generator/settings";

const DEVELOPMENT_SLIDES = [
  { title: "Subtópico específico", content: "Explicação clara e direta com exemplo" },
  { title: "Benefícios ou Justificativas", content: "- Ponto 1\n- Ponto 2\n- Ponto 3" },
  { title: "Impactos ou Desafios", content: "Principais desafios, riscos ou controvérsias" },
  { title: "O que muda na prática", content: "Efeito concreto para empresas e gestores" },
  { title: "Exemplo prático", content: "Situação real ou hipotética que ilustra o tema" },
  { title: "Pontos de atenção", content: "- Cuidado 1\n- Cuidado 2" },
  { title: "Próximos passos", content: "O que acompanhar a partir de agora" },
  { title: "Perguntas frequentes", content: "Uma dúvida comum e a resposta curta" },
];

/**
 * Slides de análise, para áreas com linha editorial de especialista ("subir a
 * prateleira"): partem do caso e do ponto técnico, sem explicar o conceito básico.
 */
const EXPERT_SLIDES = [
  { title: "Leitura do caso", content: "O ponto técnico central da notícia, dito por quem domina o assunto (sem explicar o conceito básico)" },
  { title: "O que está em jogo", content: "Efeitos concretos para credores, sócios, financiadores ou a empresa, com os números disponíveis" },
  { title: "Ponto técnico", content: "A regra, o precedente ou a estratégia que define o caso, e por que ele importa" },
  { title: "O que observar", content: "- Próximo movimento 1\n- Próximo movimento 2\n- Sinal que muda o cenário" },
  { title: "Leitura estratégica", content: "O que a decisão sinaliza para casos e negociações parecidos" },
  { title: "Na prática", content: "O que quem está do outro lado da mesa deve avaliar agora" },
];

/** Estrutura dos slides no formato que a tela e o Word sabem ler. */
export function carouselStructure(slideCount: number, cta: string, expert = false): string {
  const developmentCount = Math.max(1, slideCount - 2);
  const template = expert ? EXPERT_SLIDES : DEVELOPMENT_SLIDES;
  const blocks = [
    "**Slide de Capa**\nTítulo: Frase impactante e objetiva (manchete)\nSubtítulo: Uma linha curta de apoio que complementa o título",
  ];
  for (let index = 0; index < developmentCount; index += 1) {
    const slide = template[index % template.length];
    blocks.push(`**Slide de Desenvolvimento ${index + 1}**\nTítulo: ${slide.title}\nConteúdo: ${slide.content}`);
  }
  blocks.push(`**Slide Final**\nTítulo: Conclusão ou Perspectiva Futura\nConteúdo: Resumo final + chamada para ação (ex.: "${cta}")`);
  return blocks.join("\n\n");
}

export interface CarouselPromptInput {
  title: string;
  snippet: string;
  articleText?: string;
  link: string;
  area: string;
  settings: GeneratorSettings;
  /** Bloco do aprendizado (vazio quando desligado ou ainda sem estudo). */
  learningBlock?: string;
  /** Pedido do "Refazer com IA" (ex.: "mais curto"). */
  extraInstruction?: string;
  /** Continuação ou repetição de assunto nosso (relatedCarouselGuidance). */
  relatedGuidance?: string;
  /** Linha editorial da área definida pelos sócios (prevalece sobre o aprendizado). */
  areaGuideline?: string;
}

/** Bloco da linha editorial, com a prioridade explícita sobre o resto do prompt. */
export function areaGuidelineBlock(area: string, guideline?: string): string {
  if (!guideline?.trim()) return "";
  return `LINHA EDITORIAL DE ${area.toUpperCase()} (definida pelos sócios; prevalece sobre o aprendizado e sobre o tom geral):\n${guideline.trim()}`;
}

export function buildCarouselPrompt(input: CarouselPromptInput): string {
  const cta = effectiveCta(input.settings);
  const article = input.articleText?.trim() ? input.articleText.trim() : "(não disponível — use o resumo acima)";
  // Área com linha editorial própria usa slides de análise em vez do molde didático.
  const guideline = input.areaGuideline ?? input.settings.areaGuidelines?.[input.area];
  const expert = Boolean(guideline?.trim());
  return [
    expert
      ? "Você é o advogado sênior da área, escrevendo para o Instagram de um escritório de advocacia empresarial que quer ser visto como referência no assunto."
      : "Você é redator jurídico de um escritório de advocacia empresarial.",
    `Com base na notícia abaixo, crie um post completo em formato de carrossel para o Instagram, com exatamente ${input.settings.slideCount} slides, seguindo a estrutura:`,
    "---",
    carouselStructure(input.settings.slideCount, cta, expert),
    "---",
    "**Notícia**",
    `Título: ${input.title}`,
    `Resumo: ${input.snippet}`,
    `Conteúdo da matéria: ${article}`,
    `Link: ${input.link}`,
    `Área do Direito: ${input.area}`,
    input.learningBlock ? `\n${input.learningBlock}\nUse esse aprendizado para escolher o ângulo e o gancho: mesmo universo do que engaja, mas com abordagem nova; não copie os exemplos.` : "",
    // Sem linha explícita, usa a da área nas Configurações (vale na busca, no link e no Refazer).
    expert ? `\n${areaGuidelineBlock(input.area, guideline)}` : "",
    input.relatedGuidance ? `\n${input.relatedGuidance}` : "",
    `\nTom de voz: ${effectiveVoice(input.settings)}`,
    `Regras: ${effectiveAvoid(input.settings)}`,
    "Baseie-se no conteúdo da matéria quando disponível (é mais completo que o resumo). Mantenha os marcadores **Slide …**, Título: e Conteúdo: exatamente como na estrutura.",
    "O post é para o público: nunca comente no texto que faltam dados, que \"o resumo não informa\" ou que algo não foi divulgado. Se faltar informação, escreva só o que dá para afirmar.",
    input.extraInstruction?.trim() ? `\nPedido de quem está revisando (siga com prioridade): ${input.extraInstruction.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface RelevancePromptInput {
  title: string;
  snippet: string;
  area: string;
  sourceName?: string | null;
  learningBlock?: string;
  /** Lista numerada do que já publicamos/escolhemos de parecido (relatedCandidatesBlock). */
  relatedBlock?: string;
  /** Linha editorial da área (ex.: não explicar o básico em Reestruturação). */
  areaGuideline?: string;
}

/** Nota de potencial (0–10) antes de gastar IA escrevendo o carrossel. */
export function buildRelevancePrompt(input: RelevancePromptInput): string {
  return [
    "Você é o editor de conteúdo do Instagram de um escritório de advocacia empresarial (Bismarchi | Pires).",
    "Dê uma nota de 0 a 10 para o potencial desta notícia virar um bom carrossel no nosso perfil e ser escolhida pela equipe da área.",
    "Critérios: impacto prático para empresas e gestores; novidade (decisão, lei, tendência) e não release corporativo, nomeação ou prêmio; ligação clara com a área; chance de engajar segundo o aprendizado abaixo.",
    "Notas 0–3: fraca ou fora do perfil. 4–6: aproveitável. 7–10: forte, vale priorizar.",
    "O motivo deve ter uma frase curta em português, dita para o advogado que vai escolher (ex.: \"Decisão do STJ que muda contratos de seguro, tema que engaja em Cível\").",
    "",
    `Área: ${input.area}`,
    input.sourceName ? `Fonte: ${input.sourceName}` : "",
    `Título: ${input.title}`,
    `Resumo: ${input.snippet || "(sem resumo)"}`,
    input.learningBlock ? `\n${input.learningBlock}` : "",
    input.areaGuideline?.trim()
      ? `\n${areaGuidelineBlock(input.area, input.areaGuideline)}\nDê nota maior às notícias que permitem conteúdo nesse nível e menor às que só renderiam uma explicação básica do tema.`
      : "",
    input.relatedBlock
      ? [
          `\n${input.relatedBlock}`,
          "",
          "Compare a notícia com a lista acima e diga a relação:",
          '- "repetido": a MESMA notícia ou o mesmo debate específico (mesma empresa/caso, mesma proposta de lei, mesma decisão), sem fato novo. Nota no máximo 3.',
          '- "desdobramento": o MESMO caso, empresa, processo ou proposta com FATO NOVO (nova decisão, nova fase do processo, lei aprovada ou sancionada, recurso julgado, acordo, números novos). Diga em "novidade", em uma frase para o advogado, o que mudou (sem comentar o que a notícia não informa). Pode ter nota alta: continuação de assunto que já publicamos rende post de atualização.',
          '- "novo": outra empresa, outro caso ou outra decisão, mesmo que o tema geral (ex.: recuperação extrajudicial, herança) já tenha sido explicado por nós. Avalie normalmente.',
          'Em "referencia", o número do item da lista (ou null se "novo").',
        ].join("\n")
      : '\nNão há nada parecido no que já publicamos: relação "novo", referencia null.',
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/** Pedidos prontos do "Refazer com IA". */
export const REGENERATE_PRESETS = [
  "Mais curto e direto",
  "Mais didático, com exemplo prático",
  "Tom mais técnico",
  "Outro ângulo para a capa",
  "Foco no impacto para empresas",
] as const;
