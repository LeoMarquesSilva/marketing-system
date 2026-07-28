/**
 * Estado puro do editor de perfis.
 *
 * Fica separado do componente para poder ser testado sem DOM: o que importa
 * aqui é que a aba PT e a aba EN nunca se sobrescrevam, que a ordem das
 * entradas sobreviva até o payload e que publicar dependa do checklist.
 */

import type {
  ProfessionalProfileAdminDetail,
  ProfessionalProfileAdminEntry,
  ProfessionalProfileAdminSection,
  ProfessionalProfileLocalization,
  ProfileLocale,
  ProfileSectionKey,
} from "@/lib/profiles/types";
import type { ProfileUpdateInput } from "@/lib/profiles/validation";

export interface EditorLocalizationState {
  locale: ProfileLocale;
  isApproved: boolean;
  displayName: string;
  role: string;
  practiceArea: string;
  tagline: string;
  bio: string;
}

export interface EditorEntryState {
  id: string | null;
  /** Chave local estável para React quando a entrada ainda não tem id. */
  tempKey: string;
  entryType: string;
  linkUrl: string;
  occurredOn: string;
  isVisible: boolean;
  titlePt: string;
  titleEn: string;
  subtitlePt: string;
  subtitleEn: string;
  descriptionPt: string;
  descriptionEn: string;
}

export interface EditorSectionState {
  key: ProfileSectionKey;
  enabled: boolean;
  entries: EditorEntryState[];
  deletedEntryIds: string[];
}

export interface EditorState {
  slug: string;
  photoUrl: string;
  oab: string;
  joinedOn: string;
  professionalEmail: string;
  professionalPhone: string;
  linkedinUrl: string;
  websiteUrl: string;
  showTenure: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  showLinkedin: boolean;
  showWebsite: boolean;
  localizations: Record<ProfileLocale, EditorLocalizationState>;
  sections: EditorSectionState[];
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

function toLocalizationState(
  locale: ProfileLocale,
  source: ProfessionalProfileLocalization | undefined
): EditorLocalizationState {
  return {
    locale,
    // Tradução ausente nunca é tratada como aprovada.
    isApproved: source?.isApproved ?? false,
    displayName: text(source?.displayName),
    role: text(source?.role),
    practiceArea: text(source?.practiceArea),
    tagline: text(source?.tagline),
    bio: text(source?.bio),
  };
}

function toEntryState(entry: ProfessionalProfileAdminEntry, index: number): EditorEntryState {
  const pt = entry.localizations.find((item) => item.locale === "pt-BR");
  const en = entry.localizations.find((item) => item.locale === "en");
  return {
    id: entry.id,
    tempKey: entry.id ?? `entry-${index}`,
    entryType: entry.entryType,
    linkUrl: text(entry.linkUrl),
    occurredOn: text(entry.occurredOn),
    isVisible: entry.isVisible,
    titlePt: text(pt?.title),
    titleEn: text(en?.title),
    subtitlePt: text(pt?.subtitle),
    subtitleEn: text(en?.subtitle),
    descriptionPt: text(pt?.description),
    descriptionEn: text(en?.description),
  };
}

export const EDITOR_SECTION_ORDER: ProfileSectionKey[] = [
  "practice",
  "education",
  "knowledge",
  "highlights",
  "timeline",
];

export function buildEditorState(detail: ProfessionalProfileAdminDetail): EditorState {
  const sectionByKey = new Map<ProfileSectionKey, ProfessionalProfileAdminSection>(
    detail.sections.map((section) => [section.key, section])
  );

  return {
    slug: detail.slug,
    photoUrl: text(detail.photoUrl),
    oab: text(detail.oab),
    joinedOn: text(detail.joinedOn),
    professionalEmail: text(detail.professionalEmail),
    professionalPhone: text(detail.professionalPhone),
    linkedinUrl: text(detail.linkedinUrl),
    websiteUrl: text(detail.websiteUrl),
    showTenure: detail.showTenure,
    showEmail: detail.showEmail,
    showWhatsapp: detail.showWhatsapp,
    showLinkedin: detail.showLinkedin,
    showWebsite: detail.showWebsite,
    localizations: {
      "pt-BR": toLocalizationState(
        "pt-BR",
        detail.localizations.find((item) => item.locale === "pt-BR")
      ),
      en: toLocalizationState("en", detail.localizations.find((item) => item.locale === "en")),
    },
    sections: EDITOR_SECTION_ORDER.map((key) => {
      const section = sectionByKey.get(key);
      return {
        key,
        enabled: section?.enabled ?? true,
        entries: (section?.entries ?? []).map(toEntryState),
        deletedEntryIds: [],
      };
    }),
  };
}

/**
 * Texto que o valor em inglês assume quando está vazio. A interface mostra
 * isso explicitamente para o administrador saber que a página pública não vai
 * ficar em branco — vai cair para o português.
 */
export function describeEnglishFallback(
  state: EditorState,
  field: keyof Omit<EditorLocalizationState, "locale" | "isApproved">
): string | null {
  const en = state.localizations.en[field];
  if (en && en.trim()) return null;
  const pt = state.localizations["pt-BR"][field];
  return pt && pt.trim() ? pt : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Payload de atualização. Ambas as localizações vão sempre juntas, cada uma com
 * seus próprios campos — por isso salvar na aba PT não apaga a tradução EN.
 * A ordem das entradas vira `sortOrder` explícito.
 */
export function buildProfileUpdatePayload(state: EditorState): ProfileUpdateInput {
  return {
    slug: state.slug.trim(),
    photoUrl: emptyToNull(state.photoUrl),
    oab: emptyToNull(state.oab),
    joinedOn: emptyToNull(state.joinedOn),
    professionalEmail: emptyToNull(state.professionalEmail),
    professionalPhone: emptyToNull(state.professionalPhone),
    linkedinUrl: emptyToNull(state.linkedinUrl),
    websiteUrl: emptyToNull(state.websiteUrl),
    showTenure: state.showTenure,
    showEmail: state.showEmail,
    showWhatsapp: state.showWhatsapp,
    showLinkedin: state.showLinkedin,
    showWebsite: state.showWebsite,
    localizations: (["pt-BR", "en"] as ProfileLocale[]).map((locale) => {
      const localization = state.localizations[locale];
      return {
        locale,
        isApproved: localization.isApproved,
        displayName: emptyToNull(localization.displayName),
        role: emptyToNull(localization.role),
        practiceArea: emptyToNull(localization.practiceArea),
        tagline: emptyToNull(localization.tagline),
        bio: emptyToNull(localization.bio),
      };
    }),
    sections: state.sections.map((section, sectionIndex) => ({
      key: section.key,
      enabled: section.enabled,
      sortOrder: sectionIndex,
      deletedEntryIds: section.deletedEntryIds,
      entries: section.entries.map((entry, entryIndex) => ({
        ...(entry.id ? { id: entry.id } : {}),
        entryType: entry.entryType || "item",
        linkUrl: emptyToNull(entry.linkUrl),
        occurredOn: emptyToNull(entry.occurredOn),
        // A posição na lista é a fonte da ordem publicada.
        sortOrder: entryIndex,
        isVisible: entry.isVisible,
        localizations: [
          ...(entry.titlePt.trim()
            ? [
                {
                  locale: "pt-BR" as ProfileLocale,
                  title: entry.titlePt.trim(),
                  subtitle: emptyToNull(entry.subtitlePt),
                  description: emptyToNull(entry.descriptionPt),
                },
              ]
            : []),
          ...(entry.titleEn.trim()
            ? [
                {
                  locale: "en" as ProfileLocale,
                  title: entry.titleEn.trim(),
                  subtitle: emptyToNull(entry.subtitleEn),
                  description: emptyToNull(entry.descriptionEn),
                },
              ]
            : []),
        ],
      })),
    })),
  } as ProfileUpdateInput;
}

/** Move uma entrada dentro da seção, preservando o resto do estado. */
export function moveEntry(
  section: EditorSectionState,
  index: number,
  direction: -1 | 1
): EditorSectionState {
  const target = index + direction;
  if (index < 0 || index >= section.entries.length) return section;
  if (target < 0 || target >= section.entries.length) return section;
  const entries = [...section.entries];
  const [moved] = entries.splice(index, 1);
  entries.splice(target, 0, moved);
  return { ...section, entries };
}

/** Remove a entrada, guardando o id para o backend apagar. */
export function removeEntry(section: EditorSectionState, index: number): EditorSectionState {
  const entry = section.entries[index];
  if (!entry) return section;
  return {
    ...section,
    entries: section.entries.filter((_, position) => position !== index),
    deletedEntryIds: entry.id
      ? [...section.deletedEntryIds, entry.id]
      : section.deletedEntryIds,
  };
}

export function createEmptyEntry(): EditorEntryState {
  return {
    id: null,
    tempKey: `new-${Math.random().toString(36).slice(2, 10)}`,
    entryType: "item",
    linkUrl: "",
    occurredOn: "",
    isVisible: true,
    titlePt: "",
    titleEn: "",
    subtitlePt: "",
    subtitleEn: "",
    descriptionPt: "",
    descriptionEn: "",
  };
}

/** URL pública final, mostrada enquanto o slug é editado. */
export function buildPublicProfileUrl(slug: string, origin?: string): string {
  const base = (origin ?? "https://marketing-system-xi.vercel.app").replace(/\/+$/, "");
  return `${base}/perfil/${slug.trim()}`;
}
