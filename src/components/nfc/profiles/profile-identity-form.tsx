"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPublicProfileUrl, describeEnglishFallback } from "@/lib/profiles/editor";
import type { EditorState } from "@/lib/profiles/editor";
import type { ProfileLocale } from "@/lib/profiles/types";

/** Aviso de que o campo vazio em inglês cai para o português na página. */
function FallbackHint({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Vazio — a página pública mostra o português:{" "}
      <span className="italic text-foreground">{value}</span>
    </p>
  );
}

export function ProfileIdentityForm({
  state,
  locale,
  onChange,
  onLocalizationChange,
}: {
  state: EditorState;
  locale: ProfileLocale;
  onChange: (patch: Partial<EditorState>) => void;
  onLocalizationChange: (
    locale: ProfileLocale,
    patch: Partial<EditorState["localizations"]["pt-BR"]>
  ) => void;
}) {
  const localization = state.localizations[locale];
  const isEnglish = locale === "en";

  return (
    <section className="space-y-4 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Identidade</h3>
        <p className="text-xs text-muted-foreground">
          Como o colaborador é apresentado no topo da página.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="displayName">Nome público</Label>
          <Input
            id="displayName"
            value={localization.displayName}
            onChange={(event) => onLocalizationChange(locale, { displayName: event.target.value })}
          />
          {isEnglish && <FallbackHint value={describeEnglishFallback(state, "displayName")} />}
        </div>

        <div>
          <Label htmlFor="role">Cargo</Label>
          <Input
            id="role"
            value={localization.role}
            onChange={(event) => onLocalizationChange(locale, { role: event.target.value })}
          />
          {isEnglish && <FallbackHint value={describeEnglishFallback(state, "role")} />}
        </div>

        <div>
          <Label htmlFor="practiceArea">Área de atuação</Label>
          <Input
            id="practiceArea"
            value={localization.practiceArea}
            onChange={(event) => onLocalizationChange(locale, { practiceArea: event.target.value })}
          />
          {isEnglish && <FallbackHint value={describeEnglishFallback(state, "practiceArea")} />}
        </div>

        <div>
          <Label htmlFor="oab">
            OAB <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="oab"
            value={state.oab}
            onChange={(event) => onChange({ oab: event.target.value })}
            placeholder="OAB/SP 123.456"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="tagline">Frase de posicionamento</Label>
        <Input
          id="tagline"
          value={localization.tagline}
          onChange={(event) => onLocalizationChange(locale, { tagline: event.target.value })}
          placeholder="Uma frase curta que resume a atuação"
        />
        {isEnglish && <FallbackHint value={describeEnglishFallback(state, "tagline")} />}
      </div>

      <div>
        <Label htmlFor="bio">Mini-CV</Label>
        <Textarea
          id="bio"
          rows={5}
          value={localization.bio}
          onChange={(event) => onLocalizationChange(locale, { bio: event.target.value })}
          placeholder="Dois ou três parágrafos sobre a trajetória e a atuação."
        />
        {isEnglish && <FallbackHint value={describeEnglishFallback(state, "bio")} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="photoUrl">Foto profissional (URL)</Label>
          <Input
            id="photoUrl"
            value={state.photoUrl}
            onChange={(event) => onChange({ photoUrl: event.target.value })}
            placeholder="https://…"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Vazio usa a foto do cadastro do colaborador no ORQESTRAI. Preencha só para substituir.
          </p>
        </div>

        <div>
          <Label htmlFor="slug">Endereço público</Label>
          <Input
            id="slug"
            value={state.slug}
            onChange={(event) => onChange({ slug: event.target.value })}
          />
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {buildPublicProfileUrl(state.slug)}
          </p>
        </div>
      </div>
    </section>
  );
}
