"use client";

import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, ExternalLink, Loader2, Pencil, Plus, Rss, Search, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaTag } from "@/components/conteudo/escolhas-visuals";
import type { ContentTopic } from "@/lib/content-topics";
import { isWeakSource, type SourceStats } from "@/lib/content-generator/learning";
import { TOPIC_AREAS, topicKind } from "@/lib/content-generator/topics";
import { cn } from "@/lib/utils";
import { ConfigSection, FieldLabel, Toggle } from "./config-ui";

type Draft = {
  id: string | null;
  name: string;
  kind: "feed" | "google";
  rss_query: string;
  legal_area: string;
  months_back: number;
  item_limit: number;
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  name: "",
  kind: "google",
  rss_query: "",
  legal_area: "Geral",
  months_back: 2,
  item_limit: 15,
  is_active: true,
};

type TestResult = { total: number; usable: number; items: { title: string; link: string | null; date: string | null }[] };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ConfigFontes({
  topics,
  sources,
  windowDays,
  onSaved,
}: {
  topics: ContentTopic[];
  sources: SourceStats[];
  windowDays: number;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const statsById = new Map(sources.map((source) => [source.topicId, source]));
  const ordered = [...topics].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      (statsById.get(b.id)?.chooseRate ?? 0) - (statsById.get(a.id)?.chooseRate ?? 0) ||
      a.name.localeCompare(b.name, "pt-BR"),
  );
  const activeCount = topics.filter((topic) => topic.is_active).length;

  const openDraft = (topic?: ContentTopic) => {
    setError(null);
    setTest(null);
    setDraft(
      topic
        ? {
            id: topic.id,
            name: topic.name,
            kind: topicKind(topic.rss_query),
            rss_query: topic.rss_query,
            legal_area: (TOPIC_AREAS as readonly string[]).includes(topic.legal_area) ? topic.legal_area : "Geral",
            months_back: topic.months_back,
            item_limit: topic.item_limit,
            is_active: topic.is_active,
          }
        : { ...EMPTY_DRAFT },
    );
  };

  const toggleActive = async (topic: ContentTopic) => {
    setToggling(topic.id);
    try {
      const res = await fetch(`/api/content-topics/${topic.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !topic.is_active }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Não foi possível salvar.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setToggling(null);
    }
  };

  const runTest = async () => {
    if (!draft) return;
    setTesting(true);
    setError(null);
    setTest(null);
    try {
      const res = await fetch("/api/content-topics/testar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rss_query: draft.rss_query, months_back: draft.months_back }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível ler a fonte.");
      setTest(data as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler a fonte.");
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: draft.name,
        rss_query: draft.rss_query,
        legal_area: draft.legal_area,
        months_back: draft.months_back,
        item_limit: draft.item_limit,
        is_active: draft.is_active,
      };
      const res = await fetch(draft.id ? `/api/content-topics/${draft.id}` : "/api/content-topics", {
        method: draft.id ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar a fonte.");
      setDraft(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a fonte.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ConfigSection
        icon={Rss}
        title={`Fontes de notícias · ${activeCount} ativas`}
        description={`Desempenho nos últimos ${windowDays} dias: quantas matérias cada fonte gerou e quantas a equipe escolheu.`}
        action={
          <Button size="sm" onClick={() => openDraft()}>
            <Plus className="size-4" aria-hidden />
            Nova fonte
          </Button>
        }
      >
        {error && !draft ? (
          <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        <ul className="-mx-4 divide-y divide-[#eef4f5] sm:-mx-5">
          {ordered.map((topic) => {
            const stats = statsById.get(topic.id);
            const kind = topicKind(topic.rss_query);
            const weak = stats ? isWeakSource(stats) : false;
            return (
              <li key={topic.id} className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5", !topic.is_active && "opacity-60")}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-[#eaf2f5] text-[#285f7a]">
                    {kind === "feed" ? <Rss className="size-4" aria-hidden /> : <Search className="size-4" aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
                      {topic.name}
                      {!topic.is_active ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Pausada</span> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {topic.legal_area === "Geral" ? <span>Todas as áreas</span> : <AreaTag area={topic.legal_area} />}
                      <span>· {kind === "feed" ? `Feed direto de ${hostOf(topic.rss_query)}` : "Busca no Google Notícias"}</span>
                    </p>
                    {weak ? (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        Gerou {stats?.generated} e ninguém escolheu: vale pausar ou ajustar?
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-4 pl-12 sm:pl-0">
                  <div className="grid grid-cols-3 gap-4 text-right">
                    <Stat label="geradas" value={stats?.generated ?? 0} />
                    <Stat label="escolhidas" value={stats?.chosen ?? 0} />
                    <Stat label="taxa" value={`${(stats?.chooseRate ?? 0).toFixed(stats && stats.chooseRate % 1 ? 1 : 0)}%`} />
                  </div>
                  <Toggle
                    checked={topic.is_active}
                    disabled={toggling === topic.id}
                    onChange={() => void toggleActive(topic)}
                    label={topic.is_active ? `Pausar ${topic.name}` : `Ativar ${topic.name}`}
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => openDraft(topic)} aria-label={`Editar ${topic.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </ConfigSection>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {draft ? (
            <>
              <div className="border-b border-[#eef4f5] px-5 py-4 pr-12">
                <DialogTitle className="text-base font-semibold">{draft.id ? "Editar fonte" : "Nova fonte"}</DialogTitle>
                <DialogDescription className="mt-1 text-sm">Teste antes de salvar para ver que notícias ela traz.</DialogDescription>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div>
                  <FieldLabel htmlFor="fonte-nome">Nome</FieldLabel>
                  <Input id="fonte-nome" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Migalhas (feed direto)" />
                </div>
                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de fonte">
                    {(
                      [
                        { id: "google", label: "Busca no Google Notícias", icon: Search, hint: "Termos com OR, aspas e -exclusões" },
                        { id: "feed", label: "Feed direto do veículo", icon: Rss, hint: "Endereço RSS (https://…/feed)" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={draft.kind === option.id}
                        onClick={() => setDraft({ ...draft, kind: option.id })}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
                          draft.kind === option.id ? "border-[#347796] bg-[#f2f9fb]" : "border-[#dce9eb] hover:bg-[#f7fbfc]",
                        )}
                      >
                        <option.icon className="mt-0.5 size-4 shrink-0 text-[#347796]" aria-hidden />
                        <span>
                          <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                          <span className="block text-xs text-slate-500">{option.hint}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="fonte-query" hint={draft.kind === "google" ? 'Ex.: ("recuperação judicial" OR falência) -"polícia"' : "Ex.: https://www.migalhas.com.br/rss/quentes"}>
                    {draft.kind === "google" ? "Termos de busca" : "Endereço do feed"}
                  </FieldLabel>
                  <Textarea
                    id="fonte-query"
                    rows={draft.kind === "google" ? 3 : 1}
                    value={draft.rss_query}
                    onChange={(e) => setDraft({ ...draft, rss_query: e.target.value })}
                    className="font-mono text-[13px]"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Área</FieldLabel>
                    <Select value={draft.legal_area} onValueChange={(value) => setDraft({ ...draft, legal_area: value })}>
                      <SelectTrigger className="h-10 w-full text-sm" aria-label="Área">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOPIC_AREAS.map((area) => (
                          <SelectItem key={area} value={area}>
                            {area === "Geral" ? "Geral (a IA decide a área)" : area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="fonte-meses">Notícias de até (meses)</FieldLabel>
                    <Input id="fonte-meses" type="number" min={1} max={6} value={draft.months_back} onChange={(e) => setDraft({ ...draft, months_back: Number(e.target.value) })} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="fonte-limite">Lidas por busca</FieldLabel>
                    <Input id="fonte-limite" type="number" min={3} max={40} value={draft.item_limit} onChange={(e) => setDraft({ ...draft, item_limit: Number(e.target.value) })} />
                  </div>
                </div>

                {test ? (
                  <div className="rounded-md border border-[#dce9eb] bg-[#f7fbfc] p-3">
                    <p className="mb-2 text-sm font-medium text-slate-900">
                      {test.usable} notícias aproveitáveis de {test.total} lidas
                    </p>
                    {test.items.length === 0 ? (
                      <p className="text-sm text-slate-500">Nada dentro do período. Revise os termos ou aumente os meses.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {test.items.map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="w-12 shrink-0 text-xs tabular-nums text-slate-400">{item.date ? format(new Date(item.date), "dd/MM") : "—"}</span>
                            <a href={item.link ?? undefined} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-slate-700 hover:text-slate-900 hover:underline">
                              {item.title}
                            </a>
                            {item.link ? <ExternalLink className="mt-1 size-3 shrink-0 text-slate-400" aria-hidden /> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
                {error ? (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef4f5] px-5 py-3">
                <Button variant="outline" size="sm" onClick={() => void runTest()} disabled={testing || !draft.rss_query.trim()}>
                  {testing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <TestTube2 className="size-4" aria-hidden />}
                  Testar fonte
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => void save()} disabled={saving || !draft.name.trim() || !draft.rss_query.trim()}>
                    {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Salvar fonte
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <p>
      <span className="block text-sm font-semibold tabular-nums text-slate-900">{value}</span>
      <span className="block text-xs text-slate-500">{label}</span>
    </p>
  );
}
