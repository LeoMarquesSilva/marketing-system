"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestForm } from "@/components/solicitacoes/request-form";
import { ReelRequestForm } from "@/components/planner/reel-request-form";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Copy, ExternalLink, PlusCircle, Video } from "lucide-react";

type NewRequestMode = "standard" | "reel";

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  users: User[];
  designers: User[];
}

export function NewRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  users,
  designers,
}: NewRequestDialogProps) {
  const [mode, setMode] = useState<NewRequestMode>("standard");
  const [createdBriefingRequestId, setCreatedBriefingRequestId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSuccess = (result?: { requestId: string; briefingEnabled: boolean }) => {
    onSuccess?.();
    if (result?.briefingEnabled) {
      setCreatedBriefingRequestId(result.requestId);
      return;
    }
    setMode("standard");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setMode("standard");
      setCreatedBriefingRequestId(null);
      setCopied(false);
    }
    onOpenChange(next);
  };

  const briefingPath = createdBriefingRequestId
    ? `/briefings/identidade-visual/${createdBriefingRequestId}`
    : null;

  const copyBriefingLink = async () => {
    if (!briefingPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${briefingPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.open(briefingPath, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 rounded-lg border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-background dark:via-background dark:to-background/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]"
        aria-describedby="new-request-description"
      >
        <div className="shrink-0 border-b border-white/30 dark:border-border/50 px-6 py-4 pr-12 bg-white/80 dark:bg-[linear-gradient(135deg,var(--primary-dark-from)_0%,var(--primary-dark-to)_100%)] backdrop-blur-sm">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground leading-snug">
              Nova Solicitação
            </DialogTitle>
            <p id="new-request-description" className="mt-1.5 text-sm text-muted-foreground/90">
              {createdBriefingRequestId
                ? "A solicitação foi criada e o link já pode ser enviado."
                : mode === "reel"
                ? "Cria uma solicitação em Tarefas Leonardo com checklist de capa e legenda."
                : "Preencha os dados conforme a planilha de solicitações"}
            </p>
          </DialogHeader>

          {!createdBriefingRequestId && (
          <div className="flex gap-1 mt-4 border rounded-lg p-0.5 bg-muted/30 border-border/60">
            <button
              type="button"
              onClick={() => setMode("standard")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                mode === "standard"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <PlusCircle className="h-3.5 w-3.5" aria-hidden />
              Solicitação
            </button>
            <button
              type="button"
              onClick={() => setMode("reel")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                mode === "reel"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Video className="h-3.5 w-3.5" aria-hidden />
              Reel
            </button>
          </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
          {createdBriefingRequestId && briefingPath ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">Link do briefing gerado</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Envie este link ao solicitante. Após o login e o preenchimento, o card será sinalizado automaticamente.
              </p>
              <div className="mt-5 flex w-full max-w-md items-center gap-2 rounded-lg border border-[#dce9eb] bg-muted/30 p-2 text-left">
                <code className="min-w-0 flex-1 truncate px-2 text-xs text-foreground">
                  {briefingPath}
                </code>
                <Button type="button" size="sm" onClick={() => void copyBriefingLink()}>
                  {copied ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
                  {copied ? "Copiado" : "Copiar link"}
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" asChild>
                  <Link href={briefingPath} target="_blank">
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                    Abrir briefing
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : mode === "standard" ? (
            <RequestForm
              users={users}
              designers={designers}
              onSuccess={handleSuccess}
              embedded
            />
          ) : (
            <ReelRequestForm
              users={users}
              onSuccess={() => handleSuccess()}
              onCancel={() => setMode("standard")}
              embedded
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
