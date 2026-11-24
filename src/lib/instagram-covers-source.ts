import { isExpiredInstagramCdnUrl } from "@/lib/instagram-thumbnail-client";

export interface CoverSourceInput {
  mediaType: string | null;
  mediaProductType?: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
}

/** De onde baixar a capa: vídeo/Reels usa o thumbnail; imagem e carrossel, a própria mídia. */
export function coverSourceUrl(candidate: CoverSourceInput): string | null {
  const isVideo = candidate.mediaType === "VIDEO" || candidate.mediaProductType === "REELS";
  const ordered = isVideo ? [candidate.thumbnailUrl, candidate.mediaUrl] : [candidate.mediaUrl, candidate.thumbnailUrl];
  for (const url of ordered) {
    if (!url) continue;
    if (isExpiredInstagramCdnUrl(url)) continue;
    // media_url de vídeo é .mp4: não serve de capa.
    if (/\.mp4(\?|$)/i.test(url)) continue;
    return url;
  }
  return null;
}
