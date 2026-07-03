"use client";

import { useRef, useState } from "react";
import { ExternalLink, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FILE_TYPE_LABEL, FILE_TYPE_OPTIONS, type EventAttachment } from "@/lib/eventos";

const PROVIDER_LABEL: Record<string, string> = {
  external_link: "Link externo",
  supabase_storage: "Upload",
};

export function EventoArquivosTab({
  attachments,
  onAddAttachment,
  onUploadFile,
  onDeleteAttachment,
}: {
  attachments: EventAttachment[];
  onAddAttachment: (input: { title: string; url: string; fileType?: string }) => void;
  onUploadFile: (file: File, input: { title: string; fileType: string }) => Promise<void>;
  onDeleteAttachment: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [fileType, setFileType] = useState("arquivo_geral");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      await onUploadFile(file, {
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        fileType: fileType.trim() || "arquivo_geral",
      });
      setTitle("");
      setUrl("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Título do arquivo (opcional no upload)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILE_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{FILE_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto] md:items-center">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
              e.target.value = "";
            }}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? "Enviando…" : "Enviar arquivo do computador"}
          </Button>
          <span className="text-xs text-muted-foreground text-center px-1">ou</span>
          <Input
            placeholder="URL do arquivo (link externo)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => {
              if (!title.trim() || !url.trim()) return;
              onAddAttachment({ title: title.trim(), url: url.trim(), fileType: fileType.trim() || "arquivo_geral" });
              setTitle("");
              setUrl("");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O upload guarda o arquivo no storage do sistema (contratos, orçamentos, fotos, vídeos).
          Para links externos (OneDrive, Drive), informe título e URL.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {attachments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum arquivo cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              attachments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{FILE_TYPE_LABEL[a.fileType as keyof typeof FILE_TYPE_LABEL] ?? a.fileType}</TableCell>
                  <TableCell>{PROVIDER_LABEL[a.provider] ?? a.provider}</TableCell>
                  <TableCell>{new Date(a.createdAt).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <a href={a.url} target="_blank" rel="noreferrer">
                        <Button size="icon" variant="ghost">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button size="icon" variant="ghost" onClick={() => onDeleteAttachment(a.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
