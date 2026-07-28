import { describe, expect, it } from "vitest";
import {
  buildEditorState,
  buildProfileUpdatePayload,
  buildPublicProfileUrl,
  createEmptyEntry,
  describeEnglishFallback,
  moveEntry,
  removeEntry,
} from "@/lib/profiles/editor";
import { listMissingPublishRequirements } from "@/lib/profiles/admin";
import type { ProfessionalProfileAdminDetail } from "@/lib/profiles/types";

const detail: ProfessionalProfileAdminDetail = {
  id: "p1",
  userId: "u1",
  userName: "Letícia Rodrigues",
  slug: "leticia-rodrigues",
  status: "draft",
  photoUrl: "https://cdn.exemplo.com/leticia.jpg",
  oab: null,
  joinedOn: "2019-03-01",
  professionalEmail: "leticia@bismarchipires.com.br",
  professionalPhone: "+5519999999999",
  linkedinUrl: null,
  websiteUrl: null,
  showTenure: true,
  showEmail: false,
  showWhatsapp: false,
  showLinkedin: true,
  showWebsite: true,
  publishedAt: null,
  updatedAt: "2026-07-28T12:00:00.000Z",
  localizations: [
    {
      locale: "pt-BR",
      isApproved: true,
      displayName: "Letícia Rodrigues",
      role: "Sócia",
      practiceArea: "Tributário",
      tagline: "A advocacia começa pela escuta.",
      bio: "Atua em contencioso tributário.",
    },
  ],
  sections: [
    {
      id: "s1",
      key: "practice",
      enabled: true,
      sortOrder: 0,
      entries: [
        {
          id: "e1",
          entryType: "area",
          linkUrl: null,
          imageUrl: null,
          occurredOn: null,
          metadata: {},
          sortOrder: 0,
          isVisible: true,
          localizations: [{ locale: "pt-BR", title: "Contencioso tributário", subtitle: null, description: null }],
        },
        {
          id: "e2",
          entryType: "area",
          linkUrl: null,
          imageUrl: null,
          occurredOn: null,
          metadata: {},
          sortOrder: 1,
          isVisible: true,
          localizations: [{ locale: "pt-BR", title: "Planejamento tributário", subtitle: null, description: null }],
        },
      ],
    },
  ],
  cards: [],
  hiddenContentKeys: [],
};

describe("estado inicial do editor", () => {
  const state = buildEditorState(detail);

  it("cria as duas abas de idioma mesmo sem tradução em inglês", () => {
    expect(state.localizations["pt-BR"].displayName).toBe("Letícia Rodrigues");
    expect(state.localizations.en.displayName).toBe("");
  });

  it("nunca marca uma tradução inexistente como aprovada", () => {
    expect(state.localizations.en.isApproved).toBe(false);
  });

  it("mantém telefone e e-mail desligados por padrão do perfil", () => {
    expect(state.showEmail).toBe(false);
    expect(state.showWhatsapp).toBe(false);
  });

  it("cria todas as cinco seções, mesmo as ausentes no banco", () => {
    expect(state.sections.map((section) => section.key)).toEqual([
      "practice",
      "education",
      "knowledge",
      "highlights",
      "timeline",
    ]);
  });
});

describe("abas PT e EN são independentes", () => {
  it("editar o inglês não altera o português", () => {
    const state = buildEditorState(detail);
    const edited = {
      ...state,
      localizations: {
        ...state.localizations,
        en: { ...state.localizations.en, role: "Partner" },
      },
    };
    expect(edited.localizations["pt-BR"].role).toBe("Sócia");
    expect(edited.localizations.en.role).toBe("Partner");
  });

  it("o payload leva as duas localizações juntas", () => {
    const state = buildEditorState(detail);
    const payload = buildProfileUpdatePayload(state);
    const locales = (payload.localizations ?? []).map((item) => item.locale);
    expect(locales).toEqual(["pt-BR", "en"]);
  });

  it("campo em branco vira null em vez de string vazia", () => {
    const state = buildEditorState(detail);
    const payload = buildProfileUpdatePayload(state);
    const en = payload.localizations?.find((item) => item.locale === "en");
    expect(en?.displayName).toBeNull();
  });
});

describe("aviso de fallback do inglês", () => {
  it("anuncia o texto em português quando o inglês está vazio", () => {
    const state = buildEditorState(detail);
    expect(describeEnglishFallback(state, "role")).toBe("Sócia");
    expect(describeEnglishFallback(state, "tagline")).toBe("A advocacia começa pela escuta.");
  });

  it("some quando o inglês está preenchido", () => {
    const state = buildEditorState(detail);
    const edited = {
      ...state,
      localizations: {
        ...state.localizations,
        en: { ...state.localizations.en, role: "Partner" },
      },
    };
    expect(describeEnglishFallback(edited, "role")).toBeNull();
  });
});

describe("ordenação e visibilidade das entradas", () => {
  const state = buildEditorState(detail);
  const practice = state.sections[0];

  it("mover para baixo troca a ordem", () => {
    const moved = moveEntry(practice, 0, 1);
    expect(moved.entries.map((entry) => entry.titlePt)).toEqual([
      "Planejamento tributário",
      "Contencioso tributário",
    ]);
  });

  it("não sai dos limites da lista", () => {
    expect(moveEntry(practice, 0, -1).entries[0].titlePt).toBe("Contencioso tributário");
    expect(moveEntry(practice, 1, 1).entries[1].titlePt).toBe("Planejamento tributário");
  });

  it("a ordem da lista vira sortOrder no payload", () => {
    const reordered = {
      ...state,
      sections: [moveEntry(practice, 0, 1), ...state.sections.slice(1)],
    };
    const payload = buildProfileUpdatePayload(reordered);
    const entries = payload.sections?.[0]?.entries ?? [];
    expect(entries[0]?.sortOrder).toBe(0);
    expect(entries[0]?.localizations?.[0]?.title).toBe("Planejamento tributário");
    expect(entries[1]?.sortOrder).toBe(1);
  });

  it("remover guarda o id para o backend apagar", () => {
    const removed = removeEntry(practice, 0);
    expect(removed.entries).toHaveLength(1);
    expect(removed.deletedEntryIds).toEqual(["e1"]);
  });

  it("entrada nova sem id não entra na lista de exclusão", () => {
    const withNew = { ...practice, entries: [...practice.entries, createEmptyEntry()] };
    const removed = removeEntry(withNew, 2);
    expect(removed.deletedEntryIds).toEqual([]);
  });

  it("esconder uma entrada é preservado no payload", () => {
    const hidden = {
      ...state,
      sections: [
        { ...practice, entries: [{ ...practice.entries[0], isVisible: false }, practice.entries[1]] },
        ...state.sections.slice(1),
      ],
    };
    const payload = buildProfileUpdatePayload(hidden);
    expect(payload.sections?.[0]?.entries?.[0]?.isVisible).toBe(false);
  });

  it("desligar uma seção é preservado no payload", () => {
    const off = {
      ...state,
      sections: state.sections.map((section) =>
        section.key === "practice" ? { ...section, enabled: false } : section
      ),
    };
    const payload = buildProfileUpdatePayload(off);
    expect(payload.sections?.find((section) => section.key === "practice")?.enabled).toBe(false);
  });
});

describe("checklist de publicação", () => {
  it("perfil com tudo preenchido pode publicar", () => {
    expect(listMissingPublishRequirements({ ...detail, showEmail: true })).toEqual([]);
  });

  it("aponta o que falta quando não há ação de contato habilitada", () => {
    // showEmail/showWhatsapp desligados e sem LinkedIn/site preenchidos.
    const missing = listMissingPublishRequirements(detail);
    expect(missing).toContain("contactAction");
  });

  it("aponta foto e mini-CV ausentes", () => {
    const missing = listMissingPublishRequirements({
      ...detail,
      photoUrl: null,
      localizations: [{ ...detail.localizations[0], bio: null }],
    });
    expect(missing).toEqual(expect.arrayContaining(["photo", "bio"]));
  });
});

describe("URL pública do perfil", () => {
  it("mostra o endereço final enquanto o slug é editado", () => {
    expect(buildPublicProfileUrl("leticia-rodrigues", "https://exemplo.com.br")).toBe(
      "https://exemplo.com.br/perfil/leticia-rodrigues"
    );
  });

  it("usa a origem de produção por padrão", () => {
    expect(buildPublicProfileUrl("leticia-rodrigues")).toBe(
      "https://marketing-system-xi.vercel.app/perfil/leticia-rodrigues"
    );
  });
});
