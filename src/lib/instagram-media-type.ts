/** Rótulos do formato entregue pela Meta API (media_type) */
export function getInstagramMediaLabel(mediaType: string | null | undefined): string {
  switch (mediaType) {
    case "VIDEO":
      return "Reel";
    case "CAROUSEL_ALBUM":
      return "Carrossel";
    case "IMAGE":
      return "Imagem";
    default:
      return mediaType ?? "Post";
  }
}

export const INSTAGRAM_MEDIA_TYPE_FILTERS = [
  { value: "VIDEO", label: "Reel" },
  { value: "IMAGE", label: "Imagem" },
  { value: "CAROUSEL_ALBUM", label: "Carrossel" },
] as const;
