"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, ImageIcon, Globe2, Loader2, Lock, Plus, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILE_TYPE_LABEL, FILE_TYPE_OPTIONS, type EventAttachment } from "@/lib/eventos";

const PROVIDER_LABEL: Record<string, string> = {
  external_link: "Link externo",
  supabase_storage: "Upload",
};

export function EventoArquivosTab({
  attachments,
  onAddAttachment,
  onUploadFile,
  onToggleAttachmentPublic,
  onDeleteAttachment,
}: {
  attachments: EventAttachment[];
  onAddAttachment: (input: { title: string; url: string; fileType?: string; isPublic: boolean }) => void;
  onUploadFile: (file: File, input: { title: string; fileType: string; isPublic: boolean }) => Promise<void>;
  onToggleAttachmentPublic: (id: string, isPublic: boolean) => void;
  onDeleteAttachment: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [fileType, setFileType] = useState("arquivo_geral");
  const [isPublic, setIsPublic] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      await onUploadFile(file, {
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        fileType: fileType.trim() || "arquivo_geral",
        isPublic,
      });
      setTitle("");
      setUrl("");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Arquivos e documentos</h2><p className="mt-1 text-xs text-muted-foreground">Propostas, contratos, cardápios e registros deste evento.</p></div><Button onClick={() => setAdding(value => !value)} aria-expanded={adding}><Plus className="size-4" />{adding ? "Fechar formulário" : "Adicionar arquivo"}</Button></div>
      {adding && <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            aria-label="Título do arquivo"
            placeholder="Título do arquivo (opcional no upload)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select value={fileType} onValueChange={setFileType}>
            <SelectTrigger aria-label="Tipo de arquivo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILE_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{FILE_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--orquestrai-action)]"
          />
          <span>
            <span className="font-medium">Disponibilizar no link compartilhável</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Desmarque para contratos, orçamentos e outros arquivos internos.
            </span>
          </span>
        </label>

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
            aria-label="URL do arquivo"
            placeholder="URL do arquivo (link externo)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => {
              if (!title.trim() || !url.trim()) return;
              onAddAttachment({
                title: title.trim(),
                url: url.trim(),
                fileType: fileType.trim() || "arquivo_geral",
                isPublic,
              });
              setTitle("");
              setUrl("");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar link
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Envie documentos, fotos e vídeos do evento.
          Para links externos (OneDrive, Drive), informe título e URL.
        </p>
      </div>}
      <div className="flex flex-wrap gap-2"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar arquivos" placeholder="Buscar documento ou foto…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div><select aria-label="Filtrar arquivos por tipo" className="h-10 rounded-md border bg-card px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os tipos</option>{FILE_TYPE_OPTIONS.map(type => <option key={type} value={type}>{FILE_TYPE_LABEL[type]}</option>)}</select></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.filter(a => (filter === "all" || a.fileType === filter) && a.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map(a => {
          const isImage = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(a.url);
          return <article key={a.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
            <a href={a.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${a.title}`} className="flex h-36 items-center justify-center overflow-hidden border-b border-border/50 bg-muted/50 hover:bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {isImage ? <img src={a.url} alt={a.title} loading="lazy" className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-primary"><FileText className="size-9 stroke-[1.2]" /><span className="text-[10px] font-semibold uppercase tracking-widest">{FILE_TYPE_LABEL[a.fileType as keyof typeof FILE_TYPE_LABEL] ?? a.fileType}</span></div>}
            </a>
            <div className="p-4"><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{isImage ? <ImageIcon className="mr-1 inline size-3" /> : null}{FILE_TYPE_LABEL[a.fileType as keyof typeof FILE_TYPE_LABEL] ?? a.fileType} · {PROVIDER_LABEL[a.provider] ?? a.provider}</p><h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{a.title}</h3><p className="mt-2 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2"><Button type="button" size="sm" variant="ghost" className="h-auto px-0 text-[11px]" onClick={() => onToggleAttachmentPublic(a.id, !a.isPublic)} title={a.isPublic ? "Remover do link compartilhável" : "Adicionar ao link compartilhável"}>{a.isPublic ? <Globe2 className="size-3.5" /> : <Lock className="size-3.5" />}{a.isPublic ? "No link compartilhável" : "Fora do link compartilhável"}</Button><div className="flex gap-1"><Button asChild size="icon" variant="ghost" className="size-8"><a href={a.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${a.title}`}><ExternalLink className="size-3.5" /></a></Button><Button size="icon" variant="ghost" className="size-8" aria-label={`Excluir ${a.title}`} onClick={() => onDeleteAttachment(a.id)}><Trash2 className="size-3.5 text-destructive" /></Button></div></div>
            </div>
          </article>;
        })}
      </div>
      {!attachments.some(a => (filter === "all" || a.fileType === filter) && a.title.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) && <div className="rounded-xl border border-dashed px-5 py-12 text-center"><FileText className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{attachments.length ? "Nenhum arquivo corresponde à busca." : "Os documentos e as fotos do evento ficam reunidos aqui."}</p>{!attachments.length && <Button variant="link" onClick={() => setAdding(true)}>Adicionar primeiro arquivo</Button>}</div>}
    </div>
  );
}
