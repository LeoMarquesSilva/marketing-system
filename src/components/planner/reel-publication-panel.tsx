"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReelVideoPreview } from "@/components/planner/reel-video-preview";
import type { MarketingRequest } from "@/lib/marketing-requests";
import {
  getReelPublicationAssets,
  type ChecklistItem,
} from "@/lib/request-checklist";
import { downloadRemoteFile, filenameFromUrl } from "@/lib/download-remote-file";
import { Copy, CheckCircle2, Download, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReelPublicationPanelProps {
  request: MarketingRequest;
  checklistItems: ChecklistItem[];
}

function CopyableTextBlock({
  label,
  text,
  copyId,
  copiedId,
  onCopy,
}: {
  label: string;
  text: string | null;
  copyId: string;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      {!text ? (
        <p className="text-sm text-muted-foreground italic">Não preenchido.</p>
      ) : (
        <>
          <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-6 rounded-lg border bg-muted/20 p-3 max-h-32 overflow-y-auto">
            {text}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCopy(text, copyId)}
            className="inline-flex items-center gap-1.5"
          >
            {copiedId === copyId ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copiar
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}

export function ReelPublicationPanel({ request, checklistItems }: ReelPublicationPanelProps) {
  const assets = getReelPublicationAssets(checklistItems);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = async (url: string, kind: string, fallbackName: string) => {
    setDownloading(kind);
    try {
      await downloadRemoteFile(url, filenameFromUrl(url, fallbackName));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Vídeo
        </p>
        {request.art_link ? (
          <div className="space-y-2">
            <ReelVideoPreview src={request.art_link} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading === "video"}
              onClick={() =>
                void handleDownload(request.art_link!, "video", "reel-video.mp4")
              }
              className="inline-flex items-center gap-1.5"
            >
              <Download className={cn("h-3.5 w-3.5", downloading === "video" && "animate-pulse")} aria-hidden />
              {downloading === "video" ? "Baixando…" : "Baixar vídeo"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Vídeo não disponível.</p>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Capa
        </p>
        {assets.coverUrl ? (
          <div className="space-y-2">
            <a
              href={assets.coverUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border/40 overflow-hidden bg-muted/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assets.coverUrl}
                alt="Capa do reel"
                className="w-full max-h-40 object-contain bg-black/5"
              />
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading === "cover"}
              onClick={() =>
                void handleDownload(assets.coverUrl!, "cover", "reel-capa.jpg")
              }
              className="inline-flex items-center gap-1.5"
            >
              <Download className={cn("h-3.5 w-3.5", downloading === "cover" && "animate-pulse")} aria-hidden />
              {downloading === "cover" ? "Baixando…" : "Baixar capa"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Capa não enviada.
          </p>
        )}
      </div>

      <CopyableTextBlock
        label="Legenda"
        text={assets.caption}
        copyId="caption"
        copiedId={copiedId}
        onCopy={handleCopy}
      />

      <CopyableTextBlock
        label="Mensagem para o grupo da equipe"
        text={assets.teamMessage}
        copyId="team"
        copiedId={copiedId}
        onCopy={handleCopy}
      />
    </div>
  );
}
