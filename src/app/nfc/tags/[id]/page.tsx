import { CalendarClock, CheckCircle2, CircleOff, RadioTower, ScanLine, Settings2, TriangleAlert } from "lucide-react";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcProgrammingCard } from "@/components/nfc/nfc-programming-card";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { NfcTagForm } from "@/components/nfc/nfc-tag-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNfcPublicUrl, getNfcTag } from "@/lib/nfc/server";
import { NFC_ACTION_LABELS } from "@/lib/nfc/labels";
import { fetchActiveUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

const AUDIT_LABELS: Record<string, string> = {
  created: "Etiqueta criada",
  updated: "Configuração alterada",
  activated: "Etiqueta ativada",
  deactivated: "Etiqueta desativada",
  deleted: "Etiqueta excluída",
};

export default async function NfcTagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ tag, allowedUserIds, scans, audit }, users] = await Promise.all([getNfcTag(id), fetchActiveUsers()]);
  const permanentUrl = getNfcPublicUrl(tag.public_token);
  const timeline = [
    ...audit.map((item) => ({
      id: String(item.id),
      at: String(item.created_at),
      label: AUDIT_LABELS[String(item.event_type)] ?? String(item.event_type),
      kind: String(item.event_type),
      detail: null as string | null,
    })),
    ...scans.map((item) => ({
      id: String(item.id),
      at: String(item.scanned_at),
      label: String(item.result_status) === "completed" ? "Leitura concluída" : "Etiqueta lida",
      kind: String(item.result_status),
      detail: item.error_code ? `Código: ${String(item.error_code)}` : null,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title={tag.name}
        description={`${tag.code} · ${tag.environment || "Ambiente não informado"}${tag.location ? ` · ${tag.location}` : ""}`}
        backHref="/nfc/tags"
        primaryAction={false}
      />
      <NfcSubnav />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="gap-3 py-4"><CardContent className="flex items-center gap-3 px-4"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f8f8] text-[#347796]"><RadioTower className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">Status</p><Badge variant={tag.status === "active" ? "default" : "secondary"}>{tag.status === "active" ? "Ativa" : "Inativa"}</Badge></div></CardContent></Card>
        <Card className="gap-3 py-4"><CardContent className="flex items-center gap-3 px-4"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-[#3e84a8]"><ScanLine className="h-5 w-5" /></span><div><p className="font-mono text-xl font-semibold">{tag.total_scans}</p><p className="text-xs text-muted-foreground">Leituras</p></div></CardContent></Card>
        <Card className="gap-3 py-4"><CardContent className="flex items-center gap-3 px-4"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-50 text-[#48466e]"><Settings2 className="h-5 w-5" /></span><div><p className="text-sm font-semibold">{NFC_ACTION_LABELS[tag.action_type]}</p><p className="text-xs text-muted-foreground">Tipo de ação</p></div></CardContent></Card>
        <Card className="gap-3 py-4"><CardContent className="flex items-center gap-3 px-4"><span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600"><CalendarClock className="h-5 w-5" /></span><div><p className="font-mono text-xs font-semibold">{tag.last_scanned_at ? new Date(tag.last_scanned_at).toLocaleString("pt-BR") : "Nunca"}</p><p className="text-xs text-muted-foreground">Última leitura</p></div></CardContent></Card>
      </section>

      <NfcProgrammingCard permanentUrl={permanentUrl} tagName={tag.name} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <NfcTagForm initialTag={tag} allowedUserIds={allowedUserIds} users={users} />
        <Card className="h-fit gap-4 py-5 xl:sticky xl:top-20">
          <CardHeader className="border-b px-5"><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
          <CardContent className="px-5">
            {timeline.length ? (
              <ol className="relative space-y-0 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-px before:bg-[#dce9eb]">
                {timeline.map((item) => {
                  const Icon = item.kind === "error" ? TriangleAlert : item.kind === "deactivated" ? CircleOff : item.kind === "completed" ? CheckCircle2 : ScanLine;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="relative flex gap-3 py-3">
                      <span className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border bg-white ${item.kind === "error" ? "border-red-300 text-red-600" : "border-[#47cdd0] text-[#347796]"}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <time className="font-mono text-xs text-muted-foreground">{new Date(item.at).toLocaleString("pt-BR")}</time>
                        {item.detail && <p className="mt-1 font-mono text-xs text-red-700">{item.detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
