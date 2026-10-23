import { IMAGE_PATH_RE } from "./fields";

/** Bucket privado das imagens enviadas no Estúdio (fotos de capa, logos de clientes). */
export const STUDIO_IMAGES_BUCKET = "ESTUDIO-PECAS";
export const STUDIO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const STUDIO_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Endereço de mesma origem (com login), que a prévia e a exportação conseguem ler. */
export function studioImageUrl(path: string): string {
  return `/api/estudio/imagens/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function isStudioImagePath(path: string): boolean {
  return IMAGE_PATH_RE.test(path);
}

/** "Thayná Rodrigues Cabalin.png" → "thayna-rodrigues-cabalin" */
export function slugifyFileName(name: string): string {
  return (
    name
      .replace(/\.[a-z0-9]+$/i, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "imagem"
  );
}

/**
 * Nome legível da imagem na galeria ("1730000000000-thayna-cabalin-316ff209.png" →
 * "thayna cabalin"; o final hexadecimal é o código da foto de origem).
 */
export function imageDisplayName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file
    .replace(/^\d+-/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/-[0-9a-f]{8}$/, "")
    .replace(/-/g, " ");
}
