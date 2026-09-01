"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewsThumb } from "@/components/gustavo-content/news-thumb";
import { ScoreBadge } from "@/components/gustavo-content/score-badge";
import { TopicsAdmin } from "@/components/gustavo-content/topics-admin";
import { filterRadarItems } from "@/lib/gustavo-content/filters";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import type { GustavoContentItem, GustavoContentTopic, GustavoFetchRun } from "@/lib/gustavo-content/types";
import {
  EditorialEmpty,
  EditorialError,
  EditorialLoading,
} from "@/components/gustavo-content/editorial-states";

export function RadarBoard({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [topics, setTopics] = useState<GustavoContentTopic[]>([]);
  const [runs, setRuns] = useState<GustavoFetchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [thesis, setThesis] = useState("all");
  const [query, setQuery] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [itemsRes, topicsRes, runsRes] = await Promise.all([
        fetch("/api/gustavo-content/items?view=radar"),
        fetch("/api/gustavo-content/topics"),
        fetch("/api/gustavo-content/runs"),
      ]);
      const failed = [itemsRes, topicsRes, runsRes].find((response) => !response.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao carregar o radar.");
      }
      setItems(await itemsRes.json());
      setTopics(await topicsRes.json());
      setRuns(await runsRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o radar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(
    () =>
      filterRadarItems(items, {
        status: status === "all" ? undefined : status,
        topicId: topicId === "all" ? undefined : topicId,
        channel: channel === "all" ? undefined : channel,
        thesis: thesis === "all" ? undefined : thesis,
        query,
      }),
    [items, status, topicId, channel, thesis, query]
  );

  async function triggerFetch(source?: "institutional") {
    setFetching(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/gustavo-content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source ? { source, maxCreated: 8 } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível iniciar a busca.");
      setNotice(data.message ?? "Busca iniciada. O radar será atualizado em instantes.");
      window.setTimeout(() => void load(true), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a busca.");
    } finally {
      setFetching(false);
    }
  }

  const lastRun = runs[0];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="editorial-kicker font-mono text-[11px] uppercase text-[#347796]">
            Radar
          </p>
          <h3 className="editorial-display mt-2 text-2xl font-semibold text-[#04202f]">Oportunidades editoriais</h3>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => void triggerFetch()}
              disabled={fetching}
            >
              {fetching ? "Busca iniciada…" : "Buscar novas pautas"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void triggerFetch("institutional")}
              disabled={fetching}
            >
              Reaproveitar institucional
            </Button>
          </div>
        )}
      </div>

      {notice && (
        <p className="rounded-xl bg-[#e4f5f5] px-4 py-3 text-sm text-[#285f7a]" role="status">{notice}</p>
      )}
      {error && <EditorialError message={error} onRetry={() => void load()} />}

      {lastRun && !error && (
        <p className="font-mono text-xs text-[#6f858d]">
          Última busca: {format(new Date(lastRun.started_at), "dd MMM HH:mm", { locale: ptBR })} ·{" "}
          {lastRun.suggestions_created} sugestões · {lastRun.radar_created} radar ·{" "}
          {lastRun.discarded_under_55} abaixo de 55 · {lastRun.duplicates} duplicatas
        </p>
      )}

      <div className="rounded-[1.25rem] bg-white/75 p-3 shadow-[0_12px_38px_rgba(4,32,47,0.04)]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.6fr_repeat(4,1fr)_auto]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar pauta"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="sugestao">{GUSTAVO_CONTENT_STATUS_LABELS.sugestao}</SelectItem>
            <SelectItem value="radar">{GUSTAVO_CONTENT_STATUS_LABELS.radar}</SelectItem>
            <SelectItem value="aguardando_opiniao">
              {GUSTAVO_CONTENT_STATUS_LABELS.aguardando_opiniao}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={topicId} onValueChange={setTopicId}>
          <SelectTrigger>
            <SelectValue placeholder="Tema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os temas</SelectItem>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger>
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="reel">Reel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={thesis} onValueChange={setThesis}>
          <SelectTrigger>
            <SelectValue placeholder="Tese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Com ou sem tese</SelectItem>
            <SelectItem value="with">Com tese</SelectItem>
            <SelectItem value="without">Sem tese</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus("all"); setTopicId("all"); setChannel("all"); setThesis("all"); setQuery("");
          }}
          aria-label="Limpar filtros"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
        </div>
        <p className="mt-2 px-1 font-mono text-[11px] text-[#7b9098]">{visible.length} pautas nesta seleção</p>
      </div>

      {loading ? (
        <EditorialLoading label="Lendo sinais empresariais" />
      ) : items.length === 0 ? (
        <EditorialEmpty
          eyebrow="Radar em observação"
          title="Nenhuma oportunidade encontrada no momento"
          description="A busca automática continuará acompanhando os temas configurados e separará sinais fortes de simples notícias."
        />
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pauta corresponde aos filtros.</p>
      ) : (
        <div className="overflow-hidden rounded-[1.4rem] bg-white/80 shadow-[0_20px_60px_rgba(4,32,47,0.055)]">
          {visible.map((item) => (
            <article
              key={item.id}
              className="group border-b border-[#04202f]/[0.07] p-4 last:border-b-0 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <NewsThumb src={item.image_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 max-w-3xl">
                      <p className="text-[11px] text-muted-foreground">
                        {item.topic_name ?? item.source}
                        {item.published_at
                          ? ` · ${format(new Date(item.published_at), "dd MMM yyyy", { locale: ptBR })}`
                          : ""}
                      </p>
                      <h4 className="mt-1 text-base font-semibold leading-snug text-[#04202f]">
                        {item.title}
                      </h4>
                    </div>
                    <ScoreBadge score={item.editorial_score} />
                  </div>
                  {item.business_problem && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#04202f]/80">
                      {item.business_problem}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.score_reason}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {item.thesis_title && <span>Tese: {item.thesis_title}</span>}
                {item.recommended_channels?.linkedin.recommended && <span>LinkedIn</span>}
                {item.recommended_channels?.instagramReel.recommended && <span>Reel</span>}
                <Link
                  href={`/conteudo/gustavo/producao/${item.id}`}
                  className="ml-auto inline-flex items-center gap-2 text-sm font-semibold text-[#347796]"
                >
                  Analisar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {isAdmin && <TopicsAdmin />}
    </div>
  );
}
