import { describe, expect, it } from "vitest";
import {
  approvalStatusFor,
  canParticipantDecide,
  contentTypeForFile,
  isDeliveryStoragePath,
  missingForReady,
  reelDecisionSchema,
} from "./domain";

const ID = "6f1d3c2a-1b2c-4d5e-8f90-123456789abc";

describe("approvalStatusFor", () => {
  it("espera todas as pessoas aprovarem", () => {
    expect(approvalStatusFor(["a", "b"], [{ userId: "a", decision: "approved" }], true)).toBe("awaiting_approval");
    expect(
      approvalStatusFor(["a", "b"], [{ userId: "a", decision: "approved" }, { userId: "b", decision: "approved" }], true)
    ).toBe("approved");
  });

  it("um pedido de ajuste segura o reel mesmo com aprovações", () => {
    expect(
      approvalStatusFor(["a", "b"], [{ userId: "a", decision: "approved" }, { userId: "b", decision: "changes_requested" }], true)
    ).toBe("changes_requested");
  });

  it("ignora decisões de quem não está mais no vídeo", () => {
    expect(approvalStatusFor(["a"], [{ userId: "x", decision: "changes_requested" }, { userId: "a", decision: "approved" }], true)).toBe("approved");
  });

  it("sem vídeo ainda não há o que aprovar", () => {
    expect(approvalStatusFor(["a"], [{ userId: "a", decision: "approved" }], false)).toBe("awaiting_approval");
  });
});

describe("canParticipantDecide", () => {
  it("fecha a decisão quando o reel segue para publicação", () => {
    expect(canParticipantDecide("awaiting_approval")).toBe(true);
    expect(canParticipantDecide("approved")).toBe(true);
    expect(canParticipantDecide("ready")).toBe(false);
    expect(canParticipantDecide("published")).toBe(false);
  });
});

describe("missingForReady", () => {
  it("lista o que falta para marcar pronto", () => {
    expect(missingForReady({ status: "awaiting_approval", caption: " ", coverPath: null })).toEqual([
      "aprovação de todas as pessoas",
      "capa",
      "legenda",
    ]);
    expect(missingForReady({ status: "approved", caption: "Legenda", coverPath: "deliveries/x/capa.jpg" })).toEqual([]);
  });
});

describe("isDeliveryStoragePath", () => {
  it("aceita só arquivos dentro da pasta da própria entrega", () => {
    expect(isDeliveryStoragePath(`deliveries/${ID}/video-1-reel.mp4`, ID)).toBe(true);
    expect(isDeliveryStoragePath(`deliveries/outro/video.mp4`, ID)).toBe(false);
    expect(isDeliveryStoragePath(`deliveries/${ID}/../x.mp4`, ID)).toBe(false);
    expect(isDeliveryStoragePath(`deliveries/${ID}/sub/x.mp4`, ID)).toBe(false);
    expect(isDeliveryStoragePath(`tags/${ID}/x.mp4`, ID)).toBe(false);
  });
});

describe("contentTypeForFile", () => {
  it("deduz o tipo pela extensão quando o navegador não informa", () => {
    expect(contentTypeForFile("Reel.MOV", "", "video")).toBe("video/quicktime");
    expect(contentTypeForFile("capa.jpeg", undefined, "cover")).toBe("image/jpeg");
    expect(contentTypeForFile("capa.gif", "image/gif", "cover")).toBeNull();
  });
});

describe("reelDecisionSchema", () => {
  it("exige comentário para pedir ajuste", () => {
    const base = { version_id: ID, decision: "changes_requested" as const };
    expect(reelDecisionSchema.safeParse(base).success).toBe(false);
    expect(reelDecisionSchema.safeParse({ ...base, comment: "Cortar o começo" }).success).toBe(true);
    expect(reelDecisionSchema.safeParse({ version_id: ID, decision: "approved" }).success).toBe(true);
  });
});
