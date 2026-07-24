"use client";

import { useState } from "react";
import { Pencil, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NfcAssetInventoryItem, NfcAssetStatus } from "@/lib/nfc/types";

interface NfcAssetEditDialogProps {
  asset: NfcAssetInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

export function NfcAssetEditDialog({
  asset,
  open,
  onOpenChange,
  onSaved,
  onError,
}: NfcAssetEditDialogProps) {
  const [label, setLabel] = useState(asset?.label ?? "");
  const [status, setStatus] = useState<Exclude<NfcAssetStatus, "loaned">>(
    asset?.status === "loaned" ? "available" : asset?.status ?? "available"
  );
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [pending, setPending] = useState(false);

  if (!asset) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(`/api/nfc/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          status: asset.status === "loaned" ? undefined : status,
          notes: notes.trim() || null,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      onSaved(`${asset.assetNumber} atualizado com sucesso.`);
      onOpenChange(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-[#e8f8f8] text-[#347796]">
            <Pencil className="size-5" />
          </span>
          <DialogTitle>Editar {asset.assetNumber}</DialogTitle>
          <DialogDescription>
            Atualize a identificação, a situação e as observações do item.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-asset-label">Nome do item</Label>
            <Input
              id="edit-asset-label"
              required
              maxLength={80}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>

          {asset.status === "loaned" ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <Wrench className="mt-0.5 size-4 shrink-0" />
              <p>
                A situação só poderá ser alterada depois que a devolução for registrada.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="edit-asset-status">Situação</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as Exclude<NfcAssetStatus, "loaned">)
                }
              >
                <SelectTrigger id="edit-asset-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Disponível</SelectItem>
                  <SelectItem value="maintenance">Em manutenção</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-asset-notes">Observações</Label>
            <Textarea
              id="edit-asset-notes"
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Condição, cor ou instruções internas..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
