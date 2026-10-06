"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CpfInput } from "@/components/ui/cpf-input";
import { CepInput } from "@/components/ui/cep-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { maskOAB, maskRG, onlyDigits } from "@/lib/masks-br";
import { BRAZIL_UF_OPTIONS } from "@/lib/rh/qualifications/types";
import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NEEDS_DETAIL,
  DIETARY_NONE,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  RACE_COLOR_OPTIONS,
  type Option,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import type { RegistrationErrors } from "@/lib/rh/registration/validation";
import { cn } from "@/lib/utils";

export function registrationFieldId(field: RegistrationField): string {
  return `fc-${field}`;
}

function maskDigits(value: string, max: number): string {
  return onlyDigits(value).slice(0, max);
}

/** PIS: 000.00000.00-0 */
function maskPIS(value: string): string {
  const d = maskDigits(value, 11);
  if (d.length <= 3) return d;
  if (d.length <= 8) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 8)}.${d.slice(8, 10)}-${d.slice(10)}`;
}

/** Título de eleitor: 0000 0000 0000 */
function maskVoterTitle(value: string): string {
  return maskDigits(value, 12).replace(/(\d{4})(?=\d)/g, "$1 ");
}

function Field({
  field,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  field: RegistrationField;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-field={field}>
      <label htmlFor={registrationFieldId(field)} className="block text-sm font-medium text-foreground">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function OptionSelect({
  field,
  value,
  options,
  placeholder = "Selecione",
  invalid,
  disabled,
  onChange,
}: {
  field: RegistrationField;
  value: string;
  options: Option[] | readonly string[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const normalized: Option[] = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={registrationFieldId(field)} className="w-full" aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {normalized.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RegistrationSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="fc-section rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
      <header className="mb-5 flex items-baseline gap-3">
        <span className="fc-section__index text-xs font-semibold tabular-nums text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h2 className="fc-section__title text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function RegistrationFormFields({
  kind,
  answers,
  errors,
  disabled,
  onChange,
}: {
  kind: RegistrationKind;
  answers: RegistrationAnswers;
  errors: RegistrationErrors;
  disabled?: boolean;
  onChange: <K extends RegistrationField>(field: K, value: RegistrationAnswers[K]) => void;
}) {
  const [cepState, setCepState] = useState<"idle" | "loading" | "error">("idle");
  const lastCep = useRef(onlyDigits(answers.cep));
  const numberRef = useRef<HTMLInputElement>(null);

  const text = (field: RegistrationField, extra?: { mask?: (value: string) => string; placeholder?: string; autoComplete?: string; inputMode?: "numeric" | "text" | "email" }) => (
    <Input
      id={registrationFieldId(field)}
      value={answers[field] as string}
      disabled={disabled}
      placeholder={extra?.placeholder}
      autoComplete={extra?.autoComplete ?? "off"}
      inputMode={extra?.inputMode}
      aria-invalid={errors[field] ? true : undefined}
      onChange={(event) => onChange(field, (extra?.mask ? extra.mask(event.target.value) : event.target.value) as never)}
    />
  );

  // Endereço automático pelo CEP (mesma rota usada na Qualificação).
  useEffect(() => {
    const digits = onlyDigits(answers.cep);
    if (digits.length !== 8 || digits === lastCep.current || disabled) return;
    lastCep.current = digits;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mostra o carregamento enquanto busca o CEP digitado.
    setCepState("loading");
    fetch(`/api/cep/${digits}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setCepState("error");
          return;
        }
        const data = (await response.json()) as { street: string; district: string; city: string; state: string };
        if (cancelled) return;
        if (data.street) onChange("street", data.street);
        if (data.district) onChange("district", data.district);
        if (data.city) onChange("city", data.city);
        if (data.state) onChange("state", data.state.toUpperCase());
        setCepState("idle");
        numberRef.current?.focus();
      })
      .catch(() => !cancelled && setCepState("error"));
    return () => {
      cancelled = true;
    };
  }, [answers.cep, disabled, onChange]);

  const toggleDietary = (value: string) => {
    const current = answers.dietaryRestrictions;
    let next: string[];
    if (value === DIETARY_NONE) {
      next = current.includes(DIETARY_NONE) ? [] : [DIETARY_NONE];
    } else if (current.includes(value)) {
      next = current.filter((item) => item !== value);
    } else {
      next = [...current.filter((item) => item !== DIETARY_NONE), value];
    }
    onChange("dietaryRestrictions", next);
  };

  const needsDietaryDetail = answers.dietaryRestrictions.some((item) => DIETARY_NEEDS_DETAIL.has(item));

  return (
    <div className="space-y-5">
      <RegistrationSection index={1} title="Dados pessoais">
        <Field field="fullName" label="Nome completo" error={errors.fullName} className="sm:col-span-2">
          {text("fullName", { autoComplete: "name" })}
        </Field>
        <Field field="birthDate" label="Data de nascimento" error={errors.birthDate}>
          <DatePickerField
            id={registrationFieldId("birthDate")}
            value={answers.birthDate}
            onChange={(value) => onChange("birthDate", value)}
            disabled={disabled}
            placeholder="dd/mm/aaaa"
            startYear={1925}
            endYear={new Date().getFullYear()}
          />
        </Field>
        <Field field="gender" label="Gênero" error={errors.gender}>
          <OptionSelect
            field="gender"
            value={answers.gender}
            options={GENDER_OPTIONS}
            invalid={!!errors.gender}
            disabled={disabled}
            onChange={(value) => onChange("gender", value)}
          />
        </Field>
        <Field field="parentName" label="Nome da mãe ou do pai" error={errors.parentName} className="sm:col-span-2">
          {text("parentName")}
        </Field>
        <Field field="rg" label="Número do RG" error={errors.rg}>
          {text("rg", { mask: maskRG })}
        </Field>
        <Field field="rgIssuer" label="Órgão emissor / UF" error={errors.rgIssuer}>
          {text("rgIssuer", { placeholder: "ex.: SSP/SP", mask: (value) => value.toUpperCase() })}
        </Field>
        <Field field="cpf" label="CPF" error={errors.cpf}>
          <CpfInput
            id={registrationFieldId("cpf")}
            value={answers.cpf}
            disabled={disabled}
            aria-invalid={errors.cpf ? true : undefined}
            onChange={(value) => onChange("cpf", value)}
          />
        </Field>
      </RegistrationSection>

      <RegistrationSection index={2} title="Dados complementares">
        <Field field="nationality" label="Nacionalidade" error={errors.nationality}>
          {text("nationality")}
        </Field>
        <Field field="birthplace" label="Naturalidade" hint="Cidade e UF onde você nasceu" error={errors.birthplace}>
          {text("birthplace", { placeholder: "ex.: Campinas/SP" })}
        </Field>
        <Field field="raceColor" label="Raça/cor" hint="Autodeclaração, padrão IBGE" error={errors.raceColor}>
          <OptionSelect
            field="raceColor"
            value={answers.raceColor}
            options={RACE_COLOR_OPTIONS}
            invalid={!!errors.raceColor}
            disabled={disabled}
            onChange={(value) => onChange("raceColor", value)}
          />
        </Field>
        <Field
          field="pis"
          label="PIS"
          optional={kind !== "clt"}
          hint={kind === "clt" ? "Aparece na carteira de trabalho digital" : "Se você já tiver"}
          error={errors.pis}
        >
          {text("pis", { mask: maskPIS, inputMode: "numeric" })}
        </Field>

        {kind === "clt" && (
          <>
            <Field
              field="ctpsNumber"
              label="Número da carteira de trabalho digital"
              hint="Na CTPS digital, costuma ser o próprio CPF"
              error={errors.ctpsNumber}
            >
              {text("ctpsNumber")}
            </Field>
            <Field field="voterTitle" label="Título de eleitor" error={errors.voterTitle}>
              {text("voterTitle", { mask: maskVoterTitle, inputMode: "numeric" })}
            </Field>
          </>
        )}

        {kind === "estagio" && (
          <>
            <Field field="institution" label="Instituição de ensino" error={errors.institution} className="sm:col-span-2">
              {text("institution")}
            </Field>
            <Field field="coursePeriod" label="Ano/período atual na faculdade" error={errors.coursePeriod}>
              {text("coursePeriod", { placeholder: "ex.: 5º semestre, 2026" })}
            </Field>
            <Field field="studentRa" label="Número do RA" error={errors.studentRa}>
              {text("studentRa")}
            </Field>
          </>
        )}

        {kind === "socio_servico" && (
          <>
            <Field field="oabNumber" label="Número da OAB" error={errors.oabNumber}>
              {text("oabNumber", { mask: maskOAB, inputMode: "numeric" })}
            </Field>
            <Field field="oabUf" label="UF da OAB" error={errors.oabUf}>
              <OptionSelect
                field="oabUf"
                value={answers.oabUf}
                options={BRAZIL_UF_OPTIONS}
                placeholder="UF"
                invalid={!!errors.oabUf}
                disabled={disabled}
                onChange={(value) => onChange("oabUf", value)}
              />
            </Field>
          </>
        )}
      </RegistrationSection>

      <RegistrationSection index={3} title="Contato">
        <Field field="personalPhone" label="Telefone particular" error={errors.personalPhone}>
          <PhoneInput
            id={registrationFieldId("personalPhone")}
            value={answers.personalPhone}
            disabled={disabled}
            autoComplete="tel"
            aria-invalid={errors.personalPhone ? true : undefined}
            onChange={(value) => onChange("personalPhone", value)}
          />
        </Field>
        <Field field="personalEmail" label="E-mail particular" error={errors.personalEmail}>
          {text("personalEmail", { autoComplete: "email", inputMode: "email" })}
        </Field>
        <Field field="emergencyPhone" label="Telefone de emergência" error={errors.emergencyPhone}>
          <PhoneInput
            id={registrationFieldId("emergencyPhone")}
            value={answers.emergencyPhone}
            disabled={disabled}
            aria-invalid={errors.emergencyPhone ? true : undefined}
            onChange={(value) => onChange("emergencyPhone", value)}
          />
        </Field>
        <Field
          field="emergencyContactName"
          label="Contato de emergência"
          optional
          hint="Nome e parentesco, ex.: Maria (mãe)"
          error={errors.emergencyContactName}
        >
          {text("emergencyContactName")}
        </Field>
      </RegistrationSection>

      <RegistrationSection
        index={4}
        title="Saúde e alimentação"
        description="A restrição alimentar é compartilhada com a equipe de eventos para planejar cardápios. O tipo sanguíneo fica só com Pessoas e Cultura."
      >
        <Field field="bloodType" label="Tipo sanguíneo" optional error={errors.bloodType}>
          <OptionSelect
            field="bloodType"
            value={answers.bloodType}
            options={BLOOD_TYPE_OPTIONS}
            invalid={!!errors.bloodType}
            disabled={disabled}
            onChange={(value) => onChange("bloodType", value)}
          />
        </Field>
        <div className="hidden sm:block" />
        <div className="space-y-2 sm:col-span-2" data-field="dietaryRestrictions">
          <p id={registrationFieldId("dietaryRestrictions")} className="text-sm font-medium text-foreground" tabIndex={-1}>
            Restrição alimentar
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={registrationFieldId("dietaryRestrictions")}>
            {DIETARY_OPTIONS.map((option) => {
              const active = answers.dietaryRestrictions.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => toggleDietary(option.value)}
                  className={cn(
                    "fc-chip inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors disabled:opacity-60",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {active && <Check className="size-3.5" aria-hidden />}
                  {option.label}
                </button>
              );
            })}
          </div>
          {errors.dietaryRestrictions && (
            <p className="text-xs font-medium text-destructive" role="alert">
              {errors.dietaryRestrictions}
            </p>
          )}
        </div>
        {needsDietaryDetail && (
          <Field
            field="dietaryNotes"
            label="Especifique"
            hint="Detalhe a alergia, a restrição religiosa ou outra"
            error={errors.dietaryNotes}
            className="sm:col-span-2"
          >
            <Textarea
              id={registrationFieldId("dietaryNotes")}
              value={answers.dietaryNotes}
              disabled={disabled}
              rows={2}
              aria-invalid={errors.dietaryNotes ? true : undefined}
              onChange={(event) => onChange("dietaryNotes", event.target.value)}
            />
          </Field>
        )}
      </RegistrationSection>

      <RegistrationSection index={5} title="Dados bancários" description="Conta em seu nome, para pagamento.">
        <Field field="bankName" label="Banco" error={errors.bankName} className="sm:col-span-2">
          {text("bankName", { placeholder: "ex.: Itaú, Nubank, Banco do Brasil" })}
        </Field>
        <Field field="bankAgency" label="Agência" error={errors.bankAgency}>
          {text("bankAgency", { inputMode: "numeric" })}
        </Field>
        <Field field="bankAccount" label="Número da conta" hint="Com o dígito" error={errors.bankAccount}>
          {text("bankAccount")}
        </Field>
        <Field field="pixKey" label="Chave Pix" optional error={errors.pixKey} className="sm:col-span-2">
          {text("pixKey")}
        </Field>
      </RegistrationSection>

      <RegistrationSection index={6} title="Endereço completo">
        <Field
          field="cep"
          label="CEP"
          error={errors.cep}
          hint={
            cepState === "error"
              ? "CEP não encontrado. Preencha o endereço manualmente."
              : "Preenchemos o endereço a partir do CEP"
          }
        >
          <div className="relative">
            <CepInput
              id={registrationFieldId("cep")}
              value={answers.cep}
              disabled={disabled}
              aria-invalid={errors.cep ? true : undefined}
              onChange={(value) => {
                if (cepState === "error") setCepState("idle");
                onChange("cep", value);
              }}
            />
            {cepState === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </Field>
        <div className="hidden sm:block" />
        <Field field="street" label="Rua/Avenida" error={errors.street} className="sm:col-span-2">
          {text("street", { autoComplete: "address-line1" })}
        </Field>
        <Field field="number" label="Número" error={errors.number}>
          <Input
            ref={numberRef}
            id={registrationFieldId("number")}
            value={answers.number}
            disabled={disabled}
            aria-invalid={errors.number ? true : undefined}
            onChange={(event) => onChange("number", event.target.value)}
          />
        </Field>
        <Field field="complement" label="Complemento" optional error={errors.complement}>
          {text("complement", { placeholder: "Apto, bloco…" })}
        </Field>
        <Field field="district" label="Bairro" error={errors.district}>
          {text("district")}
        </Field>
        <Field field="city" label="Cidade" error={errors.city}>
          {text("city", { autoComplete: "address-level2" })}
        </Field>
        <Field field="state" label="UF" error={errors.state}>
          <OptionSelect
            field="state"
            value={answers.state}
            options={BRAZIL_UF_OPTIONS}
            placeholder="UF"
            invalid={!!errors.state}
            disabled={disabled}
            onChange={(value) => onChange("state", value)}
          />
        </Field>
      </RegistrationSection>
    </div>
  );
}
