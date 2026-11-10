import { describe, expect, it } from "vitest";
import {
  audienceFromDepartment,
  audienceFromPlacement,
  audienceKeysFor,
  groupLinksByAudience,
  isAudienceKey,
  linksForAudience,
} from "./audience";
import type { WelcomeLink } from "./types";

function link(partial: Partial<WelcomeLink> & { id: string; audience: string }): WelcomeLink {
  return {
    title: partial.id,
    url: `https://exemplo.com/${partial.id}`,
    description: null,
    internalNote: null,
    sortOrder: 10,
    isActive: true,
    ...partial,
  };
}

const LINKS: WelcomeLink[] = [
  link({ id: "vios", audience: "todos", sortOrder: 10 }),
  link({ id: "senhas", audience: "todos", sortOrder: 50 }),
  link({ id: "tarefas", audience: "juridica" }),
  link({ id: "pauta", audience: "trabalhista" }),
  link({ id: "fluxo-civel", audience: "civel" }),
  link({ id: "kanban", audience: "controladoria" }),
  link({ id: "inativos", audience: "operacoes-legais" }),
  link({ id: "pausado", audience: "todos", isActive: false }),
];

describe("audienceKeysFor", () => {
  it("equipe jurídica recebe todos + Jurídico + a própria equipe", () => {
    expect(audienceKeysFor("civel")).toEqual(["todos", "juridica", "civel"]);
  });

  it("Controladoria herda Operações Legais", () => {
    expect(audienceKeysFor("controladoria")).toEqual(["todos", "operacoes-legais", "controladoria"]);
  });

  it("divisão sozinha não inclui as equipes", () => {
    expect(audienceKeysFor("operacoes-legais")).toEqual(["todos", "operacoes-legais"]);
  });

  it("sem equipe (ou chave desconhecida) fica só com os links de todos", () => {
    expect(audienceKeysFor(null)).toEqual(["todos"]);
    expect(audienceKeysFor("clima")).toEqual(["todos"]);
  });
});

describe("audienceFromDepartment", () => {
  it("área jurídica do VIOS vira a equipe do organograma", () => {
    expect(audienceFromDepartment("Cível")).toBe("civel");
    expect(audienceFromDepartment("Trabalhista")).toBe("trabalhista");
    expect(audienceFromDepartment("Recuperação de Crédito")).toBe("recuperacao-de-credito");
  });

  it("nomes legados seguem o nome oficial", () => {
    expect(audienceFromDepartment("Insolvência")).toBe("reestruturacao");
    expect(audienceFromDepartment("Contratos")).toBe("societario-e-contratos");
  });

  it("Operações Legais não diz a equipe: fica a divisão", () => {
    expect(audienceFromDepartment("Operações Legais")).toBe("operacoes-legais");
  });

  it("sócio e área vazia não têm público próprio", () => {
    expect(audienceFromDepartment("Sócio")).toBeNull();
    expect(audienceFromDepartment(null)).toBeNull();
  });
});

describe("audienceFromPlacement", () => {
  it("equipe vence a divisão; comitê não conta", () => {
    expect(audienceFromPlacement("operacoes-legais", "controladoria")).toBe("controladoria");
    expect(audienceFromPlacement("operacoes-legais", null)).toBe("operacoes-legais");
    expect(audienceFromPlacement(null, "clima")).toBeNull();
  });

  it("valida a chave", () => {
    expect(isAudienceKey("civel")).toBe(true);
    expect(isAudienceKey("clima")).toBe(false);
  });
});

describe("linksForAudience", () => {
  const ids = (audience: string | null) => linksForAudience(LINKS, audience).map((item) => item.id);

  it("mostra os links ativos de todos, da divisão e da equipe", () => {
    expect(ids("trabalhista")).toEqual(["vios", "senhas", "tarefas", "pauta"]);
  });

  it("Controladoria vê também os de Operações Legais, não os jurídicos", () => {
    expect(ids("controladoria")).toEqual(["vios", "senhas", "kanban", "inativos"]);
  });

  it("sem equipe, só os de todos (link pausado nunca aparece)", () => {
    expect(ids(null)).toEqual(["vios", "senhas"]);
  });
});

describe("groupLinksByAudience", () => {
  it("ordena os grupos como o organograma e os links pela ordem do RH", () => {
    const groups = groupLinksByAudience([
      link({ id: "b", audience: "civel", sortOrder: 20 }),
      link({ id: "a", audience: "civel", sortOrder: 10 }),
      link({ id: "z", audience: "todos" }),
      link({ id: "j", audience: "juridica" }),
      link({ id: "o", audience: "operacoes-legais" }),
    ]);
    expect(groups.map((group) => group.key)).toEqual(["todos", "operacoes-legais", "juridica", "civel"]);
    expect(groups[3].links.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
