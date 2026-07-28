"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ImportRowOutcome,
  ProfessionalProfileImportPreviewRow,
  ProfessionalProfileImportResult,
} from "@/lib/profiles/types";

type PreviewPayload = {
  rows: ProfessionalProfileImportPreviewRow[];
  counts: Record<ImportRowOutcome | "total", number>;
};

/** Como cada resultado é apresentado na revisão. */
const OUTCOME_META: Record<
  ImportRowOutcome,
  { label: string; description: string; selectable: boolean; tone: string }
> = {
  create: {
    label: "Novos perfis",
    description: "Serão criados como rascunho.",
    selectable: true,
    tone: "text-emerald-800",
  },
  update: {
    label: "Com alterações",
    description: "Campos vazios do perfil serão preenchidos.",
    selectable: true,
    tone: "text-[#285f7a]",
  },
  unchanged: {
    label: "Sem mudanças",
    description: "Já estão iguais à planilha.",
    selectable: true,
    tone: "text-muted-foreground",
  },
  inactiveSource: {
    label: "Inativos na planilha",
    description: "Desmarcados por padrão — marque só se quiser importar mesmo assim.",
    selectable: true,
    tone: "text-amber-800",
  },
  unmatched: {
    label: "Sem usuário correspondente",
    description: "Nenhum usuário do sistema tem esse e-mail. Corrija a planilha e reenvie.",
    selectable: false,
    tone: "text-slate-600",
  },
  duplicate: {
    label: "E-mail repetido na planilha",
    description: "A mesma pessoa aparece duas vezes. Corrija a origem.",
    selectable: false,
    tone: "text-slate-600",
  },
};

const OUTCOME_ORDER: ImportRowOutcome[] = [
  "create",
  "update",
  "inactiveSource",
  "unchanged",
  "unmatched",
  "duplicate",
];

export function ProfileImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfessionalProfileImportResult | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<ImportRowOutcome, ProfessionalProfileImportPreviewRow[]>();
    for (const row of preview?.rows ?? []) {
      const list = map.get(row.outcome) ?? [];
      list.push(row);
      map.set(row.outcome, list);
    }
    return map;
  }, [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setError(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUpload(nextFile: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", nextFile);
      const response = await fetch("/api/nfc/profiles/import/preview", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível ler a planilha.");
      }
      const data = payload as PreviewPayload;
      setPreview(data);
      setFile(nextFile);
      // Só o que a reconciliação considerou seguro já vem marcado.
      setSelected(
        new Set(data.rows.filter((row) => row.selectedByDefault).map((row) => row.email))
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao ler a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!file || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("emails", JSON.stringify(Array.from(selected)));
      body.append("overwrite", "false");
      const response = await fetch("/api/nfc/profiles/import/apply", {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível concluir a importação.");
      }
      setResult(payload as ProfessionalProfileImportResult);
      await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha na importação.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(email: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar colaboradores</DialogTitle>
          <DialogDescription>
            Revise o que será criado ou alterado antes de aplicar. Nenhum perfil é
            publicado pela importação, e a atividade dos usuários não é alterada.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {result ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Importação concluída
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Criados", value: result.created },
                { label: "Atualizados", value: result.updated },
                { label: "Sem mudança", value: result.skipped },
                { label: "Sem correspondência", value: result.unmatched },
              ].map((card) => (
                <div key={card.label} className="rounded-md border border-[#dce9eb] px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{card.label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{card.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted-foreground">
              Todos os perfis criados estão como rascunho. Abra cada um para completar
              e publicar.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : !preview ? (
          <div className="space-y-4">
            <label
              htmlFor="import-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-[#9fd4dc] bg-[#f4fafb] px-6 py-10 text-center transition-colors hover:bg-[#eaf6f8]"
            >
              <FileSpreadsheet className="h-8 w-8 text-[#285f7a]" aria-hidden />
              <span className="text-sm font-medium text-foreground">
                Selecione a planilha de colaboradores
              </span>
              <span className="text-xs text-muted-foreground">
                Arquivos .xlsm ou .xlsx, até 5 MB
              </span>
            </label>
            <input
              ref={fileRef}
              id="import-file"
              type="file"
              accept=".xlsm,.xlsx"
              className="sr-only"
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) void handleUpload(next);
              }}
            />
            {busy && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Lendo a planilha…
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {preview.counts.total} linha(s) lida(s). {selected.size} selecionada(s) para aplicar.
            </p>

            {OUTCOME_ORDER.filter((outcome) => (grouped.get(outcome)?.length ?? 0) > 0).map(
              (outcome) => {
                const rows = grouped.get(outcome) ?? [];
                const meta = OUTCOME_META[outcome];
                return (
                  <section key={outcome} className="rounded-lg border border-[#dce9eb]">
                    <header className="border-b border-[#eef5f6] bg-[#f9fdfd] px-3 py-2">
                      <h3 className={cn("text-sm font-semibold", meta.tone)}>
                        {meta.label} ({rows.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </header>
                    <ul className="max-h-48 divide-y divide-[#f2f7f8] overflow-y-auto">
                      {rows.map((row) => (
                        <li key={`${outcome}-${row.email}`} className="px-3 py-2">
                          <label className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 accent-[#347796] disabled:opacity-40"
                              checked={selected.has(row.email)}
                              disabled={!meta.selectable}
                              onChange={() => toggle(row.email)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-foreground">
                                {row.name ?? row.email}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {row.email}
                              </span>
                              {row.differences.length > 0 && (
                                <span className="mt-1 block space-y-0.5">
                                  {row.differences.map((diff) => (
                                    <span
                                      key={diff.field}
                                      className="block text-xs text-muted-foreground"
                                    >
                                      {diff.label}:{" "}
                                      <s className="text-red-700">{diff.current ?? "vazio"}</s>{" "}
                                      → <strong className="text-emerald-800">{diff.incoming}</strong>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              }
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Escolher outro arquivo
              </Button>
              <Button onClick={handleApply} disabled={busy || selected.size === 0}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Aplicar {selected.size} selecionado(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
