import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENAI_KEY_ENV, openAIKey } from "./openai-keys";

afterEach(() => vi.unstubAllEnvs());

function clearKeys() {
  for (const name of [...Object.values(OPENAI_KEY_ENV), "NEXT_OPENAI_API_KEY", "OPENAI_API_KEY"]) {
    vi.stubEnv(name, "");
  }
}

describe("chave da OpenAI por categoria", () => {
  it("usa a chave da categoria quando existe", () => {
    clearKeys();
    vi.stubEnv("NEXT_OPENAI_API_KEY", "geral");
    vi.stubEnv("OPENAI_API_KEY_ATENDIMENTO", " atendimento ");
    expect(openAIKey("atendimento")).toBe("atendimento");
    expect(openAIKey("conteudo")).toBe("geral");
  });

  it("cai na chave geral e depois na OPENAI_API_KEY", () => {
    clearKeys();
    vi.stubEnv("OPENAI_API_KEY", "padrao");
    expect(openAIKey("facilities")).toBe("padrao");
    vi.stubEnv("NEXT_OPENAI_API_KEY", "geral");
    expect(openAIKey("facilities")).toBe("geral");
  });

  it("devolve null sem nenhuma chave", () => {
    clearKeys();
    expect(openAIKey("pessoas")).toBeNull();
  });
});
