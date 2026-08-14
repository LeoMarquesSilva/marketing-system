export const COLLABORATOR_PHOTO_MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validateCollaboratorPhotoFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const type = file.type || guessImageType(file.name);
  if (!ALLOWED_TYPES.has(type)) {
    return "Envie uma imagem (JPG, PNG, WEBP ou GIF).";
  }
  if (file.size > COLLABORATOR_PHOTO_MAX_BYTES) {
    return "A imagem deve ter no máximo 15 MB.";
  }
  return null;
}

function guessImageType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "";
}

export function slugifyPersonName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "colaborador"
  );
}

export function imageExtensionFromName(filename: string | null | undefined): string {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext === "jpg" || ext === "png" || ext === "webp" || ext === "gif") return ext;
  return "jpg";
}

export function buildCollaboratorPhotoFileName(
  personName: string,
  sequence: number,
  ext: string
): string {
  const safeExt = ext.replace(/^\./, "").toLowerCase() === "jpeg" ? "jpg" : ext.replace(/^\./, "").toLowerCase();
  return `${slugifyPersonName(personName)}-${sequence}.${safeExt || "jpg"}`;
}

export function nextPhotoSequence(
  existingNames: Array<string | null | undefined>,
  personName: string
): number {
  const slug = slugifyPersonName(personName);
  const pattern = new RegExp(`^${slug}-(\\d+)\\.[a-z0-9]+$`, "i");
  let max = 0;
  for (const name of existingNames) {
    const match = name?.trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export function downloadFileNameForPhoto(
  personName: string,
  photo: { originalFilename?: string | null },
  chronologicalIndex: number
): string {
  const current = photo.originalFilename?.trim() ?? "";
  const slug = slugifyPersonName(personName);
  if (new RegExp(`^${slug}-\\d+\\.[a-z0-9]+$`, "i").test(current)) {
    return current.toLowerCase().replace(/\.jpeg$/i, ".jpg");
  }
  return buildCollaboratorPhotoFileName(
    personName,
    chronologicalIndex,
    imageExtensionFromName(current)
  );
}
