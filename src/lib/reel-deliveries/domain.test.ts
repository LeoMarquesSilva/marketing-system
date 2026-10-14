import { describe, expect, it } from "vitest";
import {
  addBusinessDaysYmd,
  buildCoverRequestDescription,
  coverRequestNoteFrom,
  isOpenChangeRequest,
  resolveReelChangesSchema,
  reelPersonRole,
  approvalStatusFor,
  canParticipantDecide,
  contentTypeForFile,
  isDeliveryStoragePath,
  missingForReady,
  reelCreditLine,
  reelCreditName,
  reelDecisionSchema,
  stripDashes,
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

  it("ajuste marcado como feito pelo Marketing conta como aprovação", () => {
    expect(
      approvalStatusFor(["a", "b"], [{ userId: "a", decision: "approved" }, { userId: "b", decision: "changes_requested", resolved: true }], true)
    ).toBe("approved");
    expect(
      approvalStatusFor(["a", "b"], [{ userId: "a", decision: "changes_requested", resolved: true }, { userId: "b", decision: "changes_requested" }], true)
    ).toBe("changes_requested");
    expect(isOpenChangeRequest({ decision: "changes_requested", resolved: true })).toBe(false);
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

describe("crédito da legenda", () => {
  it("usa Dr./Dra. só para advogados com gênero cadastrado", () => {
    expect(reelCreditName({ name: "Maria Caroline da Cunha Thomé", gender: "F", position: "Advogado Pleno", oab: null })).toBe("Dra. Maria Thomé");
    expect(reelCreditName({ name: "Caio Augusto Silva", gender: "M", position: "Coordenador", oab: "123456" })).toBe("Dr. Caio Silva");
    expect(reelCreditName({ name: "Ana Souza", gender: null, position: "Advogado Júnior", oab: null })).toBe("Ana Souza");
    expect(reelCreditName({ name: "Pedro Lima", gender: "M", position: "Estagiário", oab: null })).toBe("Pedro Lima");
  });

  it("monta a linha com várias pessoas e a área", () => {
    expect(reelCreditLine([
      { name: "Ana Souza", gender: "F", position: "Sócio de Área", oab: null },
      { name: "João Reis", gender: "M", position: "Advogado", oab: null },
    ], "Trabalhista")).toBe("Por: Dra. Ana Souza e Dr. João Reis | BP - Trabalhista");
  });
});

describe("stripDashes", () => {
  it("troca travessões e mantém hífens de palavras", () => {
    expect(stripDashes("Risco — e prazo – curto; bem-estar")).toBe("Risco, e prazo, curto; bem-estar");
  });
});

describe("addBusinessDaysYmd", () => {
  it("pula fim de semana no SLA da capa", () => {
    expect(addBusinessDaysYmd("2026-10-05", 2)).toBe("2026-10-07"); // segunda -> quarta
    expect(addBusinessDaysYmd("2026-10-08", 2)).toBe("2026-10-12"); // quinta -> segunda
    expect(addBusinessDaysYmd("2026-10-10", 2)).toBe("2026-10-13"); // sábado -> terça
  });
});

describe("cargo na tarefa de capa", () => {
  it("usa o gênero do RH, tira o nível e fala da área", () => {
    expect(reelPersonRole({ name: "A", gender: "F", position: "Advogado Pleno", area: "Reestruturação" }, "Cível")).toBe("Advogada da área de Reestruturação");
    expect(reelPersonRole({ name: "B", gender: "M", position: "Coordenador", area: "Operações Legais" }, "Cível")).toBe("Coordenador da área de Operações Legais");
    expect(reelPersonRole({ name: "C", gender: "F", position: "Sócio de Área", area: null }, "Trabalhista")).toBe("Sócia da área de Trabalhista");
    expect(reelPersonRole({ name: "D", gender: null, position: "Advogado Júnior", area: "Cível" }, "Cível")).toBe("Advogado da área de Cível");
  });

  it("não mostra data prevista e lista nome completo com cargo", () => {
    const text = buildCoverRequestDescription({
      coverTitle: "TÍTULO",
      coverSubtitle: "Sub",
      area: "Reestruturação",
      people: [{ name: "Gabriela Bossi Leme", gender: "F", position: "Advogado Pleno", area: "Reestruturação" }],
    });
    expect(text).toContain("Quem aparece no vídeo: Gabriela Bossi Leme, Advogada da área de Reestruturação");
    expect(text).not.toMatch(/Publicação prevista/);
  });
});

describe("recado para a designer", () => {
  const base = {
    coverTitle: "TÍTULO",
    coverSubtitle: "Sub",
    area: "Cível",
    people: [{ name: "Raíssa Alni Minari", gender: "F", position: "Advogada", area: "Cível" }],
  };

  it("vai na descrição da tarefa e volta para o reel", () => {
    const text = buildCoverRequestDescription({ ...base, note: "Usar a foto de perfil nova.\nFundo escuro." });
    expect(text).toContain("Recado do Marketing:\nUsar a foto de perfil nova.\nFundo escuro.");
    expect(text.trimEnd().endsWith("capa do reel em Aprovação de Reels.")).toBe(true);
    expect(coverRequestNoteFrom(text)).toBe("Usar a foto de perfil nova.\nFundo escuro.");
  });

  it("sem recado, a descrição fica como antes", () => {
    const text = buildCoverRequestDescription({ ...base, note: "   " });
    expect(text).not.toContain("Recado do Marketing");
    expect(coverRequestNoteFrom(text)).toBeNull();
  });
});

describe("resolveReelChangesSchema", () => {
  it("aceita resolver todos os pedidos ou só de algumas pessoas", () => {
    expect(resolveReelChangesSchema.safeParse({ version_id: ID }).success).toBe(true);
    expect(resolveReelChangesSchema.safeParse({ version_id: ID, user_ids: [ID], note: "Troquei o nome na legenda." }).success).toBe(true);
    expect(resolveReelChangesSchema.safeParse({ version_id: ID, user_ids: [] }).success).toBe(false);
  });
});
