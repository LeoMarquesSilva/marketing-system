import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  for (const name of ["GUSTAVO_CONTENT_MODEL", "GUSTAVO_CONTENT_MODEL_WRITING", "GUSTAVO_CONTENT_MODEL_WRITING_FALLBACK", "GUSTAVO_CONTENT_MODEL_SCORE", "GUSTAVO_CONTENT_MODEL_REVIEW"]) {
    vi.stubEnv(name, undefined);
  }
});
afterEach(() => vi.unstubAllEnvs());

describe("modelos por etapa", () => {
  it("prioriza Sol na escrita sem encarecer as etapas auxiliares", async () => {
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-5.6-sol");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING_FALLBACK).toBe("gpt-6-luna");
    expect(models.GUSTAVO_CONTENT_MODEL_SCORE).toBe("gpt-6-luna");
    expect(models.GUSTAVO_CONTENT_MODEL_REVIEW).toBe("gpt-6-luna");
    expect(models.GUSTAVO_CONTENT_WRITING_TIMEOUT_MS).toBe(120_000);
    expect(models.GUSTAVO_CONTENT_WRITING_FALLBACK_TIMEOUT_MS).toBe(90_000);
    expect(models.GUSTAVO_CONTENT_GENERATION_TIMEOUT_MS).toBe(270_000);
  });

  it("preserva a configuracao compartilhada explicita", async () => {
    vi.stubEnv("GUSTAVO_CONTENT_MODEL", "gpt-6.1-sol");
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-6.1-sol");
  });

  it("a configuracao da escrita prevalece sobre a compartilhada", async () => {
    vi.stubEnv("GUSTAVO_CONTENT_MODEL", "gpt-6.1-sol");
    vi.stubEnv("GUSTAVO_CONTENT_MODEL_WRITING", "gpt-5.6-terra");
    const models = await import("./constants");
    expect(models.GUSTAVO_CONTENT_MODEL_WRITING).toBe("gpt-5.6-terra");
    expect(models.GUSTAVO_CONTENT_MODEL_REVIEW).toBe("gpt-6.1-sol");
  });
});
