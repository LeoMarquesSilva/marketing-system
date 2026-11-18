"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtSign, BrainCircuit, ExternalLink, Loader2, MessageSquareQuote, PencilLine, RefreshCw, ThumbsDown, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AreaIcon, getAreaIconStyle } from "@/lib/area-icons";
import type { LearningSnapshot } from "@/lib/content-generator/learning";
import { cn } from "@/lib/utils";
import { BulletList, ConfigSection, Toggle } from "./config-ui";

type HistoryEntry = Pick<LearningSnapshot, "id" | "createdAt" | "trigger" | "createdByName" | "postsAnalyzed" | "choicesAnalyzed" | "editsAnalyzed">;

export function ConfigAprendizado({
  learning,
  history,
  useLearning,
  onToggleUseLearning,
  refreshing,
  onRefresh,
}: {
  learning: LearningSnapshot | null;
  history: HistoryEntry[];
  useLearning: boolean;
  onToggleUseLearning: (value: boolean) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const refreshButton = (
    <Button size="sm" onClick={onRefresh} disabled={refreshing}>
      {refreshing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
      {refreshing ? "Estudando…" : learning ? "Atualizar agora" : "Estudar agora"}
    </Button>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(4,32,47,0.04)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#e8f8f8] text-[#285f7a]">
              <BrainCircuit className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">O que a IA aprendeu</h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Ela estuda o Instagram do escritório (o que engaja), as matérias que a equipe escolhe ou descarta e as correções feitas no
                texto. Usa isso para dar nota às notícias e para escrever o carrossel. Refaz sozinha a cada 7 dias, antes da busca.
              </p>
              {learning ? (
                <p className="mt-2 text-xs text-slate-500">
                  Atualizado {formatDistanceToNow(new Date(learning.createdAt), { addSuffix: true, locale: ptBR })} (
                  {format(new Date(learning.createdAt), "dd/MM 'às' HH:mm")}
                  {learning.trigger === "manual" && learning.createdByName ? `, por ${learning.createdByName}` : ", automático"}) ·{" "}
                  {learning.postsAnalyzed} posts do Instagram · {learning.choicesAnalyzed} escolhas · {learning.editsAnalyzed} correções da equipe
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-700">
              <Toggle checked={useLearning} onChange={onToggleUseLearning} label="Usar o aprendizado na nota e no texto" />
              Usar na nota e no texto
            </span>
            {refreshButton}
          </div>
        </div>
        {refreshing ? (
          <p className="mt-3 rounded-md bg-[#f2f9fb] px-3 py-2 text-sm text-[#1f4c61]">
            A IA está lendo um ano de posts, as escolhas e as correções. Leva cerca de um minuto; pode continuar usando o sistema.
          </p>
        ) : null}
      </section>

      {!learning ? (
        <div className="rounded-lg border border-dashed border-[#cfe0e4] bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">A IA ainda não estudou o Instagram.</p>
          <p className="mt-1 text-sm text-slate-500">Clique em Estudar agora. Depois disso ela se atualiza sozinha toda semana.</p>
        </div>
      ) : (
        <>
          {learning.playbook.resumo ? (
            <p className="rounded-lg border border-[#dce9eb] bg-[#f7fbfc] px-4 py-3 text-[15px] leading-relaxed text-slate-800 sm:px-5">
              {learning.playbook.resumo}
            </p>
          ) : null}

          {learning.stats.formats.length > 0 ? (
            <ConfigSection title="Formatos no nosso Instagram" description={learning.playbook.geral?.formato}>
              <div className="grid gap-3 sm:grid-cols-3">
                {learning.stats.formats.map((entry) => (
                  <div key={entry.format} className="rounded-md bg-[#f7fbfc] px-3 py-3">
                    <p className="text-xs font-medium text-slate-500">{entry.format}</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{entry.engagementRate.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">
                      engajamento · {entry.posts} posts · alcance médio {entry.avgReach.toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </ConfigSection>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ConfigSection title="O que engaja" icon={TrendingUp} description="Padrões dos posts com mais engajamento">
              <BulletList items={learning.playbook.geral?.oQueEngaja} empty="Sem padrão claro ainda." />
            </ConfigSection>
            <ConfigSection title="Ganchos que funcionam" icon={MessageSquareQuote} description="Primeiras frases e capas que puxam leitura">
              <BulletList items={learning.playbook.geral?.ganchos} empty="Sem padrão claro ainda." />
            </ConfigSection>
            <ConfigSection title="O que a equipe escolhe" icon={Users} description="Pelas escolhas, descartes e matérias ignoradas">
              <BulletList items={learning.playbook.preferenciasDaEquipe} empty="Ainda há poucas escolhas para tirar conclusão." />
            </ConfigSection>
            <ConfigSection title="Correções que a equipe faz no texto" icon={PencilLine} description="A IA passa a escrever já assim">
              <BulletList items={learning.playbook.edicoesDaEquipe} empty="Ainda há poucas correções para tirar conclusão." />
            </ConfigSection>
          </div>

          {learning.playbook.geral?.evitar?.length ? (
            <ConfigSection title="Evitar" icon={ThumbsDown}>
              <BulletList items={learning.playbook.geral.evitar} />
            </ConfigSection>
          ) : null}

          {learning.playbook.referencias &&
          (learning.playbook.referencias.oQueFazem.length || learning.playbook.referencias.comoMostramDominio.length) ? (
            <ConfigSection
              icon={AtSign}
              title="O que os escritórios de referência fazem"
              description={learning.playbook.referencias.resumo || "Pelos posts públicos dos perfis da aba Referências"}
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Como mostram domínio do assunto</p>
                  <BulletList items={learning.playbook.referencias.comoMostramDominio} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">O que postam</p>
                  <BulletList items={learning.playbook.referencias.oQueFazem} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Pautas nesse nível para nós</p>
                  <BulletList items={learning.playbook.referencias.ideiasDePauta} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Não vale copiar</p>
                  <BulletList items={learning.playbook.referencias.naoCopiar} />
                </div>
              </div>
            </ConfigSection>
          ) : null}

          <ConfigSection title="Por área" description="O que engaja e os posts que mais renderam em cada área">
            <div className="divide-y divide-[#eef4f5]">
              {learning.stats.areas.map((areaStats) => {
                const areaPlaybook = learning.playbook.areas?.find((entry) => entry.area === areaStats.area);
                return (
                  <div key={areaStats.area} className="grid gap-4 py-4 first:pt-0 last:pb-0 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="flex items-start gap-3">
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md ring-1", getAreaIconStyle(areaStats.area))}>
                        <AreaIcon area={areaStats.area} className="size-4" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{areaStats.area}</p>
                        <p className="text-xs text-slate-500">
                          {areaStats.posts > 0 ? `${areaStats.posts} posts · ${areaStats.engagementRate.toFixed(1)}% de engajamento` : "Sem posts medidos"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {areaStats.chosen} escolhidas de {areaStats.generated} geradas
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <BulletList items={areaPlaybook?.oQueEngaja} empty="Pouca amostra nesta área." />
                      {areaPlaybook?.temasPromissores?.length ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {areaPlaybook.temasPromissores.map((theme) => (
                            <span key={theme} className="rounded-full bg-[#eaf2f5] px-2.5 py-1 text-xs font-medium text-[#285f7a]">
                              {theme}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <ul className="space-y-2">
                      {areaStats.top.slice(0, 3).map((post, index) => (
                        <li key={`${post.permalink ?? index}`}>
                          <a
                            href={post.permalink ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-[#f4fafb]"
                          >
                            <span className="relative block size-11 shrink-0 overflow-hidden rounded bg-[#eaf2f5]">
                              {post.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-xs leading-snug text-slate-700 group-hover:text-slate-900">
                                {post.headline || "(sem legenda)"}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-emerald-700">
                                {post.engagementRate.toFixed(1)}% · {post.format}
                              </span>
                            </span>
                            {post.permalink ? <ExternalLink className="size-3.5 shrink-0 text-slate-400" aria-hidden /> : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </ConfigSection>

          {learning.playbook.fontes?.length ? (
            <ConfigSection title="Sobre as fontes" description="Sugestões da IA; você decide na aba Fontes">
              <BulletList items={learning.playbook.fontes} />
            </ConfigSection>
          ) : null}

          {history.length > 1 ? (
            <ConfigSection title="Estudos anteriores">
              <ul className="divide-y divide-[#eef4f5] text-sm">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                    <span className="text-slate-700">{format(new Date(entry.createdAt), "dd/MM/yyyy 'às' HH:mm")}</span>
                    <span className="text-xs text-slate-500">
                      {entry.trigger === "manual" ? `manual${entry.createdByName ? `, ${entry.createdByName}` : ""}` : "automático"} ·{" "}
                      {entry.postsAnalyzed} posts · {entry.choicesAnalyzed} escolhas · {entry.editsAnalyzed} correções
                    </span>
                  </li>
                ))}
              </ul>
            </ConfigSection>
          ) : null}
        </>
      )}
    </div>
  );
}

