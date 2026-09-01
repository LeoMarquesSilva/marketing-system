"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import {
  EditorialEmpty,
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";

export function HistoryBoard() {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [thesis, setThesis] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/gustavo-content/items?view=historico");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Falha ao carregar o histórico.");
      setItems(data as GustavoContentItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const theses = useMemo(
    () =>
      [...new Set(items.map((item) => item.thesis_title).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [items]
  );

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (thesis !== "all" && item.thesis_title !== thesis) return false;
        if (channel === "linkedin" && !item.linkedin_post && !item.linkedin_published_url) return false;
        if (channel === "reel" && !item.reel_script && !item.instagram_published_url) return false;
        if (period !== "all") {
          const cutoff = Date.now() - Number(period) * 24 * 60 * 60 * 1000;
          if (new Date(item.updated_at).getTime() < cutoff) return false;
        }
        if (!query.trim()) return true;
        const blob = `${item.title ?? ""} ${item.thesis_title ?? ""} ${item.linkedin_post ?? ""}`.toLowerCase();
        return blob.includes(query.toLowerCase());
      }),
    [items, status, channel, thesis, period, query]
  );

  if (loading) return <EditorialLoading label="Consultando o histórico editorial" />;
  if (error) return <EditorialError message={error} onRetry={() => void load()} />;

  if (items.length === 0) {
    return (
      <EditorialEmpty
        eyebrow="Memória editorial"
        title="Ainda não há conteúdos concluídos"
        description="Depois da primeira publicação, este histórico passa a proteger a geração contra repetição de tese, gancho e ângulo."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">Memória</p>
          <h3 className="editorial-display mt-2 text-2xl font-semibold text-[#04202f]">Histórico editorial</h3>
        </div>
        <p className="font-mono text-sm text-[#56707a]">{visible.length} registros</p>
      </header>

      <div className="grid gap-2 rounded-[1.25rem] bg-white/70 p-3 sm:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por pauta, tese ou post"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="enviado_mkt">Enviado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue placeholder="Canal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="reel">Instagram Reel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={thesis} onValueChange={setThesis}>
          <SelectTrigger><SelectValue placeholder="Tese" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as teses</SelectItem>
            {theses.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo o período</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 180 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl bg-[#04202f]/[0.04] px-4 py-5 text-sm text-[#56707a]">
          Nenhum conteúdo corresponde aos filtros atuais.
        </p>
      ) : <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => (
          <article
            key={item.id}
            className="group flex min-h-56 flex-col rounded-[1.35rem] bg-white/85 p-5 shadow-[0_18px_48px_rgba(4,32,47,0.055)]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="editorial-kicker font-mono text-[10px] uppercase text-[#347796]">
                {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
              </p>
              <time className="font-mono text-[11px] text-[#7b9098]">
                {format(new Date(item.updated_at), "dd MMM yyyy", { locale: ptBR })}
              </time>
            </div>
            <h4 className="mt-3 font-semibold leading-snug text-[#04202f]">{item.title}</h4>
            <p className="mt-2 text-xs text-[#6f858d]">
              {item.thesis_title ?? "Sem tese"}
              {item.selected_angle ? ` · ${item.selected_angle.title}` : ""}
            </p>
            {item.linkedin_post && (
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-[#4f6872]">{item.linkedin_post}</p>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
              <Link
                href={`/conteudo/gustavo/producao/${item.id}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#347796]"
              >
                Abrir conteúdo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
              {item.linkedin_published_url && (
                <a href={item.linkedin_published_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#56707a] hover:text-[#04202f]">
                  LinkedIn <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
              {item.instagram_published_url && (
                <a href={item.instagram_published_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#56707a] hover:text-[#04202f]">
                  Instagram <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>}
    </div>
  );
}
