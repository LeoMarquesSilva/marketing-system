"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportContactsDialog({ open, onOpenChange, onImported }: ImportContactsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; totalRows: number } | null>(
    null
  );

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .xlsx, .xls ou .csv.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/email-marketing/contacts/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar.");
      setResult(data);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar contatos.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setResult(null);
      setError(null);
      if (fileRef.current) fileRef.current.value = "";
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Envie uma planilha (.xlsx, .xls ou .csv) com uma coluna de e-mail. Colunas de nome, telefone
            e empresa são reconhecidas automaticamente, se existirem. Contatos já descadastrados ou
            inválidos não voltam a ficar inscritos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label
            htmlFor="import-file"
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Clique para selecionar o arquivo</span>
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={() => setError(null)}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <p className="text-sm text-emerald-600">
              {result.imported} contato(s) importado(s)/atualizado(s) de {result.totalRows} linha(s)
              {result.skipped > 0 ? ` — ${result.skipped} ignorada(s).` : "."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Fechar
          </Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
