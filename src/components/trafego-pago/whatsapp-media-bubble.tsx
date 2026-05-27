"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, FileText, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import {
  getWhatsappMediaKind,
  whatsappMediaCaption,
  type WhatsappMediaKind,
} from "@/lib/evolution-leads";
import { cn } from "@/lib/utils";

interface WhatsappMediaBubbleProps {
  messageId: string;
  messageType?: string | null;
  body?: string | null;
  fromMe?: boolean;
}

export function WhatsappMediaBubble({
  messageId,
  messageType,
  body,
  fromMe,
}: WhatsappMediaBubbleProps) {
  const kind =
    getWhatsappMediaKind(messageType, body) ?? ("image" as WhatsappMediaKind);
  const caption = whatsappMediaCaption(body ?? null, kind);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loading || src) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/evolution/messages/media?messageId=${encodeURIComponent(messageId)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar mídia.");
      const mime = typeof json.mimetype === "string" ? json.mimetype : "image/jpeg";
      const b64 = json.base64 as string;
      setSrc(`data:${mime};base64,${b64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mídia.");
    } finally {
      setLoading(false);
    }
  }, [loading, messageId, src]);

  useEffect(() => {
    if (kind !== "image" || src) return;
    void load();
  }, [kind, messageId, src, load]);

  if (kind === "image") {
    return (
      <div className="space-y-1.5">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={caption ?? "Imagem"}
            className="max-w-full max-h-64 rounded-lg object-contain"
          />
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs opacity-80 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando imagem…
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void load()}
            className={cn(
              "text-xs underline",
              fromMe ? "text-white/80" : "text-muted-foreground"
            )}
          >
            Carregar imagem
          </button>
        )}
        {caption && (
          <p className="whitespace-pre-wrap break-words text-sm">{caption}</p>
        )}
        {error && <MediaError error={error} fromMe={fromMe} />}
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="space-y-1.5">
        {src ? (
          <video
            controls
            preload="metadata"
            src={src}
            className="max-w-full max-h-64 rounded-lg"
          />
        ) : (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium",
              fromMe
                ? "bg-white/15 hover:bg-white/25 text-white"
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {loading ? "Carregando vídeo…" : "Reproduzir vídeo"}
          </button>
        )}
        {caption && (
          <p className="whitespace-pre-wrap break-words text-sm">{caption}</p>
        )}
        {error && <MediaError error={error} fromMe={fromMe} />}
      </div>
    );
  }

  const fileLabel = caption ?? body?.replace(/^\[documento\]\s*/i, "") ?? "Documento";

  return (
    <div className="space-y-1.5">
      {src ? (
        <a
          href={src}
          download={fileLabel}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            fromMe
              ? "bg-white/15 hover:bg-white/25 text-white"
              : "bg-muted hover:bg-muted/80 text-foreground"
          )}
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate max-w-[200px]">{fileLabel}</span>
          <Download className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            fromMe
              ? "bg-white/15 hover:bg-white/25 text-white"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {loading ? "Carregando…" : fileLabel}
        </button>
      )}
      {error && <MediaError error={error} fromMe={fromMe} />}
    </div>
  );
}

function MediaError({ error, fromMe }: { error: string; fromMe?: boolean }) {
  return (
    <p
      className={cn(
        "text-[10px] flex items-center gap-1",
        fromMe ? "text-white/70" : "text-destructive"
      )}
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      {error}
    </p>
  );
}
