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
import { Link2, Copy, CheckCircle2, User, Building2, Archive } from "lucide-react";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import { getContentBankDisplayTitle, isReelRequest } from "@/lib/planner-posts";
import { fetchChecklistForRequest, type ChecklistItem } from "@/lib/request-checklist";
import { ReelPublicationPanel } from "@/components/planner/reel-publication-panel";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [isArchiving, setIsArchiving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (request?.posted_at && request.completion_type === "postagem_feita") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Inicializa o rascunho com a data do item ao abrir o diálogo.
      setPostedAt(format(new Date(request.posted_at), "yyyy-MM-dd"));
      return;
    }
    setPostedAt(format(new Date(), "yyyy-MM-dd"));
  }, [open, request?.id, request?.posted_at, request?.completion_type]);

  useEffect(() => {
    if (!open || !request || !isReelRequest(request)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Remove dados do item anterior ao trocar o alvo do diálogo.
      setChecklistItems([]);
      return;
    }
    void fetchChecklistForRequest(request.id).then(setChecklistItems);
  }, [open, request?.id, request]);

  const handleSavePostedDate = async () => {
    if (!request) return;
    const dateStr = postedAt.trim();
    if (!dateStr) return;
    setIsMarking(true);
    const postedAtIso = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00.000Z`;
    const { error } = await updateMarketingRequest(request.id, {
      posted_at: postedAtIso,
    });
    setIsMarking(false);
    if (!error) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const handleRevertToBank = async () => {
    if (!request) return;
    setIsArchiving(true);
    const { error } = await updateMarketingRequest(request.id, {
      completion_type: "design_concluido",
      posted_at: null,
    });
    setIsArchiving(false);
    if (!error) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

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

  const handleCompleteWithoutDate = async () => {
    if (!request) return;
    setIsArchiving(true);
    const { error } = await updateMarketingRequest(request.id, {
      completion_type: "postagem_externa",
      posted_at: null,
    });
    setIsArchiving(false);
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

  const isReel = isReelRequest(request);
  const isAlreadyPosted =
    request.completion_type === "postagem_feita" && Boolean(request.posted_at);
  const displayTitle = getContentBankDisplayTitle(request);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] overflow-hidden max-h-[90vh] flex flex-col",
          isReel ? "max-w-lg" : "max-w-md"
        )}
        aria-describedby="post-available-dialog-description"
      >
        <DialogHeader className="min-w-0 shrink-0">
          <DialogTitle className="text-base font-semibold break-words">
            {isAlreadyPosted
              ? isReel
                ? "Reel postado — alterar data"
                : "Post postado — alterar data"
              : isReel
                ? "Reel disponível — marcar como postado"
                : "Post disponível — marcar como postado"}
          </DialogTitle>
          <DialogDescription id="post-available-dialog-description" className="break-words">
            {isAlreadyPosted
              ? "Corrija o dia da postagem no calendário ou devolva o item ao banco."
              : isReel
                ? "Baixe os arquivos, copie legenda e mensagem e registre a publicação."
                : "Use o link da arte para baixar e depois registre a postagem."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0 overflow-y-auto flex-1">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isReel ? "Reel" : "Post"}
            </p>
            <p className="text-sm font-medium text-foreground break-words line-clamp-3">
              {displayTitle}
            </p>
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

          {isReel ? (
            <ReelPublicationPanel request={request} checklistItems={checklistItems} />
          ) : (
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
          )}

          <div className="min-w-0 w-full">
            <label
              htmlFor="posted-at"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2"
            >
              Dia da postagem
            </label>
            <DatePickerField
              id="posted-at"
              value={postedAt}
              onChange={setPostedAt}
              placeholder="Selecione a data"
              className="w-full min-w-0 max-w-full"
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              {isAlreadyPosted
                ? "O item permanece na agenda; só muda o dia exibido no calendário."
                : "Se o post foi publicado em outro perfil ou canal, conclua sem data para retirá-lo do banco."}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0 shrink-0">
          <Button
            variant="outline"
            onClick={isAlreadyPosted ? handleRevertToBank : handleCompleteWithoutDate}
            disabled={isArchiving || isMarking}
            className="inline-flex items-center gap-1.5 sm:mr-auto"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            {isArchiving
              ? "Salvando…"
              : isAlreadyPosted
                ? "Voltar para disponível no banco"
                : "Concluir sem data"}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={isAlreadyPosted ? handleSavePostedDate : handleMarkAsPosted}
              disabled={isMarking || isArchiving || !postedAt.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isMarking ? "Salvando…" : isAlreadyPosted ? "Salvar data" : "Marcar como postado"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
