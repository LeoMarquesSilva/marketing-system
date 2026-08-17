import { describe, expect, it } from "vitest";
import { isQualificationPending } from "@/lib/qualification-requirement";

describe("isQualificationPending", () => {
  it("não bloqueia quem nunca recebeu uma solicitação", () => {
    expect(
      isQualificationPending({
        qualification_required_at: null,
        qualification_completed_at: null,
      })
    ).toBe(false);
  });

  it("bloqueia quando existe solicitação ainda não concluída", () => {
    expect(
      isQualificationPending({
        qualification_required_at: "2026-08-17T12:00:00.000Z",
        qualification_completed_at: null,
      })
    ).toBe(true);
  });

  it("libera quando a conclusão é posterior à solicitação", () => {
    expect(
      isQualificationPending({
        qualification_required_at: "2026-08-17T12:00:00.000Z",
        qualification_completed_at: "2026-08-17T12:05:00.000Z",
      })
    ).toBe(false);
  });

  it("volta a bloquear quando há uma nova solicitação", () => {
    expect(
      isQualificationPending({
        qualification_required_at: "2026-08-17T13:00:00.000Z",
        qualification_completed_at: "2026-08-17T12:05:00.000Z",
      })
    ).toBe(true);
  });
});
