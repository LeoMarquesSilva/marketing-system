"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EMPTY_IDENTITY_VISUAL_BRIEFING,
  IDENTITY_VISUAL_APPLICATION_OPTIONS,
  IDENTITY_VISUAL_PERSONALITY_OPTIONS,
  identityVisualBriefingSchema,
  type IdentityVisualBriefingAnswers,
} from "@/lib/identity-visual-briefing";
import { supabase } from "@/utils/supabase/client";

interface IdentityVisualBriefingFormProps {
  requestId: string;
  initialAnswers: IdentityVisualBriefingAnswers;
  canEdit: boolean;
  alreadySubmitted: boolean;
}

const textareaClass =
  "mt-2 flex min-h-[104px] w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/70 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-80";

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#dce9eb] bg-white p-5 shadow-[0_1px_3px_rgba(3,32,47,0.06)] sm:p-6">
      <div className="mb-5 flex items-center gap-3 border-b border-[#dce9eb] pb-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#04202f] font-mono text-xs font-bold text-white">
          {number}
        </span>
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[#04202f]">{title}</h2>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold leading-relaxed text-foreground">{label}</legend>
      {hint && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function IdentityVisualBriefingForm({
  requestId,
  initialAnswers,
  canEdit,
  alreadySubmitted,
}: IdentityVisualBriefingFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<IdentityVisualBriefingAnswers>({
    resolver: zodResolver(identityVisualBriefingSchema),
    defaultValues: { ...EMPTY_IDENTITY_VISUAL_BRIEFING, ...initialAnswers },
  });

  const personality = useWatch({ control: form.control, name: "personality" });
  const applications = useWatch({ control: form.control, name: "applications" });
  const audienceType = useWatch({ control: form.control, name: "audienceType" });
  const hasPreviousMaterial = useWatch({ control: form.control, name: "hasPreviousMaterial" });

  function toggleList(field: "personality" | "applications", value: string, limit?: number) {
    const current = form.getValues(field);
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : limit && current.length >= limit
        ? current
        : [...current, value];
    form.setValue(field, next, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: IdentityVisualBriefingAnswers) {
    setSaving(true);
    setSaved(false);
    setSubmitError(null);
    const now = new Date().toISOString();
    const { data: updatedBriefing, error } = await supabase
      .from("identity_visual_briefings")
      .update({
        answers: values,
        status: "submitted",
        submitted_at: now,
        updated_at: now,
      })
      .eq("request_id", requestId)
      .select("request_id")
      .maybeSingle();
    setSaving(false);

    if (error || !updatedBriefing) {
      setSubmitError("Não foi possível enviar o briefing. Confira sua conexão e tente novamente.");
      return;
    }

    setSaved(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const disabled = !canEdit || saving;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      {saved && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-semibold">Briefing enviado com sucesso</p>
            <p className="mt-0.5 text-xs">O card já foi sinalizado para a equipe de marketing.</p>
          </div>
        </div>
      )}

      {!canEdit && (
        <div className="rounded-lg border border-[#dce9eb] bg-[#47cdd0]/[0.08] p-4 text-sm text-[#17495f]">
          Você está visualizando as respostas. Somente o solicitante vinculado pode editar este briefing.
        </div>
      )}

      <Section number="1" title="Informações sobre o projeto">
        <Question label="1.1. A marca já possui um nome? Se sim, qual?">
          <Input className="mt-2" disabled={disabled} {...form.register("brandName")} />
        </Question>
        <Question label="1.2. Existe algum significado ou história por trás do nome?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("nameStory")} />
        </Question>
      </Section>

      <Section number="2" title="Sobre a marca">
        <Question
          label="2.1. O que a sua marca oferece?"
          hint="Descreva brevemente os produtos, serviços ou soluções oferecidos."
        >
          <textarea className={textareaClass} disabled={disabled} {...form.register("offer")} />
        </Question>
        <Question label="2.2. Existe alguma história, conceito ou característica da marca que você considera importante preservar ou representar visualmente?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("brandEssence")} />
        </Question>
      </Section>

      <Section number="3" title="Público-alvo">
        <Question label="3.1. O público é composto principalmente por:">
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["pessoas_fisicas", "Pessoas físicas"],
              ["empresas", "Empresas"],
              ["ambos", "Ambos"],
              ["outro", "Outro"],
            ].map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#dce9eb] px-3 text-sm hover:bg-muted/30">
                <input type="radio" value={value} disabled={disabled} {...form.register("audienceType")} />
                {label}
              </label>
            ))}
          </div>
          {audienceType === "outro" && (
            <>
              <Input className="mt-3" placeholder="Descreva o público" disabled={disabled} {...form.register("audienceOther")} />
              {form.formState.errors.audienceOther && (
                <p className="mt-1 text-xs text-destructive">{form.formState.errors.audienceOther.message}</p>
              )}
            </>
          )}
        </Question>
        <Question label="3.2. Como você gostaria que o seu público se sentisse ao entrar em contato com a marca?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("desiredFeeling")} />
        </Question>
      </Section>

      <Section number="4" title="Posicionamento e comunicação">
        <Question
          label="4.1. Escolha até 5 características que melhor representam a personalidade desejada para a marca:"
          hint={`${personality.length}/5 selecionadas`}
        >
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTITY_VISUAL_PERSONALITY_OPTIONS.map((option) => {
              const checked = personality.includes(option);
              return (
                <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#dce9eb] px-3 text-sm hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || (!checked && personality.length >= 5)}
                    onChange={() => toggleList("personality", option, 5)}
                  />
                  {option}
                </label>
              );
            })}
          </div>
          <Input className="mt-3" placeholder="Outra característica" disabled={disabled} {...form.register("personalityOther")} />
          {form.formState.errors.personality && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.personality.message}</p>
          )}
        </Question>
        <Question label="4.2. Existe alguma característica que a marca NÃO deve transmitir?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("avoidTraits")} />
        </Question>
        <Question label="4.3. Existe algum slogan, frase ou conceito que acompanha a marca?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("slogan")} />
        </Question>
      </Section>

      <Section number="5" title="Referências visuais">
        <Question label="5.1. Existem marcas ou identidades visuais que você admira? Quais?" hint="Se possível, inclua links para as referências.">
          <textarea className={textareaClass} disabled={disabled} {...form.register("admiredBrands")} />
        </Question>
        <Question label="5.2. Há alguma cor que você gostaria de utilizar na identidade visual? Por quê?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("desiredColors")} />
        </Question>
        <p className="rounded-lg border-l-4 border-[#47cdd0] bg-[#47cdd0]/[0.07] p-3 text-xs leading-relaxed text-muted-foreground">
          As referências serão utilizadas como direcionamento e inspiração. A identidade visual será desenvolvida de forma original e adequada às características da marca.
        </p>
      </Section>

      <Section number="6" title="Aplicações da identidade">
        <Question label="6.1. Onde a identidade visual será utilizada?" hint="Marque todas as opções aplicáveis.">
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IDENTITY_VISUAL_APPLICATION_OPTIONS.map((option) => (
              <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#dce9eb] px-3 text-sm hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={applications.includes(option)}
                  disabled={disabled}
                  onChange={() => toggleList("applications", option)}
                />
                {option}
              </label>
            ))}
          </div>
          <Input className="mt-3" placeholder="Outras aplicações" disabled={disabled} {...form.register("applicationsOther")} />
        </Question>
      </Section>

      <Section number="7" title="Elementos e restrições">
        <Question label="7.1. Existe algum elemento que obrigatoriamente precisa fazer parte da identidade visual?" hint="Ex.: símbolo, elemento gráfico, cor, iniciais ou referência cultural.">
          <textarea className={textareaClass} disabled={disabled} {...form.register("requiredElements")} />
        </Question>
        <Question label="7.2. Existe algum elemento que não deve ser utilizado de forma alguma?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("forbiddenElements")} />
        </Question>
        <Question label="7.3. A marca possui algum material visual anterior que possa ser utilizado como referência?">
          <div className="mt-3 flex flex-wrap gap-2">
            {[["sim", "Sim"], ["nao", "Não"]].map(([value, label]) => (
              <label key={value} className="flex min-h-11 min-w-28 cursor-pointer items-center gap-2 rounded-lg border border-[#dce9eb] px-3 text-sm hover:bg-muted/30">
                <input type="radio" value={value} disabled={disabled} {...form.register("hasPreviousMaterial")} />
                {label}
              </label>
            ))}
          </div>
          {hasPreviousMaterial === "sim" && (
            <textarea
              className={textareaClass}
              placeholder="Cole os links ou informe como os arquivos serão enviados."
              disabled={disabled}
              {...form.register("previousMaterialLinks")}
            />
          )}
        </Question>
      </Section>

      <Section number="8" title="Expectativas sobre o projeto">
        <Question label="8.1. Existe alguma ideia ou conceito que você gostaria muito que fosse explorado?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("ideasToExplore")} />
        </Question>
      </Section>

      <Section number="9" title="Comentários finais">
        <Question label="9.1. Existe algo que você gostaria de pontuar que não estava presente nas perguntas anteriores?">
          <textarea className={textareaClass} disabled={disabled} {...form.register("finalComments")} />
        </Question>
      </Section>

      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}

      {canEdit && (
        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-lg border border-[#dce9eb] bg-white/95 p-4 shadow-[0_12px_32px_rgba(3,32,47,0.12)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {alreadySubmitted
              ? "Você pode atualizar as respostas. O card mostrará a data do envio mais recente."
              : "Revise as respostas antes de enviar. Campos que você não souber podem ficar em branco."}
          </p>
          <Button type="submit" disabled={saving} className="shrink-0">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Send className="mr-2 h-4 w-4" aria-hidden />}
            {saving ? "Enviando…" : alreadySubmitted ? "Atualizar briefing" : "Enviar briefing"}
          </Button>
        </div>
      )}
    </form>
  );
}
