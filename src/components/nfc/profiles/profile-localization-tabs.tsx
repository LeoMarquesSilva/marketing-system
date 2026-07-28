"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileLocale } from "@/lib/profiles/types";

const LOCALE_LABEL: Record<ProfileLocale, string> = {
  "pt-BR": "Português",
  en: "English",
};

/** Alternância PT/EN com indicador de tradução aprovada. */
export function ProfileLocalizationTabs({
  locale,
  onChange,
  englishApproved,
  englishComplete,
}: {
  locale: ProfileLocale;
  onChange: (locale: ProfileLocale) => void;
  englishApproved: boolean;
  englishComplete: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="tablist"
        aria-label="Idioma do conteúdo"
        className="inline-flex rounded-md border border-[#dce9eb] bg-white p-0.5"
      >
        {(["pt-BR", "en"] as ProfileLocale[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={locale === option}
            onClick={() => onChange(option)}
            className={cn(
              "min-h-9 rounded px-3 text-sm font-medium transition-colors",
              locale === option
                ? "bg-[#e8f8f8] text-[#285f7a]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LOCALE_LABEL[option]}
          </button>
        ))}
      </div>

      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Languages className="h-3.5 w-3.5" aria-hidden />
        {englishApproved
          ? "Inglês aprovado — vai ao ar quando o visitante escolher EN."
          : englishComplete
            ? "Inglês preenchido, mas ainda não aprovado: a página mostra o português."
            : "Sem tradução aprovada: a página mostra o português."}
      </span>
    </div>
  );
}
