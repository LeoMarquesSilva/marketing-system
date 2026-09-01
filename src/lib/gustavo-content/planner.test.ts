import { describe, expect, it } from "vitest";
import {
  buildLinkedInPlannerPayload,
  buildReelPlannerPayload,
  plannerChannelAlreadyCreated,
} from "@/lib/gustavo-content/planner";

const ITEM = {
  id: "item-1",
  title: "GPA e a dívida que não cabe no caixa",
  link: "https://valor.com/gpa",
  thesis_snapshot: "O processo não cria viabilidade",
  linkedin_post: "A empresa perdeu capacidade de refinanciar.",
  reel_script: JSON.stringify({
    duration: "60s",
    hook: "Caixa some antes do processo começar.",
    talkingPoints: ["A dívida cresceu mais rápido que a geração."],
    closing: "O processo compra tempo. Não compra viabilidade.",
    recordingNote: "Tom executivo, sem juridiquês.",
  }),
  marketing_request_linkedin_id: null as string | null,
  marketing_request_reel_id: null as string | null,
};

describe("planner payloads", () => {
  it("monta a tarefa de LinkedIn com pauta, fonte, tese e post", () => {
    const payload = buildLinkedInPlannerPayload(ITEM);
    expect(payload.requestType).toBe("Post Redes Sociais");
    expect(payload.title).toContain("LinkedIn");
    expect(payload.description).toContain("PAUTA");
    expect(payload.description).toContain("LINK DA FONTE");
    expect(payload.description).toContain("TESE");
    expect(payload.description).toContain("POST FINAL");
    expect(payload.description).toContain(ITEM.linkedin_post);
  });

  it("monta a tarefa de Reel com gancho, fala e fecho", () => {
    const payload = buildReelPlannerPayload(ITEM);
    expect(payload.requestType).toBe("Reel Redes Sociais");
    expect(payload.description).toContain("GANCHO");
    expect(payload.description).toContain("PONTOS DE FALA");
    expect(payload.description).toContain("FECHO");
  });

  it("bloqueia segundo clique no mesmo canal", () => {
    expect(
      plannerChannelAlreadyCreated(
        { ...ITEM, marketing_request_linkedin_id: "req-1" },
        "linkedin"
      )
    ).toBe(true);
    expect(plannerChannelAlreadyCreated(ITEM, "linkedin")).toBe(false);
    expect(
      plannerChannelAlreadyCreated(
        { ...ITEM, marketing_request_reel_id: "req-2" },
        "reel"
      )
    ).toBe(true);
  });
});
