"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdvogadoOverridesCard } from "./advogado-overrides-card";
import { AreaManagersCard } from "./area-managers-card";

interface EmailDomainStatus {
  name: string;
  status: string;
  openTracking: boolean;
  clickTracking: boolean;
  trackingSubdomain: string | null;
}

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [domains, setDomains] = useState<EmailDomainStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rdLoading, setRdLoading] = useState(true);
  const [rdStatus, setRdStatus] = useState<{ ok: boolean; configured: boolean; segmentation?: string; message?: string } | null>(null);
  const [rdSyncing, setRdSyncing] = useState(false);
  const [rdForceSync, setRdForceSync] = useState(false);
  const [rdSyncResult, setRdSyncResult] = useState<string | null>(null);
  const [sioeLoading, setSioeLoading] = useState(true);
  const [sioeStatus, setSioeStatus] = useState<{
    ok: boolean;
    configured: boolean;
    activeClients?: number;
    withEmail?: number;
    message?: string;
  } | null>(null);
  const [sioeSyncing, setSioeSyncing] = useState(false);
  const [sioeSyncResult, setSioeSyncResult] = useState<string | null>(null);
  const [senderConfig, setSenderConfig] = useState<{
    fromName: string;
    fromEmail: string;
    replyTo: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/email-marketing/sender-config")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setSenderConfig(data);
      })
      .catch(() => {});

    fetch("/api/email-marketing/domains")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setConfigured(Boolean(data.configured));
        setDomains(data.domains ?? []);
      })
      .catch(() => setError("Não foi possível consultar o status do Resend."))
      .finally(() => setLoading(false));

    fetch("/api/email-marketing/rd-sync")
      .then((res) => res.json())
      .then((data) => setRdStatus(data))
      .catch(() => setRdStatus({ configured: false, ok: false, message: "Não foi possível testar o RD Station." }))
      .finally(() => setRdLoading(false));

    fetch("/api/email-marketing/sioe-sync")
      .then((res) => res.json())
      .then((data) => setSioeStatus(data))
      .catch(() => setSioeStatus({ configured: false, ok: false, message: "Não foi possível testar o SIOE." }))
      .finally(() => setSioeLoading(false));
  }, []);

  const handleSioeSync = async () => {
    setSioeSyncing(true);
    setSioeSyncResult(null);
    try {
      const res = await fetch("/api/email-marketing/sioe-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const unmatchedCount = data.unmatchedAdvogados?.length ?? 0;
      const unmatchedPart =
        unmatchedCount > 0
          ? ` · ${unmatchedCount} advogado${unmatchedCount === 1 ? "" : "s"} não casado${unmatchedCount === 1 ? "" : "s"} (veja abaixo)`
          : "";
      setSioeSyncResult(
        `Sincronizado: ${data.groupsUpserted ?? 0} grupos, ${data.companiesUpserted} empresas, ${data.peopleUpserted ?? 0} pessoas, ${data.contactsUpserted} contatos com e-mail, ${data.responsiblesUpserted ?? 0} vínculos de responsabilidade (${data.errors} erros)${unmatchedPart}.`
      );
    } catch (err) {
      setSioeSyncResult(err instanceof Error ? err.message : "Erro na sincronização.");
    } finally {
      setSioeSyncing(false);
    }
  };

  const handleRdSync = async () => {
    setRdSyncing(true);
    setRdSyncResult(null);
    try {
      const url = rdForceSync ? "/api/email-marketing/rd-sync?force=true" : "/api/email-marketing/rd-sync";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const emailPart =
        data.emailsSynced != null ? ` · ${data.emailsSynced} e-mails importados` : "";
      setRdSyncResult(
        `Sincronizado: ${data.upserted} contatos de "${data.segmentationName}" (${data.errors} erros)${emailPart}.`
      );
    } catch (err) {
      setRdSyncResult(err instanceof Error ? err.message : "Erro na sincronização.");
    } finally {
      setRdSyncing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Status do provedor (Resend)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Verificando...</p>
          ) : !configured ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                <strong>RESEND_API_KEY</strong> não configurada no ambiente. O envio de campanhas fica
                bloqueado até isso ser feito.
              </p>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum domínio cadastrado ainda no Resend. Adicione e verifique um domínio (SPF/DKIM/DMARC)
              no painel do Resend antes de enviar campanhas.
            </p>
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => (
                <div
                  key={domain.name}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{domain.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant={domain.status === "verified" ? "default" : "secondary"}>
                        {domain.status === "verified" ? "Verificado" : domain.status}
                      </Badge>
                      <Badge variant={domain.openTracking ? "outline" : "secondary"}>
                        Abertura {domain.openTracking ? "ativa" : "inativa"}
                      </Badge>
                      <Badge variant={domain.clickTracking ? "outline" : "secondary"}>
                        Cliques {domain.clickTracking ? "ativos" : "inativos"}
                      </Badge>
                    </div>
                  </div>
                  {domain.status === "verified" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Abrir painel de domínios do Resend
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">RD Station Marketing (importação)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rdLoading ? (
            <p className="text-sm text-muted-foreground">Testando conexão...</p>
          ) : !rdStatus?.configured ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Configure <code>RD_MARKETING_CLIENT_ID</code>, <code>RD_MARKETING_CLIENT_SECRET</code> e{" "}
                <code>RD_MARKETING_REFRESH_TOKEN</code> no ambiente.
              </p>
            </div>
          ) : rdStatus.ok ? (
            <div className="flex items-start gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Conectado ao RD Station. Segmentação: <strong>{rdStatus.segmentation}</strong>
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{rdStatus.message ?? "Falha na conexão com o RD Station."}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Puxa contatos, tags, telefone, base legal, campos personalizados (cargo, CNPJ, cidade,
            etc.) e o histórico de e-mails enviados no RD. Contatos existentes são enriquecidos.
          </p>

          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rdForceSync}
              onChange={(e) => setRdForceSync(e.target.checked)}
              className="rounded border-border"
            />
            Re-sincronizar todos os contatos (atualiza campos mesmo já importados)
          </label>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRdSync}
            disabled={rdSyncing || !rdStatus?.ok}
          >
            <RefreshCw className={`h-4 w-4 ${rdSyncing ? "animate-spin" : ""}`} />
            {rdSyncing ? "Sincronizando..." : "Sincronizar agora"}
          </Button>

          {rdSyncResult && <p className="text-sm text-muted-foreground">{rdSyncResult}</p>}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">SIOE — clientes ativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sioeLoading ? (
            <p className="text-sm text-muted-foreground">Testando conexão...</p>
          ) : !sioeStatus?.configured ? (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Configure <code>SIOE_SUPABASE_SERVICE_ROLE_KEY</code> no ambiente (projeto SIOE PRO).
                Opcional: <code>SIOE_SUPABASE_URL</code>.
              </p>
            </div>
          ) : sioeStatus.ok ? (
            <div className="flex items-start gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Conectado ao SIOE. <strong>{sioeStatus.activeClients}</strong> clientes ativos (
                {sioeStatus.withEmail} com e-mail válido).
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{sioeStatus.message ?? "Falha na conexão com o SIOE."}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Importa da tabela <code>pessoas</code> apenas registros com categoria &quot;Cliente ativo&quot;,
            agrupados por <strong>Grupo Cliente</strong>. Empresas (PJ) ficam dentro do grupo; pessoas (PF)
            aparecem no grupo ou vinculadas à empresa.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleSioeSync}
            disabled={sioeSyncing || !sioeStatus?.ok}
          >
            <RefreshCw className={`h-4 w-4 ${sioeSyncing ? "animate-spin" : ""}`} />
            {sioeSyncing ? "Sincronizando..." : "Sincronizar clientes ativos"}
          </Button>

          {sioeSyncResult && <p className="text-sm text-muted-foreground">{sioeSyncResult}</p>}
        </CardContent>
      </Card>

      <AreaManagersCard />

      <AdvogadoOverridesCard />

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Remetente padrão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {senderConfig ? (
            <>
              <div className="rounded-lg border p-3 space-y-1">
                <p>
                  <span className="text-muted-foreground">Nome: </span>
                  <strong>{senderConfig.fromName}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">E-mail de envio: </span>
                  <strong>{senderConfig.fromEmail || "— não configurado —"}</strong>
                </p>
                {senderConfig.replyTo && (
                  <p>
                    <span className="text-muted-foreground">Responder para: </span>
                    <strong>{senderConfig.replyTo}</strong>
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Todas as campanhas usam este remetente. Ajuste via variáveis de ambiente:{" "}
                <code>EMAIL_MARKETING_DEFAULT_FROM_NAME</code>,{" "}
                <code>EMAIL_MARKETING_FROM_DOMAIN</code> ou <code>EMAIL_MARKETING_FROM_EMAIL</code>
                {senderConfig.replyTo ? "" : " e opcionalmente "}
                {!senderConfig.replyTo && <code>EMAIL_MARKETING_REPLY_TO</code>}.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Carregando remetente...</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">Checklist de configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              Verificar o domínio de envio no Resend (registros SPF, DKIM e DMARC no DNS) — status
              &quot;Verificado&quot; acima.
            </li>
            <li>
              Ativar o rastreio de abertura/clique no mesmo domínio, configurando um subdomínio de
              tracking (ex.: <code>links.seudominio.com</code>) na aba &quot;Tracking&quot; do domínio.
            </li>
            <li>
              Criar um endpoint de webhook no Resend apontando para{" "}
              <code>/api/email-marketing/webhook</code> com os eventos: delivered, opened, clicked,
              bounced, complained e failed. Copiar o &quot;Signing Secret&quot; gerado para a variável de
              ambiente <code>RESEND_WEBHOOK_SECRET</code>.
            </li>
            <li>
              Definir o remetente global: <code>EMAIL_MARKETING_DEFAULT_FROM_NAME</code>,{" "}
              <code>EMAIL_MARKETING_FROM_DOMAIN</code> (ou <code>EMAIL_MARKETING_FROM_EMAIL</code>) e,
              se quiser, <code>EMAIL_MARKETING_REPLY_TO</code>.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
