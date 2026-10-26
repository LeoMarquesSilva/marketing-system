"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Check, Flag } from "lucide-react";
import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NONE,
  dietaryLabel,
  GENDER_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  type PersonalBankAccount,
  type RegistrationAnswers,
  type RegistrationField,
  type RegistrationKind,
} from "@/lib/rh/registration/types";
import { OAB_KINDS, resolveHasOab } from "@/lib/rh/registration/validation";
import { cn } from "@/lib/utils";

function formatBirthDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface FieldMarks {
  /** Campos que a RH marcou para ajuste (destaque em âmbar). */
  flagged: ReadonlySet<RegistrationField>;
  /** Modo de marcar: clicar no campo marca/desmarca para devolver. */
  selection: { selected: ReadonlySet<RegistrationField>; onToggle: (fields: RegistrationField[]) => void } | null;
}

const MarksContext = createContext<FieldMarks>({ flagged: new Set(), selection: null });

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/70 bg-card">
      <h3 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground">{title}</h3>
      <dl className="grid gap-x-4 gap-y-1.5 px-2.5 py-2.5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({
  label,
  value,
  fields,
  wide,
}: {
  label: string;
  value: ReactNode;
  /** Campos da ficha que este item mostra (para marcar ou destacar). */
  fields: RegistrationField[];
  wide?: boolean;
}) {
  const { flagged, selection } = useContext(MarksContext);
  const empty = value === "" || value === null || value === undefined;
  const isFlagged = fields.some((field) => flagged.has(field));
  const isSelected = selection ? fields.some((field) => selection.selected.has(field)) : false;

  const content = (
    <>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {selection && (
          <span
            className={cn(
              "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
              isSelected ? "border-amber-600 bg-amber-600 text-white" : "border-input bg-white"
            )}
          >
            {isSelected && <Check className="h-2.5 w-2.5" />}
          </span>
        )}
        {label}
        {!selection && isFlagged && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900">
            <Flag className="h-2.5 w-2.5" />
            ajustar
          </span>
        )}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">
        {empty ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </>
  );

  const box = cn(
    "rounded-md px-1.5 py-1.5",
    wide && "sm:col-span-2",
    (isFlagged && !selection) && "bg-amber-50 ring-1 ring-amber-200",
    isSelected && "bg-amber-50 ring-1 ring-amber-300"
  );

  if (selection) {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => selection.onToggle(fields)}
        className={cn(box, "text-left transition-colors hover:bg-amber-50/70")}
      >
        {content}
      </button>
    );
  }
  return <div className={box}>{content}</div>;
}

/**
 * Leitura da ficha, nas mesmas seções do formulário. Na visão do RH, destaca
 * os campos devolvidos para ajuste e, no modo de marcar, cada campo vira um
 * botão para escolher o que a pessoa precisa corrigir.
 */
export function RegistrationAnswersView({
  kind,
  answers,
  personalBank = null,
  flaggedFields,
  selection = null,
}: {
  kind: RegistrationKind;
  answers: RegistrationAnswers;
  /** Conta particular declarada antes da conta da folha (só na visão do RH). */
  personalBank?: PersonalBankAccount | null;
  flaggedFields?: readonly RegistrationField[];
  selection?: FieldMarks["selection"];
}) {
  const dietary = answers.dietaryRestrictions;
  const address = [
    [answers.street, answers.number].filter(Boolean).join(", "),
    answers.complement,
    answers.district,
    [answers.city, answers.state].filter(Boolean).join("/"),
    answers.cep,
  ]
    .filter(Boolean)
    .join(" · ");
  const marks: FieldMarks = { flagged: new Set(flaggedFields ?? []), selection };
  const hasOab = resolveHasOab(answers);

  return (
    <MarksContext.Provider value={marks}>
      <div className="space-y-3">
        <Group title="Dados pessoais">
          <Item label="Nome completo" value={answers.fullName} fields={["fullName"]} wide />
          <Item label="Data de nascimento" value={formatBirthDate(answers.birthDate)} fields={["birthDate"]} />
          <Item label="Gênero" value={optionLabel(GENDER_OPTIONS, answers.gender)} fields={["gender"]} />
          <Item label="Nome da mãe/pai" value={answers.parentName} fields={["parentName"]} wide />
          <Item label="RG" value={answers.rg} fields={["rg"]} />
          <Item label="Órgão emissor / UF" value={answers.rgIssuer} fields={["rgIssuer"]} />
          <Item label="CPF" value={answers.cpf} fields={["cpf"]} />
        </Group>

        <Group title="Dados complementares">
          <Item label="Nacionalidade" value={answers.nationality} fields={["nationality"]} />
          <Item label="Naturalidade" value={answers.birthplace} fields={["birthplace"]} />
          <Item label="Raça/cor" value={optionLabel(RACE_COLOR_OPTIONS, answers.raceColor)} fields={["raceColor"]} />
          <Item label="PIS" value={answers.pis} fields={["pis"]} />
          {kind === "clt" && (
            <>
              <Item label="Carteira de trabalho digital" value={answers.ctpsNumber} fields={["ctpsNumber"]} />
              <Item label="Título de eleitor" value={answers.voterTitle} fields={["voterTitle"]} />
            </>
          )}
          {kind === "estagio" && (
            <>
              <Item label="Instituição de ensino" value={answers.institution} fields={["institution"]} wide />
              <Item label="Ano/período" value={answers.coursePeriod} fields={["coursePeriod"]} />
              <Item label="RA" value={answers.studentRa} fields={["studentRa"]} />
            </>
          )}
          {OAB_KINDS.has(kind) && (
            <Item
              label="OAB"
              fields={["hasOab", "oabNumber", "oabUf"]}
              value={
                answers.oabNumber
                  ? `${answers.oabNumber}${answers.oabUf ? `/${answers.oabUf}` : ""}`
                  : hasOab === "nao"
                    ? "Não tem inscrição"
                    : ""
              }
            />
          )}
        </Group>

        <Group title="Contato">
          <Item label="Telefone particular" value={answers.personalPhone} fields={["personalPhone"]} />
          <Item label="E-mail particular" value={answers.personalEmail} fields={["personalEmail"]} />
          <Item label="Telefone de emergência" value={answers.emergencyPhone} fields={["emergencyPhone"]} />
          <Item label="Contato de emergência" value={answers.emergencyContactName} fields={["emergencyContactName"]} />
        </Group>

        <Group title="Saúde e alimentação">
          <Item label="Tipo sanguíneo" value={optionLabel(BLOOD_TYPE_OPTIONS, answers.bloodType)} fields={["bloodType"]} />
          <Item
            label="Restrição alimentar"
            fields={["dietaryRestrictions", "dietaryNotes"]}
            value={
              dietary.length === 0
                ? ""
                : dietary.includes(DIETARY_NONE)
                  ? "Nenhuma restrição"
                  : dietary.map(dietaryLabel).join(", ")
            }
          />
          {answers.dietaryNotes && <Item label="Detalhe" value={answers.dietaryNotes} fields={["dietaryNotes"]} wide />}
        </Group>

        <Group title="Dados bancários">
          <Item label={personalBank ? "Banco (conta da folha)" : "Banco"} value={answers.bankName} fields={["bankName"]} wide />
          <Item label="Agência" value={answers.bankAgency} fields={["bankAgency"]} />
          <Item label="Conta" value={answers.bankAccount} fields={["bankAccount"]} />
          <Item label="Chave Pix" value={answers.pixKey} fields={["pixKey"]} wide />
          {personalBank && !selection && (
            <div className="rounded-md px-1.5 py-1.5 sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Conta particular (declarada pela pessoa)</dt>
              <dd className="mt-0.5 break-words text-sm text-foreground">
                {[
                  personalBank.bankName,
                  personalBank.bankAgency && `agência ${personalBank.bankAgency}`,
                  personalBank.bankAccount && `conta ${personalBank.bankAccount}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </div>
          )}
        </Group>

        <Group title="Endereço">
          {selection ? (
            <>
              <Item label="CEP" value={answers.cep} fields={["cep"]} />
              <Item label="Número" value={answers.number} fields={["number"]} />
              <Item label="Rua/Avenida" value={answers.street} fields={["street"]} wide />
              <Item label="Complemento" value={answers.complement} fields={["complement"]} />
              <Item label="Bairro" value={answers.district} fields={["district"]} />
              <Item
                label="Cidade/UF"
                value={[answers.city, answers.state].filter(Boolean).join("/")}
                fields={["city", "state"]}
              />
            </>
          ) : (
            <Item
              label="Endereço completo"
              value={address}
              fields={["cep", "street", "number", "complement", "district", "city", "state"]}
              wide
            />
          )}
        </Group>
      </div>
    </MarksContext.Provider>
  );
}
