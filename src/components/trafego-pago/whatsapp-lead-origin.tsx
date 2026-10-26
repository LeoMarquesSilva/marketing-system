import { Briefcase, Globe, Megaphone, MessageCircle, Users, type LucideIcon } from "lucide-react";
import type { WhatsappConversation } from "./whatsapp-crm-types";
import { leadOrigin, type LeadOrigin } from "./whatsapp-crm-utils";

const ORIGIN_META: Record<LeadOrigin, { icon: LucideIcon; label: string }> = {
  meta_ads: { icon: Megaphone, label: "Anúncio Meta" },
  trafego_pago: { icon: Megaphone, label: "Tráfego pago" },
  site: { icon: Globe, label: "Site" },
  grupo: { icon: Users, label: "Grupo" },
  colaborador: { icon: Briefcase, label: "Colaborador" },
  outros: { icon: MessageCircle, label: "WhatsApp" },
};

export function leadOriginMeta(conversation: WhatsappConversation) {
  const origin = leadOrigin(conversation).origin;
  return { origin, ...ORIGIN_META[origin] };
}
