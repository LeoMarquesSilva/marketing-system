/** Metadados Click-to-WhatsApp (Meta Ads) extraídos do contextInfo da mensagem. */

export interface MetaWhatsappAttribution {
  sourceId: string | null;
  sourceUrl: string | null;
  title: string | null;
  body: string | null;
  sourceType: string | null;
  ctwaClid: string | null;
  conversionApp: string | null;
  conversionSource: string | null;
}

function readContextInfo(
  message: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!message) return null;
  const extended = message.extendedTextMessage as
    | { contextInfo?: Record<string, unknown> }
    | undefined;
  if (extended?.contextInfo) return extended.contextInfo;
  const template = message.templateMessage as
    | {
        hydratedTemplate?: { contextInfo?: Record<string, unknown> };
        hydratedFourRowTemplate?: { contextInfo?: Record<string, unknown> };
      }
    | undefined;
  const hydrated =
    template?.hydratedTemplate ?? template?.hydratedFourRowTemplate;
  return hydrated?.contextInfo ?? null;
}

export function extractMetaWhatsappAttribution(
  message: Record<string, unknown> | undefined
): MetaWhatsappAttribution | null {
  const contextInfo = readContextInfo(message);
  if (!contextInfo) return null;

  const externalAdReply = contextInfo.externalAdReply as
    | Record<string, unknown>
    | undefined;

  const attribution: MetaWhatsappAttribution = {
    sourceId:
      (externalAdReply?.sourceId as string | undefined)?.trim() ||
      (externalAdReply?.sourceID as string | undefined)?.trim() ||
      null,
    sourceUrl: (externalAdReply?.sourceUrl as string | undefined)?.trim() || null,
    title: (externalAdReply?.title as string | undefined)?.trim() || null,
    body: (externalAdReply?.body as string | undefined)?.trim() || null,
    sourceType:
      (externalAdReply?.sourceType as string | undefined)?.trim() || null,
    ctwaClid:
      (externalAdReply?.ctwaClid as string | undefined)?.trim() ||
      (contextInfo.ctwaClid as string | undefined)?.trim() ||
      null,
    conversionApp:
      (contextInfo.entryPointConversionApp as string | undefined)?.trim() ||
      (externalAdReply?.sourceApp as string | undefined)?.trim() ||
      null,
    conversionSource:
      (contextInfo.conversionSource as string | undefined)?.trim() ||
      (contextInfo.entryPointConversionSource as string | undefined)?.trim() ||
      null,
  };

  return Object.values(attribution).some(Boolean) ? attribution : null;
}

export function isMetaAdLeadFromAttribution(
  attribution: MetaWhatsappAttribution | null
): boolean {
  if (!attribution) return false;
  if (attribution.sourceId || attribution.ctwaClid) return true;
  const src = (attribution.conversionSource ?? "").toLowerCase();
  if (src.includes("fb_ads") || src.includes("ctwa")) return true;
  const app = (attribution.conversionApp ?? "").toLowerCase();
  return app === "instagram" || app === "facebook";
}

export function formatMetaConversionApp(app: string | null): string | null {
  if (!app) return null;
  const lower = app.toLowerCase();
  if (lower === "instagram") return "Instagram";
  if (lower === "facebook") return "Facebook";
  return app;
}
