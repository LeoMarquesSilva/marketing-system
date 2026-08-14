/** Monta URL de preview via Image Transformation do Supabase Storage. */

export interface CollaboratorPhotoPreviewOptions {
  width?: number;
  quality?: number;
  /** `contain` evita cortar o retrato; `cover` preenche o card. */
  resize?: "contain" | "cover";
}

/**
 * Converte URL pública (`/object/public/...`) em URL transformada
 * (`/render/image/public/...?width=&quality=`).
 * Se a URL não for do Storage público, devolve a original.
 */
export function collaboratorPhotoPreviewUrl(
  publicUrl: string,
  options: CollaboratorPhotoPreviewOptions = {}
): string {
  if (!publicUrl) return publicUrl;

  const marker = "/storage/v1/object/public/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return publicUrl;

  const width = options.width ?? 720;
  const quality = options.quality ?? 75;
  const resize = options.resize ?? "contain";

  const base = publicUrl.slice(0, idx);
  const objectPath = publicUrl.slice(idx + marker.length);
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });

  return `${base}/storage/v1/render/image/public/${objectPath}?${params.toString()}`;
}
