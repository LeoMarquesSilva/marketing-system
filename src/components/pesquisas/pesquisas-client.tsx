"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  EyeOff,
  FilePlus2,
  LoaderCircle,
  Lock,
  MessageSquareText,
  Plus,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SURVEY_TEMPLATES, SURVEY_TEMPLATE_LABELS, type SurveyTemplate } from "@/lib/pesquisas/templates";
import {
  SURVEYS_PATH,
  SURVEY_BRAND_LOGOS,
  formatSurveyDate,
  type Survey,
  type SurveyListItem,
} from "@/lib/pesquisas/types";
import { ProgressBar, SurveyStatusBadge, Toggle, plural, requestJson } from "./shared";

const TEMPLATE_ICONS = { em_branco: FilePlus2, planejamento: Sparkles } as const;

function SurveyRow({ survey }: { survey: SurveyListItem }) {
  const logo = survey.brand ? SURVEY_BRAND_LOGOS[survey.brand] : null;
  return (
    <Link
      href={`${SURVEYS_PATH}/${survey.id}`}
      className="group flex flex-col gap-4 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_3px_rgba(15,31,46,0.06)] transition-colors hover:border-[#47cdd0]/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30 sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#e6eef0] bg-[#f7fbfb]">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt="" className="h-auto w-12 object-contain" />
        ) : (
          <ClipboardList className="size-6 text-[#3e84a8]" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-semibold text-foreground group-hover:text-[#285f7a]">{survey.title}</h3>
          <SurveyStatusBadge status={survey.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3.5" aria-hidden />
            {plural(survey.question_count, "pergunta", "perguntas")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {survey.audience_departments.length ? survey.audience_departments.join(", ") : "Todo o escritório"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {survey.anonymous ? <EyeOff className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
            {survey.anonymous ? "Anônima" : "Identificada"}
          </span>
          {survey.closes_at && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden />
              até {formatSurveyDate(survey.closes_at, true)}
            </span>
          )}
        </div>
      </div>
      <div className="w-full shrink-0 space-y-1.5 sm:w-48">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold tabular-nums text-foreground">
            {survey.response_count}
            <span className="font-normal text-muted-foreground"> de {survey.audience_count}</span>
          </span>
          <span className="text-xs text-muted-foreground">responderam</span>
        </div>
        <ProgressBar value={survey.response_count} total={survey.audience_count} />
      </div>
    </Link>
  );
}

function CreateSurveyDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Array<{ name: string; count: number }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("Planejamento Estratégico 2027: escuta da equipe");
  const [template, setTemplate] = useState<SurveyTemplate>("planejamento");
  const [audience, setAudience] = useState<string[]>(["Operações Legais"]);
  const [pe27, setPe27] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDepartment = (name: string) =>
    setAudience((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const { survey } = await requestJson<{ survey: Survey }>("/api/pesquisas", {
        method: "POST",
        body: JSON.stringify({ title, template, audience_departments: audience, brand: pe27 ? "pe27" : null }),
      });
      router.push(`${SURVEYS_PATH}/${survey.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar.");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Nova pesquisa</DialogTitle>
          <DialogDescription>Depois de criar, você escreve ou ajusta as perguntas antes de abrir para a equipe.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="survey-title">Título</Label>
            <Input id="survey-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Começar com</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SURVEY_TEMPLATES.map((key) => {
                const Icon = TEMPLATE_ICONS[key];
                const selected = template === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTemplate(key)}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                      selected ? "border-[#47cdd0] bg-[#47cdd0]/8" : "border-[#dce9eb] hover:border-[#47cdd0]/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-md",
                        selected ? "bg-[#347796] text-white" : "bg-[#e8f8f8] text-[#285f7a]"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{SURVEY_TEMPLATE_LABELS[key].title}</span>
                      <span className="block text-xs leading-5 text-muted-foreground">{SURVEY_TEMPLATE_LABELS[key].description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quem responde</legend>
            <p className="text-xs text-muted-foreground">Pela área do cadastro do RH. Nenhuma marcada = todo o escritório.</p>
            <div className="flex flex-wrap gap-2">
              {departments.map((department) => {
                const selected = audience.includes(department.name);
                return (
                  <button
                    key={department.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDepartment(department.name)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/30",
                      selected
                        ? "border-[#347796] bg-[#347796] text-white"
                        : "border-[#dce9eb] bg-white text-foreground hover:border-[#47cdd0]/60"
                    )}
                  >
                    {department.name}
                    <span className={cn("text-xs tabular-nums", selected ? "text-white/80" : "text-muted-foreground")}>
                      {department.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Toggle
            checked={pe27}
            onChange={setPe27}
            label="Usar a identidade do PE27"
            description="O logo do Planejamento Estratégico 2027 aparece no topo da página de resposta."
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !title.trim()}>
            {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Criar pesquisa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Lista das pesquisas com a equipe. */
export function PesquisasClient() {
  const [surveys, setSurveys] = useState<SurveyListItem[] | null>(null);
  const [departments, setDepartments] = useState<Array<{ name: string; count: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    requestJson<{ surveys: SurveyListItem[] }>("/api/pesquisas")
      .then((data) => !cancelled && setSurveys(data.surveys))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : "Falha ao carregar."));
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = async () => {
    setCreating(true);
    if (departments.length) return;
    try {
      const data = await requestJson<{ departments: Array<{ name: string; count: number }> }>("/api/pesquisas/areas");
      setDepartments(data.departments);
    } catch {
      setDepartments([{ name: "Operações Legais", count: 0 }]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Ouvir a equipe</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Perguntas para o time responder com login, uma vez por pessoa. Você acompanha quem já respondeu e leva os
            resultados, com a síntese da IA, para a reunião.
          </p>
        </div>
        <Button type="button" onClick={() => void openCreate()}>
          <Plus className="size-4" aria-hidden />
          Nova pesquisa
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {!surveys && !error && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-label="Carregando" />
        </div>
      )}

      {surveys && surveys.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[#e8f8f8] text-[#285f7a]">
            <ClipboardList className="size-6" aria-hidden />
          </span>
          <div>
            <p className="font-semibold">Nenhuma pesquisa ainda</p>
            <p className="text-sm text-muted-foreground">Crie a primeira e escreva as perguntas quando quiser.</p>
          </div>
        </div>
      )}

      {surveys && surveys.length > 0 && (
        <div className="space-y-3">
          {surveys.map((survey) => (
            <SurveyRow key={survey.id} survey={survey} />
          ))}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" aria-hidden />
        Só administradores do sistema veem esta tela e os resultados. Quem responde só enxerga a própria página de resposta.
      </p>

      <CreateSurveyDialog open={creating} onOpenChange={setCreating} departments={departments} />
    </div>
  );
}
