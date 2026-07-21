"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clapperboard,
  Copy,
  ImageIcon,
  Loader2,
  MessageSquareText,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  currentReelMonth,
  formatReelMonth,
  type ReelStudioItem,
  type ReelStudioStatus,
} from "@/lib/reel-studio";

type Collaborator = {
  id: string;
  name: string;
  department: string | null;
  avatar_url: string | null;
};

const STATUS_COPY: Record<ReelStudioStatus, string> = {
  draft: "Aguardando curadoria",
  reviewed: "Revisado",
  teleprompter_ready: "No teleprompter",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function copyText(value: string) {
  return navigator.clipboard.writeText(value);
}

export function ReelStudioClient() {
  const [month, setMonth] = useState(currentReelMonth().slice(0, 7));
  const [items, setItems] = useState<ReelStudioItem[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", area: "", original_script: "" });

  const productionMonth = `${month}-01`;

  const loadStudio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reel-studio?month=${productionMonth}`, { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar a produção de Reels.");
      setItems(data.items ?? []);
      setCollaborators(data.collaborators ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar a produção de Reels.");
    } finally {
      setLoading(false);
    }
  }, [productionMonth]);

  useEffect(() => {
    void loadStudio();
  }, [loadStudio]);

  const filteredCollaborators = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return collaborators;
    return collaborators.filter((collaborator) =>
      `${collaborator.name} ${collaborator.department ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)
    );
  }, [collaborators, search]);

  const toggleCollaborator = (id: string) => {
    setSelectedCollaboratorIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const createItem = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/reel-studio", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          production_month: productionMonth,
          title: form.title,
          area: form.area || null,
          original_script: form.original_script,
          collaborator_ids: selectedCollaboratorIds,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível adicionar o roteiro à produção.");
      setForm({ title: "", area: "", original_script: "" });
      setSelectedCollaboratorIds([]);
      setSearch("");
      setNotice("Roteiro adicionado à produção do mês.");
      await loadStudio();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível adicionar o roteiro à produção.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item: ReelStudioItem, action: "refine" | "assets" | "cover" | "teleprompter") => {
    const key = `${item.id}:${action}`;
    setActiveAction(key);
    setError(null);
    setNotice(null);
    try {
      const endpoint =
        action === "refine"
          ? "/api/reel-studio/refine"
          : action === "assets"
            ? "/api/reel-studio/assets"
            : action === "cover"
              ? "/api/reel-studio/cover"
              : "/api/reel-studio";
      const response = await fetch(endpoint, {
        method: action === "teleprompter" ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "teleprompter" ? { id: item.id, status: "teleprompter_ready" } : { id: item.id }
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir esta etapa.");
      setNotice(
        action === "refine"
          ? "Roteiro refinado e pronto para sua revisão."
          : action === "assets"
            ? "Legenda e direção visual geradas."
            : action === "cover"
              ? "Capa gerada e salva no estúdio."
              : "Roteiro marcado como pronto para teleprompter."
      );
      await loadStudio();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível concluir esta etapa.");
    } finally {
      setActiveAction(null);
    }
  };

  const isValidDraft =
    form.title.trim().length >= 4 &&
    form.original_script.trim().length >= 80 &&
    selectedCollaboratorIds.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-8">
      <section className="flex flex-col gap-5 border-b border-black/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#347796]">
            <Clapperboard className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold">Produção editorial</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Estúdio de Reels</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Receba o roteiro, faça a curadoria e entregue uma pauta pronta para gravação, teleprompter e publicação.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-[#347796]" aria-hidden />
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 w-40 bg-white"
            aria-label="Mês da produção"
          />
        </label>
      </section>

      <section className="grid gap-5 border-y border-[#47cdd0]/30 bg-[#04202f] px-5 py-6 text-white lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold text-[#8ae5e6]">PLANEJAMENTO DE {formatReelMonth(productionMonth).toLocaleUpperCase("pt-BR")}</p>
          <p className="mt-2 text-lg font-semibold">{items.length} {items.length === 1 ? "roteiro em produção" : "roteiros em produção"}</p>
          <p className="mt-1 text-sm text-white/65">Organize a gravação por pessoa e mantenha todos os ativos no mesmo lugar.</p>
        </div>
        <div className="flex gap-5 text-sm">
          <div className="border-l border-white/15 pl-4">
            <p className="text-xl font-semibold text-[#8ae5e6]">{items.filter((item) => item.status === "teleprompter_ready").length}</p>
            <p className="text-white/60">no teleprompter</p>
          </div>
          <div className="border-l border-white/15 pl-4">
            <p className="text-xl font-semibold text-[#8ae5e6]">{new Set(items.flatMap((item) => item.assignees.map((assignee) => assignee.user_id))).size}</p>
            <p className="text-white/60">pessoas escaladas</p>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="h-fit border border-black/[0.1] bg-white p-5" aria-label="Novo roteiro de Reel">
          <div className="mb-5 flex items-center gap-2 text-[#347796]">
            <span className="flex h-8 w-8 items-center justify-center bg-[#04202f] text-[#8ae5e6]">
              <Plus className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Novo roteiro recebido</h3>
              <p className="text-xs text-muted-foreground">Adicione à escala antes de fazer a curadoria.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Tema do Reel
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Sócio pode responder por dívida da empresa?"
                maxLength={240}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Área jurídica
              <Input
                value={form.area}
                onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
                placeholder="Ex.: Societário e Contratos"
                maxLength={120}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-foreground">
              Roteiro enviado pelo advogado
              <Textarea
                value={form.original_script}
                onChange={(event) => setForm((current) => ({ ...current, original_script: event.target.value }))}
                placeholder="Cole aqui o texto recebido. A curadoria vai ajustar oralidade, clareza e convite final."
                className="min-h-48 resize-y leading-6"
                maxLength={24_000}
              />
            </label>

            <div className="border-y border-black/[0.08] py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <UsersRound className="h-4 w-4 text-[#347796]" aria-hidden />
                  Quem grava este roteiro?
                </div>
                <span className="text-xs text-muted-foreground">{selectedCollaboratorIds.length} selecionado(s)</span>
              </div>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar colaborador"
                  className="h-9 pl-9"
                />
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                {filteredCollaborators.map((collaborator) => {
                  const selected = selectedCollaboratorIds.includes(collaborator.id);
                  return (
                    <button
                      key={collaborator.id}
                      type="button"
                      onClick={() => toggleCollaborator(collaborator.id)}
                      className={cn(
                        "flex w-full items-center gap-2 border px-2.5 py-2 text-left transition-colors",
                        selected ? "border-[#347796] bg-[#f4fbfb]" : "border-transparent hover:bg-black/[0.035]"
                      )}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#04202f] text-[10px] font-semibold text-[#8ae5e6]">
                        {initials(collaborator.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{collaborator.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{collaborator.department}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-[#347796]" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="button" onClick={createItem} disabled={saving || !isValidDraft} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Adicionando à produção" : "Adicionar à produção"}
            </Button>
          </div>
        </section>

        <section aria-label="Escala mensal de Reels">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#347796]">ESCALA MENSAL</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Roteiros por pessoa e etapa</h3>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={loadStudio} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              Atualizar
            </Button>
          </div>

          {error && (
            <p className="mb-4 flex items-start gap-2 border-l-2 border-red-500 px-3 py-1 text-sm text-red-700" role="alert">
              <Target className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          {notice && (
            <p className="mb-4 flex items-start gap-2 border-l-2 border-[#47cdd0] px-3 py-1 text-sm text-[#38525e]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#347796]" aria-hidden />
              {notice}
            </p>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 border border-dashed border-black/[0.14] text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando produção
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-black/[0.14] px-6 text-center">
              <Clapperboard className="mb-3 h-6 w-6 text-[#347796]" aria-hidden />
              <p className="font-medium text-foreground">Nenhum roteiro escalado neste mês.</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">Comece colando o roteiro recebido e escolhendo quem vai gravar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const refined = item.refined_script || item.original_script;
                const refining = activeAction === `${item.id}:refine`;
                const creatingAssets = activeAction === `${item.id}:assets`;
                const creatingCover = activeAction === `${item.id}:cover`;
                const settingTeleprompter = activeAction === `${item.id}:teleprompter`;
                return (
                  <article key={item.id} className="border border-black/[0.1] bg-white">
                    <div className="flex flex-col gap-4 border-b border-black/[0.08] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                          {item.area && <span className="text-[#347796]">{item.area}</span>}
                          <span className="border border-black/[0.1] px-2 py-0.5 text-[#52717e]">{STATUS_COPY[item.status]}</span>
                        </div>
                        <h4 className="text-base font-semibold text-foreground">{item.title}</h4>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.assignees.map((assignee) => (
                            <span key={assignee.user_id} className="inline-flex items-center gap-1.5 bg-[#f4fbfb] px-2 py-1 text-xs font-medium text-[#38525e]">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#347796] text-[8px] text-white">{initials(assignee.user_name)}</span>
                              {assignee.user_name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void copyText(refined).then(() => setNotice("Roteiro copiado para o teleprompter."))}
                        className="shrink-0 gap-2"
                      >
                        <Copy className="h-4 w-4" /> Copiar roteiro
                      </Button>
                    </div>

                    <div className="grid divide-y divide-black/[0.08] lg:grid-cols-[minmax(0,1fr)_260px] lg:divide-x lg:divide-y-0">
                      <div className="px-5 py-5">
                        <div className="mb-3 flex items-center gap-2 text-[#347796]">
                          <PenLine className="h-4 w-4" aria-hidden />
                          <span className="text-xs font-semibold">{item.refined_script ? "Roteiro revisado" : "Roteiro recebido"}</span>
                        </div>
                        <p className="line-clamp-8 whitespace-pre-wrap text-sm leading-7 text-foreground/85">{refined}</p>
                      </div>
                      <div className="flex flex-col justify-between gap-4 px-5 py-5">
                        <div className="space-y-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => runAction(item, "refine")} disabled={Boolean(activeAction)} className="w-full justify-start gap-2">
                            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {item.refined_script ? "Refinar novamente" : "Refinar para teleprompter"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => runAction(item, "assets")} disabled={Boolean(activeAction)} className="w-full justify-start gap-2">
                            {creatingAssets ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                            {item.caption ? "Gerar nova legenda" : "Gerar legenda"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => runAction(item, "cover")} disabled={Boolean(activeAction) || !item.cover_prompt} className="w-full justify-start gap-2">
                            {creatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                            {item.cover_image_url ? "Gerar nova capa" : "Gerar capa"}
                          </Button>
                        </div>
                        {item.status !== "teleprompter_ready" && (
                          <Button type="button" size="sm" onClick={() => runAction(item, "teleprompter")} disabled={Boolean(activeAction) || !item.refined_script} className="w-full gap-2">
                            {settingTeleprompter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Pronto para teleprompter
                          </Button>
                        )}
                      </div>
                    </div>

                    {(item.caption || item.cover_image_url) && (
                      <div className="grid divide-y divide-black/[0.08] border-t border-black/[0.08] lg:grid-cols-[minmax(0,1fr)_220px] lg:divide-x lg:divide-y-0">
                        <div className="px-5 py-5">
                          <div className="mb-2 flex items-center gap-2 text-[#347796]">
                            <MessageSquareText className="h-4 w-4" aria-hidden />
                            <span className="text-xs font-semibold">Legenda</span>
                          </div>
                          {item.caption ? (
                            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.caption}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Gere a legenda para preparar a publicação.</p>
                          )}
                        </div>
                        <div className="bg-[#f4fbfb] p-4">
                          {item.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.cover_image_url} alt={`Capa gerada para ${item.title}`} className="aspect-[2/3] w-full object-cover" />
                          ) : (
                            <div className="flex aspect-[2/3] flex-col items-center justify-center border border-dashed border-[#347796]/35 px-4 text-center text-xs leading-5 text-[#52717e]">
                              <ImageIcon className="mb-2 h-5 w-5 text-[#347796]" aria-hidden />
                              A capa aparece aqui depois da geração.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
