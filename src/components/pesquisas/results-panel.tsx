"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Lightbulb,
  LoaderCircle,
  Lock,
  Printer,
  Quote,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MIN_ANONYMOUS_RESPONSES,
  OTHER_OPTION_ID,
  formatSurveyDate,
  isAnswerable,
  questionNumber,
  type AnswerValue,
  type QuestionResult,
  type SurveyQuestion,
  type SurveyResults,
  type SurveySynthesis,
} from "@/lib/pesquisas/types";
import { PersonFace, plural, requestJson } from "./shared";

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function Bar({ share, strong }: { share: number; strong?: boolean }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e6eef0]" aria-hidden>
      <div
        className={cn("h-full rounded-full print:[print-color-adjust:exact]", strong ? "bg-[#347796]" : "bg-[#3e84a8]/70")}
        style={{ width: `${Math.max(share * 100, share > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

function ResultBody({ result, responses }: { result: QuestionResult; responses: SurveyResults["responses"] }) {
  switch (result.kind) {
    case "secao":
      return null;
    case "escala": {
      const max = Math.max(1, ...result.distribution.map((item) => item.count));
      return (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="shrink-0">
            <p className="text-4xl font-semibold tabular-nums text-[#0f1f2e]">
              {result.average === null ? "—" : result.average.toFixed(1).replace(".", ",")}
            </p>
            <p className="text-xs text-muted-foreground">média de {result.question.scale_min} a {result.question.scale_max}</p>
          </div>
          <div className="flex flex-1 items-end gap-1.5" role="img" aria-label="Distribuição das notas">
            {result.distribution.map((item) => (
              <div key={item.value} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular-nums text-muted-foreground">{item.count || ""}</span>
                <div className="flex h-20 w-full items-end">
                  <div
                    className="w-full rounded-t bg-[#3e84a8] print:[print-color-adjust:exact]"
                    style={{ height: `${(item.count / max) * 100}%`, minHeight: item.count ? 4 : 0 }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "escolha": {
      const top = Math.max(0, ...result.options.map((option) => option.count));
      const sorted = [...result.options].sort((a, b) => b.count - a.count);
      return (
        <div className="space-y-3">
          <ul className="space-y-2">
            {sorted.map((option) => (
              <li key={option.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,16rem)_1fr_auto]">
                <span className="text-sm">{option.label}</span>
                <span className="order-3 col-span-2 flex sm:order-none sm:col-span-1">
                  <Bar share={option.share} strong={option.count === top && top > 0} />
                </span>
                <span className="text-right text-sm tabular-nums">
                  <strong className="font-semibold">{option.count}</strong>
                  <span className="ml-1 text-xs text-muted-foreground">{percent(option.share)}</span>
                </span>
              </li>
            ))}
          </ul>
          {result.others.length > 0 && (
            <div className="rounded-md bg-[#f7fbfb] px-3 py-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">O que escreveram em “Outro”</p>
              <ul className="space-y-0.5 text-sm">
                {result.others.map((other, index) => (
                  <li key={index}>“{other}”</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    case "ranking": {
      const max = Math.max(1, ...result.options.map((option) => option.points));
      return (
        <ol className="space-y-2">
          {result.options.map((option, index) => (
            <li key={option.id} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums print:[print-color-adjust:exact]",
                  index === 0 ? "bg-[#347796] text-white" : "bg-[#e8f8f8] text-[#285f7a]"
                )}
              >
                {index + 1}
              </span>
              <span className="w-40 shrink-0 text-sm sm:w-64">{option.label}</span>
              <Bar share={option.points / max} strong={index === 0} />
              <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">
                {option.first_place > 0 ? `${plural(option.first_place, "vez", "vezes")} em 1º` : "—"}
              </span>
            </li>
          ))}
        </ol>
      );
    }
    case "texto": {
      if (result.texts.length === 0) return <p className="text-sm text-muted-foreground">Ninguém respondeu esta ainda.</p>;
      // Identificada: cada texto com a foto de quem escreveu; anônima: só os textos.
      const identified = responses.flatMap((row) => {
        const text = row.answers[result.question.id]?.text?.trim();
        return row.person && text ? [{ person: row.person, text }] : [];
      });
      const items = identified.length ? identified : result.texts.map((text) => ({ person: null, text }));
      return (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex gap-3 rounded-md border border-[#e6eef0] bg-[#fbfdfd] px-3 py-2.5 break-inside-avoid">
              {item.person ? (
                <PersonFace person={item.person} />
              ) : (
                <Quote className="mt-0.5 size-4 shrink-0 text-[#3e84a8]/60" aria-hidden />
              )}
              <div className="min-w-0">
                {item.person && <p className="text-xs font-semibold text-foreground">{item.person.short_name}</p>}
                <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      );
    }
  }
}

function SynthesisBlock({ synthesis, results }: { synthesis: SurveySynthesis; results: QuestionResult[] }) {
  const maxMentions = Math.max(1, ...synthesis.temas.map((theme) => theme.mencoes));
  const titleOf = (id: string) => results.find((result) => result.question.id === id)?.question.title;
  return (
    <div className="space-y-6">
      <p className="text-[0.975rem] leading-7 text-foreground">{synthesis.resumo}</p>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Temas que mais aparecem</h4>
        <ol className="grid gap-3 lg:grid-cols-2">
          {synthesis.temas.map((theme, index) => (
            <li key={index} className="space-y-2 rounded-md border border-[#e6eef0] bg-white p-3 break-inside-avoid">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-[#0f1f2e]">{theme.titulo}</span>
                <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{plural(theme.mencoes, "menção", "menções")}</span>
              </div>
              <Bar share={theme.mencoes / maxMentions} strong={index === 0} />
              <p className="text-sm leading-6 text-foreground/85">{theme.descricao}</p>
              {theme.citacoes.length > 0 && (
                <ul className="space-y-1">
                  {theme.citacoes.map((quote, quoteIndex) => (
                    <li key={quoteIndex} className="text-sm italic leading-6 text-muted-foreground">
                      “{quote}”
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {synthesis.pontos_de_atencao.length > 0 && (
          <div className="space-y-2 rounded-md bg-amber-50/70 p-4 ring-1 ring-inset ring-amber-200 break-inside-avoid">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="size-4" aria-hidden />
              Pontos de atenção
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950/90">
              {synthesis.pontos_de_atencao.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {synthesis.propostas.length > 0 && (
          <div className="space-y-2 rounded-md bg-[#e8f8f8]/70 p-4 ring-1 ring-inset ring-[#47cdd0]/30 break-inside-avoid">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#285f7a]">
              <Lightbulb className="size-4" aria-hidden />
              Propostas para levar ao planejamento
            </h4>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/90">
              {synthesis.propostas.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {synthesis.por_pergunta.some((item) => titleOf(item.question_id)) && (
        <details className="group rounded-md border border-[#e6eef0] bg-white print:block" open>
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">Resumo por pergunta aberta</summary>
          <ul className="space-y-3 border-t border-[#e6eef0] px-4 py-3">
            {synthesis.por_pergunta.map((item) =>
              titleOf(item.question_id) ? (
                <li key={item.question_id} className="break-inside-avoid">
                  <p className="text-xs font-semibold text-muted-foreground">{titleOf(item.question_id)}</p>
                  <p className="text-sm leading-6">{item.sintese}</p>
                </li>
              ) : null
            )}
          </ul>
        </details>
      )}
    </div>
  );
}

function answerToCell(question: SurveyQuestion, answer: AnswerValue | undefined): string | number {
  if (!answer) return "";
  const label = (id: string) =>
    id === OTHER_OPTION_ID ? `Outro: ${answer.other ?? ""}` : question.options.find((option) => option.id === id)?.label ?? "";
  switch (question.type) {
    case "escala":
      return answer.number ?? "";
    case "escolha_unica":
    case "multipla":
      return (answer.choices ?? []).map(label).join("; ");
    case "ranking":
      return (answer.ranking ?? []).map((id, index) => `${index + 1}. ${label(id)}`).join(" | ");
    default:
      return answer.text ?? "";
  }
}

async function exportExcel(data: SurveyResults) {
  const XLSX = await import("xlsx");
  const questions = data.survey.questions.filter(isAnswerable);
  const identified = !data.survey.anonymous;
  const header = [
    ...(identified ? ["Pessoa"] : []),
    "Data",
    ...questions.map((question) => question.title),
  ];
  const rows = data.responses.map((row) => [
    ...(identified ? [row.person?.short_name ?? ""] : []),
    formatSurveyDate(row.submitted_at, identified),
    ...questions.map((question) => answerToCell(question, row.answers[question.id])),
  ]);
  const summary: Array<Array<string | number>> = [["Pergunta", "Item", "Respostas", "%"]];
  data.results.forEach((result) => {
    if (result.kind === "escala") summary.push([result.question.title, "Média", result.average ?? "", ""]);
    if (result.kind === "escolha") {
      result.options.forEach((option) => summary.push([result.question.title, option.label, option.count, Math.round(option.share * 100)]));
    }
    if (result.kind === "ranking") {
      result.options.forEach((option, index) => summary.push([result.question.title, `${index + 1}º ${option.label}`, option.points, ""]));
    }
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([header, ...rows]), "Respostas");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(summary), "Resumo");
  XLSX.writeFile(book, `${data.survey.slug}-respostas.xlsx`);
}

export function ResultsPanel({ surveyId }: { surveyId: string }) {
  const [data, setData] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await requestJson<SurveyResults>(`/api/pesquisas/${surveyId}/resultados`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar os resultados.");
    }
  }, [surveyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setSynthesisError(null);
    try {
      await requestJson(`/api/pesquisas/${surveyId}/sintese`, { method: "POST" });
      await load();
    } catch (err) {
      setSynthesisError(err instanceof Error ? err.message : "Não foi possível gerar a síntese.");
    } finally {
      setGenerating(false);
    }
  };

  const audienceTotal = data ? data.audience.responded.length + data.audience.pending.length - data.audience.outside : 0;
  const numbered = useMemo(() => data?.survey.questions ?? [], [data]);

  if (error) return <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  const synthesis = data.survey.ai_summary;
  const stale = synthesis && data.survey.ai_summary_responses !== data.response_count;

  return (
    <div className="space-y-6" data-results-print>
      <style>{`@media print {
        aside, header, nav, [data-print-hide] { display: none !important; }
        body { background: #fff !important; }
        [data-results-print] { padding: 0 !important; }
        main, [data-results-print] * { box-shadow: none !important; }
      }`}</style>

      <div className="flex flex-col gap-4 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_3px_rgba(15,31,46,0.06)] sm:flex-row sm:items-center sm:p-5">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase text-muted-foreground print:hidden">Respostas</p>
          <h3 className="hidden text-xl font-semibold print:block">{data.survey.title}</h3>
          <p className="text-2xl font-semibold tabular-nums text-[#0f1f2e]">
            {data.response_count}
            <span className="text-base font-normal text-muted-foreground"> de {Math.max(audienceTotal, data.response_count)} pessoas</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {data.survey.anonymous ? "Pesquisa anônima" : "Pesquisa identificada"} · atualizado agora
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-print-hide>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" aria-hidden />
            Atualizar
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportExcel(data)} disabled={data.locked || data.response_count === 0}>
            <Download className="size-4" aria-hidden />
            Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} disabled={data.locked || data.response_count === 0}>
            <Printer className="size-4" aria-hidden />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {data.locked ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-12 text-center">
          <Lock className="size-6 text-[#3e84a8]" aria-hidden />
          <p className="font-semibold">Os resultados aparecem a partir de {MIN_ANONYMOUS_RESPONSES} respostas</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Como a pesquisa é anônima, mostrar antes deixaria dar para saber quem escreveu o quê.{" "}
            {data.response_count > 0 ? `Faltam ${MIN_ANONYMOUS_RESPONSES - data.response_count}.` : ""}
          </p>
        </div>
      ) : data.response_count === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-12 text-center text-sm text-muted-foreground">
          Ainda não há respostas.
        </p>
      ) : (
        <>
          <section className="rounded-lg border border-[#3e84a8]/25 bg-gradient-to-b from-[#f2fbfb] to-white p-4 shadow-[0_1px_3px_rgba(15,31,46,0.06)] sm:p-5 break-inside-avoid-page">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-[#347796] text-white print:[print-color-adjust:exact]">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <div className="flex-1">
                <h3 className="text-base font-semibold">Síntese para o workshop</h3>
                <p className="text-xs text-muted-foreground">
                  {synthesis
                    ? `Feita pela IA com ${plural(data.survey.ai_summary_responses ?? 0, "resposta", "respostas")} em ${formatSurveyDate(data.survey.ai_summary_at, true)}. Confira com as respostas abaixo.`
                    : "A IA lê todas as respostas e agrupa em temas, pontos de atenção e propostas."}
                </p>
              </div>
              <Button type="button" size="sm" variant={synthesis && !stale ? "outline" : "default"} onClick={() => void generate()} disabled={generating} data-print-hide>
                {generating ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {synthesis ? (stale ? "Atualizar com as novas respostas" : "Refazer síntese") : "Gerar síntese"}
              </Button>
            </div>
            {synthesisError && <p className="mb-3 text-sm text-destructive">{synthesisError}</p>}
            {generating && !synthesis && <p className="text-sm text-muted-foreground">Lendo as respostas… leva uns 20 segundos.</p>}
            {synthesis && <SynthesisBlock synthesis={synthesis} results={data.results} />}
          </section>

          <div className="space-y-4">
            {data.results.map((result, index) =>
              result.kind === "secao" ? (
                <h3 key={result.question.id} className="pt-4 text-lg font-semibold text-[#0f1f2e] break-after-avoid">
                  {result.question.title}
                </h3>
              ) : (
                <section
                  key={result.question.id}
                  className="rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_3px_rgba(15,31,46,0.05)] sm:p-5 break-inside-avoid-page"
                >
                  <div className="mb-4 flex gap-3">
                    <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-[#e8f8f8] px-1 text-xs font-bold text-[#285f7a] tabular-nums">
                      P{questionNumber(numbered, index)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[0.975rem] font-semibold leading-6">{result.question.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {plural(result.answered, "resposta", "respostas")}
                        {data.response_count > result.answered ? ` · ${data.response_count - result.answered} deixaram em branco` : ""}
                      </p>
                    </div>
                  </div>
                  <ResultBody result={result} responses={data.responses} />
                </section>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
