"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Gauge, History, PenTool, Target } from "lucide-react";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import { LEGAL_AREAS } from "@/lib/content-areas";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_AVOID, DEFAULT_CTA, DEFAULT_VOICE, type GeneratorSettings } from "@/lib/content-generator/settings";
import type { ContentFetchRun } from "@/lib/content-roteiros";
import { cn } from "@/lib/utils";
import { ConfigSection, FieldLabel } from "./config-ui";

type Patch = (patch: Partial<GeneratorSettings>) => void;

/** Linha editorial por área: o nível em que o escritório quer estar em cada área. */
function LinhaEditorial({ settings, onChange }: { settings: GeneratorSettings; onChange: Patch }) {
  return (
    <ConfigSection
      icon={Target}
      title="Linha editorial por área"
      description="Para quem escrevemos e em que nível. Vale mais que o aprendizado: se a área pede domínio técnico, a IA não explica o básico, mesmo que posts didáticos tenham engajado. Também entra na nota de potencial."
    >
      <div className="space-y-4">
        {LEGAL_AREAS.map((area) => (
          <div key={area} className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
            <label htmlFor={`linha-${area}`} className="flex items-start gap-2 pt-2 text-sm font-medium text-slate-900">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded ring-1", getAreaIconStyle(area))}>
                <AreaIcon area={area} className="size-3.5" aria-hidden />
              </span>
              {area}
            </label>
            <Textarea
              id={`linha-${area}`}
              rows={settings.areaGuidelines[area] ? 4 : 2}
              value={settings.areaGuidelines[area] ?? ""}
              placeholder="Sem linha própria: segue o tom geral. Ex.: público, o que não precisa explicar, que tipo de análise mostra domínio."
              onChange={(event) => onChange({ areaGuidelines: { ...settings.areaGuidelines, [area]: event.target.value } })}
            />
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

/** Aba "Texto da IA": tom, número de slides, chamada final e o que evitar. */
export function ConfigTexto({ settings, onChange }: { settings: GeneratorSettings; onChange: Patch }) {
  return (
    <div className="space-y-4">
    <LinhaEditorial settings={settings} onChange={onChange} />
    <ConfigSection
      icon={PenTool}
      title="Como a IA escreve o carrossel"
      description="Campo vazio usa o padrão do sistema (mostrado em cinza). Além destas regras, a IA recebe o aprendizado da área."
    >
      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="ia-tom" hint="Como o escritório fala com o público: nível de formalidade, foco, tamanho das frases.">
            Tom de voz
          </FieldLabel>
          <Textarea
            id="ia-tom"
            rows={4}
            value={settings.voiceInstructions}
            placeholder={DEFAULT_VOICE}
            onChange={(e) => onChange({ voiceInstructions: e.target.value })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div>
            <FieldLabel hint="Capa e slide final incluídos.">Número de slides</FieldLabel>
            <Select value={String(settings.slideCount)} onValueChange={(value) => onChange({ slideCount: Number(value) })}>
              <SelectTrigger className="h-10 w-full text-sm" aria-label="Número de slides">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} slides
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="ia-cta" hint="Frase que fecha o último slide.">
              Chamada final
            </FieldLabel>
            <Input id="ia-cta" value={settings.defaultCta} placeholder={DEFAULT_CTA} onChange={(e) => onChange({ defaultCta: e.target.value })} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="ia-evitar" hint="Regras que a IA nunca pode quebrar.">
            O que evitar
          </FieldLabel>
          <Textarea
            id="ia-evitar"
            rows={3}
            value={settings.avoidRules}
            placeholder={DEFAULT_AVOID}
            onChange={(e) => onChange({ avoidRules: e.target.value })}
          />
        </div>
      </div>
    </ConfigSection>
    </div>
  );
}

/** Aba "Busca": nota mínima, carrosséis por busca e as últimas execuções. */
export function ConfigBusca({
  settings,
  onChange,
  runs,
}: {
  settings: GeneratorSettings;
  onChange: Patch;
  runs: ContentFetchRun[];
}) {
  const lastRun = runs[0];
  return (
    <div className="space-y-4">
      <ConfigSection
        icon={Gauge}
        title="Filtro antes de escrever"
        description="Cada notícia recebe uma nota de 0 a 10 de potencial (impacto, novidade, área e o que engaja). Só as que passam viram carrossel; as outras nem gastam IA."
      >
        <div className="space-y-5">
          <div>
            <FieldLabel hint="Quanto maior, menos matérias e mais fortes.">Nota mínima para virar carrossel</FieldLabel>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Nota mínima">
              {Array.from({ length: 11 }, (_, score) => (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={settings.minRelevance === score}
                  onClick={() => onChange({ minRelevance: score })}
                  className={cn(
                    "size-10 rounded-md border text-sm font-semibold tabular-nums transition-colors",
                    settings.minRelevance === score
                      ? "border-[#347796] bg-[#347796] text-white"
                      : score < settings.minRelevance
                        ? "border-[#eef4f5] bg-[#f7fbfc] text-slate-400"
                        : "border-[#dce9eb] bg-white text-slate-700 hover:bg-[#47cdd0]/10",
                  )}
                >
                  {score}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {settings.minRelevance === 0
                ? "Sem filtro: toda notícia da área vira carrossel."
                : `Notícias com nota abaixo de ${settings.minRelevance} ficam de fora.`}
              {lastRun ? ` Na última busca: ${lastRun.created} viraram carrossel e ${lastRun.low_score ?? 0} ficaram abaixo da nota.` : ""}
            </p>
          </div>
          <div className="max-w-xs">
            <FieldLabel htmlFor="busca-max" hint="Limite por execução, somando todas as fontes.">
              Carrosséis por busca
            </FieldLabel>
            <Input
              id="busca-max"
              type="number"
              min={1}
              max={40}
              value={settings.maxPerRun}
              onChange={(e) => onChange({ maxPerRun: Number(e.target.value) })}
            />
          </div>
        </div>
      </ConfigSection>

      <ConfigSection icon={History} title="Últimas buscas" description="A automática roda todo dia pelo agendador; a manual sai do botão Buscar notícias.">
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma busca registrada.</p>
        ) : (
          <ul className="-mx-4 divide-y divide-[#eef4f5] sm:-mx-5">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-sm text-slate-800">
                  {format(new Date(run.started_at), "dd/MM 'às' HH:mm")}
                  <span className="text-slate-500">
                    {" "}
                    · {run.trigger === "manual" ? "manual" : "automática"} ·{" "}
                    {formatDistanceToNow(new Date(run.started_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>
                    <strong className="font-semibold text-slate-900">{run.created}</strong> carrosséis
                  </span>
                  <span>{run.low_score ?? 0} abaixo da nota</span>
                  <span>{run.skipped} repetidas ou fora do perfil</span>
                  {run.error_count > 0 ? (
                    <span className="text-red-700" title={(run.errors ?? []).slice(0, 5).join("\n")}>
                      {run.error_count} com erro
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ConfigSection>
    </div>
  );
}
