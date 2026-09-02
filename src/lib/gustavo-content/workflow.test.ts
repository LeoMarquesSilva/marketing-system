import { describe, expect, it } from "vitest";
import { GUSTAVO_OWNER_USER_ID } from "@/lib/gustavo-content/constants";
import {
  approvalKindForActor,
  canGenerateDraft,
  canRunEditorialAction,
  nextStatusAfterThesisMatch,
  resolveOutputEdit,
} from "@/lib/gustavo-content/workflow";

describe("canRunEditorialAction", () => {
  it("não permite reanalisar ou regenerar conteúdo depois da aprovação", () => {
    expect(canRunEditorialAction("analyze", "aprovado")).toBe(false);
    expect(canRunEditorialAction("generate", "aguardando_aprovacao")).toBe(false);
    expect(canRunEditorialAction("generate", "publicado")).toBe(false);
    expect(canRunEditorialAction("analyze", "rascunho")).toBe(true);
    expect(canRunEditorialAction("generate", "rascunho")).toBe(true);
  });
});

describe("nextStatusAfterThesisMatch", () => {
  it("sem tese validada entra em aguardando opinião e não gera rascunho", () => {
    expect(nextStatusAfterThesisMatch({ opinionStatus: "needs_gustavo" })).toBe(
      "aguardando_opiniao"
    );
    expect(
      canGenerateDraft({ opinionStatus: "needs_gustavo", hasSelectedAngle: true })
    ).toBe(false);
  });

  it("com tese validada pode gerar rascunho", () => {
    expect(nextStatusAfterThesisMatch({ opinionStatus: "validated" })).toBe("rascunho");
    expect(
      canGenerateDraft({ opinionStatus: "validated", hasSelectedAngle: true })
    ).toBe(true);
  });
});

describe("canGenerateDraft", () => {
  it("exige uma leitura selecionada mesmo com opinião validada", () => {
    expect(
      canGenerateDraft({ opinionStatus: "validated", hasSelectedAngle: false })
    ).toBe(false);
  });

  it("modo factual libera geração sem opinião validada, desde que haja leitura escolhida", () => {
    expect(
      canGenerateDraft({
        opinionStatus: "needs_gustavo",
        hasSelectedAngle: true,
        mode: "factual",
      })
    ).toBe(true);
    expect(
      canGenerateDraft({
        opinionStatus: "needs_gustavo",
        hasSelectedAngle: false,
        mode: "factual",
      })
    ).toBe(false);
  });
});

describe("approvalKindForActor", () => {
  it("registra o Gustavo quando o owner autentica", () => {
    expect(
      approvalKindForActor({
        id: GUSTAVO_OWNER_USER_ID,
        isAdmin: false,
        memberRole: "owner",
      })
    ).toBe("gustavo");
  });

  it("não disfarça admin como Gustavo", () => {
    expect(
      approvalKindForActor({
        id: "admin-1",
        isAdmin: true,
        memberRole: null,
      })
    ).toBe("admin_exception");
  });
});

describe("resolveOutputEdit", () => {
  it("preserva a versão original na primeira edição", () => {
    const first = resolveOutputEdit({
      current: "Post da IA",
      incoming: "Post editado",
      original: null,
    });
    expect(first.original).toBe("Post da IA");
    expect(first.hasAlterations).toBe(true);
    expect(first.value).toBe("Post editado");

    const same = resolveOutputEdit({
      current: "Post da IA",
      incoming: "Post da IA",
      original: null,
    });
    expect(same.hasAlterations).toBe(false);
    expect(same.original).toBeNull();
  });
});
