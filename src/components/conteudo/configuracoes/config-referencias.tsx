"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, AtSign, ExternalLink, Film, Images, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { captionHeadline } from "@/lib/content-generator/learning";
import {
  REFERENCE_KIND_LABELS,
  referenceEngagement,
  referenceFormat,
  type ReferenceKind,
  type ReferenceSummary,
} from "@/lib/content-generator/references";
import { TOPIC_AREAS } from "@/lib/content-generator/topics";
import { cn } from "@/lib/utils";
import { ConfigSection, Toggle } from "./config-ui";

export function ConfigReferencias() {
  const [summaries, setSummaries] = useState<ReferenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("concorrente");
  const [focusArea, setFocusArea] = useState("Geral");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const call = useCallback(async (input: RequestInfo, init?: RequestInit) => {
    setError(null);
    const res = await fetch(input, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir.");
    if (Array.isArray(data.summaries)) setSummaries(data.summaries);
    return data;
  }, []);

  useEffect(() => {
    call("/api/content-roteiros/referencias")
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, [call]);

  const add = async () => {
    if (!username.trim()) return;
    setAdding(true);
    try {
      await call("/api/content-roteiros/referencias", { method: "POST", body: JSON.stringify({ username, kind, focusArea }) });
      setUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível adicionar.");
    } finally {
      setAdding(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await call("/api/content-roteiros/referencias", { method: "POST", body: JSON.stringify({ action: "sync" }) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setSyncing(false);
    }
  };

  const patch = (id: string, body: Record<string, unknown>) =>
    call("/api/content-roteiros/referencias", { method: "PATCH", body: JSON.stringify({ id, ...body }) }).catch((err) =>
      setError(err instanceof Error ? err.message : "Não foi possível salvar."),
    );

  const remove = (id: string) =>
    call(`/api/content-roteiros/referencias?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => setConfirmRemove(null))
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível remover."));

  return (
    <div className="space-y-4">
      <ConfigSection
        icon={AtSign}
        title="Escritórios de referência e concorrentes"
        description="A IA lê os posts públicos destes perfis no Instagram e usa no estudo: o que postam, em que nível e o que engaja. Só funciona com contas profissionais (Business ou Criador)."
        action={
          <Button variant="outline" size="sm" onClick={() => void sync()} disabled={syncing || summaries.length === 0}>
            {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Atualizar posts agora
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !adding) void add();
              }}
              placeholder="perfil do escritório ou link do Instagram"
              aria-label="@ do perfil"
              className="h-10 pl-9"
              disabled={adding}
            />
          </div>
          <Select value={kind} onValueChange={(value) => setKind(value as ReferenceKind)}>
            <SelectTrigger className="h-10 w-full text-sm" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concorrente">Concorrente</SelectItem>
              <SelectItem value="referencia">Escritório de referência</SelectItem>
            </SelectContent>
          </Select>
          <Select value={focusArea} onValueChange={setFocusArea}>
            <SelectTrigger className="h-10 w-full text-sm" aria-label="Área em que é referência">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TOPIC_AREAS.map((area) => (
                <SelectItem key={area} value={area}>
                  {area === "Geral" ? "Todas as áreas" : area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void add()} disabled={adding || !username.trim()} className="h-10">
            {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {adding ? "Conferindo…" : "Adicionar"}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </ConfigSection>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Carregando perfis…
        </div>
      ) : summaries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#cfe0e4] bg-white px-4 py-10 text-center text-sm text-slate-500">
          Nenhum perfil ainda. Adicione o @ dos concorrentes e dos escritórios que vocês querem ter como régua.
        </p>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => {
            const { account } = summary;
            return (
              <section
                key={account.id}
                className={cn(
                  "rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(4,32,47,0.04)]",
                  !account.isActive && "opacity-60",
                )}
              >
                <header className="flex flex-col gap-3 border-b border-[#eef4f5] px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eaf2f5] ring-1 ring-[#dce9eb]">
                      {account.profilePictureUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={account.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users className="size-5 text-[#285f7a]" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-900">
                        {account.displayName ?? account.username}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            account.kind === "concorrente" ? "bg-[#48466e]/10 text-[#48466e]" : "bg-[#eaf2f5] text-[#285f7a]",
                          )}
                        >
                          {REFERENCE_KIND_LABELS[account.kind]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <a href={`https://www.instagram.com/${account.username}/`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          @{account.username}
                        </a>
                        {account.followersCount !== null ? ` · ${account.followersCount.toLocaleString("pt-BR")} seguidores` : ""}
                        {account.focusArea !== "Geral" ? ` · foco em ${account.focusArea}` : ""}
                        {account.lastSyncedAt
                          ? ` · lido ${formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true, locale: ptBR })}`
                          : " · ainda não lido"}
                      </p>
                      {account.lastError ? (
                        <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          {account.lastError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 pl-14 sm:pl-0">
                    <p className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-slate-900">{summary.perWeek.toLocaleString("pt-BR")}</span>
                      <span className="block text-xs text-slate-500">posts/semana</span>
                    </p>
                    <p className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-slate-900">
                        {summary.avgEngagement !== null ? `${summary.avgEngagement.toLocaleString("pt-BR")}%` : "—"}
                      </span>
                      <span className="block text-xs text-slate-500" title="(curtidas + comentários) ÷ seguidores">
                        engajamento
                      </span>
                    </p>
                    <Toggle
                      checked={account.isActive}
                      onChange={(value) => void patch(account.id, { isActive: value })}
                      label={account.isActive ? `Pausar @${account.username}` : `Ativar @${account.username}`}
                    />
                    {confirmRemove === account.id ? (
                      <Button size="sm" variant="outline" className="text-red-700 hover:bg-red-50" onClick={() => void remove(account.id)}>
                        Confirmar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" onClick={() => setConfirmRemove(account.id)} aria-label={`Remover @${account.username}`}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </header>
                {summary.top.length > 0 ? (
                  <div className="px-4 py-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">Posts que mais engajaram nos últimos 90 dias</p>
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {summary.top.slice(0, 3).map((post) => {
                        const format = referenceFormat(post);
                        const rate = referenceEngagement(post);
                        const isVideo = format === "Reels";
                        return (
                          <li key={post.id}>
                            <a
                              href={post.permalink ?? undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex gap-2.5 rounded-md p-1.5 transition-colors hover:bg-[#f4fafb]"
                            >
                              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-[#eaf2f5] text-[#285f7a]">
                                {post.mediaUrl && !isVideo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={post.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : isVideo ? (
                                  <Film className="size-5" aria-hidden />
                                ) : (
                                  <Images className="size-5" aria-hidden />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-2 text-xs leading-snug text-slate-700 group-hover:text-slate-900">
                                  {captionHeadline(post.caption, 160) || "(sem legenda)"}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                  {format}
                                  {rate !== null ? <strong className="font-semibold tabular-nums text-emerald-700">{rate.toLocaleString("pt-BR")}%</strong> : null}
                                  <ExternalLink className="size-3 text-slate-400" aria-hidden />
                                </span>
                              </span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
