import { describe, expect, it } from "vitest";
import { isOpenAIReasoningModel, openAIGenerationOptions } from "./openai-models";

describe("modelos da OpenAI", () => {
  it("reconhece os modelos de raciocinio, inclusive a familia GPT-6", () => {
    for (const model of ["gpt-6-luna", "gpt-6.1-sol", "gpt-5.6-sol", "gpt-5.6-terra", "o3", "o4-mini"]) {
      expect(isOpenAIReasoningModel(model)).toBe(true);
    }
    for (const model of ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "gpt-5-chat-latest"]) {
      expect(isOpenAIReasoningModel(model)).toBe(false);
    }
  });

  it("envia esforco de raciocinio sem temperature para modelos de raciocinio", () => {
    expect(openAIGenerationOptions("gpt-6-luna", { reasoningEffort: "none", temperature: 0.4 })).toEqual({
      providerOptions: { openai: { reasoningEffort: "none" } },
    });
  });

  it("mantem temperature para modelos sem raciocinio", () => {
    expect(openAIGenerationOptions("gpt-4.1-mini", { reasoningEffort: "low", temperature: 0.4 })).toEqual({
      temperature: 0.4,
    });
  });
});
