"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoConfirmDialog } from "@/components/collaborator-photos/photo-confirm-dialog";
import { fetchGallery } from "@/lib/collaborator-photos/api";
import { collaboratorPhotoPreviewUrl } from "@/lib/collaborator-photos/preview-url";
import {
  fetchFaceScanQueue,
  fetchFaceStatus,
  grantFaceConsent,
  revokeFaceConsent,
  saveFaceScan,
} from "@/lib/event-photos/api";
import { FACE_MAX_REFERENCES, matchFacesToPeople, type FaceDescriptor } from "@/lib/event-photos/faces";
import type { FaceStatus } from "@/lib/event-photos/types";

type Progress =
  | { stage: "model" }
  | { stage: "references"; done: number; total: number }
  | { stage: "scan"; album: string; done: number; total: number };

function progressLabel(progress: Progress): string {
  if (progress.stage === "model") return "Preparando o reconhecimento (na primeira vez baixa cerca de 12 MB)…";
  if (progress.stage === "references") {
    return `Lendo suas fotos corporativas: ${progress.done} de ${progress.total}…`;
  }
  return `Procurando você em “${progress.album}”: ${progress.done} de ${progress.total} fotos…`;
}

async function loadEngine() {
  return import("@/lib/event-photos/face-engine");
}

/** Varre, no navegador, os álbuns anteriores ao consentimento em busca do próprio rosto. */
async function runSelfScan(onProgress: (p: Progress) => void): Promise<number> {
  const { albums, descriptors } = await fetchFaceScanQueue();
  if (albums.length === 0 || descriptors.length === 0) return 0;
  onProgress({ stage: "model" });
  const engine = await loadEngine();
  await engine.loadFaceEngine();
  const me = [{ userId: "me", descriptors }];
  let found = 0;

  for (const album of albums) {
    const matches: Array<{ photoId: string; distance: number }> = [];
    for (let i = 0; i < album.photos.length; i += 1) {
      onProgress({ stage: "scan", album: album.title, done: i, total: album.photos.length });
      const photo = album.photos[i];
      try {
        const img = await engine.loadImageForFaces(photo.url);
        const faces = await engine.faceDescriptorsIn(img);
        const [match] = matchFacesToPeople(faces, me);
        if (match) matches.push({ photoId: photo.id, distance: match.distance });
      } catch {
        // Foto ilegível não impede o resto da busca.
      }
    }
    await saveFaceScan(album.albumId, matches);
    found += matches.length;
  }
  return found;
}

function ConsentDialog({
  open,
  busy,
  progressText,
  error,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  progressText: string | null;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setAgreed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encontrar minhas fotos nos eventos</DialogTitle>
          <DialogDescription>
            Leia antes de ativar. É opcional, e você pode desativar quando quiser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-[#456370]">
          <p>
            <strong className="text-[#102f3d]">O que é usado:</strong> a partir das suas fotos corporativas em
            Minhas fotos, o sistema gera um padrão numérico do seu rosto (template biométrico). A foto em si
            não é alterada nem enviada a lugar nenhum.
          </p>
          <p>
            <strong className="text-[#102f3d]">Para quê:</strong> só para marcar as fotos de eventos internos em
            que você aparece, para você achá-las mais rápido. Não é usado para controle de ponto, presença,
            avaliação nem qualquer outra finalidade.
          </p>
          <p>
            <strong className="text-[#102f3d]">Como funciona:</strong> a comparação roda no navegador (o seu ou o do
            marketing ao subir fotos), sem serviço externo de IA. O padrão do seu rosto fica guardado no sistema
            do escritório para as próximas comparações.
          </p>
          <p>
            <strong className="text-[#102f3d]">Quem vê:</strong> as marcações aparecem só para você. Colegas que não
            aderiram não têm nenhum dado facial guardado.
          </p>
          <p>
            <strong className="text-[#102f3d]">Seus direitos:</strong> é voluntário e não ativar não traz nenhuma
            consequência. Ao desativar, o padrão do seu rosto e todas as marcações são apagados na hora.
          </p>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[#dce9eb] bg-[#f8fbfb] p-3 text-[#102f3d]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[#347796]"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={busy}
            />
            <span>
              Li e concordo, de forma livre e específica, com o uso do meu dado biométrico facial para esta
              finalidade.
            </span>
          </label>
        </div>
        {progressText && (
          <p className="flex items-center gap-2 text-xs text-[#456370]" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {progressText}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button
            type="button"
            disabled={!agreed || busy}
            className="bg-[#347796] text-white hover:bg-[#285f7a]"
            onClick={onConfirm}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Ativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FaceRecognitionPanel({ onMatchesChanged }: { onMatchesChanged: () => void }) {
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchFaceStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function scan() {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const found = await runSelfScan(setProgress);
      setMessage(
        found > 0
          ? `Pronto! Encontramos você em ${found} foto${found === 1 ? "" : "s"}.`
          : "Busca concluída. Não encontramos você nas fotos já publicadas."
      );
      await refresh();
      onMatchesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a busca.");
    } finally {
      setProgress(null);
      setWorking(false);
    }
  }

  async function activate() {
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const gallery = await fetchGallery();
      const ordered = [
        ...gallery.filter((p) => p.usageSlugs.includes("oficial")),
        ...gallery.filter((p) => !p.usageSlugs.includes("oficial")),
      ].slice(0, FACE_MAX_REFERENCES);
      if (ordered.length === 0) {
        throw new Error("Você ainda não tem fotos em Minhas fotos. Peça ao marketing para subir suas fotos corporativas.");
      }

      setProgress({ stage: "model" });
      const engine = await loadEngine();
      await engine.loadFaceEngine();

      const references: Array<{ sourcePhotoId: string; descriptor: FaceDescriptor }> = [];
      for (let i = 0; i < ordered.length; i += 1) {
        setProgress({ stage: "references", done: i, total: ordered.length });
        try {
          const img = await engine.loadImageForFaces(
            collaboratorPhotoPreviewUrl(ordered[i].publicUrl, { width: 900, quality: 85 })
          );
          const descriptor = await engine.mainFaceDescriptor(img);
          if (descriptor) references.push({ sourcePhotoId: ordered[i].id, descriptor });
        } catch {
          // Tenta as próximas fotos.
        }
      }
      if (references.length === 0) {
        throw new Error("Não conseguimos identificar seu rosto nas suas fotos corporativas.");
      }

      setStatus(await grantFaceConsent(references));
      setConsentOpen(false);
      await scan();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar.");
      setProgress(null);
      setWorking(false);
    }
  }

  async function revoke() {
    setWorking(true);
    setError(null);
    try {
      setStatus(await revokeFaceConsent());
      setMessage("Reconhecimento desativado. Seus dados faciais e marcações foram apagados.");
      setConfirmRevoke(false);
      onMatchesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível desativar.");
    } finally {
      setWorking(false);
    }
  }

  if (!status) return null;

  return (
    <section
      className="rounded-lg border border-[#dce9eb] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(3,32,47,0.04)]"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#e8f8f8] text-[#347796]">
            <ScanFace className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#102f3d]">
              {status.consented
                ? status.matchCount > 0
                  ? `Você aparece em ${status.matchCount} foto${status.matchCount === 1 ? "" : "s"}`
                  : "Reconhecimento ativo"
                : "Encontre as fotos em que você aparece"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#5e7a85]">
              {status.consented
                ? "Abra um álbum e use o filtro “Em que eu apareço”. Fotos novas são marcadas automaticamente."
                : "Opcional. Usamos suas fotos corporativas para achar você nos álbuns, direto no navegador."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status.consented ? (
            <>
              {status.pendingScanAlbums > 0 && (
                <Button type="button" size="sm" disabled={working} onClick={() => void scan()}>
                  {working && <Loader2 className="h-4 w-4 animate-spin" />}
                  Procurar em {status.pendingScanAlbums} álbum{status.pendingScanAlbums === 1 ? "" : "s"}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={working}
                onClick={() => setConfirmRevoke(true)}
              >
                Desativar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]"
              disabled={working}
              onClick={() => setConsentOpen(true)}
            >
              <ShieldCheck className="h-4 w-4" />
              Ativar
            </Button>
          )}
        </div>
      </div>

      {progress && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#456370]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {progressLabel(progress)} Mantenha esta aba aberta.
        </p>
      )}
      {message && !progress && <p className="mt-3 text-xs text-[#285f7a]">{message}</p>}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}

      <ConsentDialog
        open={consentOpen}
        busy={working}
        progressText={progress ? progressLabel(progress) : null}
        error={consentOpen ? error : null}
        onOpenChange={setConsentOpen}
        onConfirm={() => void activate()}
      />
      <PhotoConfirmDialog
        open={confirmRevoke}
        title="Desativar reconhecimento"
        description="O padrão do seu rosto e todas as marcações nas fotos de eventos serão apagados. Você pode ativar de novo depois."
        confirmLabel="Desativar e apagar"
        tone="danger"
        busy={working}
        onConfirm={() => void revoke()}
        onOpenChange={(open) => {
          if (!working) setConfirmRevoke(open);
        }}
      />
    </section>
  );
}
