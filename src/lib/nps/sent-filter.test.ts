import { describe, expect, it } from "vitest";
import {
  groupHasNpsSent,
  groupMatchesNpsSentFilter,
  parseNpsSentFilterParam,
} from "@/lib/nps/sent-filter";

describe("nps sent filter", () => {
  it("parseia o parâmetro da URL", () => {
    expect(parseNpsSentFilterParam("sent")).toBe("sent");
    expect(parseNpsSentFilterParam("not_sent")).toBe("not_sent");
    expect(parseNpsSentFilterParam("all")).toBe("all");
    expect(parseNpsSentFilterParam(null)).toBe("all");
  });

  it("identifica grupo com NPS enviado", () => {
    expect(groupHasNpsSent("g1", { g1: { sentAt: "2026-09-01" } })).toBe(true);
    expect(groupHasNpsSent("g1", {})).toBe(false);
    expect(groupHasNpsSent(null, { g1: {} })).toBe(false);
  });

  it("filtra enviado e não enviado", () => {
    expect(groupMatchesNpsSentFilter(true, "all")).toBe(true);
    expect(groupMatchesNpsSentFilter(false, "all")).toBe(true);
    expect(groupMatchesNpsSentFilter(true, "sent")).toBe(true);
    expect(groupMatchesNpsSentFilter(false, "sent")).toBe(false);
    expect(groupMatchesNpsSentFilter(true, "not_sent")).toBe(false);
    expect(groupMatchesNpsSentFilter(false, "not_sent")).toBe(true);
  });
});
