import type { CafeExpectationSource } from "./types";

export interface CafeRosterParticipant {
  participantId: string;
  userId: string;
  expectationSource: CafeExpectationSource;
  checkinAt: string | null;
}

export function isCafeRosterEligible(input: {
  userActive: boolean;
  hasActiveEmployee: boolean;
}): boolean {
  return input.userActive && input.hasActiveEmployee;
}

export function planCafeRosterSync(
  officialUserIds: string[],
  existingParticipants: CafeRosterParticipant[]
): { missingUserIds: string[]; removableParticipantIds: string[] } {
  const officialIds = new Set(officialUserIds);
  const existingUserIds = new Set(existingParticipants.map((participant) => participant.userId));

  return {
    missingUserIds: officialUserIds.filter((userId) => !existingUserIds.has(userId)),
    removableParticipantIds: existingParticipants
      .filter(
        (participant) =>
          !officialIds.has(participant.userId) &&
          participant.expectationSource === "automatic_roster" &&
          participant.checkinAt === null
      )
      .map((participant) => participant.participantId),
  };
}
