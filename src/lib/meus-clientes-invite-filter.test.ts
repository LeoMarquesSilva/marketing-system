import { describe, expect, it } from "vitest";
import {
  groupMatchesInviteFilter,
  isExplicitNpsNo,
  memberMatchesInviteFilter,
} from "@/lib/meus-clientes-invite-filter";

describe("meus-clientes-invite-filter", () => {
  it("identifica NPS explicitamente marcado como não", () => {
    expect(
      isExplicitNpsNo({ npsEligible: false, invitesClassifiedByUserId: "user-1" })
    ).toBe(true);
    expect(
      isExplicitNpsNo({ npsEligible: true, invitesClassifiedByUserId: "user-1" })
    ).toBe(false);
    expect(
      isExplicitNpsNo({ npsEligible: false, invitesClassifiedByUserId: null })
    ).toBe(false);
  });

  it("nps_unclassified pega só quem ainda não classificou", () => {
    expect(
      memberMatchesInviteFilter(
        { npsEligible: false, partyInvite: false, invitesClassifiedByUserId: null },
        "nps_unclassified"
      )
    ).toBe(true);
    expect(
      memberMatchesInviteFilter(
        { npsEligible: false, partyInvite: false, invitesClassifiedByUserId: "u1" },
        "nps_unclassified"
      )
    ).toBe(false);
  });

  it("gestor_default inclui NPS sim e pendente, exclui NPS não", () => {
    expect(
      memberMatchesInviteFilter(
        { npsEligible: true, partyInvite: false, invitesClassifiedByUserId: "u1" },
        "gestor_default"
      )
    ).toBe(true);
    expect(
      memberMatchesInviteFilter(
        { npsEligible: false, partyInvite: false, invitesClassifiedByUserId: null },
        "gestor_default"
      )
    ).toBe(true);
    expect(
      memberMatchesInviteFilter(
        { npsEligible: false, partyInvite: false, invitesClassifiedByUserId: "u1" },
        "gestor_default"
      )
    ).toBe(false);
  });

  it("gestor_default mantém grupos vazios visíveis", () => {
    expect(groupMatchesInviteFilter([], "gestor_default")).toBe(true);
    expect(groupMatchesInviteFilter([], "nps")).toBe(false);
  });
});
