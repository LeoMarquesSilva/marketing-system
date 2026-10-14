"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileArchive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { parseCertificadoWorkshopDescription } from "@/lib/certificado-workshop";
import { buildCardPrefill, type CardPrefill } from "@/lib/certificados/card-prefill";
import { certificateFileName, validateCertificateConfig } from "@/lib/certificados/model";
import type { CertificateParticipant } from "@/lib/certificados/participants";
import type { CertificateAssets } from "@/lib/certificados/render";
import { fetchActiveUsers } from "@/lib/users";
import { supabase } from "@/utils/supabase/client";
import {
  applyCardPrefill,
  createDefaultDraft,
  draftToConfig,
  loadStoredDraft,
  storeDraft,
  type CertificateDraft,
} from "./certificate-draft";
import { EventSection, SignaturesSection, TextSection } from "./certificate-form-sections";
import { ParticipantsPanel } from "./participants-panel";
import { PdfPagePreview } from "./pdf-page-preview";

const ASSET_FILES = {
  background: "fundo",
  ricardo: "assinatura-ricardo",
  gustavo: "assinatura-gustavo",
  regular: "fonte-regular",
  medium: "fonte-medium",
  bold: "fonte-bold",
} as const;

async function loadAssets(): Promise<CertificateAssets> {
  const entries = await Promise.all(
    Object.entries(ASSET_FILES).map(async ([key, file]) => {
      const res = await authFetch(`/api/certificados/modelo/${file}`, { cache: "default" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Não foi possível carregar o modelo do certificado.");
      }
      return [key, new Uint8Array(await res.arrayBuffer())] as const;
    })
  );
  const files = Object.fromEntries(entries) as Record<keyof typeof ASSET_FILES, Uint8Array>;
  return {
    background: files.background,
    partnerSignatures: { ricardo: files.ricardo, gustavo: files.gustavo },
    fonts: { regular: files.regular, medium: files.medium, bold: files.bold },
  };
}

const loadRenderer = () => import("@/lib/certificados/render");

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function safeFilePart(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "certificados";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: "application/pdf" });

type CardSource =
  | { status: "loading" }
  | { status: "ready"; title: string; prefill: CardPrefill }
  | { status: "error"; message: string };

/** Card "Certificados" do Planner já convertido para o gerador. */
async function loadCardPrefill(cardId: string): Promise<{ title: string; prefill: CardPrefill }> {
  const [{ data: card, error }, users] = await Promise.all([
    supabase.from("marketing_requests").select("id, title, description").eq("id", cardId).maybeSingle(),
    fetchActiveUsers(),
  ]);
  if (error || !card) throw new Error("Não encontrei esse card no Planner. Preencha os dados abaixo à mão.");
  const info = parseCertificadoWorkshopDescription(card.description);
  if (!info) throw new Error("Esse card não traz os dados do Responsum. Preencha os dados abaixo à mão.");
  return { title: card.title?.trim() || "sem título", prefill: buildCardPrefill(info, users) };
}

function CardSourceNotice({ cardId, source }: { cardId: string; source: CardSource }) {
  if (source.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#dce9eb] bg-[#f6fafb] px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        Buscando os dados do card no Planner…
      </div>
    );
  }
  if (source.status === "error") {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#dce9eb] bg-[#f6fafb] px-4 py-3 text-sm text-foreground">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        {source.message}
      </div>
    );
  }
  const { title, prefill } = source;
  const total = prefill.participantes.length;
  return (
    <div role="status" className="space-y-1.5 rounded-lg border border-[#dce9eb] bg-[#f6fafb] px-4 py-3 text-sm">
      <p className="flex items-start gap-2 text-foreground">
        <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-[#347796]" />
        <span className="min-w-0">
          Preenchido a partir do card{" "}
          <Link href={`/planner?tarefa=${encodeURIComponent(cardId)}`} className="font-medium text-[#347796] hover:underline">
            {title}
          </Link>
          . Confira e ajuste o que precisar.
        </span>
      </p>
      <p className="pl-6 text-muted-foreground">
        {prefill.presenca === "preenchida" && total > 0
          ? `${total} ${total === 1 ? "pessoa veio" : "pessoas vieram"} da lista de presença.`
          : prefill.presenca === "nao_buscada"
            ? "A presença ainda não foi buscada no card. Use “Buscar presença” no Planner ou importe a planilha."
            : "Ninguém preencheu a presença ainda. Importe a planilha ou cole os nomes."}
      </p>
      {prefill.semCadastro.length > 0 && (
        <p className="pl-6 text-muted-foreground">
          Não achei no cadastro, entraram como vieram: {prefill.semCadastro.join(", ")}.
        </p>
      )}
    </div>
  );
}

export function CertificadosClient({ cardId = null }: { cardId?: string | null }) {
  const [cardSource, setCardSource] = useState<CardSource | null>(cardId ? { status: "loading" } : null);
  const [draft, setDraftState] = useState<CertificateDraft>(createDefaultDraft);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [participants, setParticipants] = useState<CertificateParticipant[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [assets, setAssets] = useState<CertificateAssets | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState<null | { kind: "pdf" | "zip"; done: number; total: number }>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const renderToken = useRef(0);

  const setDraft = useCallback((update: (draft: CertificateDraft) => CertificateDraft) => {
    setDraftState((current) => update(current));
  }, []);

  useEffect(() => {
    const stored = loadStoredDraft();
    if (stored) setDraftState(stored);
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (draftLoaded) storeDraft(draft);
  }, [draft, draftLoaded]);

  // Card do Planner: chega depois do rascunho salvo e troca só os dados do evento.
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    loadCardPrefill(cardId)
      .then(({ title, prefill }) => {
        if (cancelled) return;
        setDraftState((current) => applyCardPrefill(current, prefill));
        setParticipants(prefill.participantes);
        setPreviewId(null);
        setCardSource({ status: "ready", title, prefill });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setCardSource({
          status: "error",
          message: error instanceof Error ? error.message : "Não foi possível ler o card do Planner.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const fetchAssets = useCallback(() => {
    setAssetsError(null);
    loadAssets()
      .then(setAssets)
      .catch((error: unknown) =>
        setAssetsError(error instanceof Error ? error.message : "Não foi possível carregar o modelo do certificado.")
      );
  }, []);

  useEffect(() => {
    fetchAssets();
    // Já baixa o gerador enquanto a pessoa preenche.
    void loadRenderer();
  }, [fetchAssets]);

  const config = useMemo(() => draftToConfig(draft), [draft]);
  const validParticipants = useMemo(() => participants.filter((p) => p.nome.trim()), [participants]);
  const issues = useMemo(() => {
    const list = validateCertificateConfig(config);
    if (validParticipants.length === 0) list.push("Adicione pelo menos um participante.");
    return list;
  }, [config, validParticipants.length]);

  const previewIndex = Math.max(0, validParticipants.findIndex((p) => p.id === previewId));
  const previewParticipant = validParticipants[previewIndex] ?? null;
  const previewName = previewParticipant?.nome ?? "Nome do Participante";

  // Prévia: completa o que ainda falta com exemplos, para a pessoa ver o resultado desde o início.
  const previewConfig = useMemo(
    () => ({
      ...config,
      curso: config.curso.trim() || "Nome do curso",
      dataInicio: config.dataInicio || todayIso(),
      cargaHorariaMinutos: config.cargaHorariaMinutos > 0 ? config.cargaHorariaMinutos : 60,
    }),
    [config]
  );

  useEffect(() => {
    if (!assets) return;
    const token = ++renderToken.current;
    setRendering(true);
    const timer = setTimeout(async () => {
      try {
        const { renderCertificatesPdf } = await loadRenderer();
        const bytes = await renderCertificatesPdf(assets, previewConfig, [previewName]);
        if (token !== renderToken.current) return;
        setPreviewBytes(bytes);
        setPreviewError(null);
      } catch (error) {
        if (token !== renderToken.current) return;
        console.error(error);
        setPreviewError("Não foi possível montar a prévia. Confira o texto e as imagens de assinatura.");
      } finally {
        if (token === renderToken.current) setRendering(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [assets, previewConfig, previewName]);

  const openPreview = () => {
    if (!previewBytes) return;
    const url = URL.createObjectURL(pdfBlob(previewBytes));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const movePreview = (delta: number) => {
    if (validParticipants.length === 0) return;
    const next = (previewIndex + delta + validParticipants.length) % validParticipants.length;
    setPreviewId(validParticipants[next].id);
  };

  const downloadSinglePdf = async () => {
    if (!assets || issues.length > 0) return;
    setDownloadError(null);
    setBusy({ kind: "pdf", done: 0, total: validParticipants.length });
    try {
      const { renderCertificatesPdf } = await loadRenderer();
      const bytes = await renderCertificatesPdf(assets, config, validParticipants.map((p) => p.nome));
      downloadBlob(pdfBlob(bytes), `Certificados - ${safeFilePart(config.curso)}.pdf`);
    } catch (error) {
      console.error(error);
      setDownloadError("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const downloadZip = async () => {
    if (!assets || issues.length > 0) return;
    setDownloadError(null);
    const total = validParticipants.length;
    setBusy({ kind: "zip", done: 0, total });
    try {
      const [{ renderCertificatesPdf }, { default: JSZip }] = await Promise.all([loadRenderer(), import("jszip")]);
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const [index, participant] of validParticipants.entries()) {
        const bytes = await renderCertificatesPdf(assets, config, [participant.nome]);
        const base = certificateFileName(participant.nome);
        const count = (used.get(base) ?? 0) + 1;
        used.set(base, count);
        zip.file(count > 1 ? base.replace(/\.pdf$/, ` (${count}).pdf`) : base, bytes);
        setBusy({ kind: "zip", done: index + 1, total });
      }
      // PDF já vem comprimido; sem recompressão o zip sai bem mais rápido.
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      downloadBlob(blob, `Certificados - ${safeFilePart(config.curso)}.zip`);
    } catch (error) {
      console.error(error);
      setDownloadError("Não foi possível gerar o arquivo .zip. Tente de novo.");
    } finally {
      setBusy(null);
    }
  };

  const canDownload = Boolean(assets) && issues.length === 0 && !busy;

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-5">
        {cardId && cardSource && <CardSourceNotice cardId={cardId} source={cardSource} />}
        <EventSection draft={draft} setDraft={setDraft} />
        <SignaturesSection draft={draft} setDraft={setDraft} />
        <ParticipantsPanel
          participants={participants}
          onChange={setParticipants}
          previewId={previewParticipant?.id ?? null}
          onPreview={setPreviewId}
          nomeEmMaiusculas={draft.nomeEmMaiusculas}
          onToggleMaiusculas={(value) => setDraft((d) => ({ ...d, nomeEmMaiusculas: value }))}
        />
        <TextSection draft={draft} setDraft={setDraft} />
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <section
          aria-label="Prévia do certificado"
          className="rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(3,32,47,0.05)] sm:p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Prévia</h2>
              {rendering && assets && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Atualizando prévia" />}
            </div>
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Participante anterior"
                disabled={validParticipants.length < 2}
                onClick={() => movePreview(-1)}
              >
                <ChevronLeft />
              </Button>
              <span className="max-w-56 truncate text-sm text-muted-foreground" title={previewName}>
                {previewParticipant
                  ? `${previewIndex + 1} de ${validParticipants.length} · ${previewParticipant.nome}`
                  : "Exemplo sem participante"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Próximo participante"
                disabled={validParticipants.length < 2}
                onClick={() => movePreview(1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="relative aspect-[297/210] w-full overflow-hidden rounded-md border border-[#e8f0f1] bg-[#f6fafb]">
            {assetsError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <AlertCircle className="size-6 text-destructive" />
                <p className="text-sm text-foreground">{assetsError}</p>
                <Button type="button" variant="outline" size="sm" onClick={fetchAssets}>
                  <RefreshCw />
                  Tentar de novo
                </Button>
              </div>
            ) : previewBytes ? (
              <PdfPagePreview
                bytes={previewBytes}
                label={`Prévia do certificado de ${previewName}`}
                onError={() => setPreviewError("Não foi possível desenhar a prévia. Use “Abrir em PDF” para conferir.")}
              />
            ) : (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando o modelo…
              </div>
            )}
          </div>
          {previewError && <p className="mt-2 text-sm text-destructive">{previewError}</p>}
          {previewBytes && (
            <button
              type="button"
              onClick={openPreview}
              className="mt-2 inline-flex items-center gap-1 text-sm text-[#347796] hover:underline"
            >
              Abrir em PDF
              <ExternalLink className="size-3.5" />
            </button>
          )}

          <div className="mt-4 border-t border-[#e8f0f1] pt-4">
            {issues.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    {issue}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={downloadZip} disabled={!canDownload}>
                {busy?.kind === "zip" ? <Loader2 className="animate-spin" /> : <FileArchive />}
                {busy?.kind === "zip"
                  ? `Gerando ${busy.done} de ${busy.total}…`
                  : `Baixar .zip (um PDF por pessoa)`}
              </Button>
              <Button type="button" variant="outline" onClick={downloadSinglePdf} disabled={!canDownload}>
                {busy?.kind === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}
                {busy?.kind === "pdf" ? "Gerando PDF…" : "Baixar PDF único"}
              </Button>
            </div>
            {downloadError && <p className="mt-2 text-sm text-destructive">{downloadError}</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}
