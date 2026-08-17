import JSZip from "jszip";
import {
  MAX_BATCH_PHOTO_OPS,
  assertBatchPhotoIds,
} from "@/lib/collaborator-photos/batch-ops";

export const MAX_BATCH_DOWNLOAD_PHOTOS = MAX_BATCH_PHOTO_OPS;

export function assertBatchDownloadIds(photoIds: unknown): string[] {
  return assertBatchPhotoIds(photoIds, "baixar");
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
