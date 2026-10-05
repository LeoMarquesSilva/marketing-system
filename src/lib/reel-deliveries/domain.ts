import { z } from "zod";

export const REEL_DELIVERIES_BUCKET = "MARKETING-SYSTEM-REELS";
export const REEL_DELIVERY_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;
export const REEL_DELIVERY_COVER_MAX_BYTES = 15 * 1024 * 1024;
export const REEL_CAPTION_MAX_LENGTH = 2200;
export const REEL_COVER_TITLE_MAX_LENGTH = 160;
export const REEL_COVER_SUBTITLE_MAX_LENGTH = 240;
/** WAV mono 16 kHz ocupa ~1,9 MB por minuto; a transcrição aceita até 25 MB. */
export const REEL_AUDIO_MAX_BYTES = 24 * 1024 * 1024;

export const REEL_DELIVERY_STATUSES = [
  "awaiting_approval",
  "changes_requested",
  "approved",
  "ready",
  "published",
] as const;
export type ReelDeliveryStatus = (typeof REEL_DELIVERY_STATUSES)[number];

export const REEL_DELIVERY_STATUS_LABELS: Record<ReelDeliveryStatus, string> = {
  awaiting_approval: "Aguardando aprovação",
  changes_requested: "Ajustes pedidos",
  approved: "Capa e legenda",
  ready: "Pronto para publicar",
  published: "Publicado",
};

export type ReelDecisionValue = "approved" | "changes_requested";

export interface ReelDecisionInput {
  userId: string;
  decision: ReelDecisionValue;
}

/** Espelha `refresh_reel_delivery_status` para a interface antecipar o resultado. */
export function approvalStatusFor(
  participantIds: string[],
  decisions: ReelDecisionInput[],
  hasVersion: boolean
): "awaiting_approval" | "changes_requested" | "approved" {
  if (!hasVersion) return "awaiting_approval";
  const participants = new Set(participantIds);
  const relevant = decisions.filter((d) => participants.has(d.userId));
  if (relevant.some((d) => d.decision === "changes_requested")) return "changes_requested";
  const approved = new Set(relevant.filter((d) => d.decision === "approved").map((d) => d.userId));
  return participants.size > 0 && approved.size >= participants.size ? "approved" : "awaiting_approval";
}

/** Quem gravou ainda pode decidir enquanto o reel não seguiu para publicação. */
export function canParticipantDecide(status: ReelDeliveryStatus): boolean {
  return status === "awaiting_approval" || status === "changes_requested" || status === "approved";
}

export function missingForReady(input: {
  status: ReelDeliveryStatus;
  caption: string | null;
  coverPath: string | null;
}): string[] {
  const missing: string[] = [];
  if (input.status !== "approved" && input.status !== "ready" && input.status !== "published") {
    missing.push("aprovação de todas as pessoas");
  }
  if (!input.coverPath) missing.push("capa");
  if (!input.caption?.trim()) missing.push("legenda");
  return missing;
}

const SAFE_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;

/** Caminhos aceitos no bucket: deliveries/<id da entrega>/<arquivo>. */
export function isDeliveryStoragePath(path: string, deliveryId: string): boolean {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === "deliveries" && parts[1] === deliveryId && SAFE_SEGMENT.test(parts[2]);
}

export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"] as const;
export const COVER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const videoSchema = z.object({
  path: z.string().min(10).max(400),
  file_name: z.string().trim().min(1).max(240),
  size_bytes: z.number().int().positive().max(REEL_DELIVERY_VIDEO_MAX_BYTES),
  content_type: z.enum(VIDEO_CONTENT_TYPES),
});

export const createReelDeliverySchema = z.object({
  id: z.string().uuid(),
  slot_id: z.string().uuid(),
  participant_ids: z.array(z.string().uuid()).min(1).max(8),
  video: videoSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const addReelVersionSchema = z.object({
  video: videoSchema,
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const reelDecisionSchema = z
  .object({
    version_id: z.string().uuid(),
    decision: z.enum(["approved", "changes_requested"]),
    comment: z.string().trim().max(2000).optional().nullable(),
    /** Marketing registrando uma aprovação recebida por fora (WhatsApp, pessoalmente). */
    on_behalf_of: z.string().uuid().optional(),
  })
  .refine((value) => value.decision === "approved" || Boolean(value.comment?.trim()), {
    message: "Conte o que precisa ser ajustado.",
    path: ["comment"],
  });

export const updateReelDeliverySchema = z.object({
  participant_ids: z.array(z.string().uuid()).min(1).max(8).optional(),
  cover_title: z.string().max(REEL_COVER_TITLE_MAX_LENGTH).nullable().optional(),
  cover_subtitle: z.string().max(REEL_COVER_SUBTITLE_MAX_LENGTH).nullable().optional(),
  caption: z.string().max(REEL_CAPTION_MAX_LENGTH).nullable().optional(),
  cover_path: z.string().min(10).max(400).nullable().optional(),
  status: z.enum(["approved", "ready", "published"]).optional(),
});

export const reelCopyRequestSchema = z.object({
  /** Áudio extraído no navegador, em deliveries/<id>/audio-*.wav. */
  audio_path: z.string().min(10).max(400).optional(),
  /** Sem áudio novo, reaproveita a transcrição salva. */
  overwrite: z.boolean().default(false),
});

export const reelCopySchema = z.object({
  titulo: z.string().min(8).max(REEL_COVER_TITLE_MAX_LENGTH),
  subtitulo: z.string().min(8).max(REEL_COVER_SUBTITLE_MAX_LENGTH),
  legenda: z.string().min(80).max(REEL_CAPTION_MAX_LENGTH),
});

export interface ReelCreditPerson {
  name: string;
  gender: string | null;
  position: string | null;
  oab: string | null;
}

/** Nome curto para o crédito: primeiro e último nome. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts.join(" ");
}

/**
 * "Dr./Dra." só para advogados (OAB ou cargo jurídico) com gênero cadastrado
 * no RH; sem esse dado, só o nome. A IA nunca escolhe o tratamento.
 */
export function reelCreditName(person: ReelCreditPerson): string {
  const lawyer = Boolean(person.oab?.trim()) || /advogad|s[oó]ci[oa]/i.test(person.position ?? "");
  const gender = (person.gender ?? "").trim().toUpperCase();
  const title = lawyer && gender === "F" ? "Dra. " : lawyer && gender === "M" ? "Dr. " : "";
  return `${title}${shortName(person.name)}`;
}

export function reelCreditLine(people: ReelCreditPerson[], area: string): string {
  const names = people.map(reelCreditName);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names[0] ?? "";
  return `Por: ${joined} | BP - ${area}`;
}

/** Regras do "Guia de Produção: Capas e Legendas de Reels" do Bismarchi | Pires. */
export const REEL_COPY_PROMPT = `Você é responsável pela redação de Reels do Bismarchi | Pires Sociedade de Advogados.
Público principal: empresários, gestores, RH e profissionais jurídicos. Tom: institucional, maduro, estratégico, técnico e natural.

A transcrição é a fonte principal. Leia inteira, identifique o problema, a consequência e a informação mais útil para o público, e escolha o gancho: qual frase faria esse público parar para assistir? Reorganizar a fala para dar clareza é permitido; criar fatos, números, prazos ou decisões que não estejam na transcrição, não.

CAPA (título + subtítulo, sem imagem):
- Título: parte de uma dor, decisão, risco ou consequência real de quem gere uma empresa. Pode ser pergunta ou tensão. Evite jargão jurídico como primeiro contato; se o termo for pouco conhecido, traduza no título e deixe o conceito técnico para o subtítulo. Curto para leitura rápida em tela. Escreva o título em CAIXA ALTA.
- Subtítulo: explica o recorte do vídeo sem repetir o título. Use "entenda", "veja" ou "saiba" quando fizer sentido.
- A capa precisa prometer exatamente o que o vídeo entrega.
Exemplos aprovados:
EMPATE ENTRE SÓCIOS PODE TRAVAR A EMPRESA / Como o acordo de sócios pode prever saídas para o deadlock societário
PERDEU A SAFRA E NÃO CONSEGUE PAGAR O FINANCIAMENTO? / Entenda quando o produtor pode ter direito à prorrogação da dívida rural

LEGENDA DE REELS JURÍDICO (complementa o vídeo, não transcreve):
1. Gancho: a frase central da capa ou uma variação direta.
2. Contexto do problema em poucas linhas e por que importa.
3. Explicação jurídica essencial, com linguagem clara, sem excesso de artigos e incisos.
4. Impacto prático para empresas, gestores, sócios ou o público do vídeo.
5. Fechamento estratégico, sem promessas absolutas.
6. CTA exato: "Ficou com alguma dúvida? Clique no link da bio e fale com nossa equipe."
7. A linha de crédito exatamente como fornecida.
8. Três linhas apenas com um ponto ("."), depois a linha "Hashtags:" sozinha e, na linha seguinte, de 6 a 10 hashtags em minúsculas na ordem: #bismarchipires, tema, área, público, e por último #campinas #sp.
Parágrafos curtos, leitura fluida no Instagram, bem abaixo de 2.200 caracteres.

REELS INSTITUCIONAL (evento, Café com Cultura, bastidores, reconhecimento): título pode ser mais institucional e emocional, mas concreto, escolhendo um conceito central do encontro; legenda abre pelo tema central, apresenta convidado e recorte, conecta ao escritório, registra momentos importantes e agradece o convidado. Não use o CTA jurídico. Se não houver fala, descreva como "o registro mostra" ou "momentos do encontro".

PROIBIDO: travessões (— ou –); "mais do que X, Y" e "mais do que isso"; "inspirar" e variações; "Tempo de leitura"; promessas como "garante", "resolve", "sempre", "nunca" sem exatidão jurídica; aberturas genéricas; fechamentos de IA como "um novo cenário", "o futuro chegou", "mais do que uma tendência"; emojis (no máximo um, se indispensável); repetir a fala palavra por palavra.

Antes de responder, revise: a capa fala com o público de negócio antes do jurista? O título tem gancho e não só tema? O subtítulo acrescenta contexto? Há travessões, clichês ou fatos sem base? As hashtags estão em minúsculas? O CTA combina com o tipo de Reels?`;

/** Remove travessões que escapem do modelo, sem mexer em hífens de palavras compostas. */
export function stripDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
}

export function contentTypeForFile(name: string, type: string | undefined, kind: "video" | "cover"): string | null {
  const allowed: readonly string[] = kind === "video" ? VIDEO_CONTENT_TYPES : COVER_CONTENT_TYPES;
  if (type && allowed.includes(type)) return type;
  const ext = name.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> =
    kind === "video"
      ? { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/x-m4v" }
      : { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return (ext && byExt[ext]) || null;
}
