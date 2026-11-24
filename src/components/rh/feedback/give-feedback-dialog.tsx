"use client";

import { useMemo, useState } from "react";
import {
  Check,
  HandHeart,
  Loader2,
  NotebookPen,
  Sparkles,
  Sprout,
  Wand2,
  X,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CIVIL_LABELS } from "@/lib/rh/pdi/civil";
import type { PdiPerson } from "@/lib/rh/pdi/types";
import {
  FEEDBACK_VALUES,
  type FeedbackRequest,
  type FeedbackSettings,
  type FeedbackTemplate,
  type FeedbackValue,
  type FeedbackVisibility,
} from "@/lib/rh/feedback/types";
import { cn } from "@/lib/utils";
import {
  ChoiceCards,
  ChoiceChips,
  PersonPicker,
  SwitchRow,
} from "../form-controls";
import { Hint } from "../hint";
import { PersonPhoto } from "../pdi/pdi-visuals";
import { MUTED, ValueSeal, VISIBILITY_STYLE } from "./feedback-visuals";

const FREE = "__livre__";
type Kind = "reconhecimento" | "desenvolvimento";

export function GiveFeedbackDialog({
  people,
  templates,
  settings,
  initialTo,
  request,
  onClose,
  onDone,
}: {
  people: PdiPerson[];
  templates: FeedbackTemplate[];
  settings: Pick<
    FeedbackSettings,
    "ai_enabled" | "mural_enabled" | "hr_reads_content"
  >;
  initialTo?: string | null;
  /** Respondendo um pedido: a pessoa já vem escolhida e o pedido aparece no topo. */
  request?: FeedbackRequest | null;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [to, setTo] = useState<string | null>(
    request?.subject.id ?? initialTo ?? null,
  );
  const [kind, setKind] = useState<Kind>("reconhecimento");
  const [values, setValues] = useState<FeedbackValue[]>([]);
  const [templateId, setTemplateId] = useState<string>(FREE);
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<FeedbackVisibility>(
    request && request.requester.id !== request.subject.id
      ? "gestor"
      : "privado",
  );
  const [inPerson, setInPerson] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [ai, setAi] = useState<{
    loading: boolean;
    text?: string;
    tip?: string;
    error?: string;
  } | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipient =
    people.find((person) => person.id === to) ?? request?.subject ?? null;
  const kindTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.is_active && (!template.kind || template.kind === kind),
      ),
    [templates, kind],
  );

  function pickTemplate(id: string) {
    const previous = templates.find((template) => template.id === templateId);
    const next = templates.find((template) => template.id === id);
    setTemplateId(id);
    if (!next) return;
    const untouched =
      !message.trim() || (previous && message.trim() === previous.body.trim());
    setMessage(untouched ? next.body : `${message.trimEnd()}\n\n${next.body}`);
  }

  function changeKind(next: Kind) {
    setKind(next);
    if (next === "desenvolvimento" && visibility === "publico")
      setVisibility("privado");
    const current = templates.find((template) => template.id === templateId);
    if (current?.kind && current.kind !== next) setTemplateId(FREE);
  }

  function toggleValue(value: FeedbackValue) {
    setValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= 2
          ? [current[1], value]
          : [...current, value],
    );
  }

  async function improve() {
    setAi({ loading: true });
    try {
      const response = await fetch("/api/feedback/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          kind,
          recipient_name: recipient?.name,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "A IA não respondeu.");
      setAi({ loading: false, text: body.text, tip: body.tip });
    } catch (caught) {
      setAi({
        loading: false,
        error: caught instanceof Error ? caught.message : "A IA não respondeu.",
      });
    }
  }

  async function send() {
    setSaving(true);
    setError(null);
    try {
      if (!to) throw new Error("Escolha para quem é o feedback.");
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_employee_id: to,
          kind,
          visibility,
          civil_values: values,
          template_id: templateId === FREE ? null : templateId,
          message: message.trim(),
          in_person: inPerson,
          ai_assisted: aiUsed,
          request_id: request?.id ?? null,
          note: note.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Não foi possível enviar.");
      onDone(body.id as string);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível enviar.",
      );
      setSaving(false);
    }
  }

  const visibilityOptions = (
    Object.keys(VISIBILITY_STYLE) as FeedbackVisibility[]
  )
    .filter(
      (key) =>
        key !== "publico" ||
        (kind === "reconhecimento" && settings.mural_enabled),
    )
    .map((key) => ({
      value: key,
      title: VISIBILITY_STYLE[key].label,
      description: VISIBILITY_STYLE[key].description,
      icon: VISIBILITY_STYLE[key].icon,
    }));

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        showCloseButton={!saving}
      >
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">
            {request ? "Responder pedido de feedback" : "Dar feedback"}
          </DialogTitle>
          <DialogDescription>
            Específico e sobre o comportamento: o que aconteceu, o que a pessoa
            fez e qual foi o impacto.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 [scrollbar-color:#c9d6da_transparent] [scrollbar-width:thin]">
          {request && (
            <div className="flex items-start gap-3 rounded-xl bg-[#eef7f7] p-4">
              <PersonPhoto person={request.requester} size="sm" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-[#0d2a38]">
                  {request.requester.name.split(" ")[0]} pediu
                  {request.requester.id !== request.subject.id
                    ? ` seu feedback sobre ${request.subject.name}`
                    : " seu feedback"}
                </p>
                <p className="mt-0.5 whitespace-pre-line text-[#3b5560]">
                  {request.message}
                </p>
              </div>
            </div>
          )}

          <section className="space-y-1.5">
            <Label>Para quem</Label>
            {request ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#e1ebee] px-3 py-2">
                <PersonPhoto person={request.subject} size="sm" />
                <span className="text-sm font-medium text-[#0d2a38]">
                  {request.subject.name}
                </span>
              </div>
            ) : (
              <PersonPicker
                label="Para quem é o feedback"
                placeholder="Escolha a pessoa"
                value={to}
                people={people}
                onChange={setTo}
              />
            )}
          </section>

          <section className="space-y-1.5">
            <Label>Tipo</Label>
            <ChoiceCards
              label="Tipo de feedback"
              className="sm:grid-cols-2"
              value={kind}
              onChange={changeKind}
              options={[
                {
                  value: "reconhecimento",
                  title: "Reconhecimento",
                  description:
                    "O que a pessoa fez bem e por que fez diferença.",
                  icon: HandHeart,
                },
                {
                  value: "desenvolvimento",
                  title: "Desenvolvimento",
                  description:
                    "O que pode melhorar, com respeito e foco no comportamento.",
                  icon: Sprout,
                },
              ]}
            />
          </section>

          <section className="space-y-1.5">
            <Label>
              Valores CIVIL{" "}
              <span className="font-normal text-[#7b929c]">
                (opcional, até 2)
              </span>
            </Label>
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Valores CIVIL"
            >
              {FEEDBACK_VALUES.map((value) => {
                const selected = values.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleValue(value)}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60",
                      selected
                        ? "border-[#47cdd0] bg-[#e8f8f8] font-semibold text-[#1d5670] shadow-[inset_0_0_0_1px_#47cdd0]"
                        : "border-[#dce9eb] bg-white text-[#3b5560] hover:border-[#47cdd0]/70",
                    )}
                  >
                    <ValueSeal value={value} size="md" />
                    {CIVIL_LABELS[value]}
                    {selected && <Check className="size-3.5" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-1.5">
            <Label>Modelo</Label>
            <ChoiceChips
              label="Modelo de texto"
              size="sm"
              value={templateId}
              onChange={pickTemplate}
              options={[
                { value: FREE, label: "Escrever livre" },
                ...kindTemplates.map((template) => ({
                  value: template.id,
                  label: template.name,
                })),
              ]}
            />
          </section>

          <section className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="feedback-text">Feedback</Label>
              {settings.ai_enabled && (
                <Hint
                  wrap
                  label={
                    message.trim().length < 40
                      ? "Escreva um pouco mais para a IA ajudar"
                      : "A IA sugere uma versão mais específica, no formato SCI"
                  }
                >
                  <button
                    type="button"
                    onClick={improve}
                    disabled={message.trim().length < 40 || ai?.loading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d9cff0] bg-[#f6f2fd] px-2.5 text-xs font-semibold text-[#5b3fa3] outline-none transition-colors hover:bg-[#efe8fb] focus-visible:ring-2 focus-visible:ring-[#47cdd0]/60 disabled:opacity-50"
                  >
                    {ai?.loading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Wand2 className="size-3.5" aria-hidden />
                    )}
                    Melhorar com IA
                  </button>
                </Hint>
              )}
            </div>
            <Textarea
              id="feedback-text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                kind === "reconhecimento"
                  ? "Ex.: Na audiência de ontem, você preparou os documentos com antecedência e isso deixou o cliente tranquilo."
                  : "Ex.: Na reunião de segunda, o prazo foi passado sem conferir a agenda; isso atrasou a equipe. Daqui para frente, vale confirmar antes."
              }
              className="max-h-[22rem] min-h-40 resize-none rounded-xl border-[#dce6e9] px-4 py-3 text-sm leading-6 [field-sizing:content]"
            />
            {ai && !ai.loading && (ai.text || ai.error) && (
              <div
                className={cn(
                  "rounded-xl border p-4",
                  ai.error
                    ? "border-red-200 bg-red-50"
                    : "border-[#d9cff0] bg-[#faf8fe]",
                )}
              >
                {ai.error ? (
                  <p className="text-sm text-red-700">{ai.error}</p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#5b3fa3]">
                      <Sparkles className="size-3.5" aria-hidden />
                      Sugestão da IA
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#0d2a38]">
                      {ai.text}
                    </p>
                    {ai.tip && (
                      <p className="mt-2 text-xs text-[#5a717b]">{ai.tip}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setMessage(ai.text ?? message);
                          setAiUsed(true);
                          setAi(null);
                        }}
                      >
                        <Check className="size-4" aria-hidden />
                        Usar esta versão
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAi(null)}
                      >
                        Manter o meu
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {settings.ai_enabled && (
              <p className={cn("text-xs", MUTED)}>
                A ajuda da IA envia o texto para a OpenAI pela conta do
                escritório. Nada é enviado sem você clicar.
              </p>
            )}
          </section>

          <section className="space-y-1.5">
            <Label>Quem vê</Label>
            <ChoiceCards
              label="Quem vê o feedback"
              className={
                visibilityOptions.length === 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2"
              }
              value={visibility}
              onChange={setVisibility}
              options={visibilityOptions}
            />
            {settings.hr_reads_content && (
              <p className={cn("text-xs", MUTED)}>
                Pessoas e Cultura também tem acesso ao texto dos feedbacks.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <SwitchRow
              className="rounded-lg border border-[#e6eff1] px-3 py-2.5"
              checked={inPerson}
              onChange={setInPerson}
              label="Já conversamos pessoalmente"
              hint="Use quando o feedback foi dado ao vivo e você está registrando."
            />
            {noteOpen ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="feedback-note"
                    className="flex items-center gap-1.5"
                  >
                    <NotebookPen
                      className="size-3.5 text-[#3e84a8]"
                      aria-hidden
                    />
                    Anotação só minha
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setNoteOpen(false);
                      setNote("");
                    }}
                    className="rounded p-1 text-[#7b929c] hover:bg-[#f4fafb]"
                    aria-label="Tirar anotação"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
                <Textarea
                  id="feedback-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Só você vê. Útil para lembrar o contexto depois."
                  className="resize-none rounded-xl border-[#dce6e9]"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[#1d7086] hover:bg-[#eef8f8]"
              >
                <NotebookPen className="size-4" aria-hidden />
                Adicionar anotação só minha
              </button>
            )}
          </section>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-[#e6eef0] px-6 py-4 sm:justify-between">
          <p className="min-w-0 text-sm text-red-700" role="alert">
            {error}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={send}
              disabled={saving || !to || message.trim().length < 10}
              className="bg-[#0f5f70] hover:bg-[#0c5262]"
            >
              {saving && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Enviar feedback
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
