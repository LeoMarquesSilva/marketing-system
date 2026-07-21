"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestForm } from "@/components/solicitacoes/request-form";
import { ReelRequestForm } from "@/components/planner/reel-request-form";
import type { User } from "@/lib/users";
import { cn } from "@/lib/utils";
import { PlusCircle, Video } from "lucide-react";

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

  const handleSuccess = () => {
    setMode("standard");
    onOpenChange(false);
    onSuccess?.();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setMode("standard");
    onOpenChange(next);
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
              {mode === "reel"
                ? "Cria uma solicitação em Tarefas Leonardo com checklist de capa e legenda."
                : "Preencha os dados conforme a planilha de solicitações"}
            </p>
          </DialogHeader>

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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
          {mode === "standard" ? (
            <RequestForm
              users={users}
              designers={designers}
              onSuccess={handleSuccess}
              embedded
            />
          ) : (
            <ReelRequestForm
              users={users}
              onSuccess={handleSuccess}
              onCancel={() => setMode("standard")}
              embedded
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
