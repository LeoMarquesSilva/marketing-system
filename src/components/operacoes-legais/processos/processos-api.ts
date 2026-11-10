import { authFetch } from "@/lib/auth-fetch";
import { TAMANHO_MAXIMO_AUTOS, type AutosDoProcesso, type DocumentoAutos } from "@/lib/processos/autos-types";
import { supabase } from "@/utils/supabase/client";

const BASE = "/api/operacoes-legais/processos";

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível concluir a operação.");
  return corpo as T;
}

function comCorpo(metodo: string, corpo?: unknown): RequestInit {
  return { method: metodo, headers: corpo === undefined ? undefined : { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) };
}

function criarApi(base: string) {
  return {
    get: async <T,>(caminho = "") => ler<T>(await authFetch(`${base}${caminho}`)),
    post: async <T,>(caminho: string, corpo?: unknown) => ler<T>(await authFetch(`${base}${caminho}`, comCorpo("POST", corpo))),
    patch: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${base}${caminho}`, comCorpo("PATCH", corpo))),
    put: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${base}${caminho}`, comCorpo("PUT", corpo))),
    del: async <T,>(caminho: string) => ler<T>(await authFetch(`${base}${caminho}`, comCorpo("DELETE"))),
  };
}

/** Chamadas das telas de Processos; erro vem como Error com a mensagem da rota. */
export const processosApi = {
  ...criarApi(BASE),
  enviarArquivo: async <T,>(caminho: string, arquivo: File) => {
    const formulario = new FormData();
    formulario.append("arquivo", arquivo);
    return ler<T>(await authFetch(`${BASE}${caminho}`, { method: "POST", body: formulario }));
  },
  /** Baixa a planilha dos processos indicados (todos, sem ids). */
  baixarPlanilha: async (ids: string[] | null) => {
    const resposta = await authFetch(`${BASE}/exportar`, comCorpo("POST", ids ? { ids } : {}));
    if (!resposta.ok) throw new Error(((await resposta.json().catch(() => null)) as { error?: string } | null)?.error ?? "Não foi possível gerar a planilha.");
    const nome = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? "processos.xlsx";
    const url = URL.createObjectURL(await resposta.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);
  },
};

/** Chamadas das telas de Pessoas (o cadastro único que Processos usa). */
export const pessoasApi = criarApi("/api/operacoes-legais/pessoas");

/**
 * Anexa o PDF dos autos: pede a URL assinada, sobe o arquivo direto no bucket privado (não passa pela
 * Vercel) e registra o documento no processo.
 */
export async function anexarAutos(processoId: string, arquivo: File): Promise<{ documento: DocumentoAutos; autos: AutosDoProcesso }> {
  if (!/\.pdf$/i.test(arquivo.name) || (arquivo.type && arquivo.type !== "application/pdf")) throw new Error("Envie os autos em PDF.");
  if (arquivo.size > TAMANHO_MAXIMO_AUTOS) throw new Error("O arquivo passa de 200 MB. Divida o PDF e anexe as partes.");
  const upload = await processosApi.post<{ bucket: string; path: string; token: string }>(`/${processoId}/autos/upload`, { nome: arquivo.name, tamanho: arquivo.size });
  const { error } = await supabase.storage.from(upload.bucket).uploadToSignedUrl(upload.path, upload.token, arquivo, { contentType: "application/pdf" });
  if (error) throw new Error(`Não foi possível enviar o arquivo: ${error.message}`);
  return processosApi.post<{ documento: DocumentoAutos; autos: AutosDoProcesso }>(`/${processoId}/autos/documentos`, { path: upload.path, nome: arquivo.name });
}

/**
 * Abre o PDF dos autos em outra aba, na página indicada. A aba abre já no clique (antes da URL assinada
 * chegar), senão o navegador bloqueia como pop-up.
 */
export async function abrirAutos(documentoId: string, pagina?: number | null): Promise<void> {
  const aba = window.open("about:blank", "_blank");
  try {
    const { url } = await processosApi.get<{ url: string }>(`/autos/documentos/${documentoId}`);
    const destino = pagina ? `${url}#page=${pagina}` : url;
    if (aba) {
      aba.opener = null;
      aba.location.href = destino;
    } else {
      window.location.href = destino;
    }
  } catch (erro) {
    aba?.close();
    throw erro;
  }
}

export function formatarTamanho(bytes: number | null): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a operação.";
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(data);
}

/** Barra de preenchimento do saneamento: âmbar até 50%, azul até completar, verde em 100%. */
export function corDoPreenchimento(percentual: number): string {
  if (percentual >= 100) return "bg-emerald-500";
  return percentual >= 50 ? "bg-[#3e84a8]" : "bg-amber-500";
}
