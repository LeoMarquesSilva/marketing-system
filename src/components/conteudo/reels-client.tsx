"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock3,
  Copy,
  Download,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  buildReelWordHtml,
  REELS_DEFAULT_CTA,
  reelWordSlug,
  type ReelScript,
} from "@/lib/reels-script";
import {
  getLegalAreasForDepartment,
  isContentManager,
  LEGAL_AREAS,
} from "@/lib/content-areas";
import type { RoteiroItem } from "@/components/conteudo/roteiro-card";
import { ReelStudioClient } from "@/components/conteudo/reel-studio-client";

const DURATIONS = [45, 60, 75, 90] as const;
const DEFAULT_AUDIENCE = "Empresários, sócios e gestores que tomam decisões de negócio";
const AUDIENCE_PRESETS = [
  DEFAULT_AUDIENCE,
  "Diretores financeiros e gestores de risco",
  "Lideranças de RH e gestores de pessoas",
  "Produtores rurais e gestores do agronegócio",
] as const;

type ReelForm = {
  area_juridica: string;
  tema: string;
  publico_alvo: string;
  texto_original: string;
  duracao_desejada_segundos: number;
  cta_desejado: string;
  informacoes_obrigatorias: string;
  informacoes_que_exigem_validacao: string;
  restricoes_adicionais: string;
};

const INITIAL_FORM: ReelForm = {
  area_juridica: "",
  tema: "",
  publico_alvo: DEFAULT_AUDIENCE,
  texto_original: "",
  duracao_desejada_segundos: 60,
  cta_desejado: REELS_DEFAULT_CTA,
  informacoes_obrigatorias: "",
  informacoes_que_exigem_validacao: "",
  restricoes_adicionais: "",
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ScriptBlock({ label, content }: { label: string; content: string }) {
  return (
    <section className="border-t border-black/[0.07] py-5 first:border-t-0 first:pt-0">
      <p className="mb-2 text-xs font-semibold text-[#347796]">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">{content}</p>
    </section>
  );
}

function NewsSourcePicker({
  items,
  value,
  loading,
  onValueChange,
  onRefresh,
}: {
  items: RoteiroItem[];
  value: string;
  loading: boolean;
  onValueChange: (value: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === value);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return items;

    return items.filter((item) =>
      [item.title, item.area, item.content_snippet, item.post]
        .filter(Boolean)
        .some((field) => field?.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    );
  }, [items, query]);

  const selectNews = (id: string) => {
    onValueChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/70">Notícia de referência</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8ae5e6] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </button>
      </div>

      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex min-h-16 w-full items-center justify-between gap-3 border border-white/20 bg-white px-3.5 py-3 text-left text-[#04202f] shadow-sm transition-colors hover:border-[#47cdd0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
          >
            {selected ? (
              <span className="min-w-0">
                <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-[#347796]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#47cdd0]" aria-hidden />
                  {selected.area}
                </span>
                <span className="block truncate text-sm font-semibold">{selected.title}</span>
              </span>
            ) : (
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Selecione uma notícia</span>
                <span className="mt-1 block text-xs text-[#52717e]">
                  Pesquise por título ou área jurídica
                </span>
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-[#347796]" aria-hidden />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[320px] overflow-hidden border border-black/[0.12] bg-white shadow-[0_18px_44px_rgba(4,32,47,0.18)]"
            align="start"
            sideOffset={6}
          >
            <div className="border-b border-black/[0.08] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52717e]" aria-hidden />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar notícia ou área..."
                  className="h-9 border-black/[0.12] pl-9"
                />
              </div>
            </div>
            <ul className="max-h-80 overflow-y-auto p-1.5" aria-label="Notícias disponíveis">
              {loading ? (
                <li className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando notícias
                </li>
              ) : filteredItems.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma notícia encontrada.
                </li>
              ) : (
                filteredItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectNews(item.id)}
                      className={cn(
                        "w-full border border-transparent px-3 py-3 text-left transition-colors hover:border-[#47cdd0]/45 hover:bg-[#f4fbfb]",
                        value === item.id && "border-[#47cdd0]/60 bg-[#f4fbfb]"
                      )}
                    >
                      <span className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold">
                        <span className="truncate text-[#347796]">{item.area}</span>
                        {value === item.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#347796]" aria-label="Selecionada" />}
                      </span>
                      <span className="line-clamp-2 block text-sm font-semibold leading-5 text-[#04202f]">
                        {item.title}
                      </span>
                      {(item.content_snippet || item.post) && (
                        <span className="mt-1.5 line-clamp-2 block text-xs leading-5 text-[#52717e]">
                          {item.content_snippet || item.post}
                        </span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="border-t border-black/[0.08] px-3 py-2 text-xs text-muted-foreground">
              {filteredItems.length} {filteredItems.length === 1 ? "notícia disponível" : "notícias disponíveis"}
            </p>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}

export function ReelsClient() {
  const [activeView, setActiveView] = useState<"generator" | "studio">("generator");

  return (
    <div className="space-y-6">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 border-b border-black/[0.08]" aria-label="Visões de Reels">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "generator"}
          onClick={() => setActiveView("generator")}
          className={cn(
            "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
            activeView === "generator"
              ? "border-[#347796] text-[#04202f]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Criar roteiro
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "studio"}
          onClick={() => setActiveView("studio")}
          className={cn(
            "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
            activeView === "studio"
              ? "border-[#347796] text-[#04202f]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Clapperboard className="h-4 w-4" aria-hidden />
          Estúdio mensal
        </button>
      </nav>
      {activeView === "studio" ? <ReelStudioClient /> : <ReelScriptGenerator />}
    </div>
  );
}

function ReelScriptGenerator() {
  const { profile } = useAuth();
  const [form, setForm] = useState<ReelForm>(INITIAL_FORM);
  const [script, setScript] = useState<ReelScript | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newsItems, setNewsItems] = useState<RoteiroItem[]>([]);
  const [selectedNewsId, setSelectedNewsId] = useState("");
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsLoaded, setNewsLoaded] = useState(false);

  const availableAreas = useMemo(() => {
    if (isContentManager(profile)) return [...LEGAL_AREAS];
    const userAreas = getLegalAreasForDepartment(profile?.department ?? "");
    return userAreas.length > 0 ? userAreas : [...LEGAL_AREAS];
  }, [profile]);

  const selectedArea = form.area_juridica || availableAreas[0] || "";
  const selectedNews = newsItems.find((item) => item.id === selectedNewsId);

  const updateForm = <K extends keyof ReelForm>(field: K, value: ReelForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const loadNews = useCallback(async () => {
    setLoadingNews(true);
    setError(null);

    try {
      const response = await fetch("/api/content-roteiros", { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível carregar as notícias.");
      }

      setNewsItems(Array.isArray(data) ? (data as RoteiroItem[]) : []);
      setNewsLoaded(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar as notícias."
      );
    } finally {
      setLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const useNewsAsSource = (newsId: string) => {
    setSelectedNewsId(newsId);
    const news = newsItems.find((item) => item.id === newsId);
    if (!news) return;

    const reference = [
      "NOTÍCIA SELECIONADA",
      `Título: ${news.title}`,
      news.link ? `Link de origem: ${news.link}` : "",
      news.content_snippet ? `Resumo da notícia:\n${news.content_snippet}` : "",
      news.post ? `Post já elaborado a partir da notícia:\n${news.post}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    setForm((current) => ({
      ...current,
      area_juridica: news.area || current.area_juridica,
      tema: news.title || current.tema,
      texto_original: reference,
    }));
    setScript(null);
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/content-reels", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area_juridica: selectedArea,
          tema: form.tema,
          publico_alvo: form.publico_alvo,
          texto_original: form.texto_original,
          duracao_desejada_segundos: form.duracao_desejada_segundos,
          cta_desejado: form.cta_desejado,
          informacoes_obrigatorias: splitLines(form.informacoes_obrigatorias),
          informacoes_que_exigem_validacao: splitLines(form.informacoes_que_exigem_validacao),
          restricoes_adicionais: splitLines(form.restricoes_adicionais),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível gerar o roteiro.");
      }

      setScript(data.script as ReelScript);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível gerar o roteiro."
      );
    } finally {
      setGenerating(false);
    }
  };

  const copyScript = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script.roteiro_completo);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const downloadWord = () => {
    if (!script) return;
    const html = buildReelWordHtml({
      title: form.tema,
      area: selectedArea,
      audience: form.publico_alvo,
      desiredDuration: form.duracao_desejada_segundos,
      script,
    });
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `reel-${reelWordSlug(form.tema)}.doc`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      <section className="flex flex-col gap-4 border-b border-black/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[#347796]">
            <Clapperboard className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold">Conteúdo em vídeo</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Roteiro de Reel</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conteúdo jurídico de autoridade para abrir conversas com empresários e gerar oportunidades reais.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BriefcaseBusiness className="h-4 w-4 text-[#347796]" aria-hidden />
          Foco em decisão de negócio
        </div>
      </section>

      <section className="border-y border-[#47cdd0]/30 bg-[#04202f] px-5 py-6 text-white sm:px-7" aria-label="Escolha da fonte">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold text-[#8ae5e6]">01 / ESCOLHA A BASE</p>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#47cdd0]/45 bg-white/5 text-[#8ae5e6]">
                <Newspaper className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-semibold">Comece por uma notícia já aprovada no fluxo.</h3>
                <p className="mt-1 max-w-xl text-sm leading-6 text-white/68">
                  O sistema aproveita o resumo e o post existente para transformar a pauta em uma conversa de negócio.
                </p>
              </div>
            </div>
          </div>
          <NewsSourcePicker
            items={newsItems}
            value={selectedNewsId}
            loading={loadingNews}
            onValueChange={useNewsAsSource}
            onRefresh={loadNews}
          />
        </div>
        {selectedNews && (
          <div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-white/65">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8ae5e6]" aria-hidden />
            Fonte selecionada. A área, o tema e o material de referência foram preenchidos abaixo.
          </div>
        )}
        {newsLoaded && newsItems.length === 0 && !loadingNews && (
          <p className="mt-5 border-t border-white/10 pt-4 text-sm text-white/65">
            Nenhuma notícia disponível para o seu perfil no momento. Você ainda pode usar um material manual abaixo.
          </p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-8" aria-label="Dados do roteiro">
          <section className="border-b border-black/[0.08] pb-8" aria-label="Direção do roteiro">
            <div className="mb-5">
              <p className="text-xs font-semibold text-[#347796]">02 / DEFINA A CONVERSA</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Fale com quem toma a decisão</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-foreground">
                Área jurídica
                <Select value={selectedArea} onValueChange={(value) => updateForm("area_juridica", value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAreas.map((area) => (
                      <SelectItem key={area} value={area}>
                        {area}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-2 text-sm font-medium text-foreground">
                Tema do Reel
                <Input
                  value={form.tema}
                  onChange={(event) => updateForm("tema", event.target.value)}
                  placeholder="Ex.: Riscos em contratos de fornecimento"
                  maxLength={240}
                />
              </label>
            </div>

            <fieldset className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-foreground">Público prioritário</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup">
                {AUDIENCE_PRESETS.map((audience) => {
                  const active = form.publico_alvo === audience;
                  return (
                    <button
                      key={audience}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => updateForm("publico_alvo", audience)}
                      className={cn(
                        "border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#347796]/45",
                        active
                          ? "border-[#347796] bg-[#347796] text-white"
                          : "border-black/[0.12] bg-white text-[#38525e] hover:border-[#347796]/45 hover:bg-[#f4fbfb]"
                      )}
                    >
                      {audience}
                    </button>
                  );
                })}
              </div>
              <Input
                value={form.publico_alvo}
                onChange={(event) => updateForm("publico_alvo", event.target.value)}
                placeholder="Descreva outro público"
                maxLength={240}
              />
            </fieldset>

            <div className="mt-6 grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-foreground">Duração</legend>
                <div className="inline-flex border border-black/[0.1] bg-black/[0.025] p-1" role="radiogroup">
                  {DURATIONS.map((duration) => {
                    const active = form.duracao_desejada_segundos === duration;
                    return (
                      <button
                        key={duration}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => updateForm("duracao_desejada_segundos", duration)}
                        className={cn(
                          "h-9 min-w-12 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#347796]/45",
                          active ? "bg-[#347796] text-white shadow-sm" : "text-muted-foreground hover:bg-white hover:text-foreground"
                        )}
                      >
                        {duration}s
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Convite final
                <Input
                  value={form.cta_desejado}
                  onChange={(event) => updateForm("cta_desejado", event.target.value)}
                  maxLength={500}
                />
              </label>
            </div>
          </section>

          <section className="border-b border-black/[0.08] pb-8" aria-label="Revisão do material">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#347796]">03 / REVISE A BASE</p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">Material que sustenta o roteiro</h3>
              </div>
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#347796]" aria-hidden />
            </div>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Conteúdo jurídico de referência
              <Textarea
                value={form.texto_original}
                onChange={(event) => updateForm("texto_original", event.target.value)}
                placeholder="Selecione uma notícia acima ou cole aqui o conteúdo já revisado pela área jurídica."
                className="min-h-64 resize-y leading-6"
                maxLength={24_000}
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {form.texto_original.length.toLocaleString("pt-BR")} de 24.000 caracteres
              </span>
            </label>
          </section>

          <details className="border-b border-black/[0.08] pb-6">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#38525e] marker:hidden">
              <span className="flex items-center justify-between gap-3">
                Ajustes jurídicos adicionais
                <ChevronDown className="h-4 w-4 text-[#347796]" aria-hidden />
              </span>
            </summary>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-foreground">
                Informações obrigatórias
                <Textarea
                  value={form.informacoes_obrigatorias}
                  onChange={(event) => updateForm("informacoes_obrigatorias", event.target.value)}
                  placeholder="Uma informação por linha"
                  className="min-h-28 resize-y"
                  maxLength={10_000}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-foreground">
                Pontos para validação
                <Textarea
                  value={form.informacoes_que_exigem_validacao}
                  onChange={(event) => updateForm("informacoes_que_exigem_validacao", event.target.value)}
                  placeholder="Uma informação por linha"
                  className="min-h-28 resize-y"
                  maxLength={10_000}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-foreground sm:col-span-2">
                Restrições de linguagem ou conteúdo
                <Textarea
                  value={form.restricoes_adicionais}
                  onChange={(event) => updateForm("restricoes_adicionais", event.target.value)}
                  placeholder="Uma restrição por linha"
                  className="min-h-24 resize-y"
                  maxLength={10_000}
                />
              </label>
            </div>
          </details>

          {error && (
            <p className="flex items-start gap-2 border-l-2 border-red-500 px-3 py-1 text-sm text-red-700" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={generate}
              disabled={generating || form.tema.trim().length < 4 || form.texto_original.trim().length < 80 || form.publico_alvo.trim().length < 3}
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando roteiro" : "Gerar roteiro para captação"}
            </Button>
            {script && (
              <Button type="button" variant="ghost" onClick={generate} disabled={generating} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Gerar nova versão
              </Button>
            )}
          </div>
        </section>

        <aside className="h-fit border-y border-[#47cdd0]/35 bg-[#f4fbfb] px-5 py-6 lg:sticky lg:top-20" aria-label="Direção editorial">
          <div className="mb-5 flex items-center gap-2 text-[#347796]">
            <Target className="h-4 w-4" aria-hidden />
            <span className="text-sm font-semibold">Objetivo do roteiro</span>
          </div>
          <p className="text-sm leading-6 text-[#38525e]">
            Mostrar o impacto jurídico na operação e conduzir o empresário a uma conversa qualificada.
          </p>
          <dl className="mt-6 space-y-4 border-t border-[#347796]/15 pt-5 text-sm">
            <div>
              <dt className="font-medium text-foreground">Tom</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">Direto, seguro e útil para quem decide.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Captação responsável</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">Convite à conversa, sem prometer resultado.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Base jurídica</dt>
              <dd className="mt-1 leading-6 text-muted-foreground">Somente fatos do material revisado.</dd>
            </div>
          </dl>
        </aside>
      </div>

      {script && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="border border-black/[0.1] bg-white shadow-[0_12px_32px_rgba(4,32,47,0.08)]"
          aria-label="Roteiro gerado"
        >
          <div className="flex flex-col gap-4 border-b border-black/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#04202f] text-[#47cdd0]">
                <Clapperboard className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-foreground">{form.tema}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  Estimativa de {script.duracao_estimada_segundos} segundos
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyScript} className="gap-2">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar roteiro"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadWord} className="gap-2">
                <Download className="h-4 w-4" />
                Baixar Word
              </Button>
            </div>
          </div>

          <div className="grid divide-y divide-black/[0.07] lg:grid-cols-[minmax(0,1fr)_320px] lg:divide-x lg:divide-y-0">
            <div className="px-5 py-6">
              <p className="mb-3 text-xs font-semibold text-[#347796]">Texto para gravação</p>
              <p className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">{script.roteiro_completo}</p>
            </div>
            <div className="px-5 py-6">
              <ScriptBlock label="Gancho" content={script.gancho} />
              <ScriptBlock label="Desenvolvimento" content={script.desenvolvimento} />
              <ScriptBlock label="Encerramento" content={script.encerramento} />
            </div>
          </div>

          <div className="grid divide-y divide-black/[0.07] border-t border-black/[0.07] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <section className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <h3 className="text-sm font-semibold">Pontos para validação jurídica</h3>
              </div>
              {script.pontos_para_validacao_juridica.length > 0 ? (
                <ul className="space-y-2 text-sm leading-6 text-foreground/80">
                  {script.pontos_para_validacao_juridica.map((point, index) => (
                    <li key={`${point}-${index}`} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">Nenhum ponto adicional indicado.</p>
              )}
            </section>
            <section className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2 text-[#347796]">
                <Check className="h-4 w-4" aria-hidden />
                <h3 className="text-sm font-semibold">Alterações de redação</h3>
              </div>
              {script.alteracoes_realizadas.length > 0 ? (
                <ul className="space-y-2 text-sm leading-6 text-foreground/80">
                  {script.alteracoes_realizadas.map((change, index) => (
                    <li key={`${change}-${index}`} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#47cdd0]" aria-hidden />
                      {change}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">Nenhuma alteração registrada.</p>
              )}
            </section>
          </div>
        </motion.section>
      )}
    </div>
  );
}
