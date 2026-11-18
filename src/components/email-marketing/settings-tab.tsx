"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdvogadoOverridesCard } from "./advogado-overrides-card";
import { AreaManagersCard } from "./area-managers-card";
import { SendingSetupCard } from "./sending-setup-card";

export function SettingsTab() {
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

  useEffect(() => {
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
    <div className="max-w-5xl space-y-4">
      <SendingSetupCard />

      <Card className="rounded-lg border-[#dce9eb] shadow-sm">
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

      <Card className="rounded-lg border-[#dce9eb] shadow-sm">
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
    </div>
  );
}
