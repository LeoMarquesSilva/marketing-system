"use client";

import { Reply, X } from "lucide-react";
import type { WhatsappReplyTarget } from "./whatsapp-crm-types";

interface ReplyPreviewProps {
  replyTo: WhatsappReplyTarget | null;
  fallbackName: string;
  onCancel: () => void;
}

export function ReplyPreview({ replyTo, fallbackName, onCancel }: ReplyPreviewProps) {
  if (!replyTo) return null;

  return (
    <div className="mb-2 flex items-start gap-3 rounded-xl border-l-4 border-emerald-500 bg-white px-3 py-2 text-xs shadow-sm dark:bg-card">
      <Reply className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">
          Respondendo a {replyTo.fromName || fallbackName}
        </p>
        <p className="truncate text-muted-foreground">{replyTo.body || "Mensagem sem texto"}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Cancelar resposta"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
