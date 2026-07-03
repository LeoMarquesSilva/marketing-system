"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  cancelScheduledCampaign,
  EMAIL_CAMPAIGN_STATUS_LABEL,
  fetchEmailCampaignStats,
  type EmailCampaign,
  type EmailCampaignStats,
} from "@/lib/email-marketing";

interface CampaignDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: EmailCampaign | null;
  onChanged: () => void;
  onEdit: (campaign: EmailCampaign) => void;
}

const STAT_ITEMS: { key: keyof EmailCampaignStats; label: string; tone?: "success" | "danger" }[] = [
  { key: "total", label: "Destinatários" },
  { key: "sent", label: "Enviados" },
  { key: "delivered", label: "Entregues" },
  { key: "opened", label: "Abriram", tone: "success" },
  { key: "clicked", label: "Clicaram", tone: "success" },
  { key: "bounced", label: "Retornaram (bounce)", tone: "danger" },
  { key: "complained", label: "Marcaram como spam", tone: "danger" },
  { key: "failed", label: "Falharam", tone: "danger" },
];

function pct(value: number, base: number): string {
  if (base <= 0) return "";
  return `${Math.round((value / base) * 100)}%`;
}

export function CampaignDetailDialog({
  open,
  onOpenChange,
  campaign,
  onChanged,
  onEdit,
}: CampaignDetailDialogProps) {
  const [stats, setStats] = useState<EmailCampaignStats | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open || !campaign) return;
    setMessage(null);
    setTestEmail("");
    setScheduledAt("");
    fetchEmailCampaignStats(campaign.id).then(setStats);
  }, [open, campaign]);

  if (!campaign) return null;

  const isDraft = campaign.status === "draft";
  const canSend = campaign.status === "draft" || campaign.status === "failed";
  const canResume = campaign.status === "sending";

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      onChanged();
      if (campaign) setStats(await fetchEmailCampaignStats(campaign.id));
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao executar ação." });
    } finally {
      setBusy(null);
    }
  };

  const handleSendTest = () =>
    runAction("test", async () => {
      if (!testEmail.trim()) throw new Error("Informe um e-mail de teste.");
      const res = await fetch(`/api/email-marketing/campaigns/${campaign.id}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: "success", text: `E-mail de teste enviado para ${testEmail}.` });
    });

  const handleSendNow = () =>
    runAction("send", async () => {
      const res = await fetch(`/api/email-marketing/campaigns/${campaign.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({
        type: "success",
        text: data.finished
          ? `Envio concluído (${data.totalRecipients} destinatário(s)).`
          : `Envio iniciado — ${data.processed} de ${data.totalRecipients} processados até agora. O restante continua em lotes automáticos.`,
      });
    });

  const handleSchedule = () =>
    runAction("schedule", async () => {
      if (!scheduledAt) throw new Error("Informe a data/hora do agendamento.");
      const res = await fetch(`/api/email-marketing/campaigns/${campaign.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: "success", text: "Campanha agendada com sucesso." });
    });

  const handleCancelSchedule = () =>
    runAction("cancel", async () => {
      await cancelScheduledCampaign(campaign.id);
      setMessage({ type: "success", text: "Agendamento cancelado — campanha voltou a rascunho." });
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.name}
            <Badge variant="outline">{EMAIL_CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Assunto:</strong> {campaign.subject}
            </p>
            <p>
              <strong className="text-foreground">Remetente:</strong> {campaign.fromName} &lt;
              {campaign.fromEmail}&gt;
            </p>
            <p>
              <strong className="text-foreground">Lista:</strong> {campaign.listName ?? "Todos os contatos"}
            </p>
            {campaign.scheduledAt && (
              <p>
                <strong className="text-foreground">Agendada para:</strong>{" "}
                {new Date(campaign.scheduledAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-2">
              {STAT_ITEMS.map((item) => {
                const value = stats[item.key];
                const base = item.key === "total" || item.key === "sent" ? 0 : stats.sent || stats.total;
                const rate = base > 0 && item.key !== "total" && item.key !== "sent" ? pct(value, base) : "";
                return (
                  <div key={item.key} className="rounded-lg border p-2 text-center">
                    <p
                      className={`text-lg font-semibold ${
                        item.tone === "success" && value > 0
                          ? "text-emerald-600"
                          : item.tone === "danger" && value > 0
                            ? "text-destructive"
                            : ""
                      }`}
                    >
                      {value}
                      {rate && <span className="text-xs font-normal text-muted-foreground"> ({rate})</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
                  </div>
                );
              })}
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-emerald-600"}`}>
              {message.text}
            </p>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Enviar teste</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="seu-email@empresa.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button variant="outline" onClick={handleSendTest} disabled={busy === "test"}>
                {busy === "test" ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>

          {isDraft && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Agendar envio</p>
              <div className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <Button variant="outline" onClick={handleSchedule} disabled={busy === "schedule"}>
                  {busy === "schedule" ? "Agendando..." : "Agendar"}
                </Button>
              </div>
            </div>
          )}

          {campaign.status === "scheduled" && (
            <Button variant="outline" onClick={handleCancelSchedule} disabled={busy === "cancel"}>
              {busy === "cancel" ? "Cancelando..." : "Cancelar agendamento"}
            </Button>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <Button className="gap-1.5" onClick={() => onEdit(campaign)}>
                <Pencil className="h-4 w-4" />
                Abrir editor
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
          {(canSend || canResume) && (
            <Button onClick={handleSendNow} disabled={busy === "send"}>
              {busy === "send" ? "Enviando..." : canResume ? "Continuar envio" : "Enviar agora"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
