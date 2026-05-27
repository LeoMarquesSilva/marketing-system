"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

interface WhatsappVoiceRecorderProps {
  conversationId: string;
  disabled?: boolean;
  quotedWaMessageId?: string;
  quotedBody?: string | null;
  onSent: (message: {
    id: string;
    wa_message_id?: string | null;
    from_me: boolean;
    body: string | null;
    message_type?: string | null;
    message_timestamp: string;
  }) => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WhatsappVoiceRecorder({
  conversationId,
  disabled,
  quotedWaMessageId,
  quotedBody,
  onSent,
}: WhatsappVoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    if (disabled || recording || sending) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void (async () => {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          if (blob.size < 800) {
            setError("Gravação muito curta.");
            return;
          }
          setSending(true);
          try {
            const buffer = await blob.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            );
            const res = await authFetch("/api/evolution/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId,
                audioBase64: base64,
                quotedWaMessageId,
                quotedBody,
              }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Erro ao enviar áudio.");
            onSent(json.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao enviar áudio.");
          } finally {
            setSending(false);
            setDuration(0);
          }
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setError("Permita o microfone no navegador para gravar.");
    }
  }, [conversationId, disabled, onSent, quotedBody, quotedWaMessageId, recording, sending]);

  useEffect(() => {
    return () => {
      stopTimer();
      mediaRecorderRef.current?.stop();
    };
  }, [stopTimer]);

  if (sending) {
    return (
      <button
        type="button"
        disabled
        className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl border bg-muted text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600 font-medium tabular-nums">
          {formatDuration(duration)}
        </span>
        <button
          type="button"
          onClick={stopRecording}
          className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl bg-red-600 text-white hover:bg-red-700"
          title="Parar e enviar"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => void startRecording()}
        disabled={disabled}
        className={cn(
          "h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl border",
          "hover:bg-muted transition-colors disabled:opacity-50"
        )}
        title="Gravar áudio"
      >
        <Mic className="h-4 w-4" />
      </button>
      {error && <span className="text-[10px] text-destructive max-w-[80px] text-center">{error}</span>}
    </div>
  );
}
