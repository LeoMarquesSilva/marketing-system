import type { PartyInviteTipo } from "@/lib/party-invite-types";

export type InviteFilter =
  | "all"
  | "party"
  | "nps"
  | "both"
  | "none"
  | "not_party"
  | "not_nps"
  /** Gestores: NPS sim ou ainda não classificado — exclui só quem marcou NPS não. */
  | "gestor_default";

export type InviteFilterMember = {
  npsEligible: boolean;
  partyInvite: boolean;
  partyInviteTipo?: PartyInviteTipo | null;
  invitesClassifiedByUserId?: string | null;
};

export const GESTOR_DEFAULT_INVITE_FILTER: InviteFilter = "gestor_default";

export function isExplicitNpsNo(
  member: Pick<InviteFilterMember, "npsEligible" | "invitesClassifiedByUserId">
): boolean {
  return Boolean(member.invitesClassifiedByUserId) && !member.npsEligible;
}

export function memberMatchesInviteFilter(
  member: InviteFilterMember,
  inviteFilter: InviteFilter,
  partyTipoFilter: PartyInviteTipo | "all" = "all"
): boolean {
  if (partyTipoFilter !== "all" && member.partyInviteTipo !== partyTipoFilter) return false;
  if (inviteFilter === "party") return member.partyInvite;
  if (inviteFilter === "nps") return member.npsEligible;
  if (inviteFilter === "both") return member.partyInvite && member.npsEligible;
  if (inviteFilter === "none") return !member.partyInvite && !member.npsEligible;
  if (inviteFilter === "not_party") return !member.partyInvite;
  if (inviteFilter === "not_nps") return !member.npsEligible;
  if (inviteFilter === "gestor_default") {
    return member.npsEligible || !member.invitesClassifiedByUserId;
  }
  return true;
}

export function groupMatchesInviteFilter(
  members: InviteFilterMember[],
  inviteFilter: InviteFilter,
  partyTipoFilter: PartyInviteTipo | "all" = "all"
): boolean {
  if (inviteFilter === "all" && partyTipoFilter === "all") return true;
  if (members.length === 0) return inviteFilter === "gestor_default";
  return members.some((member) => memberMatchesInviteFilter(member, inviteFilter, partyTipoFilter));
}

export function parseInviteFilterParam(value: string | null): InviteFilter {
  if (
    value === "party" ||
    value === "nps" ||
    value === "both" ||
    value === "none" ||
    value === "not_party" ||
    value === "not_nps" ||
    value === "gestor_default"
  ) {
    return value;
  }
  return "all";
}

export function resolveGestorInviteFilter(isAdmin: boolean, filterInvite: InviteFilter): InviteFilter {
  return isAdmin ? filterInvite : GESTOR_DEFAULT_INVITE_FILTER;
}
