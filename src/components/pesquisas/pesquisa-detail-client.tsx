"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, ExternalLink, ListChecks, LoaderCircle, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SURVEYS_PATH,
  answerPath,
  isAnswerable,
  slugify,
  type SurveyDetail,
  type SurveyQuestion,
  type SurveyUpdateInput,
} from "@/lib/pesquisas/types";
import { EnvioPanel } from "./envio-panel";
import { QuestionEditor } from "./question-editor";
import { ResultsPanel } from "./results-panel";
import { SurveyStatusBadge, Toggle, plural, requestJson } from "./shared";

type Tab = "perguntas" | "envio" | "resultados";

const TABS: Array<{ id: Tab; label: string; icon: typeof ListChecks }> = [
  { id: "perguntas", label: "Perguntas", icon: ListChecks },
  { id: "envio", label: "Envio", icon: Send },
  { id: "resultados", label: "Resultados", icon: BarChart3 },
];

interface Draft {
  title: string;
  intro: string;
  slug: string;
  pe27: boolean;
  anonymous: boolean;
  audience_departments: string[];
  questions: SurveyQuestion[];
}

function draftOf(detail: SurveyDetail): Draft {
  const { survey } = detail;
  return {
    title: survey.title,
    intro: survey.intro,
    slug: survey.slug,
    pe27: survey.brand === "pe27",
    anonymous: survey.anonymous,
    audience_departments: survey.audience_departments,
    questions: survey.questions,
  };
}

export function PesquisaDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<Tab>("perguntas");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const apply = useCallback((data: SurveyDetail) => {
    setDetail(data);
    setDraft(draftOf(data));
  }, []);

  useEffect(() => {
    requestJson<SurveyDetail>(`/api/pesquisas/${id}`)
      .then((data) => {
        apply(data);
        // Pesquisa já aberta: o mais útil é acompanhar quem respondeu.
        if (data.survey.status !== "rascunho") setTab(data.response_count > 0 ? "resultados" : "envio");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, [apply, id]);

  const dirty = useMemo(() => {
    if (!detail || !draft) return false;
    return JSON.stringify(draft) !== JSON.stringify(draftOf(detail));
  }, [detail, draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const patch = useCallback(
    async (input: SurveyUpdateInput): Promise<boolean> => {
      setSaveError(null);
      try {
        const data = await requestJson<SurveyDetail>(`/api/pesquisas/${id}`, { method: "PATCH", body: JSON.stringify(input) });
        // Mantém o rascunho do editor quando o PATCH veio de outra aba.
        setDetail(data);
        setDraft((current) => (current && dirty ? current : draftOf(data)));
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
        return false;
      }
    },
    [dirty, id]
  );

  const save = async () => {
    if (!draft || !detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const data = await requestJson<SurveyDetail>(`/api/pesquisas/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title,
          intro: draft.intro,
          slug: draft.slug,
          brand: draft.pe27 ? "pe27" : null,
          anonymous: draft.anonymous,
          audience_departments: draft.audience_departments,
          questions: draft.questions,
        } satisfies SurveyUpdateInput),
      });
      apply(data);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Excluir esta pesquisa? Não dá para desfazer.")) return;
    try {
      await requestJson(`/api/pesquisas/${id}`, { method: "DELETE" });
      router.push(SURVEYS_PATH);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link href={SURVEYS_PATH} className="inline-flex items-center gap-1.5 text-sm text-[#347796] hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Pesquisas
        </Link>
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!detail || !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  const { survey } = detail;
  const hasResponses = detail.response_count > 0;
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  const toggleDepartment = (name: string) =>
    setField(
      "audience_departments",
      draft.audience_departments.includes(name)
        ? draft.audience_departments.filter((item) => item !== name)
        : [...draft.audience_departments, name]
    );

  return (
    <div className="space-y-5 pb-24">
      <div className="space-y-3" data-print-hide>
        <Link href={SURVEYS_PATH} className="inline-flex items-center gap-1.5 text-sm text-[#347796] hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Pesquisas
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{survey.title}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <SurveyStatusBadge status={survey.status} />
              <span>{plural(survey.questions.filter(isAnswerable).length, "pergunta", "perguntas")}</span>
              <span>{plural(detail.response_count, "resposta", "respostas")}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`${answerPath(survey.slug)}?previa=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" aria-hidden />
                Ver como a equipe vê
              </a>
            </Button>
            {!hasResponses && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => void remove()} aria-label="Excluir pesquisa" title="Excluir pesquisa">
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="Partes da pesquisa" className="flex gap-1 border-b border-[#dce9eb]">
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors outline-none focus-visible:bg-[#47cdd0]/10",
                  selected ? "border-[#347796] text-[#285f7a]" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
                {item.id === "perguntas" && dirty && <span className="size-1.5 rounded-full bg-amber-500" aria-label="alterações não salvas" />}
              </button>
            );
          })}
        </div>
      </div>

      {saveError && tab !== "perguntas" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{saveError}</p>
      )}

      {tab === "perguntas" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="order-2 min-w-0 xl:order-1">
            <QuestionEditor
              questions={draft.questions}
              answeredIds={new Set(detail.answered_question_ids)}
              onChange={(questions) => setField("questions", questions)}
            />
          </div>

          <Card className="order-1 h-fit gap-0 py-0 xl:sticky xl:top-20 xl:order-2">
            <div className="border-b border-[#e6eef0] px-4 py-3">
              <h3 className="text-sm font-semibold">Apresentação e público</h3>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <Label htmlFor="survey-title-edit">Título</Label>
                <Input id="survey-title-edit" value={draft.title} onChange={(event) => setField("title", event.target.value)} maxLength={160} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="survey-intro">Texto de abertura</Label>
                <Textarea
                  id="survey-intro"
                  value={draft.intro}
                  onChange={(event) => setField("intro", event.target.value)}
                  maxLength={4000}
                  rows={5}
                  placeholder="Por que estamos perguntando e o que vamos fazer com as respostas."
                  className="text-sm leading-6"
                />
                <p className="text-xs text-muted-foreground">Dá para colar do WhatsApp: *texto* vira negrito.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="survey-slug">Link</Label>
                <div className="flex items-center rounded-md border border-input bg-white pl-3 text-sm text-muted-foreground focus-within:border-[#47cdd0]">
                  /pesquisa/
                  <input
                    id="survey-slug"
                    value={draft.slug}
                    onChange={(event) => setField("slug", slugify(event.target.value))}
                    disabled={survey.status !== "rascunho"}
                    className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-foreground outline-none disabled:opacity-60"
                  />
                </div>
                {survey.status !== "rascunho" && <p className="text-xs text-muted-foreground">O link fica fixo depois de aberta.</p>}
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Quem responde</legend>
                <div className="flex flex-wrap gap-1.5">
                  {detail.departments.map((department) => {
                    const selected = draft.audience_departments.includes(department.name);
                    return (
                      <button
                        key={department.name}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDepartment(department.name)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                          selected ? "border-[#347796] bg-[#347796] text-white" : "border-[#dce9eb] bg-white hover:border-[#47cdd0]/60"
                        )}
                      >
                        {department.name}
                        <span className={selected ? "text-white/80" : "text-muted-foreground"}>{department.count}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {draft.audience_departments.length ? "Só essas áreas recebem o convite." : "Nenhuma marcada: todo o escritório."}
                </p>
              </fieldset>
              <Toggle
                checked={draft.anonymous}
                onChange={(anonymous) => setField("anonymous", anonymous)}
                disabled={hasResponses}
                label="Respostas anônimas"
                description={
                  hasResponses
                    ? "Fica como está depois da primeira resposta."
                    : "Você vê quem respondeu, mas não o que cada pessoa escreveu."
                }
              />
              <Toggle
                checked={draft.pe27}
                onChange={(pe27) => setField("pe27", pe27)}
                label="Identidade do PE27"
                description="Logo do Planejamento Estratégico 2027 no topo da página."
              />
            </div>
          </Card>
        </div>
      )}

      {tab === "envio" && <EnvioPanel detail={detail} dirty={dirty} onPatch={patch} />}
      {tab === "resultados" && <ResultsPanel surveyId={id} />}

      {tab === "perguntas" && (dirty || saveError || savedAt) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#dce9eb] bg-white/95 backdrop-blur md:left-[var(--app-sidebar-width)]" data-print-hide>
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <p className={cn("min-w-0 flex-1 truncate text-sm", saveError ? "text-destructive" : "text-muted-foreground")}>
              {saveError ?? (dirty ? "Alterações não salvas" : "Tudo salvo")}
            </p>
            {dirty && (
              <Button type="button" variant="ghost" onClick={() => setDraft(draftOf(detail))} disabled={saving}>
                Descartar
              </Button>
            )}
            <Button type="button" onClick={() => void save()} disabled={saving || !dirty}>
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
