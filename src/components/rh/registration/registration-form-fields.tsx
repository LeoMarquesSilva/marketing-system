"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Flag, Loader2 } from "lucide-react";
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
import {
  isValidCPF,
  maskBankAccount,
  maskBankAgency,
  maskEmail,
  maskOAB,
  maskPersonName,
  maskRG,
  onlyDigits,
} from "@/lib/masks-br";
import { BRAZIL_UF_OPTIONS } from "@/lib/rh/qualifications/types";
import { joinUf, maskIssuerAcronym, splitUf } from "@/lib/rh/registration/format";
import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NEEDS_DETAIL,
  DIETARY_NONE,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  HAS_OAB_OPTIONS,
  RACE_COLOR_OPTIONS,
  type Option,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import { isBrazilian, OAB_KINDS, resolveHasOab, type RegistrationErrors } from "@/lib/rh/registration/validation";
import {
  BankCombobox,
  CityUfPicker,
  NationalityCombobox,
} from "@/components/rh/registration/registration-pickers";
import { cn } from "@/lib/utils";

export function registrationFieldId(field: RegistrationField): string {
  return `fc-${field}`;
}

/** Campos de cada seção, na ordem do formulário (para esconder seções vazias). */
const SECTION_FIELDS: RegistrationField[][] = [
  ["fullName", "birthDate", "gender", "parentName", "rg", "rgIssuer", "cpf"],
  [
    "nationality",
    "birthplace",
    "raceColor",
    "pis",
    "ctpsNumber",
    "voterTitle",
    "institution",
    "coursePeriod",
    "studentRa",
    "hasOab",
    "oabNumber",
    "oabUf",
  ],
  ["personalPhone", "personalEmail", "emergencyPhone", "emergencyContactName"],
  ["bloodType", "dietaryRestrictions", "dietaryNotes"],
  ["bankName", "bankAgency", "bankAccount", "pixKey"],
  ["cep", "street", "number", "complement", "district", "city", "state"],
];

/**
 * Campos que andam juntos: quem mostra o CEP mostra o endereço que ele
 * preenche; quem mostra a restrição alimentar mostra o "especifique".
 */
const FIELD_COMPANIONS: Partial<Record<RegistrationField, RegistrationField[]>> = {
  cep: ["street", "number", "complement", "district", "city", "state"],
  dietaryRestrictions: ["dietaryNotes"],
  hasOab: ["oabNumber", "oabUf"],
  oabNumber: ["hasOab", "oabUf"],
  oabUf: ["hasOab", "oabNumber"],
  emergencyPhone: ["emergencyContactName"],
  bankAccount: ["pixKey"],
  // UF e cidade do endereço ficam no mesmo seletor.
  city: ["state"],
  state: ["city"],
};

export function withCompanionFields(fields: Iterable<RegistrationField>): Set<RegistrationField> {
  const result = new Set<RegistrationField>(fields);
  for (const field of [...result]) {
    for (const companion of FIELD_COMPANIONS[field] ?? []) result.add(companion);
  }
  return result;
}

/** Pedido de ajuste da RH: campos marcados e, deles, os que a pessoa já mexeu. */
export interface RegistrationReopenMarks {
  flagged: ReadonlySet<RegistrationField>;
  adjusted: ReadonlySet<RegistrationField>;
}

interface FieldVisibility {
  visible: ReadonlySet<RegistrationField> | null;
  missing: ReadonlySet<RegistrationField> | null;
  reopen: RegistrationReopenMarks | null;
}

const FieldVisibilityContext = createContext<FieldVisibility>({ visible: null, missing: null, reopen: null });

type FieldMarkKind = "falta" | "ajustar" | "ajustado";

/** Marca ao lado do rótulo; o pedido de ajuste da RH vem antes do "falta". */
function fieldMark(
  fields: RegistrationField[],
  missing: ReadonlySet<RegistrationField> | null,
  reopen: RegistrationReopenMarks | null
): FieldMarkKind | null {
  if (reopen && fields.some((field) => reopen.flagged.has(field))) {
    return fields.some((field) => reopen.flagged.has(field) && !reopen.adjusted.has(field)) ? "ajustar" : "ajustado";
  }
  return fields.some((field) => missing?.has(field)) ? "falta" : null;
}

function useFieldMark(fields: RegistrationField[]): FieldMarkKind | null {
  const { missing, reopen } = useContext(FieldVisibilityContext);
  return fieldMark(fields, missing, reopen);
}

/** Destaque do bloco pedido pela RH, para a pessoa achar o campo ao rolar. */
const FLAGGED_BLOCK = "fc-flagged -m-2 rounded-lg bg-amber-50/80 p-2 ring-1 ring-amber-200";

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

/** CTPS: número (e série, na carteira de papel); na digital é o CPF. */
function maskCtps(value: string): string {
  return value.replace(/[^\d./\- ]/g, "").slice(0, 20);
}

/** Cidade: letras, espaços, apóstrofo e hífen (a UF vai no seletor ao lado). */
function maskCity(value: string): string {
  return value.replace(/[^\p{L}\s'’.-]/gu, "").replace(/\s{2,}/g, " ").slice(0, 80);
}

/** RA: letras e números, em maiúsculas. */
function maskStudentRa(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9.\-/]/g, "").slice(0, 20);
}

/** Número do endereço: "123", "123A", "S/N". */
function maskAddressNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9/\- ]/g, "").slice(0, 10);
}

/**
 * Texto + UF guardados juntos ("SSP/SP", "Campinas/SP"): campo de texto com o
 * seletor de UF ao lado. Só a barra separa as partes enquanto a pessoa digita.
 */
function UfSplitInput({
  field,
  value,
  placeholder,
  mask,
  invalid,
  disabled,
  autoCapitalize,
  onChange,
}: {
  field: RegistrationField;
  value: string;
  placeholder?: string;
  mask: (value: string) => string;
  invalid?: boolean;
  disabled?: boolean;
  autoCapitalize?: string;
  onChange: (value: string) => void;
}) {
  const { head, uf } = splitUf(value);
  return (
    <div className="flex gap-2">
      <Input
        id={registrationFieldId(field)}
        className="min-w-0 flex-1"
        value={head}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize={autoCapitalize}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(joinUf(mask(event.target.value.replace(/\//g, "")), uf))}
      />
      <Select value={uf || undefined} onValueChange={(next) => onChange(joinUf(head, next))} disabled={disabled}>
        <SelectTrigger className="w-[5.5rem] shrink-0" aria-label="UF" aria-invalid={invalid || undefined}>
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          {BRAZIL_UF_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Escolha única em botões (mesmo visual das restrições alimentares). */
function ChoiceChips({
  field,
  label,
  value,
  options,
  error,
  disabled,
  onChange,
}: {
  field: RegistrationField;
  label: string;
  value: string;
  options: Option[];
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const { visible } = useContext(FieldVisibilityContext);
  const mark = useFieldMark([field]);
  if (visible && !visible.has(field)) return null;
  const labelId = `${registrationFieldId(field)}-label`;
  return (
    <div className={cn("space-y-2 sm:col-span-2", mark === "ajustar" && FLAGGED_BLOCK)} data-field={field}>
      <p id={labelId} className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium text-foreground">
        {label}
        <FieldMark kind={mark} />
      </p>
      <div
        id={registrationFieldId(field)}
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.value)}
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
      {error && (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  field,
  label,
  hint,
  error,
  optional,
  alsoFields,
  className,
  children,
}: {
  field: RegistrationField;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Outros campos que moram neste mesmo bloco (ex.: a UF ao lado da cidade). */
  alsoFields?: RegistrationField[];
  className?: string;
  children: ReactNode;
}) {
  const { visible } = useContext(FieldVisibilityContext);
  const fields = [field, ...(alsoFields ?? [])];
  const mark = useFieldMark(fields);
  if (visible && !fields.some((item) => visible.has(item))) return null;
  return (
    <div className={cn("min-w-0 space-y-1.5", mark === "ajustar" && FLAGGED_BLOCK, className)} data-field={field}>
      <label htmlFor={registrationFieldId(field)} className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
        <FieldMark kind={mark} />
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

function FieldMark({ kind }: { kind: FieldMarkKind | null }) {
  if (kind === "ajustar") {
    return (
      <span className="fc-flag inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-px text-[0.68rem] font-semibold uppercase tracking-wide text-amber-900">
        <Flag className="size-2.5" aria-hidden />
        ajustar
      </span>
    );
  }
  if (kind === "ajustado") {
    return (
      <span className="fc-adjusted inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-px text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-800">
        <Check className="size-2.5" aria-hidden />
        ajustado
      </span>
    );
  }
  if (kind === "falta") {
    return (
      <span className="fc-missing rounded-full bg-amber-100 px-2 py-px text-[0.68rem] font-semibold uppercase tracking-wide text-amber-900">
        falta
      </span>
    );
  }
  return null;
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
  visibleFields = null,
  missingFields = null,
  reopenMarks = null,
  onChange,
}: {
  kind: RegistrationKind;
  answers: RegistrationAnswers;
  errors: RegistrationErrors;
  disabled?: boolean;
  /** Mostra só estes campos (ex.: "só o que falta"); null = ficha inteira. */
  visibleFields?: ReadonlySet<RegistrationField> | null;
  /** Campos marcados com "falta" ao lado do rótulo. */
  missingFields?: ReadonlySet<RegistrationField> | null;
  /** Campos que a RH pediu para ajustar ("ajustar" até a pessoa mexer, depois "ajustado"). */
  reopenMarks?: RegistrationReopenMarks | null;
  onChange: <K extends RegistrationField>(field: K, value: RegistrationAnswers[K]) => void;
}) {
  const filtering = visibleFields !== null;
  const sectionShown = SECTION_FIELDS.map(
    (fields) => !visibleFields || fields.some((field) => visibleFields.has(field))
  );
  // Numeração contínua só entre as seções visíveis.
  const sectionIndex = (position: number) =>
    sectionShown.slice(0, position + 1).filter(Boolean).length;
  const showField = (field: RegistrationField) => !visibleFields || visibleFields.has(field);
  const asksOab = OAB_KINDS.has(kind);
  const hasOab = resolveHasOab(answers);
  // Nascido no Brasil escolhe UF + cidade da lista do IBGE; estrangeiro digita cidade e país.
  const bornInBrazil = !answers.nationality.trim() || isBrazilian(answers.nationality);
  const birthplace = splitUf(answers.birthplace);
  const [cepState, setCepState] = useState<"idle" | "loading" | "error">("idle");
  const lastCep = useRef(onlyDigits(answers.cep));
  const numberRef = useRef<HTMLInputElement>(null);

  const text = (
    field: RegistrationField,
    extra?: {
      mask?: (value: string) => string;
      placeholder?: string;
      autoComplete?: string;
      autoCapitalize?: string;
      inputMode?: "numeric" | "text" | "email" | "tel";
      type?: "text" | "email";
    }
  ) => (
    <Input
      id={registrationFieldId(field)}
      type={extra?.type ?? "text"}
      value={answers[field] as string}
      disabled={disabled}
      placeholder={extra?.placeholder}
      autoComplete={extra?.autoComplete ?? "off"}
      autoCapitalize={extra?.autoCapitalize}
      inputMode={extra?.inputMode}
      aria-invalid={errors[field] ? true : undefined}
      onChange={(event) => onChange(field, (extra?.mask ? extra.mask(event.target.value) : event.target.value) as never)}
    />
  );
  const cpfReady = isValidCPF(answers.cpf);

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
  const dietaryMark = fieldMark(["dietaryRestrictions"], missingFields, reopenMarks);

  return (
    <FieldVisibilityContext.Provider value={{ visible: visibleFields, missing: missingFields, reopen: reopenMarks }}>
      <div className="space-y-5">
        {sectionShown[0] && (
          <RegistrationSection index={sectionIndex(0)} title="Dados pessoais">
            <Field field="fullName" label="Nome completo" error={errors.fullName} className="sm:col-span-2">
              {text("fullName", { autoComplete: "name", autoCapitalize: "words", mask: maskPersonName })}
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
              {text("parentName", { autoCapitalize: "words", mask: maskPersonName })}
            </Field>
            <Field field="rg" label="Número do RG" error={errors.rg}>
              {text("rg", { mask: maskRG, placeholder: "00.000.000-0" })}
            </Field>
            <Field field="rgIssuer" label="Órgão emissor e UF" hint="Sigla do órgão, ex.: SSP, DETRAN" error={errors.rgIssuer}>
              <UfSplitInput
                field="rgIssuer"
                value={answers.rgIssuer}
                placeholder="SSP"
                mask={maskIssuerAcronym}
                invalid={!!errors.rgIssuer}
                disabled={disabled}
                autoCapitalize="characters"
                onChange={(value) => onChange("rgIssuer", value)}
              />
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
        )}

        {sectionShown[1] && (
          <RegistrationSection index={sectionIndex(1)} title="Dados complementares">
            <Field field="nationality" label="Nacionalidade" error={errors.nationality}>
              <NationalityCombobox
                id={registrationFieldId("nationality")}
                value={answers.nationality}
                invalid={!!errors.nationality}
                disabled={disabled}
                onChange={(value) => onChange("nationality", maskCity(value))}
              />
            </Field>
            {bornInBrazil ? (
              <Field field="birthplace" label="Naturalidade" hint="Estado e cidade onde você nasceu" error={errors.birthplace}>
                <CityUfPicker
                  id={registrationFieldId("birthplace")}
                  ufId={`${registrationFieldId("birthplace")}-uf`}
                  uf={birthplace.uf}
                  city={birthplace.head}
                  invalid={!!errors.birthplace}
                  disabled={disabled}
                  onChange={(next) => onChange("birthplace", joinUf(next.city, next.uf))}
                />
              </Field>
            ) : (
              <Field field="birthplace" label="Naturalidade" hint="Cidade e país onde você nasceu" error={errors.birthplace}>
                {text("birthplace", { placeholder: "ex.: Lisboa, Portugal", autoCapitalize: "words" })}
              </Field>
            )}
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
              {text("pis", { mask: maskPIS, inputMode: "numeric", placeholder: "000.00000.00-0" })}
            </Field>

            {kind === "clt" && (
              <>
                <Field
                  field="ctpsNumber"
                  label="Número da carteira de trabalho digital"
                  hint="Na CTPS digital, costuma ser o próprio CPF"
                  error={errors.ctpsNumber}
                >
                  {text("ctpsNumber", { mask: maskCtps, inputMode: "numeric" })}
                  {cpfReady && !answers.ctpsNumber && !disabled && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline underline-offset-2"
                      onClick={() => onChange("ctpsNumber", answers.cpf)}
                    >
                      É o mesmo número do meu CPF
                    </button>
                  )}
                </Field>
                <Field field="voterTitle" label="Título de eleitor" error={errors.voterTitle}>
                  {text("voterTitle", { mask: maskVoterTitle, inputMode: "numeric", placeholder: "0000 0000 0000" })}
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
                  {text("studentRa", { mask: maskStudentRa })}
                </Field>
              </>
            )}

            {asksOab && (
              <ChoiceChips
                field="hasOab"
                label="Você tem inscrição na OAB?"
                value={hasOab}
                options={HAS_OAB_OPTIONS}
                error={errors.hasOab}
                disabled={disabled}
                onChange={(value) => onChange("hasOab", value)}
              />
            )}
            {asksOab && hasOab === "sim" && (
              <>
                <Field field="oabNumber" label="Número da OAB" error={errors.oabNumber}>
                  {text("oabNumber", { mask: maskOAB, inputMode: "numeric", placeholder: "000.000" })}
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
        )}

        {sectionShown[2] && (
          <RegistrationSection index={sectionIndex(2)} title="Contato">
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
              {text("personalEmail", {
                autoComplete: "email",
                inputMode: "email",
                type: "email",
                autoCapitalize: "none",
                placeholder: "voce@email.com",
                mask: maskEmail,
              })}
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
        )}

        {sectionShown[3] && (
          <RegistrationSection
            index={sectionIndex(3)}
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
            {!filtering && <div className="hidden sm:block" />}
            {showField("dietaryRestrictions") && (
              <div className={cn("space-y-2 sm:col-span-2", dietaryMark === "ajustar" && FLAGGED_BLOCK)} data-field="dietaryRestrictions">
                <p
                  id={registrationFieldId("dietaryRestrictions")}
                  className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium text-foreground"
                  tabIndex={-1}
                >
                  Restrição alimentar
                  <FieldMark kind={dietaryMark} />
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
            )}
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
        )}

        {sectionShown[4] && (
          <RegistrationSection index={sectionIndex(4)} title="Dados bancários" description="Conta em seu nome, para pagamento.">
            <Field field="bankName" label="Banco" error={errors.bankName} className="sm:col-span-2">
              <BankCombobox
                id={registrationFieldId("bankName")}
                value={answers.bankName}
                invalid={!!errors.bankName}
                disabled={disabled}
                onChange={(value) => onChange("bankName", value)}
              />
            </Field>
            <Field field="bankAgency" label="Agência" hint="Com o dígito, se houver" error={errors.bankAgency}>
              {text("bankAgency", { mask: maskBankAgency, inputMode: "numeric", placeholder: "0000" })}
            </Field>
            <Field field="bankAccount" label="Número da conta" hint="Com o dígito" error={errors.bankAccount}>
              {text("bankAccount", { mask: maskBankAccount, inputMode: "numeric", placeholder: "00000-0" })}
            </Field>
            <Field
              field="pixKey"
              label="Chave Pix"
              optional
              hint="CPF, e-mail, celular ou chave aleatória"
              error={errors.pixKey}
              className="sm:col-span-2"
            >
              {text("pixKey", { autoCapitalize: "none" })}
            </Field>
          </RegistrationSection>
        )}

        {sectionShown[5] && (
          <RegistrationSection index={sectionIndex(5)} title="Endereço completo">
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
            {!filtering && <div className="hidden sm:block" />}
            <Field field="street" label="Rua/Avenida" error={errors.street} className="sm:col-span-2">
              {text("street", { autoComplete: "address-line1" })}
            </Field>
            <Field field="number" label="Número" error={errors.number}>
              <Input
                ref={numberRef}
                id={registrationFieldId("number")}
                value={answers.number}
                disabled={disabled}
                placeholder="ex.: 123 ou S/N"
                autoComplete="off"
                aria-invalid={errors.number ? true : undefined}
                onChange={(event) => onChange("number", maskAddressNumber(event.target.value))}
              />
            </Field>
            <Field field="complement" label="Complemento" optional error={errors.complement}>
              {text("complement", { placeholder: "Apto, bloco…" })}
            </Field>
            <Field field="district" label="Bairro" error={errors.district}>
              {text("district")}
            </Field>
            <Field field="city" label="Estado e cidade" alsoFields={["state"]} error={errors.state ?? errors.city}>
              <CityUfPicker
                id={registrationFieldId("city")}
                ufId={registrationFieldId("state")}
                uf={answers.state}
                city={answers.city}
                invalid={!!(errors.city || errors.state)}
                disabled={disabled}
                onChange={(next) => {
                  if (next.uf !== answers.state) onChange("state", next.uf);
                  if (next.city !== answers.city) onChange("city", next.city);
                }}
              />
            </Field>
          </RegistrationSection>
        )}
      </div>
    </FieldVisibilityContext.Provider>
  );
}
