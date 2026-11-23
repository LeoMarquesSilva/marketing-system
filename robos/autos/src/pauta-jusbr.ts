import type { FichaJusbr } from "./conectores/jusbr-urls.ts";

/**
 * Audiências "só no VIOS" no Jus.br (parte sem navegador). O processo não está na Minha Pauta do certificado e a
 * consulta do processo no PJe pede captcha; o Jus.br (Portal de Serviços do CNJ, mesmo login da PDPJ) traz a ficha
 * com os movimentos, e a designação de audiência do PJe é um movimento, ex.: "Audiência de julgamento designada
 * (09/12/2026 17:32 Sala par - (Dr Flávio) - 13ª Vara do Trabalho de Guarulhos)" (visto no PJe do TRT-2, 23/11/2026).
 *
 * Fase 1 (23/11/2026): o robô só escreve no log os movimentos de audiência de cada processo, para conferir o formato
 * que o Jus.br devolve antes de gravar qualquer coisa na pauta.
 */

/** Uma audiência "só no VIOS", como o ORQESTRAI devolve em GET /api/robos/pauta/so-no-vios. */
export interface AudienciaSoNoVios {
  cnj: string;
  inicio: string;
  tarefaCi: string;
  tarefa: string;
}

/** Lê a resposta do ORQESTRAI, descartando o que vier sem número de processo ou sem data. */
export function lerSoNoVios(corpo: unknown): AudienciaSoNoVios[] {
  const lista = (corpo as { audiencias?: unknown } | null)?.audiencias;
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => item as Partial<Record<keyof AudienciaSoNoVios, unknown>>)
    .filter((item) => typeof item.cnj === "string" && typeof item.inicio === "string")
    .map((item) => ({ cnj: String(item.cnj), inicio: String(item.inicio), tarefaCi: String(item.tarefaCi ?? ""), tarefa: String(item.tarefa ?? "") }));
}

export interface MovimentoDeAudiencia {
  dataHora: string | null;
  descricao: string;
  complementos: string[];
}

/**
 * Os movimentos que falam de audiência, de todas as tramitações (1º e 2º grau), sem repetir, do mais novo para o
 * mais antigo. Olha a descrição e os complementos: a designação pode vir no texto ou separada em campos.
 */
export function movimentosDeAudiencia(fichas: FichaJusbr[]): MovimentoDeAudiencia[] {
  const vistos = new Set<string>();
  const saida: MovimentoDeAudiencia[] = [];
  for (const ficha of fichas) {
    for (const tramitacao of [ficha.tramitacaoAtual, ...(ficha.tramitacoes ?? [])]) {
      for (const movimento of tramitacao?.movimentos ?? []) {
        const descricao = (movimento.descricao ?? "").replace(/\s+/g, " ").trim();
        const complementos = (movimento.complementos ?? [])
          .map((item) => {
            const valor = item.valor?.descricao ?? item.valor?.valor ?? "";
            return [item.nome, valor].filter(Boolean).join(": ").replace(/\s+/g, " ").trim();
          })
          .filter(Boolean);
        if (!/audi[eê]ncia/i.test([descricao, ...complementos].join(" "))) continue;
        const chave = `${movimento.dataHora ?? ""}|${descricao}|${complementos.join(";")}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        saida.push({ dataHora: movimento.dataHora ?? null, descricao, complementos });
      }
    }
  }
  return saida.sort((a, b) => (b.dataHora ?? "").localeCompare(a.dataHora ?? ""));
}

/** Uma linha de log: "2026-10-14 17:12 · Audiência … designada (…) · [tipo: …; situação: …]". */
export function linhaDoMovimento(movimento: MovimentoDeAudiencia): string {
  const quando = (movimento.dataHora ?? "sem data").slice(0, 16).replace("T", " ");
  const extra = movimento.complementos.length ? ` · [${movimento.complementos.join("; ").slice(0, 300)}]` : "";
  return `${quando} · ${movimento.descricao.slice(0, 300)}${extra}`;
}
