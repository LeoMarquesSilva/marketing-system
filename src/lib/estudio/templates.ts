import type { ListField, OptionField, StudioField, TextField } from "./fields";
import type { PieceKind, StudioCollection, StudioTemplateDef } from "./types";

/**
 * Modelos do Estúdio de peças. Cada um nasce de pranchetas do Illustrator: o fundo
 * fixo é extraído com `scripts/estudio/extrair-fundo.mjs` para `public/estudio/<tag>/`
 * e o desenho dos campos fica em `src/components/estudio/templates/`.
 */

// ---------- campos reutilizados ----------

const titulo = (max: number, dica: string): TextField => ({ kind: "texto", key: "titulo", label: "Título", max, multilinha: true, dica });

const servico: TextField[] = [
  { kind: "texto", key: "data", label: "Data", max: 30, dica: "Pílula com calendário. Ex.: 28 de outubro. Vazio = não mostrar." },
  { kind: "texto", key: "horario", label: "Horário", max: 30, dica: "Pílula com relógio. Ex.: das 8h às 19h. Vazio = não mostrar." },
  { kind: "texto", key: "local", label: "Local", max: 60, dica: "Pílula com marcador. Ex.: Expo Boulevard Iguatemi | Campinas/SP. Vazio = não mostrar." },
];

const ICONES: OptionField = {
  kind: "opcao",
  key: "icone",
  label: "Ícone",
  padrao: "calendario",
  opcoes: [
    { value: "calendario", label: "Calendário" },
    { value: "relogio", label: "Relógio" },
    { value: "local", label: "Local" },
    { value: "informacao", label: "Informação" },
    { value: "certificado", label: "Certificado" },
    { value: "inscricao", label: "Inscrição" },
  ],
};

/** Feitos no Instagram na hora de postar: não entram na arte, vão para o checklist e para /entregas. */
const postagemStory: TextField[] = [
  {
    kind: "texto",
    key: "sticker",
    label: "Sticker de link (na hora de postar)",
    max: 50,
    dica: "Texto do sticker de link do Instagram. Não aparece na arte. Vazio = sem sticker.",
  },
  {
    kind: "texto",
    key: "enquete",
    label: "Enquete (na hora de postar)",
    max: 80,
    dica: "Opções separadas por ' / '. Não aparece na arte; deixe espaço livre na tela. Vazio = sem enquete.",
  },
];

export const POSTING_FIELD_KEYS = new Set(postagemStory.map((f) => f.key));

const itensAviso: ListField = {
  kind: "lista",
  key: "itens",
  label: "Linhas com ícone",
  item: "Linha",
  min: 1,
  max: 4,
  dica: "Cada linha tem um ícone e até duas linhas de texto (use \\n para quebrar).",
  campos: [ICONES, { kind: "texto", key: "texto", label: "Texto", max: 110, multilinha: true }],
};

const avisoCampos: StudioField[] = [
  titulo(30, "Caixa alta, muito curto, termina com ponto. Ex.: É AMANHÃ."),
  itensAviso,
  {
    kind: "texto",
    key: "cta",
    label: "Botão do Sympla",
    max: 70,
    dica: "Frase do botão branco com o logo do Sympla. Vazio = sem botão.",
  },
];

const listaCampos: StudioField[] = [
  titulo(110, "Caixa alta, até 3 linhas, termina com ponto."),
  { kind: "texto", key: "subtitulo", label: "Rótulo da lista", max: 30, dica: "Ex.: Realização: (vazio = sem rótulo)." },
  {
    kind: "lista",
    key: "itens",
    label: "Itens",
    item: "Item",
    min: 1,
    max: 6,
    dica: "Itens com marcador ciano, frases curtas.",
    campos: [{ kind: "texto", key: "texto", label: "Texto", max: 90 }],
  },
  ...servico,
];

// ---------- coleção OAB ----------

export const OAB_COLLECTION: StudioCollection = {
  tag: "OAB",
  nome: "3º Congresso OAB Campinas",
  contexto: `Evento: 3º Congresso de Direito Recuperacional, Falimentar e Empresarial da OAB Campinas (o cabeçalho com esse nome já está fixo no fundo de todas as artes).
Data: quarta-feira, 28 de outubro de 2026, das 8h às 19h. Local: Expo Boulevard Iguatemi, Av. Senador Darcy Ribeiro, 140, Campinas/SP.
Agenda: credenciamento das 8h às 8h30; abertura das 8h30 às 9h15; 12 painéis em dois palcos; coffee-break 10h15–10h30 e 16h30–17h; almoço 12h30–14h30; palestra de encerramento 18h30–19h.
Manhã — 9h15 às 10h15: Palco 1 "A Saída do Sócio em Números: Apuração de Haveres, Critérios de Avaliação e Estratégias de Litígio"; Palco 2 "Mercado de Crédito e Insolvência". 10h30 às 11h30: Palco 1 "Agronegócio e Insolvência"; Palco 2 "Planejamento Patrimonial e Sucessório: Aspectos Consultivos e Contenciosos". 11h30 às 12h30: Palco 1 "Dinâmicas Empresariais Contemporâneas: Concorrência, Contratos e Solução de Conflitos"; Palco 2 "Falência e Liquidação de Ativos".
Tarde — 14h30 às 15h30: Palco 1 "Recuperação Judicial em Debate"; Palco 2 "Ativos Intangíveis em Disputa: Propriedade Intelectual, Concorrência e Prova Pericial". 15h30 às 16h30: Palco 1 "Sociedades Profissionais na Prática: Estrutura Societária, Governança e Sucessão"; Palco 2 "Recuperação Extrajudicial em Debate". 17h às 18h: Palco 1 "Jurisprudência e Tendências da Insolvência"; Palco 2 "O Futuro do Direito Empresarial: Contratos que Movem a Nova Economia, Infraestrutura, Data Centers e Inteligência Artificial".
Realização: Comissões da OAB Campinas de Estudos em Falência e Recuperação Judicial; de Direito Empresarial; de Direito da Moda; de Cursos e Palestras de Interesse Jurídico.
Inscrições e programação: Sympla. Certificado para participantes presentes, mediante assinatura da lista de presença; estudantes devem usar o nome completo no cadastro.
Tom: institucional, técnico e convidativo. Não usar "imperdível", não prometer vagas limitadas, valores, lotação ou resultados. Nunca chamar o evento só de "3º Congresso" em legenda.`,
};

const OAB_TEMPLATES: StudioTemplateDef[] = [
  {
    id: "oab-capa",
    tag: "OAB",
    nome: "Capa",
    descricao: "Capa de carrossel ou post único: título, texto de apoio e pílulas de data, horário e local.",
    formato: "feed",
    usoEm: ["carrossel", "feed"],
    campos: [
      titulo(70, "Caixa alta, até 2 linhas, termina com ponto. Ex.: SUA MANHÃ NO CONGRESSO."),
      { kind: "texto", key: "apoio", label: "Texto de apoio", max: 170, multilinha: true, dica: "Uma ou duas frases em caixa normal." },
      ...servico,
      { kind: "alternar", key: "arraste", label: "Mostrar “arraste para o lado”", padrao: true, dica: "Sim na capa de carrossel, não em post único." },
    ],
    exemplo: {
      titulo: "SUA MANHÃ NO CONGRESSO.",
      apoio: "Confira a programação dos dois palcos antes de escolher os debates.",
      data: "28 de outubro",
      horario: "das 8h às 19h",
      local: "Expo Boulevard Iguatemi | Campinas/SP",
      arraste: true,
    },
  },
  {
    id: "oab-programacao",
    tag: "OAB",
    nome: "Programação",
    descricao: "Slide de carrossel com horário e palcos (Palco 1 / Palco 2), linhas de agenda e destaques como intervalo ou coffee-break.",
    formato: "feed",
    usoEm: ["carrossel"],
    campos: [
      { kind: "texto", key: "destaqueAntes", label: "Destaque antes", max: 60, dica: "Linha solta acima do horário. Ex.: 16h30 às 17h00 | coffee-break. Vazio = não usar." },
      { kind: "texto", key: "horario", label: "Horário (pílula)", max: 30, dica: "Ex.: 9h15 às 10h15. Vazio = sem pílula." },
      {
        kind: "lista",
        key: "agenda",
        label: "Linhas de agenda",
        item: "Linha",
        min: 0,
        max: 4,
        dica: "Linhas 'horário | atividade' que aparecem ANTES dos palcos, ex.: credenciamento e abertura. O que vem depois dos palcos (intervalo, encerramento) vai em destaqueDepois.",
        campos: [
          { kind: "texto", key: "horario", label: "Horário", max: 20 },
          { kind: "texto", key: "atividade", label: "Atividade", max: 50 },
        ],
      },
      {
        kind: "lista",
        key: "palcos",
        label: "Palcos",
        item: "Palco",
        min: 0,
        max: 3,
        dica: "Título do painel exatamente como na programação.",
        campos: [
          { kind: "texto", key: "rotulo", label: "Rótulo", max: 14, placeholder: "Palco 1" },
          { kind: "texto", key: "titulo", label: "Painel", max: 150 },
        ],
      },
      { kind: "texto", key: "destaqueDepois", label: "Destaque depois", max: 60, dica: "Linha solta abaixo dos palcos. Ex.: 12h30 às 14h30 | Intervalo para almoço. Vazio = não usar." },
      {
        kind: "texto",
        key: "cta",
        label: "Botão do Sympla",
        max: 70,
        dica: "Botão branco com o logo do Sympla, no último slide. Ex.: Confira a programação completa no Sympla. Vazio = sem botão.",
      },
      { kind: "alternar", key: "arraste", label: "Mostrar “arraste para o lado”", padrao: true, dica: "Não no último slide." },
    ],
    exemplo: {
      destaqueAntes: "",
      horario: "9h15 às 10h15",
      agenda: [],
      palcos: [
        { rotulo: "Palco 1", titulo: "A Saída do Sócio em Números: Apuração de Haveres, Critérios de Avaliação e Estratégias de Litígio" },
        { rotulo: "Palco 2", titulo: "Mercado de Crédito e Insolvência" },
      ],
      destaqueDepois: "",
      cta: "",
      arraste: true,
    },
  },
  {
    id: "oab-aviso-feed",
    tag: "OAB",
    nome: "Aviso",
    descricao: "Post de aviso com título grande (É AMANHÃ.), linhas com ícone e botão do Sympla.",
    formato: "feed",
    usoEm: ["feed", "carrossel"],
    campos: avisoCampos,
    exemplo: {
      titulo: "É AMANHÃ.",
      itens: [
        { icone: "calendario", texto: "28 de outubro" },
        { icone: "relogio", texto: "Credenciamento das 8h às 8h30\nAbertura às 8h30" },
        { icone: "local", texto: "Expo Boulevard Iguatemi\nAv. Senador Darcy Ribeiro, 140 | Campinas/SP" },
      ],
      cta: "Consulte sua inscrição e a programação no Sympla.",
    },
  },
  {
    id: "oab-aviso-story",
    tag: "OAB",
    nome: "Aviso",
    descricao: "Story de aviso com título grande, linhas com ícone e botão do Sympla.",
    formato: "story",
    usoEm: ["stories"],
    campos: [...avisoCampos, ...postagemStory],
    exemplo: {
      titulo: "É AMANHÃ.",
      itens: [
        { icone: "calendario", texto: "28 de outubro" },
        { icone: "relogio", texto: "Credenciamento das 8h às 8h30\nAbertura às 8h30" },
        { icone: "local", texto: "Expo Boulevard Iguatemi\nAv. Senador Darcy Ribeiro, 140 | Campinas/SP" },
      ],
      cta: "",
      sticker: "Acesse as informações do evento",
      enquete: "",
    },
  },
  {
    id: "oab-lista-feed",
    tag: "OAB",
    nome: "Lista",
    descricao: "Post com título, lista com marcadores (ex.: comissões realizadoras) e pílulas de data, horário e local.",
    formato: "feed",
    usoEm: ["feed", "carrossel"],
    campos: listaCampos,
    exemplo: {
      titulo: "QUATRO COMISSÕES. UMA PROGRAMAÇÃO CONSTRUÍDA A PARTIR DE DIFERENTES ESPECIALIDADES.",
      subtitulo: "Realização:",
      itens: [
        { texto: "Comissão de Estudos em Falência e Recuperação Judicial;" },
        { texto: "Comissão de Direito Empresarial;" },
        { texto: "Comissão de Direito da Moda;" },
        { texto: "Comissão de Cursos e Palestras de Interesse Jurídico." },
      ],
      data: "28 de outubro",
      horario: "das 8h às 19h",
      local: "Expo Boulevard Iguatemi | Campinas/SP",
    },
  },
  {
    id: "oab-lista-story",
    tag: "OAB",
    nome: "Lista",
    descricao: "Story com título, lista com marcadores e pílulas de data, horário e local.",
    formato: "story",
    usoEm: ["stories"],
    campos: [...listaCampos, ...postagemStory],
    exemplo: {
      titulo: "UMA REALIZAÇÃO CONJUNTA DE QUATRO COMISSÕES DA OAB CAMPINAS.",
      subtitulo: "",
      itens: [
        { texto: "Estudos em Falência e Recuperação Judicial;" },
        { texto: "Direito Empresarial;" },
        { texto: "Direito da Moda;" },
        { texto: "Cursos e Palestras de Interesse Jurídico." },
      ],
      data: "28 de outubro",
      horario: "das 8h às 19h",
      local: "Expo Boulevard Iguatemi | Campinas/SP",
      sticker: "",
      enquete: "",
    },
  },
];

export const STUDIO_COLLECTIONS: StudioCollection[] = [OAB_COLLECTION];
export const STUDIO_TEMPLATES: StudioTemplateDef[] = [...OAB_TEMPLATES];

export function getTemplate(id: string): StudioTemplateDef | null {
  return STUDIO_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function getCollection(tag: string): StudioCollection | null {
  return STUDIO_COLLECTIONS.find((c) => c.tag === tag) ?? null;
}

/** Modelos de uma coleção que servem para o tipo de peça. */
export function templatesFor(tag: string, kind: PieceKind): StudioTemplateDef[] {
  return STUDIO_TEMPLATES.filter((t) => t.tag === tag && t.usoEm.includes(kind));
}
