/**
 * Conteúdo fixo do PE27, tirado da apresentação do workshop de 05/11/2026
 * ("Ciclo PE27_WS_05nov2026.pptx", Camila Gracioli): etapas do ciclo, o Norte
 * (Visão, Missão sugerida, Propósito e CIVIL) e as provocações de cada dimensão.
 */

import type { Dimension } from "./types";

export interface CycleStep {
  /** Data da etapa (a revisão dos sócios é "até" essa data). */
  date: string;
  dateLabel: string;
  title: string;
  description: string;
  who: string;
  duration: string | null;
}

export const PE27_CYCLE_STEPS: CycleStep[] = [
  {
    date: "2026-11-05",
    dateLabel: "05/11",
    title: "Workshop",
    description: "Definir as alavancas de valor e sugerir metas estratégicas.",
    who: "Todos os grupos e sócios",
    duration: "4h",
  },
  {
    date: "2026-11-11",
    dateLabel: "Até 11/11",
    title: "Revisão dos sócios",
    description: "Revisão e definição das alavancas de valor e metas estratégicas.",
    who: "Sócios, com os consultores",
    duration: "2h",
  },
  {
    date: "2026-11-12",
    dateLabel: "12/11",
    title: "Devolutiva",
    description: "Devolutiva das alavancas de valor e metas estratégicas.",
    who: "Todos os grupos e sócios",
    duration: "1h",
  },
  {
    date: "2026-11-23",
    dateLabel: "23/11",
    title: "Plano tático",
    description: "Elaboração e definição das ações para atingir as metas.",
    who: "Todos os grupos e sócios de área",
    duration: "3h",
  },
  {
    date: "2026-12-04",
    dateLabel: "04/12",
    title: "Desdobramento por área",
    description: "Desdobramento e apresentação das metas e ações por área.",
    who: "Grupos e sócios de área",
    duration: "3h",
  },
  {
    date: "2027-01-08",
    dateLabel: "08/01/2027",
    title: "Divulgação do PE27",
    description: "Apresentação do plano para o escritório no Café com Cultura.",
    who: "Todo o escritório",
    duration: null,
  },
];

/** Hoje no fuso de Brasília, em AAAA-MM-DD (as etapas são por dia). */
export function todayInBrasilia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export type StepState = "feita" | "proxima" | "futura";

/** Etapas com data passada estão feitas; a primeira de hoje em diante é a próxima. */
export function cycleStepStates(today: string): StepState[] {
  const nextIndex = PE27_CYCLE_STEPS.findIndex((step) => step.date >= today);
  return PE27_CYCLE_STEPS.map((_, index) => {
    if (nextIndex === -1 || index < nextIndex) return "feita";
    return index === nextIndex ? "proxima" : "futura";
  });
}

export const PE27_NORTE = {
  visao:
    "Ser um dos escritórios mais relevantes do Brasil em Direito Empresarial, reconhecido pela atuação em situações de alta complexidade, crise e transformação empresarial.",
  missaoSugerida:
    "Apoiar empresários, empresas, credores e investidores em decisões críticas de crise, conflito e complexidade, unindo técnica jurídica, visão de negócio e execução disciplinada, antes, durante e depois do problema.",
  proposito:
    "Transformar desafios jurídicos em oportunidades, construindo relações duradouras e criando impactos reais para pessoas e negócios.",
  civil: [
    { letter: "C", value: "Cliente no centro" },
    { letter: "I", value: "Inovação constante" },
    { letter: "V", value: "Valorização de pessoas" },
    { letter: "I", value: "Inteligência em resultados" },
    { letter: "L", value: "Liberdade para criar" },
  ],
} as const;

/** Provocações entregues a cada grupo na Dinâmica 2 (pergunta central + 7). */
export const PE27_PROVOCACOES: Record<Dimension, { central: string; perguntas: string[] }> = {
  clientes: {
    central: "Como queremos ser reconhecidos pelos nossos clientes em 2030 e por que eles escolherão o Bismarchi e Pires?",
    perguntas: [
      "Qual o perfil dos clientes que queremos atender em 2030?",
      "Como comunicar com esses clientes?",
      "Qual o posicionamento do BP nas redes sociais?",
      "Marca, reputação, satisfação, êxito é importante? Como medir?",
      "Como captar e fidelizar os clientes?",
      "Excelência nas entregas?",
      "Como será a experiência e jornada dos clientes no BP?",
    ],
  },
  pessoas: {
    central: "Que pessoas, competências e cultura precisamos desenvolver para sustentar o BP em 2030?",
    perguntas: [
      "Quais as competências e formação requeridas dos colaboradores em 2030?",
      "Incentivar a saúde e qualidade de vida?",
      "Incentivar a diversidade e inclusão?",
      "Promover a cultura, clima e engajamento?",
      "Como atrair, reter e desenvolver os profissionais?",
      "Promover a meritocracia, carreira e remuneração?",
      "Medir e alavancar a eficiência operacional?",
    ],
  },
  acionistas: {
    central:
      "Que escritório queremos construir para 2030, qual valor econômico e institucional ele deverá gerar para os sócios e o que garantirá a perenidade do BP?",
    perguntas: [
      "Qual será o crescimento econômico-financeiro?",
      "Avaliar fusões e aquisições?",
      "Abertura de novos escritórios?",
      "Evoluir em tecnologia, inovação, digitalização e uso de IA?",
      "Participações em pesquisas, rankings, associações, publicações e eventos?",
      "Explorar novos negócios, criaremos uma área tributária?",
      "Qual a estrutura e organograma do BP em 2030?",
    ],
  },
};

/**
 * Temas procurados nos cartazes para mostrar o que apareceu em mais de um
 * grupo. Busca literal (sem acento), para ninguém precisar adivinhar de onde
 * veio a ligação.
 */
export const PE27_TEMAS: Array<{ label: string; terms: string[] }> = [
  { label: "NPS", terms: ["nps"] },
  { label: "Reputação", terms: ["reputacao"] },
  { label: "Eventos e mídia", terms: ["evento", "midia", "congresso"] },
  { label: "Parcerias", terms: ["parceri", "parceiro"] },
  { label: "Agenda positiva", terms: ["agenda positiva"] },
  { label: "Tecnologia e IA", terms: ["tecnologia", "automatizar", " ia"] },
];

/** Quem conduz o ciclo (fora dos grupos da Dinâmica 2). */
export const PE27_CONDUCAO: Array<{ role: string; employeeId?: string; userId?: string }> = [
  { role: "Sócio patrimonial", employeeId: "3da9c5f0-cf80-4743-aea9-76ec5c80ddb2" },
  { role: "Sócio patrimonial", employeeId: "1948ec31-133f-402d-9f66-27b6b5eea093" },
  { role: "Consultora de Gente e Gestão", userId: "a662c33b-412b-42c7-822f-eef0fab0af97" },
  { role: "Consultor", userId: "e1b3a867-f957-4a1f-886b-a2e1decf19f1" },
];

/** Arquivos do workshop no bucket PE27. */
export const PE27_FILES = {
  presentation: "workshop-05nov/apresentacao-workshop-pe27.pptx",
  groupsSheet: "workshop-05nov/dinamica2-grupos.jpg",
} as const;
