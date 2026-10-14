"use client";

import { useRef, useState } from "react";
import { ClipboardPaste, Eye, FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  dedupeParticipants,
  newParticipantId,
  participantsFromRows,
  participantsFromText,
  type CertificateParticipant,
} from "@/lib/certificados/participants";
import { cn } from "@/lib/utils";
import { FormSection } from "./certificate-form-sections";

interface ParticipantsPanelProps {
  participants: CertificateParticipant[];
  onChange: (next: CertificateParticipant[]) => void;
  previewId: string | null;
  onPreview: (id: string) => void;
  nomeEmMaiusculas: boolean;
  onToggleMaiusculas: (value: boolean) => void;
}

/** CSV do Excel vem em UTF-8 ("CSV UTF-8") ou em Windows-1252 ("CSV" comum no Windows). */
function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const isText = /\.(csv|txt)$/i.test(file.name) || file.type.startsWith("text/");
  const workbook = isText
    ? XLSX.read(decodeCsv(buffer), { type: "string" })
    : XLSX.read(buffer, { type: "array" });
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    if (rows.length > 0) return rows;
  }
  return [];
}

export function ParticipantsPanel({
  participants,
  onChange,
  previewId,
  onPreview,
  nomeEmMaiusculas,
  onToggleMaiusculas,
}: ParticipantsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const addMany = (incoming: CertificateParticipant[], origem: string) => {
    if (incoming.length === 0) {
      setMessage({ tone: "error", text: `Não encontrei nomes em ${origem}. Confira se há uma coluna “Nome”.` });
      return;
    }
    const merged = dedupeParticipants([...participants, ...incoming]);
    const added = merged.length - participants.length;
    const repeated = incoming.length - added;
    setMessage({
      tone: "ok",
      text:
        `${added} ${added === 1 ? "pessoa adicionada" : "pessoas adicionadas"} de ${origem}` +
        (repeated > 0 ? ` (${repeated} já ${repeated === 1 ? "estava" : "estavam"} na lista).` : "."),
    });
    onChange(merged);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setMessage(null);
    try {
      addMany(participantsFromRows(await readSpreadsheet(file)), file.name);
    } catch {
      setMessage({ tone: "error", text: `Não consegui ler ${file.name}. Envie um .xlsx, .xls ou .csv.` });
    } finally {
      setImporting(false);
    }
  };

  const update = (id: string, patch: Partial<CertificateParticipant>) =>
    onChange(participants.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const filled = participants.filter((p) => p.nome.trim()).length;

  return (
    <FormSection
      title="Participantes"
      description={
        filled > 0
          ? `${filled} ${filled === 1 ? "certificado" : "certificados"} a gerar.`
          : "Importe a planilha com a coluna “Nome” (e “E-mail”, se tiver)."
      }
      action={
        participants.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Limpar lista
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
          Importar planilha
        </Button>
        <Button type="button" variant="outline" onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
          <ClipboardPaste />
          Colar nomes
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const id = newParticipantId();
            onChange([...participants, { id, nome: "", email: null }]);
            setFocusId(id);
          }}
        >
          <Plus />
          Adicionar pessoa
        </Button>
      </div>

      {pasteOpen && (
        <div className="mt-3 space-y-2">
          <Textarea
            aria-label="Nomes para colar"
            rows={5}
            value={pasteText}
            placeholder={"Um nome por linha. Pode vir com e-mail:\nAna Nunes Galvão; ana@exemplo.com.br"}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!pasteText.trim()}
              onClick={() => {
                addMany(participantsFromText(pasteText), "texto colado");
                setPasteText("");
                setPasteOpen(false);
              }}
            >
              Adicionar à lista
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPasteOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className={cn("mt-3 text-sm", message.tone === "error" ? "text-destructive" : "text-[#285f7a]")}>
          {message.text}
        </p>
      )}

      <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="size-4 accent-[#347796]"
          checked={nomeEmMaiusculas}
          onChange={(e) => onToggleMaiusculas(e.target.checked)}
        />
        Nome em letras maiúsculas no certificado
      </label>

      {participants.length > 0 && (
        <div className="mt-4 max-h-[460px] overflow-auto rounded-md border border-[#dce9eb]">
          <table className="w-full min-w-[440px] text-sm">
            <thead className="sticky top-0 z-10 bg-[#f6fafb] text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Nome</th>
                <th className="px-2 py-2 font-medium">E-mail</th>
                <th className="w-20 px-2 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8f0f1]">
              {participants.map((participant, index) => {
                const active = participant.id === previewId;
                return (
                  <tr key={participant.id} className={cn(active && "bg-[#e8f8f8]/70")}>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Nome do participante ${index + 1}`}
                        className="h-9"
                        value={participant.nome}
                        autoFocus={participant.id === focusId}
                        onChange={(e) => update(participant.id, { nome: e.target.value })}
                        onFocus={() => onPreview(participant.id)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`E-mail do participante ${index + 1}`}
                        className="h-9"
                        type="email"
                        value={participant.email ?? ""}
                        placeholder="opcional"
                        onChange={(e) => update(participant.id, { email: e.target.value.trim() || null })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Ver certificado de ${participant.nome || "participante"} na prévia`}
                          aria-pressed={active}
                          onClick={() => onPreview(participant.id)}
                        >
                          <Eye />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${participant.nome || "participante"}`}
                          onClick={() => onChange(participants.filter((p) => p.id !== participant.id))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FormSection>
  );
}
