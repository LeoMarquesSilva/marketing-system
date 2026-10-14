// Regras de texto dos certificados do Programa de Educação Continuada.
// Puro (sem pdf-lib nem DOM): a tela e o gerador de PDF usam as mesmas funções.

export type CertificateWeight = "regular" | "medium" | "bold";

export interface TextRun {
  text: string;
  weight: CertificateWeight;
}

/** Tipos de evento com o artigo e a concordância usados no parágrafo. */
export const EVENT_TYPES = [
  { value: "Workshop", feminino: false },
  { value: "Curso", feminino: false },
  { value: "Treinamento", feminino: false },
  { value: "Webinar", feminino: false },
  { value: "Seminário", feminino: false },
  { value: "Encontro", feminino: false },
  { value: "Palestra", feminino: true },
  { value: "Aula", feminino: true },
  { value: "Masterclass", feminino: true },
  { value: "Mentoria", feminino: true },
  { value: "Imersão", feminino: true },
  { value: "Oficina", feminino: true },
] as const;

export const CERTIFICATE_PARTNERS = [
  { id: "ricardo", nome: "Ricardo Viscardi Pires", cargo: "Sócio" },
  { id: "gustavo", nome: "Gustavo Bismarchi Motta", cargo: "Sócio" },
] as const;

export type PartnerId = (typeof CERTIFICATE_PARTNERS)[number]["id"];

export const ROLE_SUGGESTIONS = ["Facilitador", "Facilitadora", "Palestrante", "Instrutor", "Instrutora", "Mediador", "Mediadora"];

/** `**texto**` sai em negrito e `*texto*` em peso médio, como no modelo do Illustrator. */
export const DEFAULT_CERTIFICATE_TEXT = [
  "O Bismarchi | Pires Sociedade de Advogados certifica que **{nome}**",
  "participou {tipo} *“{curso}”*",
  "com carga horária de {carga_horaria}, {realizado} {periodo} **{data}.**",
].join("\n");

export const TEXT_PLACEHOLDERS = ["{nome}", "{tipo}", "{curso}", "{carga_horaria}", "{realizado}", "{periodo}", "{data}"];

export interface SignatureImage {
  bytes: Uint8Array;
  format: "png" | "jpg";
}

export interface CertificateFacilitator {
  nome: string;
  cargo: string;
  assinatura?: SignatureImage | null;
}

export interface CertificateConfig {
  tipo: string;
  curso: string;
  /** yyyy-mm-dd */
  dataInicio: string;
  /** yyyy-mm-dd, só quando o evento dura mais de um dia. */
  dataFim?: string | null;
  cargaHorariaMinutos: number;
  texto: string;
  nomeEmMaiusculas: boolean;
  facilitadores: CertificateFacilitator[];
  socios: PartnerId[];
}

export type CertificateSignatory =
  | { nome: string; cargo: string; assinatura: { kind: "partner"; id: PartnerId } }
  | { nome: string; cargo: string; assinatura: { kind: "image"; image: SignatureImage } | null };

/** Sem acento, sem caixa e sem espaço nas pontas, para comparar textos digitados. */
export const foldText = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function eventTypeIsFeminine(tipo: string): boolean {
  const normalized = foldText(tipo);
  return EVENT_TYPES.find((type) => foldText(type.value) === normalized)?.feminino ?? false;
}

export function formatCargaHoraria(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  const horasTexto = horas === 1 ? "1 hora" : `${horas} horas`;
  const minutosTexto = resto === 1 ? "1 minuto" : `${resto} minutos`;
  if (horas === 0) return minutosTexto;
  if (resto === 0) return horasTexto;
  return `${horasTexto} e ${minutosTexto}`;
}

function parseIsoDate(value: string | null | undefined): { dia: string; mes: string; ano: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  return { ano: match[1], mes: match[2], dia: match[3] };
}

/** "no dia 17/09/2026" ou "entre os dias 01 e 03/07/2026". */
export function formatPeriodo(dataInicio: string, dataFim?: string | null): { periodo: string; data: string } {
  const inicio = parseIsoDate(dataInicio);
  const fim = parseIsoDate(dataFim);
  if (!inicio) return { periodo: "no dia", data: "" };
  const completa = (d: { dia: string; mes: string; ano: string }) => `${d.dia}/${d.mes}/${d.ano}`;
  if (!fim || dataFim! <= dataInicio) return { periodo: "no dia", data: completa(inicio) };
  if (inicio.ano !== fim.ano) return { periodo: "entre os dias", data: `${completa(inicio)} e ${completa(fim)}` };
  if (inicio.mes !== fim.mes) {
    return { periodo: "entre os dias", data: `${inicio.dia}/${inicio.mes} e ${completa(fim)}` };
  }
  return { periodo: "entre os dias", data: `${inicio.dia} e ${completa(fim)}` };
}

export function formatParticipantName(nome: string, emMaiusculas: boolean): string {
  const clean = nome.replace(/\s+/g, " ").trim();
  return emMaiusculas ? clean.toLocaleUpperCase("pt-BR") : clean;
}

/** Quebra uma linha com marcações `**`/`*` em trechos com peso. */
export function parseMarkup(line: string): TextRun[] {
  const runs: TextRun[] = [];
  let bold = false;
  let medium = false;
  for (const part of line.split(/(\*\*|\*)/)) {
    if (part === "**") {
      bold = !bold;
      continue;
    }
    if (part === "*") {
      medium = !medium;
      continue;
    }
    if (!part) continue;
    const weight: CertificateWeight = bold ? "bold" : medium ? "medium" : "regular";
    const last = runs[runs.length - 1];
    if (last && last.weight === weight) last.text += part;
    else runs.push({ text: part, weight });
  }
  return runs;
}

/** Texto final do certificado de uma pessoa, já em linhas e trechos com peso. */
export function buildCertificateText(config: CertificateConfig, participante: string): TextRun[][] {
  const feminino = eventTypeIsFeminine(config.tipo);
  const { periodo, data } = formatPeriodo(config.dataInicio, config.dataFim);
  const tipo = config.tipo.trim();
  const curso = config.curso.replace(/\s+/g, " ").trim();
  // "Workshop de fluxos…" já diz o tipo: vira "participou do “Workshop de fluxos…”".
  const cursoJaTemTipo = Boolean(tipo) && foldText(curso).startsWith(`${foldText(tipo)} `);
  const artigo = feminino ? "da" : "do";
  // Asterisco nos dados viraria marcação; remove antes de substituir.
  const values: Record<string, string> = {
    "{nome}": formatParticipantName(participante, config.nomeEmMaiusculas),
    "{tipo}": cursoJaTemTipo || !tipo ? artigo : `${artigo} ${tipo}`,
    "{curso}": curso,
    "{carga_horaria}": formatCargaHoraria(config.cargaHorariaMinutos),
    "{realizado}": feminino ? "realizada" : "realizado",
    "{periodo}": periodo,
    "{data}": data,
  };
  return config.texto
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/\{[a-z_]+\}/g, (key) => (key in values ? values[key].replace(/\*/g, "") : key))
    )
    .map((line) => parseMarkup(line.replace(/ {2,}/g, " ").trim()))
    .filter((runs) => runs.length > 0);
}

/** Quem assina, da esquerda para a direita: facilitadores e depois os sócios marcados. */
export function buildSignatories(config: CertificateConfig): CertificateSignatory[] {
  const facilitadores: CertificateSignatory[] = config.facilitadores
    .filter((f) => f.nome.trim())
    .map((f) => ({
      nome: f.nome.replace(/\s+/g, " ").trim(),
      cargo: f.cargo.trim(),
      assinatura: f.assinatura ? { kind: "image" as const, image: f.assinatura } : null,
    }));
  const socios: CertificateSignatory[] = CERTIFICATE_PARTNERS.filter((p) => config.socios.includes(p.id)).map(
    (p) => ({ nome: p.nome, cargo: p.cargo, assinatura: { kind: "partner" as const, id: p.id } })
  );
  return [...facilitadores, ...socios];
}

/** Problemas que impedem gerar os certificados, em linguagem da tela. */
export function validateCertificateConfig(config: CertificateConfig): string[] {
  const issues: string[] = [];
  if (!config.curso.trim()) issues.push("Informe o nome do curso.");
  if (!parseIsoDate(config.dataInicio)) issues.push("Informe a data de realização.");
  if (config.dataFim && parseIsoDate(config.dataFim) && config.dataFim < config.dataInicio) {
    issues.push("A data final é anterior à data inicial.");
  }
  if (!(config.cargaHorariaMinutos > 0)) issues.push("Informe a carga horária.");
  if (!config.texto.includes("{nome}")) issues.push("O texto do certificado precisa ter o campo {nome}.");
  return issues;
}

export function certificateFileName(participante: string): string {
  const safe = participante
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `Certificado - ${safe || "participante"}.pdf`;
}
