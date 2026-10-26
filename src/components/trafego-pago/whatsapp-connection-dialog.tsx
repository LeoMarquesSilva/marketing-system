"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { formatRelativeLeadTime } from "./whatsapp-crm-utils";

export type RealtimeStatus = "connecting" | "connected" | "unavailable";

export interface WhatsappInstanceState {
  state: string;
  updated_at: string;
}

interface EvolutionStatus {
  supabaseWebhookUrl?: string | null;
  webhook?: { enabled: boolean; url: string; pointsToApp: boolean } | null;
  recommendations?: string[];
}

export type ConnectionHealth = "ok" | "slow" | "down" | "unconfigured";

export function connectionHealth(
  configured: boolean,
  instance: WhatsappInstanceState | null,
  realtime: RealtimeStatus
): ConnectionHealth {
  if (!configured) return "unconfigured";
  if (instance && instance.state !== "open") return "down";
  if (realtime === "unavailable") return "slow";
  return "ok";
}

const HEALTH_COPY: Record<ConnectionHealth, { label: string; dot: string }> = {
  ok: { label: "WhatsApp conectado", dot: "bg-emerald-500" },
  slow: { label: "Atualização automática lenta", dot: "bg-amber-500" },
  down: { label: "WhatsApp desconectado", dot: "bg-red-500" },
  unconfigured: { label: "WhatsApp não configurado", dot: "bg-red-500" },
};

/** Bolinha de status no topo da lista; abre o diálogo de conexão. */
export function WhatsappConnectionIndicator({
  health,
  onClick,
}: {
  health: ConnectionHealth;
  onClick: () => void;
}) {
  const copy = HEALTH_COPY[health];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${copy.label}. Ver conexão`}
      title={copy.label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#3e84a8]/25 bg-white outline-none hover:bg-[#47cdd0]/10 focus-visible:ring-2 focus-visible:ring-[#47cdd0] dark:bg-input/30"
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", copy.dot)} />
    </button>
  );
}

/** Aviso único quando mensagens novas não estão chegando. */
export function WhatsappConnectionAlert({
  health,
  instance,
  onOpen,
}: {
  health: ConnectionHealth;
  instance: WhatsappInstanceState | null;
  onOpen: () => void;
}) {
  if (health !== "down" && health !== "unconfigured") return null;
  return (
    <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        {health === "down"
          ? `WhatsApp desconectado${instance ? ` ${formatRelativeLeadTime(instance.updated_at)}` : ""}: mensagens novas não estão chegando.`
          : "O WhatsApp do escritório ainda não foi ligado ao sistema."}
      </p>
      <Button type="button" variant="outline" size="xs" onClick={onOpen}>
        Ver detalhes
      </Button>
    </div>
  );
}

interface WhatsappConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  health: ConnectionHealth;
  instance: WhatsappInstanceState | null;
  realtime: RealtimeStatus;
  fetchedAt: string | null;
  configured: boolean;
  /** Recarrega a lista depois de sincronizar. */
  onSynced: () => Promise<void>;
}

/** Diagnóstico e ações técnicas, fora da tela de atendimento. */
export function WhatsappConnectionDialog({
  open,
  onOpenChange,
  health,
  instance,
  realtime,
  fetchedAt,
  configured,
  onSynced,
}: WhatsappConnectionDialogProps) {
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Diagnóstico do webhook só para quem abre o diálogo (rota restrita a admins).
  useEffect(() => {
    if (!open || !configured) return;
    let cancelled = false;
    authFetch("/api/evolution/status")
      .then(async (res) => (res.ok ? ((await res.json()) as EvolutionStatus) : null))
      .then((status) => {
        if (!cancelled) setEvolutionStatus(status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, configured]);

  const sync = async () => {
    setSyncing(true);
    setInfo(null);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 150 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível buscar as mensagens.");
      const stored = Number(json.stored ?? 0);
      setInfo(stored === 1 ? "1 mensagem nova trazida." : `${stored} mensagens novas trazidas.`);
      await onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível buscar as mensagens.");
    } finally {
      setSyncing(false);
    }
  };

  const configureWebhook = async () => {
    setConfiguringWebhook(true);
    setInfo(null);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/webhook/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível religar o recebimento.");
      setInfo("Recebimento de mensagens religado.");
      setEvolutionStatus((current) =>
        current?.webhook ? { ...current, webhook: { ...current.webhook, pointsToApp: true } } : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível religar o recebimento.");
    } finally {
      setConfiguringWebhook(false);
    }
  };

  const copy = HEALTH_COPY[health];
  const webhookBroken = evolutionStatus?.webhook && !evolutionStatus.webhook.pointsToApp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Conexão do WhatsApp</DialogTitle>
          <DialogDescription>Situação do número do escritório e do recebimento das mensagens.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm">
          <div className="space-y-2">
            <StatusRow
              icon={health === "down" || health === "unconfigured" ? <WifiOff /> : <Wifi />}
              label="Número"
              value={
                health === "unconfigured"
                  ? "Não configurado"
                  : health === "down"
                    ? `Desconectado${instance ? ` ${formatRelativeLeadTime(instance.updated_at)}` : ""}`
                    : "Conectado"
              }
              dot={copy.dot}
            />
            <StatusRow
              icon={<RefreshCw />}
              label="Atualização automática"
              value={
                realtime === "connected"
                  ? "Ativa: mensagens chegam na hora"
                  : realtime === "connecting"
                    ? "Conectando…"
                    : "Indisponível: a lista se atualiza a cada 10 minutos"
              }
              dot={realtime === "connected" ? "bg-emerald-500" : realtime === "connecting" ? "bg-muted-foreground" : "bg-amber-500"}
            />
            {fetchedAt && (
              <p className="text-xs text-muted-foreground">Lista carregada {formatRelativeLeadTime(fetchedAt)}.</p>
            )}
          </div>

          {health === "down" && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/30 dark:text-red-300">
              Alguém com acesso ao celular do escritório precisa reconectar o número na Evolution, lendo o QR code de novo.
            </p>
          )}

          {health === "unconfigured" && (
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              Faltam as credenciais da Evolution no servidor. Peça para o administrador do sistema configurar.
            </p>
          )}

          {webhookBroken && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Mensagens novas não estão sendo recebidas pelo sistema
              </p>
              <p className="text-xs">
                O número está mandando as mensagens para outro endereço. Religue o recebimento para elas voltarem a aparecer aqui.
              </p>
              <Button type="button" size="sm" disabled={configuringWebhook} onClick={() => void configureWebhook()}>
                {configuringWebhook && <Loader2 className="animate-spin" />}
                Religar recebimento
              </Button>
            </div>
          )}

          {info && <p className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">{info}</p>}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
          <p className="self-center text-xs text-muted-foreground">
            Faltou alguma mensagem? Busque as mais recentes direto do WhatsApp.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={!configured || syncing} onClick={() => void sync()}>
            {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Buscar mensagens
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusRow({
  icon,
  label,
  value,
  dot,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  dot: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
        {icon}
      </span>
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
        {value}
      </span>
    </div>
  );
}
