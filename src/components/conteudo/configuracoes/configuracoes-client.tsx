"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, AtSign, BrainCircuit, CheckCircle2, Gauge, Loader2, PenTool, Rss } from "lucide-react";
import { ConfigReferencias } from "./config-referencias";
import { Button } from "@/components/ui/button";
import type { ContentTopic } from "@/lib/content-topics";
import type { ContentFetchRun } from "@/lib/content-roteiros";
import type { LearningSnapshot, SourceStats } from "@/lib/content-generator/learning";
import type { GeneratorSettings } from "@/lib/content-generator/settings";
import { cn } from "@/lib/utils";
import { ConfigAprendizado } from "./config-aprendizado";
import { ConfigFontes } from "./config-fontes";
import { ConfigBusca, ConfigTexto } from "./config-regras";

type TabId = "aprendizado" | "referencias" | "fontes" | "texto" | "busca";

const TABS: { id: TabId; label: string; icon: typeof Rss }[] = [
  { id: "aprendizado", label: "Aprendizado", icon: BrainCircuit },
  { id: "referencias", label: "Referências", icon: AtSign },
  { id: "texto", label: "Texto da IA", icon: PenTool },
  { id: "fontes", label: "Fontes", icon: Rss },
  { id: "busca", label: "Busca", icon: Gauge },
];

type HistoryEntry = Pick<LearningSnapshot, "id" | "createdAt" | "trigger" | "createdByName" | "postsAnalyzed" | "choicesAnalyzed" | "editsAnalyzed">;

interface ConfigPayload {
  settings: GeneratorSettings;
  learning: LearningSnapshot | null;
  history: HistoryEntry[];
  topics: ContentTopic[];
  sources: SourceStats[];
  runs: ContentFetchRun[];
  sourcesWindowDays: number;
}

const SETTINGS_FIELDS: (keyof GeneratorSettings)[] = [
  "voiceInstructions",
  "slideCount",
  "defaultCta",
  "avoidRules",
  "minRelevance",
  "maxPerRun",
  "useLearning",
  "areaGuidelines",
];

export function ConfiguracoesClient() {
  const [data, setData] = useState<ConfigPayload | null>(null);
  const [draft, setDraft] = useState<GeneratorSettings | null>(null);
  const [tab, setTab] = useState<TabId>("aprendizado");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (keepDraft = false) => {
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros/configuracoes", { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Não foi possível carregar as configurações.");
      setData(payload as ConfigPayload);
      if (!keepDraft) setDraft((payload as ConfigPayload).settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    // JSON: a linha editorial é um objeto (comparar referência marcaria alteração à toa).
    () => Boolean(data && draft && SETTINGS_FIELDS.some((field) => JSON.stringify(data.settings[field]) !== JSON.stringify(draft[field]))),
    [data, draft],
  );

  const patchDraft = (patch: Partial<GeneratorSettings>) => {
    setNotice(null);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const save = async (override?: Partial<GeneratorSettings>) => {
    const next = draft ? { ...draft, ...override } : null;
    if (!next) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros/configuracoes", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, next[field]]))),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Não foi possível salvar.");
      const saved = payload.settings as GeneratorSettings;
      setData((prev) => (prev ? { ...prev, settings: saved } : prev));
      setDraft(saved);
      setNotice("Configurações salvas. Valem a partir da próxima busca.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const refreshLearning = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/content-roteiros/aprendizado", { method: "POST", credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? "Não foi possível atualizar o aprendizado.");
      await load(true);
      setNotice("Aprendizado atualizado. A próxima busca e o Refazer com IA já usam a versão nova.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o aprendizado.");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 py-24 text-slate-500">
        <Loader2 className="size-7 animate-spin" aria-hidden />
        <p className="text-sm">Carregando configurações…</p>
      </div>
    );
  }

  return (
    <div className={cn("mx-auto max-w-6xl space-y-4", dirty ? "pb-24" : "pb-8")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-[#dce9eb] bg-white p-1" role="tablist" aria-label="Seções das configurações">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={tab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                tab === option.id ? "bg-[#347796] text-white" : "text-slate-600 hover:bg-[#f4fafb] hover:text-slate-900",
              )}
            >
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>
        {data?.settings.updatedAt && data.settings.updatedByName ? (
          <p className="text-xs text-slate-500">
            Regras salvas em {format(new Date(data.settings.updatedAt), "dd/MM/yyyy 'às' HH:mm")} por {data.settings.updatedByName}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Usando as regras padrão do sistema</p>
        )}
      </div>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          <span>{notice}</span>
        </div>
      ) : null}

      {data && draft ? (
        <div role="tabpanel">
          {tab === "aprendizado" ? (
            <ConfigAprendizado
              learning={data.learning}
              history={data.history}
              useLearning={draft.useLearning}
              onToggleUseLearning={(value) => void save({ useLearning: value })}
              refreshing={refreshing}
              onRefresh={() => void refreshLearning()}
            />
          ) : null}
          {tab === "referencias" ? <ConfigReferencias /> : null}
          {tab === "fontes" ? (
            <ConfigFontes topics={data.topics} sources={data.sources} windowDays={data.sourcesWindowDays} onSaved={() => void load(true)} />
          ) : null}
          {tab === "texto" ? <ConfigTexto settings={draft} onChange={patchDraft} /> : null}
          {tab === "busca" ? <ConfigBusca settings={draft} onChange={patchDraft} runs={data.runs} /> : null}
        </div>
      ) : null}

      {dirty ? (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-4 md:left-[72px]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-lg border border-[#dce9eb] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(4,32,47,0.12)]">
            <p className="text-sm text-slate-700">Você tem alterações sem salvar.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(data?.settings ?? null)} disabled={saving}>
                Descartar
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
