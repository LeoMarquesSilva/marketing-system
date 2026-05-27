"use client";

import { useCallback, useState } from "react";
import { Loader2, Mic, AlertCircle, FileText } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

interface WhatsappAudioPlayerProps {
  messageId: string;
  fromMe?: boolean;
  transcript?: string | null;
  onTranscript?: (text: string) => void;
}

export function WhatsappAudioPlayer({
  messageId,
  fromMe,
  transcript: initialTranscript,
  onTranscript,
}: WhatsappAudioPlayerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(initialTranscript ?? null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loading || src) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/evolution/messages/media?messageId=${encodeURIComponent(messageId)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar áudio.");
      const mime = typeof json.mimetype === "string" ? json.mimetype : "audio/ogg";
      const b64 = json.base64 as string;
      setSrc(`data:${mime};base64,${b64}`);
      void authFetch("/api/evolution/messages/played", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar áudio.");
    } finally {
      setLoading(false);
    }
  }, [loading, messageId, src]);

  const transcribe = useCallback(async () => {
    if (transcribing || transcript) return;
    setTranscribing(true);
    setTranscriptError(null);
    try {
      const res = await authFetch("/api/evolution/messages/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao transcrever.");
      const text = json.transcript as string;
      setTranscript(text);
      onTranscript?.(text);
    } catch (err) {
      setTranscriptError(
        err instanceof Error ? err.message : "Erro ao transcrever áudio."
      );
    } finally {
      setTranscribing(false);
    }
  }, [messageId, onTranscript, transcribing, transcript]);

  return (
    <div className="space-y-2">
      {src ? (
        <audio
          controls
          preload="metadata"
          src={src}
          className={cn("w-full max-w-[260px] h-9", fromMe && "opacity-95")}
        />
      ) : (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              fromMe
                ? "bg-white/15 hover:bg-white/25 text-white"
                : "bg-muted hover:bg-muted/80 text-foreground"
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {loading ? "Carregando…" : "Ouvir áudio"}
          </button>
          {error && (
            <p
              className={cn(
                "text-[10px] flex items-center gap-1",
                fromMe ? "text-white/70" : "text-destructive"
              )}
            >
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}

      {transcript ? (
        <p
          className={cn(
            "text-xs whitespace-pre-wrap rounded-lg px-2.5 py-1.5",
            fromMe ? "bg-white/10 text-white/90" : "bg-muted/60 text-foreground"
          )}
        >
          {transcript}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void transcribe()}
          disabled={transcribing}
          className={cn(
            "inline-flex items-center gap-1.5 text-[10px] font-medium opacity-80 hover:opacity-100",
            fromMe ? "text-white/80" : "text-muted-foreground"
          )}
        >
          {transcribing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          {transcribing ? "Transcrevendo…" : "Transcrever áudio"}
        </button>
      )}

      {transcriptError && (
        <p
          className={cn(
            "text-[10px] flex items-center gap-1",
            fromMe ? "text-white/70" : "text-destructive"
          )}
        >
          <AlertCircle className="h-3 w-3 shrink-0" />
          {transcriptError}
        </p>
      )}
    </div>
  );
}
