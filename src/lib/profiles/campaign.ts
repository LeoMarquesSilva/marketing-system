/**
 * Campanha institucional exibida como faixa temporária no topo do perfil.
 *
 * O interruptor manual é soberano: desligado, nenhuma janela de data reativa a
 * campanha. Ligado, limites ausentes significam janela aberta daquele lado.
 */

import { localizeField } from "@/lib/profiles/localization";
import type { ProfileCampaign, ProfileLocale } from "@/lib/profiles/types";

/** Converte para Date apenas quando a string é uma data real. */
function parseBoundary(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isProfileCampaignActive(
  campaign: ProfileCampaign | null | undefined,
  now: Date
): boolean {
  if (!campaign || !campaign.enabled) return false;

  const startsAt = parseBoundary(campaign.startsAt);
  if (startsAt && now.getTime() < startsAt.getTime()) return false;

  const endsAt = parseBoundary(campaign.endsAt);
  if (endsAt && now.getTime() > endsAt.getTime()) return false;

  return true;
}

/** Mensagem da campanha no idioma pedido, ou null quando inativa. */
export function resolveCampaignMessage(
  campaign: ProfileCampaign | null | undefined,
  locale: ProfileLocale,
  now: Date
): string | null {
  if (!campaign || !isProfileCampaignActive(campaign, now)) return null;
  const message = localizeField(
    { "pt-BR": campaign.messagePt, en: campaign.messageEn },
    locale
  );
  return message || null;
}

/** Título da campanha no idioma pedido, ou null quando inativa. */
export function resolveCampaignTitle(
  campaign: ProfileCampaign | null | undefined,
  locale: ProfileLocale,
  now: Date
): string | null {
  if (!campaign || !isProfileCampaignActive(campaign, now)) return null;
  const title = localizeField({ "pt-BR": campaign.titlePt, en: campaign.titleEn }, locale);
  return title || null;
}
