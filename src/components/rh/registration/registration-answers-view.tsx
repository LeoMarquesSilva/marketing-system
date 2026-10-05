"use client";

import type { ReactNode } from "react";
import {
  BLOOD_TYPE_OPTIONS,
  DIETARY_NONE,
  dietaryLabel,
  GENDER_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  type RegistrationAnswers,
  type RegistrationKind,
} from "@/lib/rh/registration/types";

function formatBirthDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card">
      <h3 className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <dl className="grid gap-x-6 gap-y-3 px-4 py-3.5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Item({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  const empty = value === "" || value === null || value === undefined;
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">
        {empty ? <span className="text-muted-foreground">—</span> : value}
      </dd>
    </div>
  );
}

/** Leitura da ficha enviada, nas mesmas seções do formulário. */
export function RegistrationAnswersView({
  kind,
  answers,
}: {
  kind: RegistrationKind;
  answers: RegistrationAnswers;
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

  return (
    <div className="space-y-3">
      <Group title="Dados pessoais">
        <Item label="Nome completo" value={answers.fullName} wide />
        <Item label="Data de nascimento" value={formatBirthDate(answers.birthDate)} />
        <Item label="Gênero" value={optionLabel(GENDER_OPTIONS, answers.gender)} />
        <Item label="Nome da mãe/pai" value={answers.parentName} wide />
        <Item label="RG" value={answers.rg} />
        <Item label="Órgão emissor / UF" value={answers.rgIssuer} />
        <Item label="CPF" value={answers.cpf} />
      </Group>

      <Group title="Dados complementares">
        <Item label="Nacionalidade" value={answers.nationality} />
        <Item label="Naturalidade" value={answers.birthplace} />
        <Item label="Raça/cor" value={optionLabel(RACE_COLOR_OPTIONS, answers.raceColor)} />
        <Item label="PIS" value={answers.pis} />
        {kind === "clt" && (
          <>
            <Item label="Carteira de trabalho digital" value={answers.ctpsNumber} />
            <Item label="Título de eleitor" value={answers.voterTitle} />
          </>
        )}
        {kind === "estagio" && (
          <>
            <Item label="Instituição de ensino" value={answers.institution} wide />
            <Item label="Ano/período" value={answers.coursePeriod} />
            <Item label="RA" value={answers.studentRa} />
          </>
        )}
        {kind === "socio_servico" && (
          <Item
            label="OAB"
            value={answers.oabNumber ? `${answers.oabNumber}${answers.oabUf ? `/${answers.oabUf}` : ""}` : ""}
          />
        )}
      </Group>

      <Group title="Contato">
        <Item label="Telefone particular" value={answers.personalPhone} />
        <Item label="E-mail particular" value={answers.personalEmail} />
        <Item label="Telefone de emergência" value={answers.emergencyPhone} />
        <Item label="Contato de emergência" value={answers.emergencyContactName} />
      </Group>

      <Group title="Saúde e alimentação">
        <Item label="Tipo sanguíneo" value={optionLabel(BLOOD_TYPE_OPTIONS, answers.bloodType)} />
        <Item
          label="Restrição alimentar"
          value={
            dietary.length === 0
              ? ""
              : dietary.includes(DIETARY_NONE)
                ? "Nenhuma restrição"
                : dietary.map(dietaryLabel).join(", ")
          }
        />
        {answers.dietaryNotes && <Item label="Detalhe" value={answers.dietaryNotes} wide />}
      </Group>

      <Group title="Dados bancários">
        <Item label="Banco" value={answers.bankName} wide />
        <Item label="Agência" value={answers.bankAgency} />
        <Item label="Conta" value={answers.bankAccount} />
        <Item label="Chave Pix" value={answers.pixKey} wide />
      </Group>

      <Group title="Endereço">
        <Item label="Endereço completo" value={address} wide />
      </Group>
    </div>
  );
}
