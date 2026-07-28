"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditorState } from "@/lib/profiles/editor";

/** Interruptor individual de visibilidade de um contato. */
function VisibilityToggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-[#eef5f6] px-3 py-2"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#347796] disabled:opacity-40"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function ProfileContactForm({
  state,
  onChange,
}: {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Contatos</h3>
        <p className="text-xs text-muted-foreground">
          Cada canal só aparece na página pública se você ligar aqui. Telefone e
          WhatsApp começam desligados.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="professionalEmail">E-mail institucional</Label>
          <Input
            id="professionalEmail"
            type="email"
            value={state.professionalEmail}
            onChange={(event) => onChange({ professionalEmail: event.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="professionalPhone">Telefone / WhatsApp</Label>
          <Input
            id="professionalPhone"
            value={state.professionalPhone}
            onChange={(event) => onChange({ professionalPhone: event.target.value })}
            placeholder="+55 19 90000-0000"
          />
        </div>

        <div>
          <Label htmlFor="linkedinUrl">LinkedIn</Label>
          <Input
            id="linkedinUrl"
            value={state.linkedinUrl}
            onChange={(event) => onChange({ linkedinUrl: event.target.value })}
            placeholder="https://www.linkedin.com/in/…"
          />
        </div>

        <div>
          <Label htmlFor="websiteUrl">Site</Label>
          <Input
            id="websiteUrl"
            value={state.websiteUrl}
            onChange={(event) => onChange({ websiteUrl: event.target.value })}
            placeholder="https://bismarchipires.com.br"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          O que aparece na página pública
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <VisibilityToggle
            id="showEmail"
            checked={state.showEmail}
            onChange={(value) => onChange({ showEmail: value })}
            label="Mostrar e-mail"
            hint={!state.professionalEmail.trim() ? "Preencha o e-mail para poder exibir." : undefined}
            disabled={!state.professionalEmail.trim()}
          />
          <VisibilityToggle
            id="showWhatsapp"
            checked={state.showWhatsapp}
            onChange={(value) => onChange({ showWhatsapp: value })}
            label="Mostrar WhatsApp"
            hint={
              !state.professionalPhone.trim()
                ? "Preencha o telefone para poder exibir."
                : "Só ligue com o consentimento da pessoa."
            }
            disabled={!state.professionalPhone.trim()}
          />
          <VisibilityToggle
            id="showLinkedin"
            checked={state.showLinkedin}
            onChange={(value) => onChange({ showLinkedin: value })}
            label="Mostrar LinkedIn"
            disabled={!state.linkedinUrl.trim()}
          />
          <VisibilityToggle
            id="showWebsite"
            checked={state.showWebsite}
            onChange={(value) => onChange({ showWebsite: value })}
            label="Mostrar site"
            disabled={!state.websiteUrl.trim()}
          />
          <VisibilityToggle
            id="showTenure"
            checked={state.showTenure}
            onChange={(value) => onChange({ showTenure: value })}
            label="Mostrar tempo de casa"
            hint="Calculado a partir da data de admissão."
          />
        </div>
      </fieldset>

      <div className="sm:max-w-xs">
        <Label htmlFor="joinedOn">Data de admissão</Label>
        <Input
          id="joinedOn"
          type="date"
          value={state.joinedOn}
          onChange={(event) => onChange({ joinedOn: event.target.value })}
        />
      </div>
    </section>
  );
}
