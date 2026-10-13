"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  CalendarCheck,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Loader2,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { AreaIcon } from "@/lib/area-icons";
import type { PlannerReel, ReelDeliveryDetail } from "@/lib/reel-deliveries/types";
import {
  calendarItemFromReel,
  calendarItemPeople,
  calendarItemTitle,
} from "@/lib/planner-calendar";
import {
  fetchReelDeliveryDetail,
  publishCalendarItemOn,
  returnReelToBank,
} from "@/lib/planner-calendar-client";
import { PeopleAvatars } from "./calendar-item-parts";

interface ReelDeliveryPublishDialogProps {
  reel: PlannerReel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function civilDate(value: string | null): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function ReelDeliveryPublishDialog({ reel, open, onOpenChange, onSuccess }: ReelDeliveryPublishDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Monta o conteúdo a cada abertura para começar sem dados do reel anterior. */}
      {open && reel && <ReelDialogContent key={reel.id} reel={reel} onOpenChange={onOpenChange} onSuccess={onSuccess} />}
    </Dialog>
  );
}

function ReelDialogContent({
  reel,
  onOpenChange,
  onSuccess,
}: {
  reel: PlannerReel;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const isPublished = reel.status === "published" && Boolean(reel.publishedAt);
  const [detail, setDetail] = useState<ReelDeliveryDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState(() =>
    format(isPublished && reel.publishedAt ? new Date(reel.publishedAt) : new Date(), "yyyy-MM-dd")
  );
  const [saving, setSaving] = useState<"publish" | "bank" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchReelDeliveryDetail(reel.id)
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, [reel.id]);

  const item = calendarItemFromReel(reel);
  const caption = detail?.caption ?? reel.caption;
  const coverUrl = detail?.coverUrl ?? reel.coverThumbUrl;

  const handleCopy = async () => {
    if (!caption) return;
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const run = async (kind: "publish" | "bank", action: () => Promise<string | null>) => {
    setSaving(kind);
    setSaveError(null);
    const error = await action();
    setSaving(null);
    if (error) {
      setSaveError(error);
      return;
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <DialogContent
      className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-3xl"
      aria-describedby="reel-publish-dialog-description"
    >
      <DialogHeader className="min-w-0 shrink-0">
        <DialogTitle className="text-base font-semibold">
          {isPublished ? "Reel publicado" : "Reel pronto para publicar"}
        </DialogTitle>
        <DialogDescription id="reel-publish-dialog-description">
          {isPublished
            ? "Corrija o dia no calendário ou devolva o reel ao banco."
            : "Baixe o vídeo e a capa, copie a legenda e registre o dia da publicação."}
        </DialogDescription>
      </DialogHeader>

      <div className="min-w-0 flex-1 space-y-5 overflow-y-auto py-1">
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-snug text-foreground">{calendarItemTitle(item)}</p>
          {reel.coverSubtitle && <p className="text-sm text-muted-foreground">{reel.coverSubtitle}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <AreaIcon area={reel.area} className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {reel.area}
            </span>
            <PeopleAvatars people={calendarItemPeople(item)} size="xs" />
            {reel.dueDate && <span>Cronograma: {civilDate(reel.dueDate)}</span>}
            {reel.readyAt && <span>Pronto em {civilDate(reel.readyAt)}</span>}
            {isPublished && (
              <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                Publicado em {civilDate(reel.publishedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vídeo</p>
              {detail?.videoUrl ? (
                <video
                  src={detail.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] max-h-[46vh] w-full rounded-lg border border-border/50 bg-black object-contain"
                />
              ) : (
                <div className="grid aspect-[9/16] max-h-[46vh] w-full place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                  {loadError ? (
                    <span className="px-4 text-center">{loadError}</span>
                  ) : detail ? (
                    <span className="flex items-center gap-1.5"><Video className="h-4 w-4" aria-hidden />Vídeo indisponível</span>
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" aria-label="Carregando vídeo" />
                  )}
                </div>
              )}
              {detail?.videoDownloadUrl && (
                <Button asChild variant="outline" size="sm" className="w-full">
                  <a href={detail.videoDownloadUrl}>
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Baixar vídeo
                  </a>
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Capa</p>
              {coverUrl ? (
                <div className="flex items-end gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl}
                    alt="Capa do reel"
                    className="aspect-[9/16] w-24 shrink-0 rounded-md object-cover ring-1 ring-border/60"
                  />
                  {detail?.coverDownloadUrl && (
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={detail.coverDownloadUrl}>
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Baixar capa
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm italic text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Capa não enviada.
                </p>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Legenda</p>
              <Button
                type="button"
                size="sm"
                variant={copied ? "outline" : "default"}
                onClick={() => void handleCopy()}
                disabled={!caption}
                className="gap-1.5"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    Copiada
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copiar legenda
                  </>
                )}
              </Button>
            </div>
            {caption ? (
              <p className="max-h-[52vh] min-h-40 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm leading-6 text-foreground">
                {caption}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">Legenda ainda não escrita.</p>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-center">
          <label htmlFor="reel-published-on" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Dia da publicação
          </label>
          <DatePickerField
            id="reel-published-on"
            value={day}
            onChange={setDay}
            placeholder="Selecione a data"
            className="w-full max-w-xs"
          />
        </div>

        {saveError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {saveError}
          </p>
        )}
      </div>

      <DialogFooter className="shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        {isPublished ? (
          <Button
            variant="outline"
            onClick={() => void run("bank", () => returnReelToBank(reel.id))}
            disabled={saving !== null}
            className="gap-1.5 sm:mr-auto"
          >
            {saving === "bank" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}
            Voltar para o banco
          </Button>
        ) : (
          <Button variant="ghost" asChild className="gap-1.5 sm:mr-auto">
            <Link href={`/conteudo/aprovacao-reels?reel=${reel.id}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Abrir na Aprovação de Reels
            </Link>
          </Button>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          onClick={() => void run("publish", () => publishCalendarItemOn(item, day))}
          disabled={saving !== null || !day}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {saving === "publish" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {isPublished ? "Salvar data" : "Marcar como publicado"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
