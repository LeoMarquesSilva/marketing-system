"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocBoard, DocProject, DocProjectVersion } from "@/lib/documentario/types";
import { docRequest } from "./shared";

export function ProjectDialog({ project, onClose, onSaved }: { project: DocProject; onClose: () => void; onSaved: (project: DocProject) => void }) {
  const [form, setForm] = useState({
    title: project.title,
    subtitle: project.subtitle ?? "",
    tagline: project.tagline ?? "",
    signature: project.signature ?? "",
    status_label: project.status_label ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = (key: keyof typeof form, label: string, multiline = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`projeto-${key}`}>{label}</Label>
      {multiline ? (
        <Textarea id={`projeto-${key}`} rows={2} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      ) : (
        <Input id={`projeto-${key}`} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
      )}
    </div>
  );
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">Cartela do projeto</DialogTitle>
          <DialogDescription className="text-sm">Título, linha conceitual e assinatura final.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {field("title", "Título")}
          {field("tagline", "Linha conceitual", true)}
          {field("signature", "Assinatura final")}
          {field("subtitle", "Descrição", true)}
          {field("status_label", "Status")}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || form.title.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await docRequest<{ project: DocProject }>({ action: "project.update", ...form });
                onSaved(result.project);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Não foi possível salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function nextVersionLabel(current: string): string {
  const parts = current.split(".").map(Number);
  if (parts.some(Number.isNaN)) return current;
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

export function CloseVersionDialog({ board, onClose, onSaved }: { board: DocBoard; onClose: () => void; onSaved: (versions: DocProjectVersion[], label: string) => void }) {
  const last = board.versions[0];
  const changed = last ? board.sections.filter((section) => (last.section_versions[section.slug] ?? 0) !== section.version) : board.sections;
  const [label, setLabel] = useState(nextVersionLabel(board.project.version_label));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <div className="border-b border-[#e6eef0] px-5 py-4 pr-12">
          <DialogTitle className="text-base">Fechar versão do projeto</DialogTitle>
          <DialogDescription className="text-sm">As próximas decisões dos sócios ficam registradas nesta versão.</DialogDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Mudou desde a {last?.version_label ?? "primeira versão"}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {changed.map((section) => (
                <li key={section.id}>
                  {section.title} <span className="text-xs text-muted-foreground">(v{section.version})</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="versao-rotulo">Número da versão</Label>
            <Input id="versao-rotulo" value={label} onChange={(event) => setLabel(event.target.value)} className="w-32 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="versao-nota">O que muda nesta versão</Label>
            <Textarea id="versao-nota" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: ajustes da reunião com os sócios; pergunta 20 retirada" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6eef0] px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy || note.trim().length < 3 || !/^\d+(\.\d+){1,2}$/.test(label.trim())}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const result = await docRequest<{ versions: DocProjectVersion[]; version_label: string }>({ action: "project.closeVersion", label: label.trim(), note: note.trim() });
                onSaved(result.versions, result.version_label);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Não foi possível fechar a versão.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Fechar versão {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

