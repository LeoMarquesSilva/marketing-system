"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export function RadarBoard({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [topics, setTopics] = useState<GustavoContentTopic[]>([]);
  const [runs, setRuns] = useState<GustavoFetchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [thesis, setThesis] = useState("all");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const [itemsRes, topicsRes, runsRes] = await Promise.all([
      fetch("/api/gustavo-content/items?view=radar"),
      fetch("/api/gustavo-content/topics"),
      fetch("/api/gustavo-content/runs"),
    ]);
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (topicsRes.ok) setTopics(await topicsRes.json());
    if (runsRes.ok) setRuns(await runsRes.json());
    setLoading(false);
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

  async function fetchRadar() {
    setFetching(true);
    try {
      await fetch("/api/gustavo-content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      setFetching(false);
    }
  }

  async function importInstitutional() {
    setFetching(true);
    try {
      await fetch("/api/gustavo-content/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "institutional", maxCreated: 8 }),
      });
    } finally {
      setFetching(false);
    }
  }

  const lastRun = runs[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347796]">
            Radar
          </p>
          <h3 className="text-xl font-semibold text-[#04202f]">Oportunidades editoriais</h3>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={fetchRadar} disabled={fetching}>
              {fetching ? "Buscando…" : "Buscar agora"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void importInstitutional()}
              disabled={fetching}
            >
              Usar notícias do outro módulo
            </Button>
          </div>
        )}
      </div>

      {lastRun && (
        <p className="text-xs text-muted-foreground">
          Última busca: {format(new Date(lastRun.started_at), "dd MMM HH:mm", { locale: ptBR })} ·{" "}
          {lastRun.suggestions_created} sugestões · {lastRun.radar_created} radar ·{" "}
          {lastRun.discarded_under_55} abaixo de 55 · {lastRun.duplicates} duplicatas
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando radar…</p>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-10">
          <h4 className="text-lg font-semibold text-[#04202f]">
            Nenhuma oportunidade encontrada no momento.
          </h4>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            A busca automática continuará acompanhando os temas configurados.
          </p>
        </section>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pauta corresponde aos filtros.</p>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_1px_0_rgba(4,32,47,0.03)] sm:p-4"
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
                  className="ml-auto text-sm font-medium text-[#347796] hover:underline"
                >
                  Analisar pauta
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
