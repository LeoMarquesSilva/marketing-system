"use client";

import { useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";

interface WhatsappMediaPickerProps {
  conversationId: string;
  disabled?: boolean;
  quotedWaMessageId?: string | null;
  quotedBody?: string | null;
  onSent: (message: {
    id: string;
    wa_message_id?: string | null;
    from_me: boolean;
    body: string | null;
    message_type?: string | null;
    message_timestamp: string;
    wa_status?: string | null;
  }) => void;
}

export function WhatsappMediaPicker({
  conversationId,
  disabled,
  quotedWaMessageId,
  quotedBody,
  onSent,
}: WhatsappMediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);

  const upload = async (file: File) => {
    if (loadingRef.current || disabled) return;
    loadingRef.current = true;
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const mediaType = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "document";

      const res = await authFetch("/api/evolution/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          mediaType,
          mediaBase64: base64,
          fileName: file.name,
          caption: mediaType !== "document" ? file.name : undefined,
          quotedWaMessageId: quotedWaMessageId ?? undefined,
          quotedBody: quotedBody ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar arquivo.");
      onSent(json.message);
    } catch (err) {
      console.error(err);
    } finally {
      loadingRef.current = false;
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled || loadingRef.current}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl border",
          "hover:bg-muted transition-colors disabled:opacity-50"
        )}
        title="Enviar imagem, vídeo ou PDF"
      >
        {loadingRef.current ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
