"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { wrapEmailPreviewHtml } from "@/lib/email-marketing-templates";
import { applyMergeTags, SAMPLE_MERGE_CONTEXT } from "@/lib/email-marketing-merge-tags";

/** E-mail montado com dados de exemplo (mesmo HTML da pré-visualização). */
export function useCampaignPreviewDoc(html: string, previewText: string | null) {
  return useMemo(
    () =>
      wrapEmailPreviewHtml(
        applyMergeTags(html, SAMPLE_MERGE_CONTEXT),
        applyMergeTags(previewText ?? "", SAMPLE_MERGE_CONTEXT)
      ),
    [html, previewText]
  );
}

const FRAME_WIDTH = 640;
const THUMB_WIDTH = 96;
const SCALE = THUMB_WIDTH / FRAME_WIDTH;

/** Miniatura do topo do e-mail (iframe reduzido, sem interação). */
export function CampaignThumbnail({
  html,
  previewText,
  className,
}: {
  html: string;
  previewText: string | null;
  className?: string;
}) {
  const doc = useCampaignPreviewDoc(html, previewText);
  return (
    <div
      className={cn("relative h-[120px] w-[96px] shrink-0 overflow-hidden rounded-md border border-[#dce9eb] bg-[#f4f5f7]", className)}
      aria-hidden
    >
      <iframe
        title="Miniatura do e-mail"
        srcDoc={doc}
        tabIndex={-1}
        loading="lazy"
        sandbox=""
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{ width: FRAME_WIDTH, height: 120 / SCALE, transform: `scale(${SCALE})` }}
      />
    </div>
  );
}
