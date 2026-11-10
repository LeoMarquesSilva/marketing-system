import { authFetch } from "@/lib/auth-fetch";

const BASE = "/api/operacoes-legais/processos";

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = (await resposta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!resposta.ok) throw new Error(corpo?.error ?? "Não foi possível concluir a operação.");
  return corpo as T;
}

function comCorpo(metodo: string, corpo?: unknown): RequestInit {
  return { method: metodo, headers: corpo === undefined ? undefined : { "Content-Type": "application/json" }, body: corpo === undefined ? undefined : JSON.stringify(corpo) };
}

/** Chamadas das telas de Processos; erro vem como Error com a mensagem da rota. */
export const processosApi = {
  get: async <T,>(caminho = "") => ler<T>(await authFetch(`${BASE}${caminho}`)),
  post: async <T,>(caminho: string, corpo?: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("POST", corpo))),
  patch: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("PATCH", corpo))),
  put: async <T,>(caminho: string, corpo: unknown) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("PUT", corpo))),
  del: async <T,>(caminho: string) => ler<T>(await authFetch(`${BASE}${caminho}`, comCorpo("DELETE"))),
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
