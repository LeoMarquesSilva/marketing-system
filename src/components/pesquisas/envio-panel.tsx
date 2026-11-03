"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Hourglass,
  Link2,
  LoaderCircle,
  Lock,
  MessageCircle,
  Play,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  answerPath,
  formatSurveyDate,
  isAnswerable,
  surveyReadinessIssues,
  type SurveyDetail,
  type SurveyUpdateInput,
} from "@/lib/pesquisas/types";
import { PersonFace, ProgressBar, SurveyStatusBadge, plural } from "./shared";

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      window.prompt("Copie o texto:", text);
    }
  };
  return { copied, copy };
}

function Section({ icon: Icon, title, children, action }: { icon: typeof Users; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="min-w-0 gap-0 py-0">
      <div className="flex items-center gap-2.5 border-b border-[#e6eef0] px-4 py-3">
        <Icon className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

/** Recriado (key) quando o prazo salvo muda, para o campo voltar ao valor gravado. */
function DeadlineEditor({
  closesAt,
  busy,
  onSave,
}: {
  closesAt: string | null;
  busy: string | null;
  onSave: (closesAt: string | null) => Promise<void>;
}) {
  const saved = toLocalInput(closesAt);
  const [value, setValue] = useState(saved);
  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Encerra sozinha em</span>
          <Input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} className="h-10 w-56" />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onSave(value ? new Date(value).toISOString() : null)}
          disabled={busy !== null || value === saved}
        >
          {busy === "prazo" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Salvar prazo
        </Button>
        {closesAt && (
          <Button type="button" variant="ghost" onClick={() => void onSave(null)} disabled={busy !== null}>
            Sem prazo
          </Button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {closesAt ? `Hoje encerra em ${formatSurveyDate(closesAt, true)}.` : "Sem prazo: fica aberta até você encerrar."}
      </p>
    </>
  );
}

export function EnvioPanel({
  detail,
  dirty,
  onPatch,
}: {
  detail: SurveyDetail;
  /** Há perguntas não salvas: abrir exige salvar antes. */
  dirty: boolean;
  onPatch: (input: SurveyUpdateInput) => Promise<boolean>;
}) {
  const { survey, audience } = detail;
  // Só renderiza no navegador, depois de carregar o detalhe.
  const [origin] = useState(() => window.location.origin);
  const [busy, setBusy] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const link = `${origin}${answerPath(survey.slug)}`;
  const issues = surveyReadinessIssues(survey);
  const audienceTotal = audience.responded.length - audience.outside + audience.pending.length;
  const minutes = Math.max(
    2,
    Math.round(survey.questions.reduce((sum, question) => sum + (question.type === "texto_longo" ? 90 : isAnswerable(question) ? 30 : 0), 0) / 60)
  );

  const message = useMemo(() => {
    const deadline = survey.closes_at ? ` Dá para responder até ${formatSurveyDate(survey.closes_at, true)}.` : "";
    const privacy = survey.anonymous ? " É anônimo: ninguém vê o que cada um escreveu." : "";
    const reason =
      survey.brand === "pe27"
        ? "Como embaixadores de Operações Legais no Planejamento Estratégico 2027, queremos levar a voz de vocês para o workshop."
        : "Queremos ouvir vocês.";
    return `Oi, time! ${reason} Leva uns ${minutes} minutos.${privacy}${deadline}\n\nResponda aqui (entre com o seu login do ORQESTRAI):\n${link}`;
  }, [link, minutes, survey.anonymous, survey.brand, survey.closes_at]);

  const reminder = useMemo(
    () =>
      audience.pending.length
        ? `Ainda dá tempo! Faltam ${plural(audience.pending.length, "pessoa", "pessoas")} responder a pesquisa:\n${link}`
        : "",
    [audience.pending.length, link]
  );

  const run = async (key: string, input: SurveyUpdateInput) => {
    setBusy(key);
    await onPatch(input);
    setBusy(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Section icon={Play} title="Status">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <SurveyStatusBadge status={survey.status} className="text-sm" />
              {survey.opened_at && <span className="text-xs text-muted-foreground">aberta em {formatSurveyDate(survey.opened_at, true)}</span>}
            </div>
            {survey.status === "rascunho" && (
              <>
                {issues.length > 0 || dirty ? (
                  <ul className="space-y-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                    {dirty && <li>Salve as alterações das perguntas antes de abrir.</li>}
                    {issues.slice(0, 4).map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Tudo pronto. Ao abrir, o link passa a aceitar respostas e quem está no público recebe um convite ao entrar no
                    sistema.
                  </p>
                )}
                <Button type="button" onClick={() => void run("status", { status: "aberta" })} disabled={busy !== null || issues.length > 0 || dirty}>
                  {busy === "status" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
                  Abrir para respostas
                </Button>
              </>
            )}
            {survey.status === "aberta" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (window.confirm("Encerrar a pesquisa? O link para de aceitar respostas (dá para reabrir depois).")) {
                    void run("status", { status: "encerrada" });
                  }
                }}
                disabled={busy !== null}
              >
                {busy === "status" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                Encerrar agora
              </Button>
            )}
            {survey.status === "encerrada" && (
              <Button type="button" variant="outline" onClick={() => void run("status", { status: "aberta", closes_at: null })} disabled={busy !== null}>
                {busy === "status" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
                Reabrir (sem prazo)
              </Button>
            )}
          </div>
        </Section>

        <Section icon={CalendarClock} title="Prazo">
          <DeadlineEditor
            key={survey.closes_at ?? "sem-prazo"}
            closesAt={survey.closes_at}
            busy={busy}
            onSave={(closes_at) => run("prazo", { closes_at })}
          />
        </Section>

        <Section
          icon={Link2}
          title="Link e mensagem"
          action={
            <a
              href={`${answerPath(survey.slug)}?previa=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#347796] hover:underline"
            >
              Ver como a equipe vê
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          }
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Link da pesquisa" className="h-10 font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="secondary" onClick={() => void copy("link", link)}>
                {copied === "link" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === "link" ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageCircle className="size-3.5" aria-hidden />
                Mensagem pronta para WhatsApp ou Teams
              </p>
              <Textarea readOnly value={message} rows={6} className="text-sm leading-6" aria-label="Mensagem para a equipe" />
              <Button type="button" variant="outline" size="sm" onClick={() => void copy("mensagem", message)}>
                {copied === "mensagem" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === "mensagem" ? "Mensagem copiada" : "Copiar mensagem"}
              </Button>
            </div>
            {survey.status === "rascunho" && (
              <p className="text-xs text-muted-foreground">Enquanto está em rascunho, quem abrir o link vê “ainda não foi aberta”.</p>
            )}
          </div>
        </Section>
      </div>

      <Section
        icon={Users}
        title="Quem já respondeu"
        action={
          <span className="text-xs tabular-nums text-muted-foreground">
            {audience.responded.length} de {audienceTotal}
          </span>
        }
      >
        <div className="space-y-5">
          <ProgressBar value={audience.responded.length - audience.outside} total={audienceTotal} className="h-2" />
          {survey.anonymous && (
            <p className="text-xs leading-5 text-muted-foreground">
              Anônima: aqui aparece só quem respondeu, para você lembrar quem falta. O conteúdo de cada resposta não fica ligado à
              pessoa.
            </p>
          )}

          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-700">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Responderam ({audience.responded.length})
            </h4>
            {audience.responded.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguém ainda.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {audience.responded.map((person) => (
                  <li key={person.user_id} className="flex items-center gap-2.5">
                    <PersonFace person={person} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{person.short_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatSurveyDate(person.submitted_at, true)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase text-amber-700">
                <Hourglass className="size-3.5" aria-hidden />
                Faltam ({audience.pending.length})
              </h4>
              {reminder && survey.status === "aberta" && (
                <Button type="button" variant="ghost" size="xs" className="ml-auto" onClick={() => void copy("lembrete", reminder)}>
                  {copied === "lembrete" ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
                  {copied === "lembrete" ? "Copiado" : "Copiar lembrete"}
                </Button>
              )}
            </div>
            {audience.pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">{audienceTotal ? "Todo mundo respondeu." : "Ninguém no público."}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {audience.pending.map((person) => (
                  <li key={person.user_id} className={cn("flex items-center gap-2.5", survey.status !== "aberta" && "opacity-80")}>
                    <PersonFace person={person} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{person.short_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{person.position ?? person.department}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
