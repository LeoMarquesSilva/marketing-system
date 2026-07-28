import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NFC_SUBNAV_ITEMS } from "@/components/nfc/nfc-subnav";
import {
  PROFILE_STATUS_META,
  ProfileCompletenessBar,
  ProfileStatusBadge,
} from "./profile-status-badge";
import { matchesProfileListFilters } from "@/lib/profiles/admin";
import type { ProfessionalProfileListItem } from "@/lib/profiles/types";

const item: ProfessionalProfileListItem = {
  id: "p1",
  userId: "u1",
  slug: "leticia-rodrigues",
  status: "draft",
  photoUrl: null,
  displayName: "Letícia Rodrigues",
  role: "Sócia",
  practiceArea: "Tributário",
  completeness: 60,
  hasApprovedEnglish: false,
  cardCount: 2,
  activeCardCount: 1,
  viewCount: 0,
  scanCount: 0,
  updatedAt: "2026-07-28T12:00:00.000Z",
};

describe("navegação do NFC Hub", () => {
  it("inclui a aba Perfis", () => {
    const perfis = NFC_SUBNAV_ITEMS.find((entry) => entry.href === "/nfc/perfis");
    expect(perfis).toBeDefined();
    expect(perfis?.label).toBe("Perfis");
  });

  it("mantém as abas existentes do hub", () => {
    const hrefs = NFC_SUBNAV_ITEMS.map((entry) => entry.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/nfc", "/nfc/tags", "/nfc/itens", "/nfc/logs", "/nfc/modelos"])
    );
  });
});

describe("ProfileStatusBadge", () => {
  it("rotula as três situações em português", () => {
    expect(PROFILE_STATUS_META.draft.label).toBe("Rascunho");
    expect(PROFILE_STATUS_META.published.label).toBe("Publicado");
    expect(PROFILE_STATUS_META.archived.label).toBe("Arquivado");
  });

  it("renderiza o rótulo visível", () => {
    const markup = renderToStaticMarkup(<ProfileStatusBadge status="published" />);
    expect(markup).toContain("Publicado");
  });
});

describe("ProfileCompletenessBar", () => {
  it("expõe o progresso para leitor de tela", () => {
    const markup = renderToStaticMarkup(<ProfileCompletenessBar value={60} />);
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="60"');
    expect(markup).toContain("60% completo");
  });

  it("prende o valor na faixa 0..100", () => {
    expect(renderToStaticMarkup(<ProfileCompletenessBar value={140} />)).toContain(
      'aria-valuenow="100"'
    );
    expect(renderToStaticMarkup(<ProfileCompletenessBar value={-20} />)).toContain(
      'aria-valuenow="0"'
    );
  });
});

describe("filtros da listagem", () => {
  it("filtra por rascunho, publicado e arquivado", () => {
    expect(matchesProfileListFilters(item, { status: "draft" })).toBe(true);
    expect(matchesProfileListFilters(item, { status: "published" })).toBe(false);
    expect(matchesProfileListFilters({ ...item, status: "archived" }, { status: "archived" })).toBe(
      true
    );
  });

  it("separa completos de incompletos", () => {
    expect(matchesProfileListFilters(item, { completeness: "incomplete" })).toBe(true);
    expect(matchesProfileListFilters({ ...item, completeness: 100 }, { completeness: "complete" })).toBe(
      true
    );
  });

  it("busca ignorando acento", () => {
    expect(matchesProfileListFilters(item, { search: "leticia" })).toBe(true);
    expect(matchesProfileListFilters(item, { search: "tributario" })).toBe(true);
  });
});
