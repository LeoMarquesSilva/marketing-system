"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Clapperboard, Film, RefreshCw, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaMark } from "@/components/conteudo/content-schedule-visuals";
import type { ReelDeliveriesResponse, ReelDeliverySummary } from "@/lib/reel-deliveries/types";
import { generateReelCopyFromVideo } from "@/lib/reel-deliveries/audio-client";
import { cn } from "@/lib/utils";
import { ParticipantStack, ReelStatusBadge, formatReelDate, reelDisplayTitle } from "./reel-delivery-ui";
import { ReelUploadDialog } from "./reel-upload-dialog";
import { ReelDeliverySheet } from "./reel-delivery-sheet";

type StageKey = "approval" | "finishing" | "ready" | "published";

const STAGES: { key: StageKey; label: string; empty: string; match: (d: ReelDeliverySummary) => boolean }[] = [
  {
    key: "approval",
    label: "Em aprovação",
    empty: "Nenhum reel esperando aprovação.",
    match: (d) => d.status === "awaiting_approval" || d.status === "changes_requested",
  },
  {
    key: "finishing",
    label: "Capa e legenda",
    empty: "Quando um reel for aprovado, ele aparece aqui para você preparar capa e legenda.",
    match: (d) => d.status === "approved",
  },
  { key: "ready", label: "Prontos para publicar", empty: "Nenhum reel pronto ainda.", match: (d) => d.status === "ready" },
  { key: "published", label: "Publicados", empty: "Nenhum reel publicado por aqui ainda.", match: (d) => d.status === "published" },
];

function DeliveryCard({ delivery, onOpen, viewerIsManager }: { delivery: ReelDeliverySummary; onOpen: () => void; viewerIsManager: boolean }) {
  const pendingCount = delivery.participants.filter((p) => !delivery.currentDecisions.some((d) => d.userId === p.id)).length;
  const changes = delivery.currentDecisions.filter((d) => d.decision === "changes_requested");
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-full w-full flex-col gap-3 rounded-lg border bg-white p-4 text-left shadow-[0_1px_2px_rgba(24,63,80,0.05)] transition hover:border-[#9fc9d3] hover:shadow-[0_8px_24px_rgba(24,63,80,0.08)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
          delivery.awaitingMe ? "border-[#47cdd0] ring-1 ring-[#47cdd0]/40" : "border-[#dce9eb]"
        )}
      >
        <div className="flex w-full items-start justify-between gap-3 text-sm">
          <span className="min-w-0 text-slate-700"><AreaMark area={delivery.area} compact /></span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">{formatReelDate(delivery.dueDate)}</span>
        </div>
        <p className={cn("line-clamp-2 leading-snug", delivery.coverTitle ? "font-semibold text-[#0d1e2e]" : "font-medium text-slate-500")}>
          {reelDisplayTitle(delivery)}
        </p>
        {delivery.aiStatus === "processing" && (
          <p className="flex items-center gap-1.5 text-xs text-[#285f7a]"><Sparkles className="size-3.5" />IA escrevendo capa e legenda…</p>
        )}
        <ParticipantStack people={delivery.participants} decisions={delivery.currentDecisions} />
        <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 pt-1">
          <ReelStatusBadge status={delivery.status} />
          <span className="text-xs text-slate-500">
            {delivery.awaitingMe
              ? "Falta você aprovar"
              : changes.length > 0
                ? `${changes.length} ${changes.length === 1 ? "pedido" : "pedidos"} de ajuste`
                : delivery.status === "awaiting_approval" && pendingCount > 0
                  ? `${pendingCount} ${pendingCount === 1 ? "aprovação pendente" : "aprovações pendentes"}`
                  : delivery.status === "approved" && viewerIsManager
                    ? [!delivery.hasCover && "capa", !delivery.caption && "legenda"].filter(Boolean).join(" e ") || "Revisar e marcar pronto"
                    : delivery.currentVersion && delivery.currentVersion.number > 1
                      ? `Versão ${delivery.currentVersion.number}`
                      : ""}
          </span>
        </div>
      </button>
    </li>
  );
}

export function ReelDeliveriesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReelDeliveriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey>("approval");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const openId = searchParams.get("reel");

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/reel-deliveries", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os reels.");
      setData(body);
      window.dispatchEvent(new Event("reel-deliveries:changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os reels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setOpenId = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("reel", id); else params.delete("reel");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }, [router, searchParams]);

  // Roda depois do envio sem prender a tela: extrai o áudio, transcreve e escreve capa e legenda.
  const runCopyInBackground = useCallback((id: string, video: File, overwrite: boolean) => {
    void generateReelCopyFromVideo(id, video, overwrite)
      .then(() => setAiNotice(null))
      .catch((err) => setAiNotice(err instanceof Error ? err.message : "A IA não conseguiu gerar o texto agora."))
      .finally(() => { void load(); setRefreshToken((value) => value + 1); });
    window.setTimeout(() => void load(), 1500);
  }, [load]);

  const deliveries = useMemo(() => data?.deliveries ?? [], [data]);
  const awaitingMe = deliveries.filter((d) => d.awaitingMe);
  const counts = useMemo(
    () => Object.fromEntries(STAGES.map((s) => [s.key, deliveries.filter(s.match).length])) as Record<StageKey, number>,
    [deliveries]
  );
  const current = STAGES.find((s) => s.key === stage)!;
  const visible = deliveries
    .filter(current.match)
    .sort((a, b) => Number(b.awaitingMe) - Number(a.awaitingMe) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const isManager = data?.viewer.isManager ?? false;

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          {isManager
            ? "Suba o vídeo pronto, acompanhe a aprovação de quem gravou e deixe capa e legenda prontas para publicar."
            : "Os reels que você gravou chegam aqui depois da edição. Assista e aprove ou peça ajuste."}
        </p>
        {isManager && (
          <Button onClick={() => setUploadOpen(true)} className="bg-[#347796] text-white hover:bg-[#285f7a]">
            <UploadCloud />Enviar reel para aprovação
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span className="flex gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</span>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }}><RefreshCw />Tentar de novo</Button>
        </div>
      )}

      {aiNotice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0" />IA: {aiNotice} Você pode escrever à mão ou tentar de novo em Capa e legenda.</span>
          <button type="button" onClick={() => setAiNotice(null)} className="underline">Fechar</button>
        </div>
      )}

      {awaitingMe.length > 0 && (
        <section aria-labelledby="awaiting-me" className="rounded-lg bg-[#e8f8f8] p-4 ring-1 ring-[#bfe6e8]">
          <h2 id="awaiting-me" className="text-sm font-semibold text-[#183f50]">
            {awaitingMe.length === 1 ? "1 reel esperando sua aprovação" : `${awaitingMe.length} reels esperando sua aprovação`}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {awaitingMe.map((d) => (
              <li key={d.id}>
                <Button size="sm" variant="outline" className="bg-white" onClick={() => setOpenId(d.id)}>
                  <Film />{reelDisplayTitle(d)}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_10px_30px_rgba(24,63,80,0.06)]">
        <div className="overflow-x-auto border-b border-[#dce9eb] bg-[#f8fbfb] p-3 sm:px-4">
          <div role="tablist" aria-label="Etapas dos reels" className="inline-flex min-w-max rounded-lg border border-[#dce9eb] bg-white p-1 shadow-sm">
            {STAGES.map((s) => (
              <Button
                key={s.key}
                role="tab"
                aria-selected={stage === s.key}
                variant="ghost"
                size="sm"
                onClick={() => setStage(s.key)}
                className={cn(stage === s.key && "bg-[#183f50] text-white hover:bg-[#183f50] hover:text-white")}
              >
                {s.label}
                <span className={cn("rounded-full px-1.5 font-mono text-xs tabular-nums", stage === s.key ? "bg-white/15" : "bg-slate-100 text-slate-600")}>
                  {counts[s.key] ?? 0}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <div role="tabpanel" className="p-3 sm:p-4">
          {loading ? (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((i) => <li key={i} className="h-44 animate-pulse rounded-lg bg-slate-100" />)}
            </ul>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-[#e8f8f8] text-[#347796]"><Clapperboard className="size-5" /></span>
              <p className="max-w-sm text-sm text-slate-600">
                {deliveries.length === 0
                  ? isManager
                    ? "Nenhum reel em aprovação ainda. Envie o primeiro e ligue à data do cronograma."
                    : "Nenhum reel seu por aqui ainda. Quando o Marketing enviar a edição, ele aparece nesta página."
                  : current.empty}
              </p>
              {isManager && deliveries.length === 0 && (
                <Button onClick={() => setUploadOpen(true)} className="mt-2 bg-[#347796] text-white hover:bg-[#285f7a]"><UploadCloud />Enviar reel para aprovação</Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((delivery) => (
                <DeliveryCard key={delivery.id} delivery={delivery} viewerIsManager={isManager} onOpen={() => setOpenId(delivery.id)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {data && isManager && (
        <ReelUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          slots={data.slots}
          people={data.people}
          onCreated={(id, video) => { setUploadOpen(false); setStage("approval"); void load(); setOpenId(id); runCopyInBackground(id, video, false); }}
        />
      )}
      {data && (
        <ReelDeliverySheet
          deliveryId={openId}
          viewer={data.viewer}
          people={data.people}
          onOpenChange={(open) => { if (!open) setOpenId(null); }}
          onChanged={() => void load()}
          refreshToken={refreshToken}
          onVersionUploaded={(id, video) => runCopyInBackground(id, video, false)}
        />
      )}
    </main>
  );
}
