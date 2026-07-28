"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileLocalizationTabs } from "./profile-localization-tabs";
import { ProfileIdentityForm } from "./profile-identity-form";
import { ProfileContactForm } from "./profile-contact-form";
import { ProfileSectionsEditor } from "./profile-sections-editor";
import { ProfilePublicationPanel } from "./profile-publication-panel";
import { ProfileContentPanel } from "./profile-content-panel";
import {
  buildEditorState,
  buildProfileUpdatePayload,
  type EditorSectionState,
  type EditorState,
} from "@/lib/profiles/editor";
import { listMissingPublishRequirements } from "@/lib/profiles/admin";
import type {
  ProfessionalProfileAdminDetail,
  ProfessionalProfileStatus,
  ProfileContentItem,
  ProfileLocale,
} from "@/lib/profiles/types";

/** Reconstrói o detalhe a partir do estado, para avaliar o checklist ao vivo. */
function projectDetail(
  base: ProfessionalProfileAdminDetail,
  state: EditorState
): ProfessionalProfileAdminDetail {
  return {
    ...base,
    slug: state.slug,
    photoUrl: state.photoUrl || null,
    oab: state.oab || null,
    joinedOn: state.joinedOn || null,
    professionalEmail: state.professionalEmail || null,
    professionalPhone: state.professionalPhone || null,
    linkedinUrl: state.linkedinUrl || null,
    websiteUrl: state.websiteUrl || null,
    showTenure: state.showTenure,
    showEmail: state.showEmail,
    showWhatsapp: state.showWhatsapp,
    showLinkedin: state.showLinkedin,
    showWebsite: state.showWebsite,
    localizations: (["pt-BR", "en"] as ProfileLocale[]).map((locale) => {
      const item = state.localizations[locale];
      return {
        locale,
        isApproved: item.isApproved,
        displayName: item.displayName || null,
        role: item.role || null,
        practiceArea: item.practiceArea || null,
        tagline: item.tagline || null,
        bio: item.bio || null,
      };
    }),
  };
}

export function ProfileEditorClient({
  initialDetail,
  initialContent = [],
}: {
  initialDetail: ProfessionalProfileAdminDetail;
  initialContent?: ProfileContentItem[];
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [state, setState] = useState<EditorState>(() => buildEditorState(initialDetail));
  const [savedState, setSavedState] = useState<EditorState>(() => buildEditorState(initialDetail));
  const [locale, setLocale] = useState<ProfileLocale>("pt-BR");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(savedState),
    [state, savedState]
  );

  // Avisa antes de sair com alteração não salva.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const missing = useMemo(
    () => listMissingPublishRequirements(projectDetail(detail, state)),
    [detail, state]
  );

  const patchState = useCallback((patch: Partial<EditorState>) => {
    setState((current) => ({ ...current, ...patch }));
  }, []);

  const patchLocalization = useCallback(
    (target: ProfileLocale, patch: Partial<EditorState["localizations"]["pt-BR"]>) => {
      setState((current) => ({
        ...current,
        localizations: {
          ...current.localizations,
          [target]: { ...current.localizations[target], ...patch },
        },
      }));
    },
    []
  );

  const setSections = useCallback((sections: EditorSectionState[]) => {
    setState((current) => ({ ...current, sections }));
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/nfc/profiles/${detail.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProfileUpdatePayload(state)),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar.");
      const saved = payload.profile as ProfessionalProfileAdminDetail;
      setDetail(saved);
      const nextState = buildEditorState(saved);
      setState(nextState);
      setSavedState(nextState);
      setMessage({ tone: "ok", text: "Alterações salvas." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao salvar.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: ProfessionalProfileStatus) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/nfc/profiles/${detail.id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível alterar a publicação.");
      setDetail((current) => ({ ...current, status }));
      setMessage({
        tone: "ok",
        text:
          status === "published"
            ? "Perfil publicado."
            : status === "draft"
              ? "Perfil voltou para rascunho."
              : "Perfil arquivado.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao alterar publicação.",
      });
    } finally {
      setBusy(false);
    }
  }

  const englishLocalization = state.localizations.en;
  const englishComplete = Boolean(
    englishLocalization.displayName.trim() &&
      englishLocalization.role.trim() &&
      englishLocalization.bio.trim()
  );

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
          <Link href="/nfc/perfis" aria-label="Voltar para a lista de perfis">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-foreground">
            {detail.localizations.find((item) => item.locale === "pt-BR")?.displayName ??
              detail.userName ??
              "Perfil"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Edite em português e inglês. O inglês só vai ao ar depois de aprovado.
          </p>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={
            message.tone === "ok"
              ? "rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          }
        >
          {message.text}
        </p>
      )}

      <ProfileLocalizationTabs
        locale={locale}
        onChange={setLocale}
        englishApproved={englishLocalization.isApproved}
        englishComplete={englishComplete}
      />

      {locale === "en" && (
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#dce9eb] bg-white px-3 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#347796]"
            checked={englishLocalization.isApproved}
            onChange={(event) => patchLocalization("en", { isApproved: event.target.checked })}
          />
          Tradução em inglês aprovada para publicação
        </label>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <ProfileIdentityForm
            state={state}
            locale={locale}
            onChange={patchState}
            onLocalizationChange={patchLocalization}
          />
          {locale === "pt-BR" && <ProfileContactForm state={state} onChange={patchState} />}
          <ProfileSectionsEditor state={state} locale={locale} onSectionsChange={setSections} />
          <ProfileContentPanel
            profileId={detail.id}
            initialItems={initialContent}
            initialHiddenKeys={detail.hiddenContentKeys}
          />
        </div>

        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <ProfilePublicationPanel
            status={detail.status}
            slug={state.slug}
            missing={missing}
            busy={busy}
            dirty={dirty}
            onPublish={() => changeStatus("published")}
            onUnpublish={() => changeStatus("draft")}
            onArchive={() => changeStatus("archived")}
          />
        </div>
      </div>

      {/* Mobile: salvar fica sempre alcançável */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce9eb] bg-white/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex items-center justify-end gap-2">
          {dirty && (
            <span className="mr-auto text-xs text-amber-800 lg:mr-0">Alterações não salvas</span>
          )}
          <Button onClick={save} disabled={busy || !dirty} className="min-h-11">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
