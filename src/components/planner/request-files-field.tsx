"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileArchive, FileText, FileVideo, Loader2, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  REQUEST_FILE_ACCEPT,
  formatFileSize,
  isImageContentType,
  sortFilesByName,
  type RequestFile,
} from "@/lib/request-files/domain";
import {
  deleteRequestFile,
  fetchRequestFiles,
  signRequestFileUrls,
  uploadRequestFile,
} from "@/lib/request-files/client";

function FileTypeIcon({ contentType }: { contentType: string | null }) {
  if (contentType?.startsWith("video/")) return <FileVideo className="h-6 w-6" aria-hidden />;
  if (contentType === "application/zip") return <FileArchive className="h-6 w-6" aria-hidden />;
  return <FileText className="h-6 w-6" aria-hidden />;
}

/**
 * Arquivos finais da arte: a designer sobe as peças direto na tarefa (um ou
 * vários arquivos — carrossel vai na ordem do nome) em vez de mandar link.
 */
export function RequestFilesField({
  requestId,
  canEdit,
  onFilesChange,
}: {
  requestId: string;
  canEdit: boolean;
  onFilesChange?: (files: RequestFile[]) => void;
}) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<RequestFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const onFilesChangeRef = useRef(onFilesChange);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  const applyFiles = useCallback((next: RequestFile[]) => {
    setFiles(next);
    onFilesChangeRef.current?.(next);
    void signRequestFileUrls(next.map((f) => f.storagePath)).then(setUrls);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRequestFiles(requestId)
      .then((list) => { if (!cancelled) applyFiles(list); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar arquivos."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [requestId, applyFiles]);

  async function upload(selected: File[]) {
    if (selected.length === 0) return;
    setError(null);
    const ordered = sortFilesByName(selected);
    let next = files;
    setUploading({ done: 0, total: ordered.length });
    try {
      for (const [index, file] of ordered.entries()) {
        const saved = await uploadRequestFile(requestId, file, {
          sortOrder: next.length,
          uploadedById: profile?.id,
        });
        next = [...next, saved];
        setUploading({ done: index + 1, total: ordered.length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar os arquivos.");
    } finally {
      applyFiles(next);
      setUploading(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(file: RequestFile) {
    if (!window.confirm(`Remover "${file.fileName}" da tarefa?`)) return;
    setError(null);
    try {
      await deleteRequestFile(file);
      applyFiles(files.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover o arquivo.");
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando arquivos...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Arquivos da arte">
          {files.map((file, index) => {
            const url = urls[file.storagePath];
            return (
              <li key={file.id} className="group relative overflow-hidden rounded-lg border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
                <div className="grid aspect-square place-items-center overflow-hidden text-muted-foreground">
                  {isImageContentType(file.contentType) && url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={file.fileName} className="size-full object-cover" />
                  ) : (
                    <FileTypeIcon contentType={file.contentType} />
                  )}
                </div>
                <div className="flex items-center gap-1 border-t border-black/5 px-2 py-1.5 dark:border-white/10">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-foreground" title={file.fileName}>
                      {files.length > 1 && <span className="text-muted-foreground">{index + 1}. </span>}
                      {file.fileName}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Abrir ${file.fileName}`}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void remove(file)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label={`Remover ${file.fileName}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void upload(Array.from(e.dataTransfer.files));
          }}
          disabled={Boolean(uploading)}
          className={`flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#04202f]/40 disabled:cursor-wait ${
            dragOver
              ? "border-[#347796] bg-[#347796]/5"
              : "border-[#9fc9d3] bg-[#f8fbfb] hover:border-[#347796] dark:border-white/20 dark:bg-white/[0.03]"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-[#347796]" aria-hidden />
              <span className="font-medium text-foreground">Enviando {Math.min(uploading.done + 1, uploading.total)} de {uploading.total}...</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-[#347796]" aria-hidden />
              <span className="font-medium text-foreground">
                {files.length > 0 ? "Enviar mais arquivos" : "Enviar arquivos da arte"}
              </span>
              <span className="text-xs text-muted-foreground">
                Clique ou arraste aqui · imagem, PDF, vídeo ou ZIP até 500 MB · carrossel segue a ordem do nome
              </span>
            </>
          )}
        </button>
      ) : (
        files.length === 0 && <p className="text-sm italic text-muted-foreground">Nenhum arquivo enviado ainda.</p>
      )}

      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}

      <input
        ref={input}
        type="file"
        multiple
        accept={REQUEST_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(Array.from(e.target.files ?? []))}
      />
    </div>
  );
}
