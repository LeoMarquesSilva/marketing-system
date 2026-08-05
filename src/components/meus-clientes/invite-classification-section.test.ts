import { describe, expect, it } from "vitest";
import {
  isInviteClassificationComplete,
} from "@/components/meus-clientes/invite-classification-section";

describe("invite classification completeness", () => {
  it("exige critério da festa quando a edição está liberada", () => {
    expect(
      isInviteClassificationComplete({
        classification: "invites",
        partyInvite: true,
        partyInviteTipo: null,
        partyInviteEditable: true,
      })
    ).toBe(false);
  });

  it("não exige critério da festa quando a edição está bloqueada (gestor)", () => {
    expect(
      isInviteClassificationComplete({
        classification: "invites",
        partyInvite: true,
        partyInviteTipo: null,
        partyInviteEditable: false,
      })
    ).toBe(true);
  });

  it("mantém pending incompleto mesmo com festa bloqueada", () => {
    expect(
      isInviteClassificationComplete({
        classification: "pending",
        partyInvite: false,
        partyInviteTipo: null,
        partyInviteEditable: false,
      })
    ).toBe(false);
  });
});
