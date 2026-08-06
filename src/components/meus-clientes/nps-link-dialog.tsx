"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Send,
  Users,
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import type { ClientGroupBucket } from "./meus-clientes-ui";
import { formatSyncDate, personInitials } from "./meus-clientes-ui";

interface NpsSentInfo {
  sentAt: string;
  sentBy: { id: string; name: string; avatarUrl: string | null };
}

interface NpsLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroupBucket | null;
  eligibleCount: number;
  onMarkedSent?: (info: { sentAt: string; sentByName: string }) => void;
}

interface LinkBundle {
  surveyUrl: string;
  whatsappMessage: string;
  eligibleCount: number;
  campaign: { id: string; name: string; status: string };
  respondents: Array<{ name: string; submittedAt: string }>;
  sent: NpsSentInfo | null;
}

export function NpsLinkDialog({
  open,
  onOpenChange,
  group,
  eligibleCount,
  onMarkedSent,
}: NpsLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<LinkBundle | null>(null);
  const [copied, setCopied] = useState<"url" | "whatsapp" | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!open || !group?.clientGroupId) {
      setBundle(null);
      setError(null);
      setCopied(null);
      setMarking(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setBundle(null);
      try {
        const res = await fetch("/api/nps/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientGroupId: group!.clientGroupId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Não foi possível gerar o link.");
        }
        if (!cancelled) {
          setBundle({
            surveyUrl: data.surveyUrl as string,
            whatsappMessage: data.whatsappMessage as string,
            eligibleCount: data.eligibleCount as number,
            campaign: data.campaign as LinkBundle["campaign"],
            respondents: (data.respondents ?? []) as LinkBundle["respondents"],
            sent: (data.sent as NpsSentInfo | null) ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao gerar link.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, group]);

  if (!group?.clientGroupId) return null;

  async function copyText(text: string, kind: "url" | "whatsapp") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  async function markSent() {
    if (!group?.clientGroupId || marking || bundle?.sent) return;
    setMarking(true);
    setError(null);
    try {
      const res = await fetch("/api/nps/links/mark-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientGroupId: group.clientGroupId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Não foi possível marcar como enviado.");
      }
      const sent = data.sent as NpsSentInfo;
      setBundle((prev) => (prev ? { ...prev, sent } : prev));
      onMarkedSent?.({
        sentAt: sent.sentAt,
        sentByName: sent.sentBy.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao marcar envio.");
    } finally {
      setMarking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-br from-blue-50 via-white to-cyan-50/40 px-6 py-5">
          <div className="flex items-start gap-3">
            <DialogHeaderIcon icon={Link2} />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">Link da pesquisa NPS</DialogTitle>
              <DialogDescription className="mt-1">
                Gere o link exclusivo de <strong>{group.name}</strong> e copie a
                mensagem para enviar no WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gerando link…
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {!loading && bundle && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                  {bundle.campaign.name}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    bundle.campaign.status === "active"
                      ? "text-emerald-700 border-emerald-200 bg-emerald-50"
                      : "text-muted-foreground"
                  }
                >
                  {bundle.campaign.status === "active" ? "Ativa" : bundle.campaign.status}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {bundle.eligibleCount || eligibleCount} elegível
                  {(bundle.eligibleCount || eligibleCount) === 1 ? "" : "eis"}
                </span>
              </div>

              <div className="space-y-2">
                <DialogSectionHeading icon={Link2}>Link da pesquisa</DialogSectionHeading>
                <Label className="sr-only">URL</Label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={bundle.surveyUrl}
                    className="h-10 flex-1 rounded-md border border-input bg-muted/30 px-3 text-xs"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => void copyText(bundle.surveyUrl, "url")}
                  >
                    {copied === "url" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">Copiar</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <DialogSectionHeading icon={MessageSquareText}>Mensagem WhatsApp</DialogSectionHeading>
                <Textarea
                  readOnly
                  rows={8}
                  value={bundle.whatsappMessage}
                  className="resize-none text-sm"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void copyText(bundle.whatsappMessage, "whatsapp")}
                >
                  {copied === "whatsapp" ? (
                    <Check className="mr-2 h-4 w-4 text-emerald-600" />
                  ) : (
                    <MessageCircle className="mr-2 h-4 w-4" />
                  )}
                  {copied === "whatsapp" ? "Mensagem copiada" : "Copiar mensagem WhatsApp"}
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50">
                <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100/80 px-3 py-2.5">
                  <DialogSectionHeading icon={Send}>Controle de envio</DialogSectionHeading>
                  <Badge
                    variant="outline"
                    className="border-emerald-300/80 bg-white text-[11px] font-medium text-emerald-800"
                  >
                    Após mandar no WhatsApp
                  </Badge>
                </div>
                <div className="space-y-3 px-3 py-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Marque <strong className="font-medium text-foreground">NPS enviado</strong>{" "}
                    só depois de enviar o link ao cliente. O time vê quem mandou e quando. O
                    primeiro clique trava e não dá para desmarcar.
                  </p>
                  {bundle.sent ? (
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-200/70 bg-white/90 px-3 py-2.5 shadow-sm">
                      <Avatar className="size-9 shrink-0 ring-2 ring-emerald-100">
                        <AvatarImage
                          src={bundle.sent.sentBy.avatarUrl || undefined}
                          alt={bundle.sent.sentBy.name}
                        />
                        <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-800">
                          {personInitials(bundle.sent.sentBy.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">
                          Enviado por
                        </p>
                        <p className="truncate text-sm font-semibold text-emerald-950">
                          {bundle.sent.sentBy.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSyncDate(bundle.sent.sentAt)}
                        </p>
                      </div>
                      <Badge className="shrink-0 border-0 bg-emerald-600 text-white hover:bg-emerald-600">
                        Enviado
                      </Badge>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={marking}
                      onClick={() => void markSent()}
                    >
                      {marking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {marking ? "Marcando…" : "NPS enviado"}
                    </Button>
                  )}
                </div>
              </div>

              {bundle.respondents.length > 0 && (
                <div className="space-y-2">
                  <DialogSectionHeading icon={Users}>
                    Já responderam ({bundle.respondents.length})
                  </DialogSectionHeading>
                  <ul className="space-y-1.5 rounded-lg border bg-muted/20 p-3 text-sm">
                    {bundle.respondents.map((r) => (
                      <li key={`${r.name}-${r.submittedAt}`} className="flex justify-between gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(r.submittedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-muted/20 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
