"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestForm } from "@/components/solicitacoes/request-form";
import type { User } from "@/lib/users";

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
  const handleSuccess = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-background dark:via-background dark:to-background/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]"
        aria-describedby="new-request-description"
      >
        <div className="shrink-0 border-b border-white/30 dark:border-border/50 px-6 py-4 pr-12 bg-white/80 dark:bg-[linear-gradient(135deg,var(--primary-dark-from)_0%,var(--primary-dark-to)_100%)] backdrop-blur-sm">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground leading-snug">
              Nova Solicitação
            </DialogTitle>
            <p id="new-request-description" className="mt-1.5 text-sm text-muted-foreground/90">
              Preencha os dados conforme a planilha de solicitações
            </p>
          </DialogHeader>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
          <RequestForm
            users={users}
            designers={designers}
            onSuccess={handleSuccess}
            embedded
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
