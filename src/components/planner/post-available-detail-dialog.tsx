"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Link2, Copy, CheckCircle2, User, Building2 } from "lucide-react";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostAvailableDetailDialogProps {
  request: MarketingRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PostAvailableDetailDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: PostAvailableDetailDialogProps) {
  const [postedAt, setPostedAt] = useState("");
  const [isMarking, setIsMarking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      const today = format(new Date(), "yyyy-MM-dd");
      setPostedAt(today);
    }
  }, [open]);

  const handleMarkAsPosted = async () => {
    if (!request) return;
    const dateStr = postedAt.trim();
    if (!dateStr) return;
    setIsMarking(true);
    const postedAtIso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
    const { error } = await updateMarketingRequest(request.id, {
      completion_type: "postagem_feita",
      posted_at: postedAtIso,
    });
    setIsMarking(false);
    if (!error) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const handleCopyLink = async () => {
    if (!request?.art_link) return;
    await navigator.clipboard.writeText(request.art_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md w-[calc(100vw-2rem)] overflow-hidden"
        aria-describedby="post-available-dialog-description"
      >
        <DialogHeader className="min-w-0">
          <DialogTitle className="text-base font-semibold break-words">
            Post disponível — marcar como postado
          </DialogTitle>
          <DialogDescription id="post-available-dialog-description" className="break-words">
            Use o link da arte para baixar e depois registre a postagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0 overflow-hidden">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Post
            </p>
            <p className="text-sm font-medium text-foreground break-words">
              {request.description || request.title}
            </p>
            {request.description && request.title && request.title !== request.description && (
              <p className="text-xs text-muted-foreground mt-0.5 break-words">{request.title}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {request.requesting_area && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {request.requesting_area}
              </span>
            )}
            {(request.nome_advogado || request.solicitante_user?.name || request.solicitante) && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {request.nome_advogado || request.solicitante_user?.name || request.solicitante}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Link da arte
            </p>
            {request.art_link ? (
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 min-w-0 overflow-hidden">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground flex-shrink-0" aria-hidden />
                  <a
                    href={request.art_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate min-w-0 flex-1 overflow-hidden text-ellipsis block"
                    title={request.art_link}
                  >
                    {request.art_link}
                  </a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={request.art_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5"
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      Abrir arte
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Copiar link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Link da arte ainda não informado.
              </p>
            )}
          </div>

          <div className="min-w-0 w-full">
            <label htmlFor="posted-at" className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
              Dia da postagem
            </label>
            <DatePickerField
              id="posted-at"
              value={postedAt}
              onChange={setPostedAt}
              placeholder="Selecione a data"
              className="w-full min-w-0 max-w-full"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleMarkAsPosted}
            disabled={isMarking || !postedAt.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isMarking ? "Salvando…" : "Marcar como postado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
