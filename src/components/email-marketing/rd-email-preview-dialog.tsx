"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type EmailRdEmail } from "@/lib/email-marketing";

interface RdEmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: EmailRdEmail | null;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RdEmailPreviewDialog({ open, onOpenChange, email }: RdEmailPreviewDialogProps) {
  if (!email?.htmlBody) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4 shrink-0">
          <DialogTitle className="text-left leading-snug pr-6">{email.name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {email.subject && (
              <p className="text-sm text-muted-foreground">Assunto: {email.subject}</p>
            )}
            <Badge variant="outline">Migrado do RD</Badge>
            {email.sendAt && (
              <span className="text-xs text-muted-foreground">Enviado {formatDate(email.sendAt)}</span>
            )}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden bg-muted/30 p-4">
          <iframe
            title={`Preview ${email.name}`}
            srcDoc={email.htmlBody}
            className="h-[min(70vh,720px)] w-full rounded-lg border bg-white shadow-sm"
            sandbox="allow-same-origin"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
