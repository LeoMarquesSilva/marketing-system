"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ImageUp,
  Loader2,
  MessageSquareWarning,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AreaMark } from "@/components/conteudo/content-schedule-visuals";
import { uploadReelDeliveryFile } from "@/lib/storage-buckets";
import { generateReelCopyFromVideo } from "@/lib/reel-deliveries/audio-client";
import {
  REEL_CAPTION_MAX_LENGTH,
  REEL_COVER_SUBTITLE_MAX_LENGTH,
  REEL_COVER_TITLE_MAX_LENGTH,
  REEL_DELIVERY_COVER_MAX_BYTES,
  canParticipantDecide,
  contentTypeForFile,
  missingForReady,
} from "@/lib/reel-deliveries/domain";
import type { ReelDeliveryDetail, ReelPerson } from "@/lib/reel-deliveries/types";
import { cn } from "@/lib/utils";
import {
  DecisionLine,
  ReelStatusBadge,
  formatBytes,
  formatReelDate,
  formatReelDateTime,
  reelDisplayTitle,
} from "./reel-delivery-ui";
import { UploadProgress, VideoFileField, validateVideo } from "./reel-upload-dialog";
import { ReelPeoplePicker } from "./reel-people-picker";

type Viewer = { id: string; isManager: boolean };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[#e6eef0] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-[#183f50]">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

async function sendJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir.");
  return data as { delivery?: ReelDeliveryDetail };
}

export function ReelDeliverySheet({
  deliveryId,
  viewer,
  people,
  onOpenChange,
  onChanged,
  refreshToken = 0,
  onVersionUploaded,
}: {
  deliveryId: string | null;
  viewer: Viewer;
  people: ReelPerson[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  /** Muda quando a IA termina em segundo plano, para recarregar o reel aberto. */
  refreshToken?: number;
  onVersionUploaded?: (deliveryId: string, video: File) => void;
}) {
  const [detail, setDetail] = useState<ReelDeliveryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (id: string) => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reel-deliveries/${id}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível abrir o reel.");
      if (request === requestRef.current) setDetail(body.delivery);
    } catch (err) {
      if (request === requestRef.current) setError(err instanceof Error ? err.message : "Não foi possível abrir o reel.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetail(null);
    setNotice(null);
    if (deliveryId) void load(deliveryId);
  }, [deliveryId, load]);

  useEffect(() => {
    if (deliveryId && refreshToken > 0) void load(deliveryId);
  }, [refreshToken, deliveryId, load]);

  // Enquanto a IA trabalha (inclusive aberta em outra aba), acompanha até terminar.
  useEffect(() => {
    if (!deliveryId || detail?.id !== deliveryId || detail.aiStatus !== "processing") return;
    const timer = window.setTimeout(() => void load(deliveryId), 5000);
    return () => window.clearTimeout(timer);
  }, [deliveryId, detail, load]);

  async function run(key: string, action: () => Promise<{ delivery?: ReelDeliveryDetail }>, success: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result.delivery) setDetail(result.delivery);
      setNotice(success);
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={Boolean(deliveryId)} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[min(980px,100vw)] overflow-hidden">
        <SheetHeader className="border-b border-[#e6eef0] px-5 pb-4 pt-5 pr-16 sm:px-6">
          {detail ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <AreaMark area={detail.area} compact />
                <span aria-hidden>·</span>
                <span>{formatReelDate(detail.dueDate, "long")}</span>
                <ReelStatusBadge status={detail.status} />
              </div>
              <SheetTitle className="text-lg leading-6 text-[#0d1e2e]">{reelDisplayTitle(detail)}</SheetTitle>
              <SheetDescription className="sr-only">Vídeo, aprovação, capa e legenda do reel.</SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>Reel</SheetTitle>
              <SheetDescription>{loading ? "Carregando…" : "Vídeo, aprovação, capa e legenda."}</SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {notice && (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="size-4 shrink-0" />{notice}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />{error}
            </p>
          )}
          {loading && !detail && (
            <div className="grid gap-6 md:grid-cols-[300px_1fr]" aria-hidden>
              <div className="aspect-[9/16] animate-pulse rounded-lg bg-slate-200" />
              <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-md bg-slate-100" />)}</div>
            </div>
          )}
          {detail && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <VideoColumn detail={detail} viewer={viewer} busy={busy} run={run} onVersionUploaded={onVersionUploaded} />
              <div className="min-w-0 space-y-5">
                <ApprovalSection key={detail.currentVersion?.id ?? "none"} detail={detail} viewer={viewer} people={people} busy={busy} run={run} />
                <CoverCaptionSection key={[detail.id, detail.coverTitle, detail.coverSubtitle, detail.caption].join("|")} detail={detail} viewer={viewer} busy={busy} run={run} />
                <HistorySection detail={detail} />
                {viewer.isManager && (
                  <DeleteSection
                    busy={busy}
                    onDelete={async () => {
                      const ok = await run("delete", () => sendJson(`/api/reel-deliveries/${detail.id}`, "DELETE"), "Reel excluído.");
                      if (ok) onOpenChange(false);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type RunFn = (key: string, action: () => Promise<{ delivery?: ReelDeliveryDetail }>, success: string) => Promise<boolean>;

function VideoColumn({ detail, viewer, busy, run, onVersionUploaded }: { detail: ReelDeliveryDetail; viewer: Viewer; busy: string | null; run: RunFn; onVersionUploaded?: (deliveryId: string, video: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const version = detail.currentVersion;

  async function sendVersion() {
    setLocalError(null);
    const check = validateVideo(file);
    if ("error" in check) return setLocalError(check.error);
    const ok = await run(
      "version",
      async () => {
        setProgress(0);
        try {
          const { path } = await uploadReelDeliveryFile(detail.id, file!, "video", check.contentType, { onProgress: setProgress });
          return await sendJson(`/api/reel-deliveries/${detail.id}/versions`, "POST", {
            notes: notes.trim() || null,
            video: { path, file_name: file!.name, size_bytes: file!.size, content_type: check.contentType },
          });
        } finally {
          setProgress(null);
        }
      },
      "Nova versão enviada. A aprovação recomeçou."
    );
    if (ok) {
      // A IA atualiza a transcrição da nova versão sem apagar o texto já revisado.
      if (file) onVersionUploaded?.(detail.id, file);
      setFile(null);
      setNotes("");
    }
  }

  return (
    <div className="space-y-4 md:sticky md:top-0 md:self-start">
      <div className="mx-auto aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-lg bg-[#071a27]">
        {detail.videoUrl ? (
          <video key={detail.videoUrl} src={detail.videoUrl} controls playsInline preload="metadata" className="size-full object-contain" />
        ) : (
          <p className="grid size-full place-items-center p-6 text-center text-sm text-white/70">Vídeo indisponível. Atualize a página.</p>
        )}
      </div>
      {version && (
        <div className="text-xs text-slate-600">
          <p className="font-medium text-slate-800">
            Versão {version.number}{detail.versions.length > 1 ? ` de ${detail.versions.length}` : ""} · {formatBytes(version.sizeBytes)}
          </p>
          <p>Enviada {formatReelDateTime(version.createdAt)}{version.uploadedByName ? ` por ${version.uploadedByName}` : ""}</p>
          {version.notes && <p className="mt-2 whitespace-pre-wrap rounded-md bg-white px-2.5 py-1.5 text-sm leading-5 text-slate-700 ring-1 ring-[#dce9eb]">{version.notes}</p>}
        </div>
      )}
      {viewer.isManager && detail.videoDownloadUrl && (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={detail.videoDownloadUrl}><Download />Baixar vídeo</a>
        </Button>
      )}
      {viewer.isManager && (
        <details className="group rounded-lg border border-[#dce9eb] bg-white p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#183f50]">
            <UploadCloud className="size-4" />Enviar nova versão
          </summary>
          <div className="mt-3 space-y-3">
            {localError && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{localError}</p>}
            <VideoFileField id={`reel-version-${detail.id}`} file={file} onChange={setFile} disabled={busy !== null} />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="O que mudou nesta versão?" rows={2} maxLength={2000} disabled={busy !== null} aria-label="O que mudou nesta versão" />
            {progress !== null && <UploadProgress percent={progress} />}
            <p className="text-xs text-slate-500">Todas as pessoas precisarão aprovar de novo.</p>
            <Button onClick={() => void sendVersion()} disabled={busy !== null || !file} className="w-full bg-[#347796] text-white hover:bg-[#285f7a]">
              {busy === "version" ? <Loader2 className="animate-spin" /> : <UploadCloud />}Enviar versão
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}

function ApprovalSection({ detail, viewer, people, busy, run }: { detail: ReelDeliveryDetail; viewer: Viewer; people: ReelPerson[]; busy: string | null; run: RunFn }) {
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [editingPeople, setEditingPeople] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [onBehalf, setOnBehalf] = useState<string | null>(null);
  const [behalfNote, setBehalfNote] = useState("");
  const version = detail.currentVersion;
  const myDecision = detail.currentDecisions.find((d) => d.userId === viewer.id);
  const isParticipant = detail.participants.some((p) => p.id === viewer.id);
  const canDecide = isParticipant && Boolean(version) && canParticipantDecide(detail.status);
  const [changingMine, setChangingMine] = useState(false);
  const showActions = canDecide && (!myDecision || changingMine);

  async function decide(decision: "approved" | "changes_requested", extra?: { on_behalf_of?: string; comment?: string }) {
    if (!version) return;
    const ok = await run(
      `decide-${extra?.on_behalf_of ?? "me"}`,
      () => sendJson(`/api/reel-deliveries/${detail.id}/decisions`, "POST", {
        version_id: version.id,
        decision,
        comment: extra?.comment ?? (decision === "changes_requested" ? comment : null),
        on_behalf_of: extra?.on_behalf_of,
      }),
      decision === "approved" ? "Aprovação registrada." : "Pedido de ajuste enviado ao Marketing."
    );
    if (ok) { setMode("idle"); setComment(""); setChangingMine(false); setOnBehalf(null); setBehalfNote(""); }
  }

  return (
    <Section
      title="Aprovação"
      description={detail.participants.length > 1 ? "O reel só segue quando todas as pessoas aprovarem." : "O reel segue assim que for aprovado."}
    >
      {showActions && (
        <div className="space-y-3 rounded-lg bg-[#eef8f8] p-4 ring-1 ring-[#cfe7ea]">
          <p className="text-sm font-medium text-[#183f50]">
            {myDecision ? "Mudar sua decisão sobre esta versão" : "Assistiu? Aprove ou peça um ajuste."}
          </p>
          {mode === "changes" ? (
            <>
              <Textarea
                autoFocus
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="O que precisa mudar? Se for um trecho específico, diga o minuto (ex.: 0:12)."
                rows={3}
                maxLength={2000}
                aria-label="O que precisa mudar"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void decide("changes_requested")} disabled={busy !== null || !comment.trim()} className="bg-[#347796] text-white hover:bg-[#285f7a]">
                  {busy === "decide-me" ? <Loader2 className="animate-spin" /> : <Send />}Enviar pedido de ajuste
                </Button>
                <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy !== null}>Voltar</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void decide("approved")} disabled={busy !== null} className="bg-[#347796] text-white hover:bg-[#285f7a]">
                {busy === "decide-me" ? <Loader2 className="animate-spin" /> : <Check />}Aprovar vídeo
              </Button>
              <Button variant="outline" onClick={() => setMode("changes")} disabled={busy !== null}>
                <MessageSquareWarning />Pedir ajuste
              </Button>
              {myDecision && <Button variant="ghost" onClick={() => setChangingMine(false)} disabled={busy !== null}>Cancelar</Button>}
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-[#e6eef0]">
        {detail.participants.map((person) => {
          const decision = detail.currentDecisions.find((d) => d.userId === person.id);
          return (
            <div key={person.id}>
              <DecisionLine person={person} decision={decision} />
              {person.id === viewer.id && myDecision && canDecide && !changingMine && (
                <button type="button" onClick={() => setChangingMine(true)} className="mb-2 ml-11 text-xs font-medium text-[#285f7a] underline-offset-2 hover:underline">
                  Mudar minha decisão
                </button>
              )}
              {viewer.isManager && !decision && version && canParticipantDecide(detail.status) && person.id !== viewer.id && (
                onBehalf === person.id ? (
                  <div className="mb-3 ml-11 space-y-2">
                    <Textarea value={behalfNote} onChange={(e) => setBehalfNote(e.target.value)} placeholder="Como aprovou? Ex.: aprovou pelo WhatsApp." rows={2} maxLength={2000} aria-label={`Como ${person.name} aprovou`} />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void decide("approved", { on_behalf_of: person.id, comment: behalfNote.trim() || undefined })} disabled={busy !== null} className="bg-[#347796] text-white hover:bg-[#285f7a]">
                        {busy === `decide-${person.id}` ? <Loader2 className="animate-spin" /> : <Check />}Registrar aprovação
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOnBehalf(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { setOnBehalf(person.id); setBehalfNote(""); }} className="mb-2 ml-11 text-xs font-medium text-[#285f7a] underline-offset-2 hover:underline">
                    Aprovou por fora? Registrar
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {viewer.isManager && (
        editingPeople ? (
          <div className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-3">
            <Label>Quem aparece no vídeo</Label>
            <ReelPeoplePicker people={people} value={participantIds} onChange={setParticipantIds} />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const ok = await run("people", () => sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", { participant_ids: participantIds }), "Pessoas atualizadas.");
                  if (ok) setEditingPeople(false);
                }}
                disabled={busy !== null || participantIds.length === 0}
                className="bg-[#347796] text-white hover:bg-[#285f7a]"
              >
                {busy === "people" && <Loader2 className="animate-spin" />}Salvar pessoas
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingPeople(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { setParticipantIds(detail.participants.map((p) => p.id)); setEditingPeople(true); }}>
            Alterar quem aparece no vídeo
          </Button>
        )
      )}
    </Section>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={!text.trim()}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check /> : <Copy />}{copied ? "Copiado" : label}
    </Button>
  );
}

function CoverCaptionSection({ detail, viewer, busy, run }: { detail: ReelDeliveryDetail; viewer: Viewer; busy: string | null; run: RunFn }) {
  const [coverTitle, setCoverTitle] = useState(detail.coverTitle ?? "");
  const [coverSubtitle, setCoverSubtitle] = useState(detail.coverSubtitle ?? "");
  const [caption, setCaption] = useState(detail.caption ?? "");
  const [coverError, setCoverError] = useState<string | null>(null);
  const [confirmAi, setConfirmAi] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  const dirty =
    (detail.coverTitle ?? "") !== coverTitle.trim() ||
    (detail.coverSubtitle ?? "") !== coverSubtitle.trim() ||
    (detail.caption ?? "") !== caption.trim();
  const texts = { cover_title: coverTitle, cover_subtitle: coverSubtitle, caption };
  const missing = missingForReady({ status: detail.status, caption: dirty ? caption : detail.caption, coverPath: detail.hasCover ? "ok" : null });
  const unlocked = detail.status === "approved" || detail.status === "ready" || detail.status === "published";
  const aiRunning = detail.aiStatus === "processing" || busy === "ai";
  const hasText = Boolean(detail.coverTitle || detail.coverSubtitle || detail.caption);

  if (!viewer.isManager) {
    if (!detail.coverUrl && !detail.caption && !detail.coverTitle) return null;
    return (
      <Section title="Capa e legenda" description="Preparadas pelo Marketing para a publicação.">
        <div className="flex flex-col gap-4 sm:flex-row">
          {detail.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.coverUrl} alt="Capa do reel" className="aspect-[9/16] w-28 shrink-0 rounded-md object-cover ring-1 ring-[#dce9eb]" />
          )}
          <div className="min-w-0 space-y-2">
            {detail.coverTitle && <p className="font-semibold uppercase leading-snug text-[#0d1e2e]">{detail.coverTitle}</p>}
            {detail.coverSubtitle && <p className="text-sm text-slate-600">{detail.coverSubtitle}</p>}
            {detail.caption && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.caption}</p>}
          </div>
        </div>
      </Section>
    );
  }

  async function uploadCover(file: File | undefined) {
    setCoverError(null);
    if (!file) return;
    const contentType = contentTypeForFile(file.name, file.type, "cover");
    if (!contentType) return setCoverError("Use JPG, PNG ou WebP.");
    if (file.size > REEL_DELIVERY_COVER_MAX_BYTES) return setCoverError("A capa passa de 15 MB.");
    await run(
      "cover",
      async () => {
        const { path } = await uploadReelDeliveryFile(detail.id, file, "cover", contentType);
        return sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", { cover_path: path });
      },
      "Capa salva."
    );
    if (coverInput.current) coverInput.current.value = "";
  }

  async function generate() {
    setConfirmAi(false);
    await run(
      "ai",
      async () => {
        // Com transcrição salva, só reescreve; sem ela, baixa o vídeo atual e transcreve.
        let video: Blob | null = null;
        if (!detail.transcript) {
          if (!detail.videoUrl) throw new Error("Vídeo indisponível. Atualize a página.");
          const response = await fetch(detail.videoUrl);
          if (!response.ok) throw new Error("Não foi possível baixar o vídeo para transcrever.");
          video = await response.blob();
        }
        return generateReelCopyFromVideo(detail.id, video, true);
      },
      "Título, subtítulo e legenda gerados pela IA. Revise antes de publicar."
    );
  }

  return (
    <Section
      title="Capa e legenda"
      description={unlocked ? "Deixe tudo pronto para publicar." : "Libera de vez depois da aprovação, mas você já pode adiantar."}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#f4f3fa] p-3 text-sm ring-1 ring-[#48466e]/15">
        <Sparkles className="size-4 shrink-0 text-[#48466e]" aria-hidden />
        {aiRunning ? (
          <span className="flex items-center gap-2 text-[#48466e]"><Loader2 className="size-4 animate-spin" />A IA está transcrevendo o vídeo e escrevendo pelo guia de capas e legendas…</span>
        ) : confirmAi ? (
          <>
            <span className="text-slate-700">Substituir título, subtítulo e legenda atuais?</span>
            <Button size="sm" onClick={() => void generate()} className="bg-[#48466e] text-white hover:bg-[#3a3859]">Substituir</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmAi(false)}>Cancelar</Button>
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 text-slate-700">
              {detail.aiStatus === "failed"
                ? `A IA não conseguiu: ${detail.aiError ?? "erro desconhecido"}`
                : detail.aiStatus === "done"
                  ? "Texto sugerido pela IA a partir da fala do vídeo. Revise antes de publicar."
                  : "A IA transcreve o vídeo e sugere título, subtítulo e legenda no padrão do escritório."}
            </span>
            <Button size="sm" variant="outline" onClick={() => (hasText ? setConfirmAi(true) : void generate())} disabled={busy !== null}>
              <Sparkles />{hasText ? "Gerar de novo com IA" : "Gerar com IA"}
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="w-32 shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => coverInput.current?.click()}
            disabled={busy !== null}
            className={cn(
              "grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-md text-center text-xs text-slate-500 ring-1 ring-[#dce9eb] transition hover:ring-[#347796] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/40",
              !detail.coverUrl && "border border-dashed border-[#9fc9d3] bg-[#f8fbfb] ring-0"
            )}
            aria-label={detail.coverUrl ? "Trocar capa" : "Enviar capa"}
          >
            {busy === "cover" ? (
              <Loader2 className="size-5 animate-spin text-[#347796]" />
            ) : detail.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.coverUrl} alt="Capa do reel" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-2"><ImageUp className="size-5 text-[#347796]" />Enviar arte da capa</span>
            )}
          </button>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void uploadCover(e.target.files?.[0])} tabIndex={-1} aria-hidden />
          {detail.coverDownloadUrl && (
            <Button asChild variant="outline" size="xs" className="w-full"><a href={detail.coverDownloadUrl}><Download />Baixar capa</a></Button>
          )}
          {coverError && <p role="alert" className="text-xs text-red-700">{coverError}</p>}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`cover-title-${detail.id}`}>Título da capa</Label>
              <span className="font-mono text-xs tabular-nums text-slate-500">{coverTitle.length}/{REEL_COVER_TITLE_MAX_LENGTH}</span>
            </div>
            <Input
              id={`cover-title-${detail.id}`}
              value={coverTitle}
              onChange={(e) => setCoverTitle(e.target.value)}
              maxLength={REEL_COVER_TITLE_MAX_LENGTH}
              placeholder="EMPATE ENTRE SÓCIOS PODE TRAVAR A EMPRESA"
              className="font-semibold"
              disabled={aiRunning}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`cover-subtitle-${detail.id}`}>Subtítulo da capa</Label>
            <Input
              id={`cover-subtitle-${detail.id}`}
              value={coverSubtitle}
              onChange={(e) => setCoverSubtitle(e.target.value)}
              maxLength={REEL_COVER_SUBTITLE_MAX_LENGTH}
              placeholder="Como o acordo de sócios pode prever saídas para o deadlock societário"
              disabled={aiRunning}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`caption-${detail.id}`}>Legenda</Label>
              <span className={cn("font-mono text-xs tabular-nums", caption.length > REEL_CAPTION_MAX_LENGTH ? "text-red-700" : "text-slate-500")}>
                {caption.length}/{REEL_CAPTION_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id={`caption-${detail.id}`}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={10}
              maxLength={REEL_CAPTION_MAX_LENGTH}
              placeholder="Legenda do post no Instagram, com CTA, autoria e hashtags."
              className="min-h-52"
              disabled={aiRunning}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => void run("texts", () => sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", texts), "Capa e legenda salvas.")}
              disabled={busy !== null || !dirty || aiRunning}
              className="bg-[#347796] text-white hover:bg-[#285f7a]"
            >
              {busy === "texts" && <Loader2 className="animate-spin" />}Salvar
            </Button>
            <CopyButton text={[coverTitle, coverSubtitle].filter((t) => t.trim()).join("\n")} label="Copiar capa" />
            <CopyButton text={caption} label="Copiar legenda" />
          </div>
          {detail.transcript && (
            <details className="rounded-md bg-white p-3 text-sm ring-1 ring-[#e6eef0]">
              <summary className="cursor-pointer font-medium text-[#183f50]">Transcrição do vídeo</summary>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">{detail.transcript}</p>
            </details>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 ring-1 ring-[#dce9eb]">
        {detail.status === "ready" || detail.status === "published" ? (
          <>
            {detail.status === "ready" && (
              <Button
                size="sm"
                onClick={() => void run("stage", () => sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", { status: "published" }), "Reel marcado como publicado.")}
                disabled={busy !== null}
                className="bg-[#347796] text-white hover:bg-[#285f7a]"
              >
                {busy === "stage" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Marcar como publicado
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void run("stage-back", () => sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", { status: "approved" }), "Reel voltou para capa e legenda.")}
              disabled={busy !== null}
            >
              <RotateCcw />Voltar para capa e legenda
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => void run("stage", () => sendJson(`/api/reel-deliveries/${detail.id}`, "PATCH", { status: "ready", ...(dirty ? texts : {}) }), "Reel pronto para publicar.")}
              disabled={busy !== null || missing.length > 0 || aiRunning}
              className="bg-[#347796] text-white hover:bg-[#285f7a]"
            >
              {busy === "stage" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Marcar como pronto para publicar
            </Button>
            {missing.length > 0 && <span className="text-xs text-slate-500">Falta {missing.join(", ")}.</span>}
          </>
        )}
      </div>
    </Section>
  );
}

function HistorySection({ detail }: { detail: ReelDeliveryDetail }) {
  const older = detail.versions.slice(1);
  if (older.length === 0) return null;
  return (
    <Section title="Versões anteriores">
      <ol className="space-y-3">
        {older.map((version) => {
          const decisions = detail.decisions.filter((d) => d.versionId === version.id);
          return (
            <li key={version.id} className="rounded-lg bg-white p-3 text-sm ring-1 ring-[#e6eef0]">
              <p className="font-medium text-slate-800">
                Versão {version.number} <span className="font-normal text-slate-500">· {formatReelDateTime(version.createdAt)}</span>
              </p>
              {version.notes && <p className="mt-1 whitespace-pre-wrap text-slate-600">{version.notes}</p>}
              {decisions.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {decisions.map((d) => (
                    <li key={d.id} className="text-xs leading-5 text-slate-600">
                      <span className={cn("font-medium", d.decision === "approved" ? "text-emerald-700" : "text-red-700")}>
                        {d.userName.split(" ")[0]} {d.decision === "approved" ? "aprovou" : "pediu ajuste"}
                      </span>
                      {d.comment ? `: ${d.comment}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function DeleteSection({ busy, onDelete }: { busy: string | null; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="border-t border-[#e6eef0] pt-5">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-700">Excluir o reel, os vídeos e a capa? Não dá para desfazer.</span>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />}Excluir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => setConfirming(true)}>
          <Trash2 />Excluir reel
        </Button>
      )}
    </section>
  );
}
