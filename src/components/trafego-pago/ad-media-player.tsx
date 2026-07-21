"use client";

import { useCallback, useState } from "react";
import { Loader2, Play, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdMediaPlayerProps {
  videoId: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  mediaType: "video" | "image" | "none";
  adName: string;
  inactive?: boolean;
}

export function AdMediaPlayer({
  videoId,
  thumbnailUrl,
  imageUrl,
  mediaType,
  adName,
  inactive = false,
}: AdMediaPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [embedHtml, setEmbedHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = thumbnailUrl ?? imageUrl;

  const loadVideo = useCallback(async () => {
    if (!videoId || embedHtml) {
      setPlaying(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta-ads/video?videoId=${encodeURIComponent(videoId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar vídeo.");
      setEmbedHtml(json.embed_html as string);
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar vídeo.");
    } finally {
      setLoading(false);
    }
  }, [videoId, embedHtml]);

  if (playing && embedHtml) {
    const iframeMatch = embedHtml.match(/<iframe[\s\S]*?<\/iframe>/i);
    const safeEmbed = iframeMatch ? iframeMatch[0] : "";
    const responsiveEmbed = safeEmbed
      .replace(/width="[^"]*"/, 'width="100%"')
      .replace(/height="[^"]*"/, 'height="100%"');
    if (!responsiveEmbed) {
      return (
        <div
          className={cn(
            "relative w-[88px] md:w-[120px] aspect-[9/16] rounded-xl overflow-hidden bg-black/80 text-white text-xs flex items-center justify-center p-2",
            inactive && "opacity-70"
          )}
        >
          Embed indisponível
        </div>
      );
    }
    return (
      <div
        className={cn(
          "relative w-[88px] md:w-[120px] aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-md shrink-0",
          inactive && "opacity-70"
        )}
      >
        <div
          className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:border-0"
          dangerouslySetInnerHTML={{ __html: responsiveEmbed }}
        />
      </div>
    );
  }

  if (mediaType === "image" && imageUrl) {
    return (
      <div
        className={cn(
          "relative w-[88px] h-[88px] md:w-[100px] md:h-[100px] rounded-xl overflow-hidden bg-muted shadow-sm shrink-0",
          inactive && "opacity-60 grayscale"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={adName} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={mediaType === "video" ? loadVideo : undefined}
      disabled={mediaType !== "video" || loading}
      className={cn(
        "relative w-[88px] h-[88px] md:w-[100px] md:h-[100px] rounded-xl overflow-hidden bg-muted shadow-sm shrink-0 group",
        mediaType === "video" && "cursor-pointer hover:ring-2 hover:ring-[#04202f]/20",
        inactive && "opacity-60 grayscale"
      )}
      aria-label={mediaType === "video" ? `Reproduzir vídeo de ${adName}` : undefined}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      {mediaType === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          {loading ? (
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-lg">
              <Play className="h-5 w-5 text-[#04202f] ml-0.5" fill="currentColor" />
            </span>
          )}
        </span>
      )}

      {error && (
        <span className="absolute bottom-1 left-1 right-1 text-[9px] text-red-200 bg-red-900/80 rounded px-1 py-0.5">
          {error}
        </span>
      )}
    </button>
  );
}
