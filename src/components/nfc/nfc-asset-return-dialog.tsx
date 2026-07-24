"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NfcAssetLoanAdminItem } from "@/lib/nfc/types";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

interface NfcAssetReturnDialogProps {
  loan: NfcAssetLoanAdminItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReturned: (message: string) => void;
  onError: (message: string) => void;
}

export function NfcAssetReturnDialog({
  loan,
  open,
  onOpenChange,
  onReturned,
  onError,
}: NfcAssetReturnDialogProps) {
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  if (!loan) return null;

  const handleReturn = async () => {
    setPending(true);
    try {
      const response = await fetch(
        `/api/nfc/assets/loans/${encodeURIComponent(loan.id)}/return`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() || null }),
        }
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível devolver.");
      onReturned(`${loan.assetLabel} ${loan.assetNumber} devolvido com sucesso.`);
      onOpenChange(false);
      setNotes("");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível devolver.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <RotateCcw className="size-5" />
          </span>
          <DialogTitle>Confirmar devolução</DialogTitle>
          <DialogDescription>
            Esta ação encerrará o empréstimo e deixará o item disponível novamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl border border-[#dce9eb] bg-[#f7fafb] p-3">
          <Avatar className="size-11 border border-[#dce9eb]">
            <AvatarImage
              src={loan.borrower.avatarUrl || undefined}
              alt={loan.borrower.name}
            />
            <AvatarFallback className="bg-[#e8f8f8] text-xs font-semibold text-[#285f7a]">
              {getInitials(loan.borrower.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-[#347796]">
              {loan.assetLabel} {loan.assetNumber}
            </p>
            <p className="truncate text-sm font-semibold">{loan.borrower.name}</p>
            <p className="text-xs text-muted-foreground">
              Retirado em {new Date(loan.checkedOutAt).toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="return-notes">Observação da devolução</Label>
          <Textarea
            id="return-notes"
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opcional: condição do item ou ocorrência..."
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleReturn} disabled={pending}>
            <RotateCcw />
            {pending ? "Registrando..." : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
