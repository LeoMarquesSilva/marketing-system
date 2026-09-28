"use client";

import { useRef, useState } from "react";
import { Film, LoaderCircle, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NFC_VIDEO_MAX_BYTES, uploadNfcVideo } from "@/lib/storage-buckets";
import type { NfcActionConfig } from "@/lib/nfc/types";

/** Acima disso o vídeo demora a começar no 4G; vale comprimir para 1080p. */
const HEAVY_VIDEO_BYTES = 500 * 1024 * 1024;

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1
    ? `${gb.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`
    : `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function NfcVideoField({
  config,
  onChange,
  onUploadingChange,
}: {
  config: NfcActionConfig;
  onChange: (patch: Partial<NfcActionConfig>) => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = progress !== null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      setError("Envie um vídeo MP4, MOV ou WebM.");
      return;
    }
    if (file.size > NFC_VIDEO_MAX_BYTES) {
      setError(`O vídeo tem ${formatSize(file.size)}; o limite é ${formatSize(NFC_VIDEO_MAX_BYTES)}.`);
      return;
    }
    setProgress(0);
    onUploadingChange(true);
    try {
      const { path } = await uploadNfcVideo(file, { onProgress: setProgress });
      onChange({ videoPath: path, videoFileName: file.name, videoSizeBytes: file.size });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o vídeo.");
    } finally {
      setProgress(null);
      onUploadingChange(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const heavy = (config.videoSizeBytes ?? 0) > HEAVY_VIDEO_BYTES;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="nfc-video-title">Título na tela</Label>
        <Input
          id="nfc-video-title"
          value={config.title ?? ""}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Parabéns, Ricardo!"
        />
        <p className="text-xs leading-5 text-muted-foreground">Aparece por cima do vídeo nos primeiros segundos.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nfc-video-description">Mensagem curta (opcional)</Label>
        <Textarea
          id="nfc-video-description"
          rows={2}
          value={config.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Um recado da sua família e dos seus amigos."
        />
      </div>

      <div className="md:col-span-2 rounded-md border border-[#dce9eb] bg-[#f7fafb] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[#347796] shadow-sm">
              <Film className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {config.videoPath ? config.videoFileName || "Vídeo enviado" : "Nenhum vídeo enviado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {config.videoPath
                  ? `${formatSize(config.videoSizeBytes)} · guardado em área privada`
                  : "MP4 recomendado · até 2 GB · o envio continua se a conexão cair"}
              </p>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.m4v,.webm"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button type="button" variant={config.videoPath ? "outline" : "default"} disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <LoaderCircle className="animate-spin" /> : <Upload />}
            {uploading ? `Enviando ${progress}%` : config.videoPath ? "Trocar vídeo" : "Enviar vídeo"}
          </Button>
        </div>

        {uploading && (
          <div className="mt-3" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#47cdd0] transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Mantenha esta aba aberta. Vídeos grandes podem levar vários minutos.
            </p>
          </div>
        )}

        {heavy && !uploading && (
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Vídeo pesado: no 4G ele pode demorar para começar ou travar. Uma versão em 1080p costuma ficar
            5 a 10 vezes menor sem perda visível no celular.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
