/** Regras puras dos álbuns de fotos de eventos (sem I/O). */

export const EVENT_PHOTO_MAX_BYTES = 30 * 1024 * 1024;
export const EVENT_PHOTO_PREVIEW_MAX_SIDE = 1600;
export const EVENT_PHOTO_UPLOAD_CONCURRENCY = 3;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateEventPhotoFile(file: { name: string; type: string; size: number }): string | null {
  const type = file.type || guessImageType(file.name);
  if (!ALLOWED_TYPES.has(type)) return "Envie JPG, PNG ou WEBP.";
  if (file.size > EVENT_PHOTO_MAX_BYTES) return "A imagem deve ter no máximo 30 MB.";
  return null;
}

function guessImageType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "";
}

export function slugifyAlbumTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Garante slug único acrescentando -2, -3… quando já existe. */
export function uniqueAlbumSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, 80 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Data ISO (yyyy-mm-dd) válida ou null. */
export function parseAlbumDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function formatAlbumDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Dimensões da prévia mantendo proporção, sem ampliar imagens pequenas. */
export function previewDimensions(
  width: number,
  height: number,
  maxSide = EVENT_PHOTO_PREVIEW_MAX_SIDE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Ordena nomes de arquivo com números naturais ("foto-2" antes de "foto-10"); sem nome vai pro fim. */
export function compareEventPhotoNames(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

/** Nome de download: <album>-<nnn>.<ext>, estável pela ordem da foto no álbum. */
export function eventPhotoDownloadName(albumSlug: string, index: number, filename: string | null): string {
  const ext = (filename?.split(".").pop() ?? "jpg").toLowerCase().replace("jpeg", "jpg");
  const safeExt = /^(jpg|png|webp)$/.test(ext) ? ext : "jpg";
  return `${albumSlug}-${String(index + 1).padStart(3, "0")}.${safeExt}`;
}
