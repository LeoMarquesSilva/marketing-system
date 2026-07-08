export const PARTY_INVITE_TYPES = [
  {
    id: "estrategico",
    label: "Estratégico",
    description:
      "Cliente de elevada relevância para os objetivos do escritório, considerando faturamento, complexidade, potencial de crescimento ou impacto estratégico.",
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    description:
      "Cliente convidado para fortalecer ou manter o relacionamento institucional e a proximidade com o escritório.",
  },
  {
    id: "potencial",
    label: "Potencial",
    description:
      "Cliente com oportunidade de expansão da parceria ou prospecção de novos negócios.",
  },
  {
    id: "historico",
    label: "Histórico",
    description:
      "Cliente de longa data, reconhecido pela contribuição para a trajetória e desenvolvimento do escritório.",
  },
  {
    id: "institucional",
    label: "Institucional",
    description:
      "Cliente cuja presença agrega valor ao evento em razão de sua representatividade no mercado, segmento ou influência institucional.",
  },
] as const;

export type PartyInviteTipo = (typeof PARTY_INVITE_TYPES)[number]["id"];

const PARTY_INVITE_TYPE_IDS = new Set<string>(PARTY_INVITE_TYPES.map((t) => t.id));

export function parsePartyInviteTipo(value: unknown): PartyInviteTipo | null {
  if (typeof value === "string" && PARTY_INVITE_TYPE_IDS.has(value)) {
    return value as PartyInviteTipo;
  }
  return null;
}

export function getPartyInviteTipoLabel(tipo: PartyInviteTipo | null | undefined): string | null {
  if (!tipo) return null;
  return PARTY_INVITE_TYPES.find((t) => t.id === tipo)?.label ?? null;
}

export function getPartyInviteTipoDescription(tipo: PartyInviteTipo | null | undefined): string | null {
  if (!tipo) return null;
  return PARTY_INVITE_TYPES.find((t) => t.id === tipo)?.description ?? null;
}
