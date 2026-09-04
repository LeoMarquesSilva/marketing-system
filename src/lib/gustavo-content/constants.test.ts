import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  for (const name of ["GUSTAVO_CONTENT_MODEL", "GUSTAVO_CONTENT_MODEL_WRITING", "GUSTAVO_CONTENT_MODEL_SCORE", "GUSTAVO_CONTENT_MODEL_REVIEW"]) {
    vi.stubEnv(name, undefined);
  }
});
afterEach(() => vi.unstubAllEnvs());

describe("modelos por etapa", () => {
  it("prioriza Sol na escrita sem encarecer as etapas auxiliares", async () => {
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-5.6-sol");
    expect(models.GUSTAVO_CONTENT_MODEL_SCORE).toBe("gpt-4.1-mini");
    expect(models.GUSTAVO_CONTENT_MODEL_REVIEW).toBe("gpt-4.1-mini");
  });

  it("preserva a configuracao compartilhada explicita", async () => {
    vi.stubEnv("GUSTAVO_CONTENT_MODEL", "gpt-4.1");
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-4.1");
  });

  it("a configuracao da escrita prevalece sobre a compartilhada", async () => {
    vi.stubEnv("GUSTAVO_CONTENT_MODEL", "gpt-4.1");
    vi.stubEnv("GUSTAVO_CONTENT_MODEL_WRITING", "gpt-5.6-terra");
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-5.6-terra");
    expect(models.GUSTAVO_CONTENT_MODEL_REVIEW).toBe("gpt-4.1");
  });
});
