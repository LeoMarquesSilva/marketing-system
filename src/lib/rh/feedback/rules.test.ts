import { describe, expect, it } from "vitest";
import { canDelete, coverageBand, daysAgo, excerpt, goodPracticeSentByFeedz, normalizeVisibility, skipGoodPracticeIntro, sanitizeValues, viewerRole, type FeedbackAccessRow, type ViewerInfo } from "./rules";

const base: FeedbackAccessRow = { from_employee_id: "ana", to_employee_id: "bia", visibility: "privado", kind: "desenvolvimento", deleted_at: null };
const viewer = (patch: Partial<ViewerInfo> = {}): ViewerInfo => ({ employeeId: "zeca", team: new Set(), isHr: false, hrReadsContent: true, ...patch });

describe("quem vê o feedback", () => {
  it("remetente e destinatário sempre veem", () => {
    expect(viewerRole(base, viewer({ employeeId: "ana" }))).toBe("remetente");
    expect(viewerRole(base, viewer({ employeeId: "bia" }))).toBe("destinatario");
  });

  it("privado não aparece para o gestor; 'pessoa e gestor' aparece", () => {
    const gestor = viewer({ team: new Set(["bia"]) });
    expect(viewerRole(base, gestor)).toBeNull();
    expect(viewerRole({ ...base, visibility: "gestor" }, gestor)).toBe("gestor");
  });

  it("mural só vale para reconhecimento", () => {
    expect(viewerRole({ ...base, kind: "reconhecimento", visibility: "publico" }, viewer())).toBe("mural");
    expect(viewerRole({ ...base, kind: "desenvolvimento", visibility: "publico" }, viewer())).toBeNull();
  });

  it("o RH lê tudo quando a configuração deixa, e os apagados só ele vê", () => {
    expect(viewerRole(base, viewer({ isHr: true }))).toBe("rh");
    expect(viewerRole(base, viewer({ isHr: true, hrReadsContent: false }))).toBeNull();
    expect(viewerRole({ ...base, deleted_at: "2026-11-20T10:00:00Z" }, viewer({ employeeId: "ana" }))).toBeNull();
    expect(viewerRole({ ...base, deleted_at: "2026-11-20T10:00:00Z" }, viewer({ isHr: true }))).toBe("rh");
  });
});

describe("apagar", () => {
  const row = { ...base, created_at: "2026-11-20T10:00:00Z" };
  it("o autor apaga em até 24 h", () => {
    expect(canDelete(row, viewer({ employeeId: "ana" }), new Date("2026-11-21T09:59:00Z"))).toBe(true);
    expect(canDelete(row, viewer({ employeeId: "ana" }), new Date("2026-11-21T10:01:00Z"))).toBe(false);
  });
  it("quem recebe não apaga; o RH apaga sempre", () => {
    expect(canDelete(row, viewer({ employeeId: "bia" }))).toBe(false);
    expect(canDelete(row, viewer({ isHr: true }), new Date("2027-01-01T00:00:00Z"))).toBe(true);
  });
});

describe("regras de envio", () => {
  it("desenvolvimento nunca vai para o mural", () => {
    expect(normalizeVisibility("desenvolvimento", "publico", true)).toBe("gestor");
    expect(normalizeVisibility("reconhecimento", "publico", true)).toBe("publico");
    expect(normalizeVisibility("reconhecimento", "publico", false)).toBe("gestor");
  });
  it("valores: só os 5 do CIVIL, sem repetir, no máximo 2", () => {
    expect(sanitizeValues(["cliente", "cliente", "lideranca", "inovacao", "liberdade"])).toEqual(["cliente", "inovacao"]);
  });
});

describe("cobertura", () => {
  it("faixas de 30, 60 e 90 dias", () => {
    expect(coverageBand(null)).toBe("nunca");
    expect(coverageBand(10)).toBe("ok");
    expect(coverageBand(31)).toBe("30");
    expect(coverageBand(75)).toBe("60");
    expect(coverageBand(120)).toBe("90");
  });
  it("dias desde a data", () => {
    expect(daysAgo("2026-11-01T12:00:00Z", new Date("2026-11-23T12:00:00Z"))).toBe(22);
    expect(daysAgo(null)).toBeNull();
  });
  it("resumo não corta palavra", () => {
    expect(excerpt("um dois três quatro cinco seis sete oito", 20)).toBe("um dois três quatro…");
  });
});

describe("goodPracticeSentByFeedz", () => {
  it("considera enviado pelo Feedz o que saiu antes de 23/11/2026", () => {
    expect(goodPracticeSentByFeedz("2026-11-19")).toBe(true);
    expect(goodPracticeSentByFeedz("2026-11-23")).toBe(false);
    expect(goodPracticeSentByFeedz(null)).toBe(false);
  });
});

describe("skipGoodPracticeIntro", () => {
  it("tira o título fixo e a saudação da ocorrência", () => {
    const text = "Registro de Ocorrência | Boas Práticas no Escritório\n\nPrezado Leonardo, bom dia.\n\nIdentificamos que a colaboradora deixou a geladeira aberta.";
    expect(skipGoodPracticeIntro(text)).toBe("Identificamos que a colaboradora deixou a geladeira aberta.");
    expect(skipGoodPracticeIntro("Texto sem cabeçalho")).toBe("Texto sem cabeçalho");
  });
});
