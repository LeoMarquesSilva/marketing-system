/**
 * Feedbacks de boas práticas (RH > Boas práticas).
 *
 * Só registro para o RH: nada daqui é enviado ao colaborador. Substitui a
 * planilha DASHBOARD_FEEDBACKS_BOAS_PRATICAS.xlsx.
 */

export interface GoodPracticeFeedback {
  id: string;
  occurred_on: string;
  sent_on: string;
  employee_id: string | null;
  employee_name: string;
  is_team: boolean;
  manager_employee_id: string | null;
  manager_name: string;
  area: string;
  category: string;
  /** Subtema da categoria (cozinha e sala de reunião); null = sem subtema. */
  subtopic: string | null;
  description: string;
  manager_action: string | null;
  responded_on: string | null;
  /** true = visualizado, false = não visualizado, null = sem dado do Feedz. */
  viewed: boolean | null;
  viewed_on: string | null;
  source: "sistema" | "planilha";
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
  photo_count: number;
  /** Linha do Feedz ligada a este registro (destinatário + data/hora de envio). */
  feedz_key: string | null;
  feedz_sent_at: string | null;
  feedz_viewed_at: string | null;
}

/** Vínculo com uma linha do relatório do Feedz (importação ou registro a partir dela). */
export interface FeedzLinkInput {
  key: string;
  sent_at: string;
  viewed_at: string | null;
  message: string;
}

export interface FeedzImportLog {
  id: string;
  file_name: string;
  rows_total: number;
  rows_linked: number;
  rows_updated: number;
  rows_unmatched: number;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  created_by_name: string | null;
}

/** Bucket PRIVADO das fotos das ocorrências (visualização por link assinado). */
export const FEEDBACK_PHOTOS_BUCKET = "RH-BOAS-PRATICAS";
export const FEEDBACK_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const FEEDBACK_PHOTOS_MAX = 10;
export const FEEDBACK_PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type FeedbackPhotoType = (typeof FEEDBACK_PHOTO_TYPES)[number];

export interface FeedbackPhoto {
  id: string;
  feedback_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  /** Quando a foto foi tirada (EXIF), se a câmera gravou. */
  taken_at: string | null;
  created_at: string;
  /** Link assinado, vale 1 hora. */
  url: string;
}

/** Colaborador do cadastro, para escolher quem recebeu e quem é o gestor. */
export interface FeedbackPerson {
  id: string;
  full_name: string;
  /** Nome de exibição: o do organograma, senão primeiro + último nome. */
  short_name: string;
  department: string | null;
  position: string | null;
  is_active: boolean;
  /** Foto do usuário (avatar → OneDrive) ou, na falta, a do organograma. */
  avatar_url: string | null;
}

export interface FeedbackInput {
  occurred_on: string;
  sent_on: string;
  employee_name: string;
  is_team: boolean;
  manager_name: string;
  area: string;
  category: string;
  /** "" = sem subtema. */
  subtopic: string;
  description: string;
  manager_action: string;
  responded_on: string;
  viewed: boolean | null;
  viewed_on: string;
  /** Só ao registrar a partir de uma linha do Feedz. */
  feedz?: FeedzLinkInput | null;
}

/** Áreas do Registro (mesma grafia das outras telas do RH; Marketing e Comercial à parte). */
export const FEEDBACK_AREAS = [
  "Reestruturação",
  "Cível",
  "Trabalhista",
  "Operações Legais",
  "Societário e Contratos",
  "ADD",
  "Recuperação de Crédito",
  "Tributário",
  "Marketing",
  "Comercial",
] as const;

export interface FeedbackCategoryInfo {
  name: string;
  /** Capítulo do Manual de Boas Práticas 2025; null = tema fora da numeração do manual. */
  chapter: number | null;
  /** O que entra nesta categoria, pelo manual. */
  hint: string;
  /** Subtemas opcionais (só nas categorias que concentram muitos casos). */
  subtopics?: readonly string[];
}

/**
 * Categorias = capítulos do Manual de Boas Práticas 2025, na mesma ordem, mais
 * dois temas sem capítulo próprio e "Outros". Adotadas em 26/10/2026, no lugar
 * das 10 categorias da planilha (registros antigos reclassificados).
 */
export const FEEDBACK_CATEGORY_INFO: readonly FeedbackCategoryInfo[] = [
  {
    name: "Uso consciente da sala de reunião",
    chapter: 1,
    hint: "Agendamento, liberar a sala e deixar arrumada (TV, HDMI, cadeiras, persianas).",
    subtopics: ["Arrumação", "Agendamento"],
  },
  { name: "Uso consciente dos banheiros", chapter: 2, hint: "Designação de gênero, pia só para higiene, limpeza." },
  { name: "Cigarro eletrônico", chapter: 3, hint: "Vape nas dependências internas." },
  { name: "Local correto para fumar", chapter: 4, hint: "Fumar na entrada do escritório." },
  { name: "Saúde e comportamento no ambiente de trabalho", chapter: 5, hint: "Vir ao escritório com sintomas de gripe ou resfriado." },
  {
    name: "Uso da cozinha",
    chapter: 6,
    hint: "Geladeira, louça e pia, limpeza do local, escala de almoço e tempo de permanência.",
    subtopics: ["Geladeira e alimentos", "Louça, pia e limpeza", "Permanência"],
  },
  { name: "Volume de conversas", chapter: 7, hint: "Tom de voz, chamadas fora da sala Outback ou da biblioteca." },
  { name: "Dress code", chapter: 8, hint: "Vestimenta." },
  {
    name: "Organização do ambiente de trabalho",
    chapter: 9,
    hint: "Copos e canecas na mesa, cadeiras fora do lugar, fios, sujeira e o entorno (mesa alta, impressoras, materiais).",
  },
  { name: "Segurança e confidencialidade", chapter: 10, hint: "Documentos ou notebook expostos, tela desbloqueada, senhas." },
  { name: "Recebimento de encomendas particulares", chapter: 11, hint: "Identificação, presença no dia, aviso prévio." },
  { name: "Biblioteca", chapter: 12, hint: "Prioridade a clientes e arrumação." },
  { name: "Uso e transporte de equipamentos do escritório", chapter: 13, hint: "Mochila corporativa, cuidado e dano, impressoras." },
  { name: "Local adequado para descanso", chapter: 14, hint: "Onde descansar no escritório." },
  { name: "Luz, ar e equipamentos ligados ao sair", chapter: null, hint: "Luzes, ar-condicionado ou notebook ligados no fim do expediente." },
  { name: "Estacionamento", chapter: null, hint: "Vagas de sócios e clientes, cone de sinalização." },
  { name: "Outros", chapter: null, hint: "Só quando nenhuma categoria acima serve." },
];

export const FEEDBACK_CATEGORIES: readonly string[] = FEEDBACK_CATEGORY_INFO.map((info) => info.name);

export function categoryInfo(category: string): FeedbackCategoryInfo | null {
  return FEEDBACK_CATEGORY_INFO.find((info) => info.name === category) ?? null;
}

/** "Uso da cozinha · Geladeira e alimentos" (ou só a categoria, sem subtema). */
export function categoryLabel(item: { category: string; subtopic: string | null }): string {
  return item.subtopic ? `${item.category} · ${item.subtopic}` : item.category;
}

/** "Cap. 6" para os capítulos do manual; null nos temas sem capítulo. */
export function chapterLabel(category: string): string | null {
  const chapter = categoryInfo(category)?.chapter;
  return chapter ? `Cap. ${chapter}` : null;
}

export type FeedbackFlowStatus = "respondido" | "visualizado" | "nao_visualizado" | "sem_dado";

export const FLOW_STATUS_LABEL: Record<FeedbackFlowStatus, string> = {
  respondido: "Respondido",
  visualizado: "Visto, sem resposta",
  nao_visualizado: "Não visualizado",
  sem_dado: "Sem dado do Feedz",
};

export type AreaBand = "acionamento" | "atencao" | "monitoramento";

export const AREA_BAND_LABEL: Record<AreaBand, string> = {
  acionamento: "Acionamento",
  atencao: "Atenção",
  monitoramento: "Monitoramento",
};

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
