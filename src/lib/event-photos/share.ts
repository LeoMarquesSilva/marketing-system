/**
 * Link de convidado de um álbum de fotos de evento: /galeria/<token>, sem login.
 * Regras puras (sem I/O), usadas pela página pública, pela API e pelo modal do marketing.
 */

import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";

export const GALLERY_PATH_PREFIX = "/galeria";
/** Validades oferecidas ao criar o link (dias); null = sem prazo. */
export const SHARE_EXPIRY_OPTIONS = [30, 90, 365, null] as const;
export const SHARE_DEFAULT_EXPIRY_DAYS = 90;
export const SHARE_LABEL_MAX = 120;
/** Fora do Chrome/Edge o ZIP é montado na memória: cada parte fica abaixo disso. */
export const ZIP_PART_MAX_BYTES = 450 * 1024 * 1024;

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

export function galleryPath(token: string): string {
  return `${GALLERY_PATH_PREFIX}/${token}`;
}

export function galleryUrl(token: string, origin: string = PUBLIC_APP_ORIGIN): string {
  return `${origin.replace(/\/$/, "")}${galleryPath(token)}`;
}

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(
  share: { revokedAt: string | null; expiresAt: string | null },
  now: number = Date.now()
): ShareStatus {
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && Date.parse(share.expiresAt) <= now) return "expired";
  return "active";
}

/** Validade escolhida no modal → data de expiração (ISO) ou null. Fora das opções = padrão. */
export function shareExpiresAt(days: unknown, now: number = Date.now()): string | null {
  if (days === null) return null;
  const valid = SHARE_EXPIRY_OPTIONS.find((option) => option !== null && option === days);
  const chosen = valid ?? SHARE_DEFAULT_EXPIRY_DAYS;
  return new Date(now + chosen * 24 * 60 * 60 * 1000).toISOString();
}

export function normalizeShareLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const label = raw.replace(/\s+/g, " ").trim();
  if (!label || label.length > SHARE_LABEL_MAX) return null;
  return label;
}

/** Só aceita logo hospedada no nosso Storage (evita link para imagem de terceiros na página). */
export function isOwnStorageUrl(url: unknown, supabaseUrl: string): url is string {
  if (typeof url !== "string" || !supabaseUrl) return false;
  const base = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/`;
  return url.startsWith(base) && !url.includes("..");
}

/** Miniatura 1200x630 (JPEG) feita pelo próprio Storage, para a prévia do link no WhatsApp. */
export function shareImageUrl(publicUrl: string): string {
  const transformed = publicUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  if (transformed === publicUrl) return publicUrl;
  return `${transformed}?width=1200&height=630&resize=cover&quality=70`;
}

export interface SizedFile {
  size: number | null;
}

/**
 * Divide os arquivos em partes que caibam na memória do navegador. Arquivo sem tamanho conta como
 * o maior tamanho conhecido; um arquivo maior que o limite vai sozinho numa parte.
 */
export function splitIntoParts<T extends SizedFile>(files: T[], maxBytes: number = ZIP_PART_MAX_BYTES): T[][] {
  const fallback = Math.max(0, ...files.map((f) => f.size ?? 0));
  const parts: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const file of files) {
    const size = file.size ?? fallback;
    if (current.length > 0 && currentBytes + size > maxBytes) {
      parts.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += size;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2).toLocaleString("pt-BR")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}
