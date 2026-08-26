import { describe, expect, it } from "vitest";
import { pickDefaultCafeEdition } from "./cafe-admin-client";
import type { CafeAdminEdition } from "@/lib/cafe-cultura/types";

function edition(id: string, eventDate: string): CafeAdminEdition {
  return {
    id,
    name: `Café ${id}`,
    eventDate,
    location: null,
    attendanceCutoffAt: null,
    checkinOpensAt: `${eventDate}T12:00:00.000Z`,
    checkinClosesAt: `${eventDate}T15:00:00.000Z`,
    summary: { total: 50, expected: 48, excused: 2, excluded: 0, present: 0, pending: 48 },
  };
}

describe("pickDefaultCafeEdition", () => {
  it("abre a edição futura mais próxima", () => {
    expect(
      pickDefaultCafeEdition(
        [edition("setembro", "2026-09-25"), edition("agosto", "2026-08-28"), edition("julho", "2026-07-31")],
        "2026-08-26"
      )?.id
    ).toBe("agosto");
  });

  it("cai na edição mais recente quando todas já passaram", () => {
    expect(
      pickDefaultCafeEdition(
        [edition("agosto", "2026-08-28"), edition("julho", "2026-07-31")],
        "2026-10-01"
      )?.id
    ).toBe("agosto");
  });
});
