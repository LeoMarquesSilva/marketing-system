import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/access-control";
import {
  GUSTAVO_CONTENT_PATH,
  canAccessGustavoContent,
  isGustavoContentPath,
} from "@/lib/gustavo-content/access";

const ADMIN = { id: "admin-1", role: "admin", permissions: null as string[] | null };
const GUSTAVO_OWNER = {
  id: "9394f718-5e3a-4b2a-ae53-84faefcd4c7e",
  role: null as string | null,
  department: "Facilities",
  permissions: null as string[] | null,
  gustavo_content_member: true,
};
const MARKETING = {
  id: "mkt-1",
  role: null as string | null,
  department: "Marketing",
  permissions: [
    "/conteudo/roteiros",
    "/conteudo/boletim",
    "/conteudo/reels",
    "/planner",
  ],
};
const DESIGNER = {
  id: "des-1",
  role: "designer",
  department: "Marketing",
  permissions: null as string[] | null,
};
const SOCIO = {
  id: "socio-1",
  role: null as string | null,
  department: "Sócio",
  permissions: ["/conteudo/roteiros", "/conteudo/boletim", "/meus-clientes"],
};
const COLLABORATOR = {
  id: "colab-1",
  role: null as string | null,
  department: "Cível",
  permissions: ["/conteudo/roteiros"],
};

describe("canAccessGustavoContent", () => {
  it("libera admin sem membership", () => {
    expect(canAccessGustavoContent(ADMIN)).toBe(true);
  });

  it("libera membro cadastrado (conta do Gustavo)", () => {
    expect(canAccessGustavoContent(GUSTAVO_OWNER)).toBe(true);
  });

  it("bloqueia Marketing, designer, sócio e colaborador de conteúdo", () => {
    expect(canAccessGustavoContent(MARKETING)).toBe(false);
    expect(canAccessGustavoContent(DESIGNER)).toBe(false);
    expect(canAccessGustavoContent(SOCIO)).toBe(false);
    expect(canAccessGustavoContent(COLLABORATOR)).toBe(false);
  });

  it("não libera por nome ou department", () => {
    expect(
      canAccessGustavoContent({
        id: "outro",
        role: null,
        department: "Facilities",
        name: "Gustavo Bismarchi Motta",
      })
    ).toBe(false);
  });
});

describe("canAccessPath — /conteudo/gustavo não herda a subárvore de conteúdo", () => {
  it("reconhece a rota do módulo e as filhas", () => {
    expect(isGustavoContentPath(GUSTAVO_CONTENT_PATH)).toBe(true);
    expect(isGustavoContentPath(`${GUSTAVO_CONTENT_PATH}/radar`)).toBe(true);
    expect(isGustavoContentPath("/conteudo/roteiros")).toBe(false);
  });

  it("admin e membro acessam a rota e as filhas", () => {
    expect(canAccessPath(ADMIN, GUSTAVO_CONTENT_PATH)).toBe(true);
    expect(canAccessPath(GUSTAVO_OWNER, `${GUSTAVO_CONTENT_PATH}/teses`)).toBe(true);
  });

  it("quem tem /conteudo/roteiros NÃO entra no módulo do Gustavo", () => {
    expect(canAccessPath(MARKETING, GUSTAVO_CONTENT_PATH)).toBe(false);
    expect(canAccessPath(SOCIO, GUSTAVO_CONTENT_PATH)).toBe(false);
    expect(canAccessPath(COLLABORATOR, GUSTAVO_CONTENT_PATH)).toBe(false);
    expect(canAccessPath(DESIGNER, GUSTAVO_CONTENT_PATH)).toBe(false);
  });

  it("continua liberando o módulo institucional de conteúdo", () => {
    expect(canAccessPath(MARKETING, "/conteudo/roteiros")).toBe(true);
    expect(canAccessPath(COLLABORATOR, "/conteudo/reels")).toBe(true);
  });
});
