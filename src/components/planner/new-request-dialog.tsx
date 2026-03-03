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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
        </DialogHeader>
        <RequestForm
          users={users}
          designers={designers}
          onSuccess={handleSuccess}
          embedded
        />
      </DialogContent>
    </Dialog>
  );
}
