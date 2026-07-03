"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STANDARD_MERGE_TAGS,
  type MergeTagDefinition,
} from "@/lib/email-marketing-merge-tags";
import { rdFieldLabel } from "@/lib/email-marketing-rd-fields";

interface MergeTagPickerProps {
  /** id do input/textarea alvo para inserir a variável */
  targetId?: string;
  value?: string;
  onInsert?: (nextValue: string) => void;
  /** Tags extras (ex.: campos rd_* mais usados) */
  extraTags?: MergeTagDefinition[];
  compact?: boolean;
}

const COMMON_RD_TAGS: MergeTagDefinition[] = [
  { tag: "rd_cargo_e_book", label: rdFieldLabel("rd_cargo_e_book"), example: "Gerente de RH" },
  { tag: "rd_grupo_empresa", label: rdFieldLabel("rd_grupo_empresa"), example: "Grupo Exemplo" },
  { tag: "rd_cidade_empresa", label: rdFieldLabel("rd_cidade_empresa"), example: "Campinas" },
  { tag: "rd_estado_empresa", label: rdFieldLabel("rd_estado_empresa"), example: "SP" },
];

export function MergeTagPicker({
  targetId,
  value,
  onInsert,
  extraTags,
  compact = false,
}: MergeTagPickerProps) {
  const tags = [...STANDARD_MERGE_TAGS, ...(extraTags ?? COMMON_RD_TAGS)];

  const insert = (tag: string) => {
    const token = `{{${tag}}}`;
    if (onInsert && value != null) {
      onInsert(value + (value && !value.endsWith(" ") ? " " : "") + token);
      return;
    }
    if (!targetId) return;
    const el = document.getElementById(targetId) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  };

  return (
    <div className="space-y-1.5">
      {!compact && (
        <Label className="text-xs text-muted-foreground">
          Variáveis de personalização
        </Label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((item) => (
          <Button
            key={item.tag}
            type="button"
            variant="outline"
            size="xs"
            className="h-7 gap-1 font-mono text-[11px]"
            title={`Exemplo: ${item.example}`}
            onClick={() => insert(item.tag)}
          >
            <Plus className="h-3 w-3 opacity-60" />
            {`{{${item.tag}}}`}
          </Button>
        ))}
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          No envio, cada variável é trocada pelos dados do contato. Use no assunto e no corpo do e-mail.
        </p>
      )}
    </div>
  );
}

/** Campo de assunto com picker de variáveis integrado. */
export function SubjectWithMergeTags({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <MergeTagPicker targetId={id} value={value} onInsert={onChange} compact />
    </div>
  );
}
