"use client";

import { ExternalLink, Megaphone } from "lucide-react";
import { formatMetaConversionApp } from "@/lib/evolution-meta-attribution";

interface WhatsappMetaLeadCardProps {
  meta_ad_title?: string | null;
  meta_ad_body?: string | null;
  meta_campaign_name?: string | null;
  meta_adset_name?: string | null;
  meta_ad_source_url?: string | null;
  meta_conversion_app?: string | null;
  meta_ad_id?: string | null;
}

export function WhatsappMetaLeadCard({
  meta_ad_title,
  meta_ad_body,
  meta_campaign_name,
  meta_adset_name,
  meta_ad_source_url,
  meta_conversion_app,
  meta_ad_id,
}: WhatsappMetaLeadCardProps) {
  const appLabel = formatMetaConversionApp(meta_conversion_app ?? null);
  const hasContent =
    meta_ad_title ||
    meta_ad_body ||
    meta_campaign_name ||
    meta_adset_name ||
    appLabel ||
    meta_ad_source_url;

  if (!hasContent) return null;

  return (
    <div className="rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-950/10 dark:border-blue-900/40 p-4 space-y-3 text-xs shadow-sm">
      <div className="flex items-center gap-2 border-b border-blue-200/50 dark:border-blue-900/50 pb-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/50">
          <Megaphone className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
        </div>
        <p className="font-semibold text-blue-900 dark:text-blue-100">
          Origem Meta Ads
        </p>
      </div>
      {meta_campaign_name && (
        <p>
          <span className="text-muted-foreground">Campanha:</span>{" "}
          <span className="font-medium">{meta_campaign_name}</span>
        </p>
      )}
      {meta_adset_name && (
        <p>
          <span className="text-muted-foreground">Conjunto:</span>{" "}
          <span className="font-medium">{meta_adset_name}</span>
        </p>
      )}
      {meta_ad_title && (
        <p>
          <span className="text-muted-foreground">Anúncio:</span>{" "}
          <span className="font-medium">{meta_ad_title}</span>
        </p>
      )}
      {appLabel && (
        <p>
          <span className="text-muted-foreground">App:</span>{" "}
          <span className="font-medium">{appLabel}</span>
        </p>
      )}
      {meta_ad_body && (
        <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {meta_ad_body}
        </p>
      )}
      {meta_ad_source_url && (
        <a
          href={meta_ad_source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 rounded bg-blue-100 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors mt-1"
        >
          Ver anúncio
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {meta_ad_id && !meta_campaign_name && (
        <p className="text-[10px] text-muted-foreground">ID anúncio: {meta_ad_id}</p>
      )}
    </div>
  );
}
