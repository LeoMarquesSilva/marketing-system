import JSZip from "jszip";

export const MAX_BATCH_DOWNLOAD_PHOTOS = 40;

export function assertBatchDownloadIds(photoIds: unknown): string[] {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    throw new Error("Selecione ao menos uma foto para baixar.");
  }
  if (photoIds.length > MAX_BATCH_DOWNLOAD_PHOTOS) {
    throw new Error(`Selecione no máximo ${MAX_BATCH_DOWNLOAD_PHOTOS} fotos por vez.`);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of photoIds) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Lista de fotos inválida.");
    }
    const id = value.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  if (unique.length === 0) {
    throw new Error("Selecione ao menos uma foto para baixar.");
  }
  return unique;
}

/** Evita colisão de nomes dentro do ZIP. */
export function uniqueZipEntryName(filename: string, used: Set<string>): string {
  const lower = filename.toLowerCase();
  if (!used.has(lower)) {
    used.add(lower);
    return filename;
  }

  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  let index = 2;
  while (used.has(`${base}-${index}${ext}`.toLowerCase())) {
    index += 1;
  }
  const next = `${base}-${index}${ext}`;
  used.add(next.toLowerCase());
  return next;
}

export async function buildPhotosZip(
  files: Array<{ filename: string; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) {
    const entryName = uniqueZipEntryName(file.filename, used);
    zip.file(entryName, file.bytes);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export function batchDownloadZipName(ownerName?: string | null): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = (ownerName ?? "fotos")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40) || "fotos";
  return `${safe}-${stamp}.zip`;
}
