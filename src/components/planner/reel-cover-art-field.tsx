"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/utils/supabase/client";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import { uploadReelDeliveryFile } from "@/lib/storage-buckets";
import {
  REEL_DELIVERIES_BUCKET,
  REEL_DELIVERY_COVER_MAX_BYTES,
  contentTypeForFile,
} from "@/lib/reel-deliveries/domain";

/**
 * Arte da capa de um reel (tarefas "Capa de Reels"): a designer sobe a imagem
 * direto no sistema. Quando a tarefa é aprovada, ela vira a capa do reel.
 */
export function ReelCoverArtField({
  requestId,
  reelDeliveryId,
  imagePath,
  canEdit,
  onUploaded,
}: {
  requestId: string;
  reelDeliveryId: string;
  imagePath: string | null;
  canEdit: boolean;
  onUploaded?: (path: string) => void;
}) {
  const [path, setPath] = useState(imagePath);
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) return;
    void supabase.storage
      .from(REEL_DELIVERIES_BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => { if (!cancelled) setUrl(data?.signedUrl ?? null); });
    return () => { cancelled = true; };
  }, [path]);

  async function upload(file: File | undefined) {
    setError(null);
    if (!file) return;
    const contentType = contentTypeForFile(file.name, file.type, "cover");
    if (!contentType) return setError("Use JPG, PNG ou WebP.");
    if (file.size > REEL_DELIVERY_COVER_MAX_BYTES) return setError("A imagem passa de 15 MB.");
    setUploading(true);
    try {
      const { path: uploaded } = await uploadReelDeliveryFile(reelDeliveryId, file, "cover", contentType);
      const { error: saveError } = await updateMarketingRequest(requestId, { art_image_path: uploaded });
      if (saveError) throw new Error(saveError);
      setUrl(null);
      setPath(uploaded);
      onUploaded?.(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={!canEdit || uploading}
        aria-label={path ? "Trocar a arte da capa" : "Enviar a arte da capa"}
        className="grid aspect-[9/16] w-28 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-[#9fc9d3] bg-[#f8fbfb] text-center text-xs text-slate-500 transition hover:border-[#347796] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40 disabled:cursor-default"
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin text-[#347796]" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Arte da capa" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-2">
            <ImageUp className="size-5 text-[#347796]" />
            {canEdit ? "Enviar imagem" : "Sem imagem"}
          </span>
        )}
      </button>
      <div className="min-w-0 space-y-2 text-sm">
        <p className="text-muted-foreground">
          {path
            ? "Quando a tarefa for aprovada, esta imagem vai sozinha para a capa do reel."
            : "Suba a arte final como imagem (JPG, PNG ou WebP). Não precisa de link."}
        </p>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
              <ImageUp />{path ? "Trocar imagem" : "Enviar imagem"}
            </Button>
          )}
          {url && (
            <Button asChild size="sm" variant="outline">
              <a href={url} download target="_blank" rel="noopener noreferrer"><Download />Abrir</a>
            </Button>
          )}
        </div>
        {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </div>
  );
}
