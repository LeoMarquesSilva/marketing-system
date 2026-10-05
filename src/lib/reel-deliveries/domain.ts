import { z } from "zod";

export const REEL_DELIVERIES_BUCKET = "MARKETING-SYSTEM-REELS";
export const REEL_DELIVERY_VIDEO_MAX_BYTES = 1024 * 1024 * 1024;
export const REEL_DELIVERY_COVER_MAX_BYTES = 15 * 1024 * 1024;
export const REEL_CAPTION_MAX_LENGTH = 2200;

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
  title: z.string().trim().min(3).max(240),
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
  title: z.string().trim().min(3).max(240).optional(),
  participant_ids: z.array(z.string().uuid()).min(1).max(8).optional(),
  caption: z.string().max(REEL_CAPTION_MAX_LENGTH).nullable().optional(),
  cover_path: z.string().min(10).max(400).nullable().optional(),
  status: z.enum(["approved", "ready", "published"]).optional(),
});

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
