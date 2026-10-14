"use client";

import { useRef, useState, type ReactNode } from "react";
import { ImagePlus, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CERTIFICATE_PARTNERS,
  DEFAULT_CERTIFICATE_TEXT,
  EVENT_TYPES,
  formatCargaHoraria,
  ROLE_SUGGESTIONS,
  TEXT_PLACEHOLDERS,
  type PartnerId,
} from "@/lib/certificados/model";
import { cn } from "@/lib/utils";
import { draftMinutes, emptyFacilitator, type CertificateDraft, type FacilitatorDraft } from "./certificate-draft";

type DraftSetter = (update: (draft: CertificateDraft) => CertificateDraft) => void;

export function FormSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#dce9eb] bg-white p-5 shadow-[0_1px_2px_rgba(3,32,47,0.05)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EventSection({ draft, setDraft }: { draft: CertificateDraft; setDraft: DraftSetter }) {
  const minutes = draftMinutes(draft);
  return (
    <FormSection title="Curso" description="Dados que entram no texto do certificado.">
      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="cert-tipo">Tipo</Label>
          <Select value={draft.tipo} onValueChange={(tipo) => setDraft((d) => ({ ...d, tipo }))}>
            <SelectTrigger id="cert-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-curso">Nome do curso</Label>
          <Input
            id="cert-curso"
            value={draft.curso}
            placeholder="Ex.: Técnicas de Redação Jurídica Persuasiva para Petições"
            onChange={(e) => setDraft((d) => ({ ...d, curso: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cert-data">{draft.variosDias ? "Primeiro dia" : "Data de realização"}</Label>
          <DatePickerField
            id="cert-data"
            value={draft.dataInicio}
            onChange={(dataInicio) => setDraft((d) => ({ ...d, dataInicio }))}
          />
        </div>
        {draft.variosDias ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="cert-data-fim">Último dia</Label>
              <button
                type="button"
                className="text-xs font-medium text-[#347796] hover:underline"
                onClick={() => setDraft((d) => ({ ...d, variosDias: false, dataFim: "" }))}
              >
                Foi um dia só
              </button>
            </div>
            <DatePickerField
              id="cert-data-fim"
              value={draft.dataFim}
              onChange={(dataFim) => setDraft((d) => ({ ...d, dataFim }))}
            />
          </div>
        ) : (
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, variosDias: true }))}
            >
              <Plus />
              Durou mais de um dia
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="cert-horas">Carga horária</Label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input
              id="cert-horas"
              type="number"
              inputMode="numeric"
              min={0}
              className="w-20"
              value={draft.horas}
              onChange={(e) => setDraft((d) => ({ ...d, horas: e.target.value }))}
            />
            <span className="text-sm text-muted-foreground">h</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              aria-label="Minutos"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={5}
              className="w-20"
              value={draft.minutos}
              onChange={(e) => setDraft((d) => ({ ...d, minutos: e.target.value }))}
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
          {minutes > 0 && <span className="text-sm text-muted-foreground">→ “{formatCargaHoraria(minutes)}”</span>}
        </div>
      </div>
    </FormSection>
  );
}

function FacilitatorRow({
  facilitator,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  facilitator: FacilitatorDraft;
  index: number;
  canRemove: boolean;
  onChange: (next: FacilitatorDraft) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const format = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : null;
    if (!format) {
      setError("Use uma imagem PNG (de preferência com fundo transparente) ou JPG.");
      return;
    }
    if (facilitator.assinatura) URL.revokeObjectURL(facilitator.assinatura.previewUrl);
    onChange({
      ...facilitator,
      assinatura: {
        image: { bytes: new Uint8Array(await file.arrayBuffer()), format },
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
      },
    });
  };

  const nameId = `cert-facilitador-${facilitator.id}`;
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor={nameId}>Facilitador {index + 1}</Label>
          <Input
            id={nameId}
            value={facilitator.nome}
            placeholder="Nome completo"
            onChange={(e) => onChange({ ...facilitator, nome: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${nameId}-cargo`}>Cargo</Label>
          <Input
            id={`${nameId}-cargo`}
            list="cert-cargos"
            value={facilitator.cargo}
            onChange={(e) => onChange({ ...facilitator, cargo: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {facilitator.assinatura ? (
            <div className="flex h-10 items-center gap-1 rounded-md border border-[#dce9eb] bg-[#fbfdfd] pr-1 pl-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={facilitator.assinatura.previewUrl}
                alt={`Assinatura de ${facilitator.nome || "facilitador"}`}
                className="h-7 max-w-24 object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Remover assinatura"
                onClick={() => {
                  URL.revokeObjectURL(facilitator.assinatura!.previewUrl);
                  onChange({ ...facilitator, assinatura: null });
                }}
              >
                <X />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              Assinatura
            </Button>
          )}
          {canRemove && (
            <Button type="button" variant="ghost" size="icon" aria-label={`Remover facilitador ${index + 1}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  );
}

export function SignaturesSection({ draft, setDraft }: { draft: CertificateDraft; setDraft: DraftSetter }) {
  const updateFacilitator = (id: string, next: FacilitatorDraft) =>
    setDraft((d) => ({ ...d, facilitadores: d.facilitadores.map((f) => (f.id === id ? next : f)) }));
  const removeFacilitator = (id: string) =>
    setDraft((d) => {
      const removed = d.facilitadores.find((f) => f.id === id);
      if (removed?.assinatura) URL.revokeObjectURL(removed.assinatura.previewUrl);
      return { ...d, facilitadores: d.facilitadores.filter((f) => f.id !== id) };
    });
  const togglePartner = (id: PartnerId, checked: boolean) =>
    setDraft((d) => ({
      ...d,
      socios: CERTIFICATE_PARTNERS.map((p) => p.id).filter((pid) => (pid === id ? checked : d.socios.includes(pid))),
    }));

  return (
    <FormSection
      title="Assinaturas"
      description="Facilitadores à esquerda e sócios à direita. A linha se ajusta à quantidade de pessoas."
    >
      <datalist id="cert-cargos">
        {ROLE_SUGGESTIONS.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      {draft.facilitadores.length > 0 ? (
        <ul className="divide-y divide-[#e8f0f1]">
          {draft.facilitadores.map((facilitator, index) => (
            <FacilitatorRow
              key={facilitator.id}
              facilitator={facilitator}
              index={index}
              canRemove
              onChange={(next) => updateFacilitator(facilitator.id, next)}
              onRemove={() => removeFacilitator(facilitator.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem facilitador neste certificado.</p>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => setDraft((d) => ({ ...d, facilitadores: [...d.facilitadores, emptyFacilitator()] }))}
      >
        <Plus />
        Adicionar facilitador
      </Button>

      <div className="mt-5 border-t border-[#e8f0f1] pt-4">
        <p className="mb-2 text-sm font-medium text-foreground">Sócios que assinam</p>
        <div className="flex flex-wrap gap-2">
          {CERTIFICATE_PARTNERS.map((partner) => {
            const checked = draft.socios.includes(partner.id);
            return (
              <label
                key={partner.id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-sm transition-colors",
                  checked
                    ? "border-[#47cdd0]/60 bg-[#e8f8f8] text-[#1c1c1c]"
                    : "border-[#dce9eb] bg-white text-muted-foreground hover:border-[#3e84a8]/40"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#347796]"
                  checked={checked}
                  onChange={(e) => togglePartner(partner.id, e.target.checked)}
                />
                {partner.nome}
              </label>
            );
          })}
        </div>
      </div>
    </FormSection>
  );
}

export function TextSection({ draft, setDraft }: { draft: CertificateDraft; setDraft: DraftSetter }) {
  const [open, setOpen] = useState(false);
  const customized = draft.texto !== DEFAULT_CERTIFICATE_TEXT;
  return (
    <FormSection
      title="Texto do certificado"
      description={customized ? "Texto personalizado." : "Usando o texto padrão do modelo."}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Fechar" : "Editar texto"}
        </Button>
      }
    >
      {open ? (
        <div className="space-y-3">
          <Textarea
            aria-label="Texto do certificado"
            rows={4}
            className="font-mono text-sm"
            value={draft.texto}
            onChange={(e) => setDraft((d) => ({ ...d, texto: e.target.value }))}
          />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              Cada linha do texto é uma linha no certificado. <code className="text-foreground">**assim**</code> fica
              em negrito e <code className="text-foreground">*assim*</code> em seminegrito.
            </p>
            <p>
              Campos:{" "}
              {TEXT_PLACEHOLDERS.map((placeholder) => (
                <code key={placeholder} className="mr-1.5 text-foreground">
                  {placeholder}
                </code>
              ))}
            </p>
          </div>
          {customized && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, texto: DEFAULT_CERTIFICATE_TEXT }))}
            >
              <RotateCcw />
              Voltar ao texto padrão
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm whitespace-pre-line text-muted-foreground">
          {draft.texto.replace(/\*\*|\*/g, "")}
        </p>
      )}
    </FormSection>
  );
}
