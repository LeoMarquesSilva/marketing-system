import type { IconField, ListField, OptionField, StudioField, TextField } from "./fields";
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
  planner: "tag",
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

// ---------- coleção BP (posts do escritório, "posts.ai") ----------

const TEMA: OptionField = {
  kind: "opcao",
  key: "tema",
  label: "Tema",
  padrao: "claro",
  opcoes: [
    { value: "claro", label: "Claro (papel)" },
    { value: "escuro", label: "Escuro (navy)" },
  ],
  dica: "Alterne claro e escuro ao longo do carrossel, em pares, como nas peças do escritório.",
};

/** Ícones em dourado; "pergunta" e "alerta" são os balões cheios das peças. */
export const BP_ICONS = [
  { value: "nenhum", label: "Sem ícone" },
  { value: "pergunta", label: "Balão com ?" },
  { value: "alerta", label: "Balão com !" },
  { value: "check", label: "Confirmação" },
  { value: "escudo", label: "Escudo" },
  { value: "calendario", label: "Calendário" },
  { value: "grafico", label: "Gráfico subindo" },
  { value: "queda", label: "Gráfico caindo" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "loja", label: "Loja" },
  { value: "predio", label: "Empresa/prédio" },
  { value: "documento", label: "Documento" },
  { value: "contrato", label: "Contrato assinado" },
  { value: "balanca", label: "Balança da justiça" },
  { value: "martelo", label: "Martelo do juiz" },
  { value: "telefone", label: "Telefone" },
  { value: "pessoas", label: "Pessoas" },
  { value: "acordo", label: "Aperto de mãos" },
  { value: "engrenagem", label: "Engrenagem" },
  { value: "alvo", label: "Alvo" },
  { value: "lampada", label: "Ideia" },
] as const;

// atalhos desenhados no código; o campo também aceita qualquer ícone da Iconify
const icone = (key: string, label: string, dica: string): IconField => ({
  kind: "icone",
  key,
  label,
  padrao: "nenhum",
  opcoes: BP_ICONS.map((i) => ({ value: i.value, label: i.label })),
  dica,
});

export const BP_COLLECTION: StudioCollection = {
  tag: "BP",
  nome: "Posts do escritório",
  planner: "posts",
  importaPosts: true,
  perfil: { nome: "bismarchipires", foto: "/estudio/bp/fenix.png" },
  contexto: `Escritório: Bismarchi | Pires Sociedade de Advogados (10 anos), Instagram @bismarchipires. Os posts explicam decisões, leis e casos para empresários e gestores, a partir de textos escritos pelo Gerador de conteúdo e aprovados pelo advogado autor.
Estrutura dos carrosséis: capa (área, título em caixa alta, subtítulo, foto e nome do autor) + slides de conteúdo com título em caixa alta e de 1 a 4 caixas de texto + último slide com a conclusão e uma chamada para conversar com um advogado da área.
Estilo das caixas: "suave" (fundo preenchido) para o texto principal, "contorno" para complemento ou exemplo, "destaque" (dourada) para uma frase-chave; listas com marcador quando o texto for uma enumeração; ícone de balão com ? ou ! quando ajudar a leitura; rótulo curto em cima da caixa para separar ideias ("Não há resposta uniforme:", "Dois anos depois").
Tom: técnico, claro e direto. Não prometer resultado, não usar "imperdível", não citar o veículo de imprensa.`,
};

/** Até 4 pessoas na capa com equipe; foto e nome vazios = cartão não aparece. */
const PESSOAS_CAPA = 4;
const pessoaFields = (n: number): StudioField[] => [
  { kind: "imagem", key: `foto${n}`, label: `Foto ${n} (com fundo)`, pasta: "retratos" },
  { kind: "texto", key: `nome${n}`, label: `Nome ${n}`, max: 26, dica: "Nome curto na pílula do cartão. Ex.: Ricardo V. Pires. Vazio = sem pessoa." },
];

const BP_TEMPLATES: StudioTemplateDef[] = [
  {
    id: "bp-capa",
    tag: "BP",
    nome: "Capa",
    descricao: "Capa do carrossel: área, chamada opcional, título, logo do cliente opcional, subtítulo, foto e autor.",
    ajustes: ["fotoZoom", "fotoX", "fotoY", "texto", "titulo", "y"],
    formato: "feed",
    usoEm: ["carrossel"],
    campos: [
      TEMA,
      {
        kind: "opcao",
        key: "lado",
        label: "Foto",
        padrao: "esquerda",
        opcoes: [
          { value: "esquerda", label: "À esquerda" },
          { value: "direita", label: "À direita (só no tema claro)" },
        ],
      },
      { kind: "imagem", key: "foto", label: "Foto do autor (PNG sem fundo)", pasta: "fotos" },
      { kind: "texto", key: "area", label: "Área", max: 30, dica: "Pílula dourada com a área do Direito. Ex.: Reestruturação." },
      { kind: "texto", key: "chamada", label: "Chamada", max: 40, dica: "Pílula de contorno acima do título, em caixa alta. Ex.: CLÁUSULAS IPSO FACTO: Vazio = não usar." },
      titulo(70, "Manchete em caixa alta, curta e forte, até 3 linhas. Ex.: BLOQUEIO NÃO É PAGAMENTO"),
      { kind: "imagem", key: "logo", label: "Logo do cliente/empresa (opcional)", pasta: "logos" },
      { kind: "texto", key: "subtitulo", label: "Subtítulo", max: 150, multilinha: true, dica: "Uma frase de apoio em caixa normal." },
      { kind: "texto", key: "autor", label: "Autor", max: 60, dica: "Nome como sai depois de 'Por:'. Não troque o que já estiver preenchido." },
      { kind: "texto", key: "cargo", label: "Cargo", max: 80, dica: "Pílula abaixo do autor. Não troque o que já estiver preenchido." },
    ],
    exemplo: {
      tema: "claro",
      lado: "direita",
      foto: "",
      area: "Reestruturação",
      chamada: "",
      titulo: "BLOQUEIO NÃO É PAGAMENTO",
      logo: "",
      subtitulo: "Valor tratado antes da recuperação judicial não vai direto ao banco credor",
      autor: "Dra. Thayná Rodrigues Cabalin",
      cargo: "Advogada da área de Reestruturação",
    },
  },
  {
    id: "bp-conteudo",
    tag: "BP",
    nome: "Conteúdo",
    ajustes: ["texto", "titulo", "y"],
    // os mesmos três fundos do posts.ai, em papel e em navy
    fundos: { variacoes: 3, previa: (n, valores) => `/estudio/bp/fundo-${valores.tema === "escuro" ? "escuro" : "claro"}-${n}.jpg` },
    descricao:
      "Slide de conteúdo: ícone opcional, título em caixa alta e de 1 a 4 caixas de texto (suave, contorno ou destaque), com ícone, rótulo ou marcadores. O último slide do carrossel sai sem 'arraste'.",
    formato: "feed",
    usoEm: ["carrossel"],
    campos: [
      TEMA,
      icone("icone", "Ícone acima do título", "Opcional. 'pergunta' em títulos que são perguntas, 'alerta' em avisos."),
      titulo(80, "Caixa alta, até 2 linhas. Ex.: O QUE DECIDIU O TJGO?"),
      {
        kind: "lista",
        key: "caixas",
        label: "Caixas de texto",
        item: "Caixa",
        min: 1,
        max: 4,
        dica: "De 1 a 4 caixas; somadas, até uns 650 caracteres por slide.",
        campos: [
          {
            kind: "opcao",
            key: "estilo",
            label: "Estilo",
            padrao: "suave",
            opcoes: [
              { value: "suave", label: "Preenchida" },
              { value: "contorno", label: "Contorno" },
              { value: "destaque", label: "Destaque dourado" },
            ],
          },
          icone("icone", "Ícone à esquerda", "Opcional."),
          {
            kind: "opcao",
            key: "marcador",
            label: "Marcadores",
            padrao: "nenhum",
            opcoes: [
              { value: "nenhum", label: "Texto corrido" },
              { value: "ponto", label: "Lista com pontos" },
              { value: "quadrado", label: "Lista com quadrados" },
              { value: "losango", label: "Lista com losangos" },
            ],
            dica: "Com marcador, cada linha do texto (\\n) vira um item.",
          },
          { kind: "texto", key: "rotulo", label: "Rótulo em cima da caixa", max: 40, dica: "Opcional. Ex.: Não há resposta uniforme:" },
          { kind: "texto", key: "texto", label: "Texto", max: 520, multilinha: true, dica: "Use **negrito** para destacar valores e termos." },
        ],
      },
    ],
    exemplo: {
      tema: "claro",
      icone: "nenhum",
      titulo: "O QUE DECIDIU O TJGO?",
      caixas: [
        {
          estilo: "suave",
          icone: "nenhum",
          marcador: "nenhum",
          rotulo: "",
          texto:
            "Em recuperação judicial de produtores rurais em Hidrolândia (GO), o Santander havia bloqueado valores via Sisbajud, em execução individual, antes do deferimento do processamento do pedido.",
        },
        {
          estilo: "contorno",
          icone: "nenhum",
          marcador: "nenhum",
          rotulo: "",
          texto:
            "A 7ª Câmara Cível do TJGO manteve a decisão que liberou esses valores: o bloqueio era válido, mas o dinheiro estava apenas indisponível, sem levantamento pelo banco.",
        },
      ],
    },
  },
  {
    id: "bp-capa-equipe",
    tag: "BP",
    nome: "Capa com equipe",
    descricao:
      "Capa com duas a quatro pessoas: área, chamada, título e subtítulo em cima e, embaixo, cartões arredondados com a foto (com fundo) e o nome de cada uma, em ordem alfabética. Para participação em eventos, equipe, novos sócios.",
    ajustes: ["texto", "titulo", "y"],
    formato: "feed",
    usoEm: ["carrossel"],
    campos: [
      TEMA,
      { kind: "texto", key: "area", label: "Área", max: 30, dica: "Pílula dourada acima do título. Ex.: Eventos." },
      { kind: "texto", key: "chamada", label: "Chamada", max: 40, dica: "Pílula de contorno em caixa alta. Ex.: 28 DE OUTUBRO. Vazio = não usar." },
      titulo(100, "Manchete em caixa alta, até 3 linhas. Ex.: BISMARCHI | PIRES NO 3º CONGRESSO DE DIREITO RECUPERACIONAL, FALIMENTAR E EMPRESARIAL"),
      { kind: "texto", key: "subtitulo", label: "Subtítulo", max: 220, multilinha: true, dica: "Uma ou duas frases em caixa normal." },
      ...Array.from({ length: PESSOAS_CAPA }, (_, i) => pessoaFields(i + 1)).flat(),
    ],
    exemplo: {
      tema: "escuro",
      area: "3º Congresso OAB Campinas",
      chamada: "28 DE OUTUBRO",
      titulo: "NOSSOS SÓCIOS ESTARÃO ENTRE OS PALESTRANTES",
      subtitulo: "Gustavo Bismarchi Motta, Ricardo Viscardi Pires e Wagner Armani participam do 3º Congresso de Direito Recuperacional, Falimentar e Empresarial.",
      foto1: "",
      nome1: "Gustavo Bismarchi",
      foto2: "",
      nome2: "Ricardo V. Pires",
      foto3: "",
      nome3: "Wagner Armani",
      foto4: "",
      nome4: "",
    },
  },
  {
    id: "bp-pessoa",
    tag: "BP",
    nome: "Pessoa",
    descricao:
      "Slide interno com uma pessoa (sem o logo de 10 anos da capa): foto com fundo numa caixa arredondada de um lado e, do outro, papel, chamada curta, nome e um texto de apoio, alinhados à esquerda. Ex.: o painel de cada sócio num evento.",
    ajustes: ["fotoZoom", "fotoX", "fotoY", "texto", "titulo", "y"],
    // os mesmos três fundos dos slides de conteúdo, em papel e em navy
    fundos: { variacoes: 3, previa: (n, valores) => `/estudio/bp/fundo-${valores.tema === "escuro" ? "escuro" : "claro"}-${n}.jpg` },
    formato: "feed",
    usoEm: ["carrossel"],
    campos: [
      TEMA,
      {
        kind: "opcao",
        key: "lado",
        label: "Foto",
        padrao: "direita",
        opcoes: [
          { value: "direita", label: "À direita" },
          { value: "esquerda", label: "À esquerda" },
        ],
        dica: "Alterne o lado entre slides seguidos de pessoas.",
      },
      { kind: "imagem", key: "foto", label: "Foto (com fundo, vai na caixa)", pasta: "retratos" },
      { kind: "texto", key: "area", label: "Papel", max: 30, dica: "Pílula dourada. Ex.: Palestrante, Presidente de mesa." },
      { kind: "texto", key: "chamada", label: "Chamada", max: 40, dica: "Pílula de contorno em caixa alta. Ex.: 14H30 ÀS 15H30. Vazio = não usar." },
      titulo(60, "Nome em caixa alta, sem Dr./Dra., até 3 linhas. Ex.: RICARDO VISCARDI PIRES"),
      { kind: "texto", key: "rotulo", label: "Rótulo", max: 30, dica: "Linha pequena acima do destaque. Ex.: Painel:. Vazio = não usar." },
      { kind: "texto", key: "painel", label: "Destaque", max: 120, multilinha: true, dica: "Em negrito, abaixo do rótulo. Ex.: “RECUPERAÇÃO JUDICIAL EM DEBATE”. Vazio = não usar." },
      { kind: "texto", key: "subtitulo", label: "Texto de apoio", max: 240, multilinha: true, dica: "Uma ou duas frases sobre a participação." },
    ],
    exemplo: {
      tema: "claro",
      lado: "direita",
      foto: "",
      area: "Presidente de mesa",
      chamada: "14H30 ÀS 15H30",
      titulo: "RICARDO VISCARDI PIRES",
      rotulo: "Painel:",
      painel: "“RECUPERAÇÃO JUDICIAL EM DEBATE”",
      subtitulo: "Ricardo presidirá a mesa do painel dedicado à Recuperação Judicial e também participará do podcast oficial do Congresso.",
    },
  },
];

export const STUDIO_COLLECTIONS: StudioCollection[] = [BP_COLLECTION, OAB_COLLECTION];
export const STUDIO_TEMPLATES: StudioTemplateDef[] = [...BP_TEMPLATES, ...OAB_TEMPLATES];

// ---------- modelos criados na tela (banco) ----------

/*
 * Os modelos e coleções do banco entram aqui em memória: o servidor carrega no começo
 * das rotas do Estúdio (com cache curto) e o navegador ao abrir o Estúdio. Assim
 * getTemplate/templatesFor continuam síncronos para o resto do código.
 */
let dynamicTemplates: StudioTemplateDef[] = [];
let dynamicCollections: StudioCollection[] = [];

export function registerDynamic(data: { colecoes: StudioCollection[]; modelos: StudioTemplateDef[] }) {
  const codeTags = new Set(STUDIO_COLLECTIONS.map((c) => c.tag));
  const codeIds = new Set(STUDIO_TEMPLATES.map((t) => t.id));
  dynamicCollections = data.colecoes.filter((c) => !codeTags.has(c.tag));
  dynamicTemplates = data.modelos.filter((t) => !codeIds.has(t.id));
}

/** Coleções do código e as criadas na tela. */
export function allCollections(): StudioCollection[] {
  return [...STUDIO_COLLECTIONS, ...dynamicCollections];
}

function allTemplates(): StudioTemplateDef[] {
  return [...STUDIO_TEMPLATES, ...dynamicTemplates];
}

export function getTemplate(id: string): StudioTemplateDef | null {
  return allTemplates().find((t) => t.id === id) ?? null;
}

export function getCollection(tag: string): StudioCollection | null {
  return allCollections().find((c) => c.tag === tag) ?? null;
}

/**
 * Modelos de uma coleção que servem para o tipo de peça. Os desativados ficam de fora
 * da escolha, mas `incluirInativos` mantém os slides das peças que já os usam.
 */
export function templatesFor(tag: string, kind: PieceKind, { incluirInativos = false } = {}): StudioTemplateDef[] {
  return allTemplates().filter((t) => t.tag === tag && t.usoEm.includes(kind) && (incluirInativos || !t.inativo));
}
