"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createEmptyEntry, moveEntry, removeEntry } from "@/lib/profiles/editor";
import type { EditorSectionState, EditorState } from "@/lib/profiles/editor";
import { PROFILE_SECTION_LABELS } from "@/lib/profiles/types";
import type { ProfileLocale } from "@/lib/profiles/types";

const SECTION_HINTS: Record<string, string> = {
  practice: "Blocos objetivos com as áreas em que a pessoa atua.",
  education: "Graduação, pós, cursos, certificações e idiomas.",
  knowledge: "Conteúdos e conhecimentos que valem destacar.",
  highlights: "Casos, prêmios e reconhecimentos.",
  timeline: "Trajetória dentro do escritório.",
};

export function ProfileSectionsEditor({
  state,
  locale,
  onSectionsChange,
}: {
  state: EditorState;
  locale: ProfileLocale;
  onSectionsChange: (sections: EditorSectionState[]) => void;
}) {
  const isEnglish = locale === "en";

  function updateSection(index: number, next: EditorSectionState) {
    onSectionsChange(state.sections.map((section, position) => (position === index ? next : section)));
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Conteúdo do perfil</h3>
        <p className="text-xs text-muted-foreground">
          Seção desligada ou vazia desaparece da página pública — sem título solto.
        </p>
      </div>

      {state.sections.map((section, sectionIndex) => (
        <details
          key={section.key}
          className="rounded-lg border border-[#dce9eb] bg-white"
          open={section.entries.length > 0}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {PROFILE_SECTION_LABELS[section.key]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {section.entries.length} item(ns)
                </span>
              </span>
              <span className="block text-xs text-muted-foreground">
                {SECTION_HINTS[section.key]}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                section.enabled
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200"
              )}
            >
              {section.enabled ? "Visível" : "Oculta"}
            </span>
          </summary>

          <div className="space-y-3 border-t border-[#eef5f6] px-4 py-3">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#347796]"
                checked={section.enabled}
                onChange={(event) =>
                  updateSection(sectionIndex, { ...section, enabled: event.target.checked })
                }
              />
              Exibir esta seção na página pública
            </label>

            {section.entries.map((entry, entryIndex) => (
              <div key={entry.tempKey} className="rounded-md border border-[#eef5f6] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Item {entryIndex + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Mover para cima"
                      disabled={entryIndex === 0}
                      onClick={() => updateSection(sectionIndex, moveEntry(section, entryIndex, -1))}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Mover para baixo"
                      disabled={entryIndex === section.entries.length - 1}
                      onClick={() => updateSection(sectionIndex, moveEntry(section, entryIndex, 1))}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={entry.isVisible ? "Ocultar item" : "Mostrar item"}
                      onClick={() =>
                        updateSection(sectionIndex, {
                          ...section,
                          entries: section.entries.map((item, position) =>
                            position === entryIndex ? { ...item, isVisible: !item.isVisible } : item
                          ),
                        })
                      }
                    >
                      {entry.isVisible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() => updateSection(sectionIndex, removeEntry(section, entryIndex))}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`${entry.tempKey}-title`}>Título</Label>
                    <Input
                      id={`${entry.tempKey}-title`}
                      value={isEnglish ? entry.titleEn : entry.titlePt}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          ...section,
                          entries: section.entries.map((item, position) =>
                            position === entryIndex
                              ? isEnglish
                                ? { ...item, titleEn: event.target.value }
                                : { ...item, titlePt: event.target.value }
                              : item
                          ),
                        })
                      }
                    />
                    {isEnglish && !entry.titleEn.trim() && entry.titlePt.trim() && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Vazio — a página mostra:{" "}
                        <span className="italic text-foreground">{entry.titlePt}</span>
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`${entry.tempKey}-subtitle`}>Subtítulo</Label>
                      <Input
                        id={`${entry.tempKey}-subtitle`}
                        value={isEnglish ? entry.subtitleEn : entry.subtitlePt}
                        onChange={(event) =>
                          updateSection(sectionIndex, {
                            ...section,
                            entries: section.entries.map((item, position) =>
                              position === entryIndex
                                ? isEnglish
                                  ? { ...item, subtitleEn: event.target.value }
                                  : { ...item, subtitlePt: event.target.value }
                                : item
                            ),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${entry.tempKey}-date`}>Data (opcional)</Label>
                      <Input
                        id={`${entry.tempKey}-date`}
                        type="date"
                        value={entry.occurredOn}
                        onChange={(event) =>
                          updateSection(sectionIndex, {
                            ...section,
                            entries: section.entries.map((item, position) =>
                              position === entryIndex
                                ? { ...item, occurredOn: event.target.value }
                                : item
                            ),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`${entry.tempKey}-description`}>Descrição</Label>
                    <Textarea
                      id={`${entry.tempKey}-description`}
                      rows={2}
                      value={isEnglish ? entry.descriptionEn : entry.descriptionPt}
                      onChange={(event) =>
                        updateSection(sectionIndex, {
                          ...section,
                          entries: section.entries.map((item, position) =>
                            position === entryIndex
                              ? isEnglish
                                ? { ...item, descriptionEn: event.target.value }
                                : { ...item, descriptionPt: event.target.value }
                              : item
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                updateSection(sectionIndex, {
                  ...section,
                  entries: [...section.entries, createEmptyEntry()],
                })
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar item
            </Button>
          </div>
        </details>
      ))}
    </section>
  );
}
