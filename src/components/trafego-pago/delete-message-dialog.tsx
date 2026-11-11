"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import { formatWhatsappMessageDisplay } from "@/lib/evolution-leads";
import type { WhatsappConversation, WhatsappMessage } from "./whatsapp-crm-types";

const DELETE_FAILED = "Não foi possível apagar a mensagem. Tente de novo.";

interface DeleteMessageDialogProps {
  /** Mensagem a apagar; null mantém o modal fechado. */
  message: WhatsappMessage | null;
  leadName: string;
  onClose: () => void;
  onDeleted: (message: WhatsappMessage, conversation: Partial<WhatsappConversation>) => void;
}

/** Confirmação do "apagar para todos": mostra a mensagem, porque não dá para desfazer. */
export function DeleteMessageDialog({ message, leadName, onClose, onDeleted }: DeleteMessageDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (deleting) return;
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!message || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? DELETE_FAILED);
      onDeleted(json.message as WhatsappMessage, json.conversation ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : DELETE_FAILED);
    } finally {
      setDeleting(false);
    }
  };

  const alreadyRead = message?.wa_status === "read" || message?.wa_status === "played";

  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Apagar para todos?</DialogTitle>
          <DialogDescription>
            A mensagem sai do WhatsApp de {leadName} e, no lugar dela, fica o aviso de mensagem apagada.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
          {message && (
            <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-lg rounded-tr-md bg-[#d9fdd3] px-4 py-2 text-sm leading-relaxed text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
              {formatWhatsappMessageDisplay(message.body, message.message_type)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {alreadyRead
              ? "O WhatsApp indica que ela já foi lida. Não dá para desfazer."
              : "Não dá para desfazer, e ela pode já ter sido vista na notificação."}
          </p>
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" disabled={deleting} onClick={close}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirm()}>
            {deleting && <Loader2 className="animate-spin" />}
            Apagar para todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
