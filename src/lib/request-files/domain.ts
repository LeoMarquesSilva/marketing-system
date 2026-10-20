import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";

/** Bucket PRIVADO das artes do planner (a página pública recebe URL assinada). */
export const REQUEST_FILES_BUCKET = "MARKETING-SYSTEM-ARTES";
export const REQUEST_FILE_MAX_BYTES = 500 * 1024 * 1024;
export const REQUEST_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/quicktime,application/zip,.zip";

const CONTENT_TYPES_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  zip: "application/zip",
};
const ALLOWED_CONTENT_TYPES = new Set(Object.values(CONTENT_TYPES_BY_EXT));

export interface RequestFile {
  id: string;
  requestId: string;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  sortOrder: number;
  createdAt: string;
}

/** Tipo aceito pelo bucket (pelo MIME do navegador ou, se faltar, pela extensão). */
export function requestFileContentType(name: string, type: string | undefined): string | null {
  if (type && ALLOWED_CONTENT_TYPES.has(type)) return type;
  if (type === "application/x-zip-compressed") return "application/zip";
  const ext = name.split(".").pop()?.toLowerCase();
  return (ext && CONTENT_TYPES_BY_EXT[ext]) || null;
}

export function isImageContentType(contentType: string | null | undefined): boolean {
  return Boolean(contentType?.startsWith("image/"));
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Ordem natural pelo nome ("slide-2" antes de "slide-10"), para carrosséis. */
export function sortFilesByName<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

export type PostingStepKind = "enquete" | "sticker" | "nota";

export interface PostingStep {
  /** Número da tela/slide do item do checklist ("Tela 2 · texto exato" → 2). */
  screen: number | null;
  kind: PostingStepKind;
  text: string;
  /** Opções da enquete ("[Enquete: A / B]" → ["A", "B"]). */
  options: string[];
}

/**
 * Linhas entre colchetes no texto de cada tela ("[Enquete: A / B]", "[Sticker: …]",
 * "[Inserir foto real…]") não vão na arte: são o que quem posta faz no Instagram.
 */
export function extractPostingSteps(items: { label: string; content: string | null }[]): PostingStep[] {
  const steps: PostingStep[] = [];
  for (const item of items) {
    const screen = Number(item.label.match(/^(?:tela|slide)\s+(\d+)/i)?.[1]) || null;
    for (const line of (item.content ?? "").split("\n")) {
      const inner = line.trim().match(/^\[(.+)\]$/)?.[1]?.trim();
      if (!inner || /^assinatura/i.test(inner)) continue;
      const typed = inner.match(/^(enquete|sticker)\s*:\s*(.+)$/i);
      if (!typed) {
        steps.push({ screen, kind: "nota", text: inner, options: [] });
        continue;
      }
      const kind = typed[1].toLowerCase() as "enquete" | "sticker";
      const text = typed[2].trim();
      const options = kind === "enquete" ? text.split("/").map((o) => o.trim()).filter(Boolean) : [];
      steps.push({ screen, kind, text, options });
    }
  }
  return steps;
}

/** Página de download (com login) das peças de uma tag: "OAB" → "/entregas/oab". */
export function plannerTagDeliveryPath(tag: string): string {
  return `/entregas/${encodeURIComponent(tag.toLowerCase())}`;
}

export function plannerTagDeliveryUrl(tag: string): string {
  return `${PUBLIC_APP_ORIGIN}${plannerTagDeliveryPath(tag)}`;
}

/** Parâmetro da rota de volta para a tag do título ("oab" → "OAB"). */
export function tagFromDeliveryParam(param: string): string | null {
  let tag: string;
  try {
    tag = decodeURIComponent(param).trim().toUpperCase();
  } catch {
    return null;
  }
  return tag.length > 0 && tag.length <= 24 && !tag.includes("]") ? tag : null;
}
