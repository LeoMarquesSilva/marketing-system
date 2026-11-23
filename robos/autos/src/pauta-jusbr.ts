import type { FichaJusbr } from "./conectores/jusbr-urls.ts";

/**
 * Audiências "só no VIOS" no Jus.br (parte sem navegador). O processo não está na Minha Pauta do certificado e a
 * consulta do processo no PJe pede captcha; o Jus.br (Portal de Serviços do CNJ, mesmo login da PDPJ) traz a ficha
 * com os movimentos, e a designação de audiência do PJe é um movimento, ex.: "Audiência de julgamento designada
 * (09/12/2026 17:32 Sala par - (Dr Flávio) - 13ª Vara do Trabalho de Guarulhos)" (visto no PJe do TRT-2, 23/11/2026).
 *
 * Fase 1 (23/11/2026): o robô só escreveu no log os movimentos de audiência. Visto no log do servidor: as 7 "só no
 * VIOS" estavam no Jus.br, todas no formato "Audiência <descrição> <situação> (<dd/mm/aaaa> <hh:mm> <sala> - <órgão>)",
 * e a remarcação aparece como "cancelada" e "designada" no mesmo minuto. Fase 2: as audiências vão ao ORQESTRAI.
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

/** Processos das audiências que já vieram do Jus.br e seguem designadas: o robô relê para pegar cancelamento ou remarcação. */
export function lerAcompanhar(corpo: unknown): string[] {
  const lista = (corpo as { acompanhar?: unknown } | null)?.acompanhar;
  return Array.isArray(lista) ? [...new Set(lista.filter((cnj): cnj is string => typeof cnj === "string"))] : [];
}

/** Uma audiência tirada dos movimentos do Jus.br, no formato que POST /api/robos/pauta/jusbr recebe. */
export interface AudienciaDoJusbr {
  cnj: string;
  /** Dia e hora no horário de Brasília, sem fuso: "2026-12-10T14:05". */
  inicio: string;
  /** "inicial (rito sumaríssimo) por videoconferência". */
  descricao: string;
  situacao: "designada" | "cancelada" | "realizada";
  sala: string | null;
  orgao: string | null;
  /** Quando o movimento que decidiu a situação foi lançado. */
  movimentoEm: string | null;
}

const MOVIMENTO_DE_AUDIENCIA =
  /^Audi[eê]ncia\s+(.+?)\s+(designada|redesignada|antecipada|cancelada|adiada|n[aã]o realizada|convertida(?: em dilig[eê]ncia)?|realizada)\s*\((\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(.*)\)\s*$/i;

function situacaoDoMovimento(texto: string): AudienciaDoJusbr["situacao"] {
  const t = texto.toLowerCase();
  if (/^(designada|redesignada|antecipada)$/.test(t)) return "designada";
  if (t === "realizada") return "realizada";
  return "cancelada"; // cancelada, adiada, não realizada, convertida em diligência
}

/** "BRUNO FURTADO SILVEIRA - CON1 - Jundiaí" → sala "BRUNO FURTADO SILVEIRA", órgão "CON1 - Jundiaí". */
export function salaEOrgao(resto: string): { sala: string | null; orgao: string | null } {
  const texto = resto.replace(/\s+/g, " ").trim();
  if (!texto) return { sala: null, orgao: null };
  const orgao = texto.match(/(?:^|\s-\s)((?:CON\s*\d+|CEJUSC|Posto|Vara|\d+[ªºa]?\s*Vara)\b.*)$/i);
  if (!orgao) return { sala: null, orgao: texto };
  const sala = texto.slice(0, orgao.index ?? 0).replace(/\s-\s*$/, "").trim();
  return { sala: sala || null, orgao: orgao[1]!.trim() };
}

/**
 * As audiências dos movimentos de um processo: uma por dia e hora, com a situação do movimento mais recente. Na
 * remarcação o Jus.br lança "cancelada" e "designada" no mesmo minuto: aí vale "designada".
 */
export function audienciasDosMovimentos(cnj: string, movimentos: MovimentoDeAudiencia[]): AudienciaDoJusbr[] {
  const porHorario = new Map<string, { movimentoEm: string; lidos: { situacao: AudienciaDoJusbr["situacao"]; descricao: string; sala: string | null; orgao: string | null }[] }>();
  for (const movimento of movimentos) {
    const m = movimento.descricao.match(MOVIMENTO_DE_AUDIENCIA);
    if (!m) continue;
    const inicio = `${m[5]}-${m[4]}-${m[3]}T${m[6]!.padStart(2, "0")}:${m[7]}`;
    const lido = { situacao: situacaoDoMovimento(m[2]!), descricao: m[1]!.trim(), ...salaEOrgao(m[8] ?? "") };
    const em = movimento.dataHora ?? "";
    const atual = porHorario.get(inicio);
    if (!atual || em > atual.movimentoEm) porHorario.set(inicio, { movimentoEm: em, lidos: [lido] });
    else if (em === atual.movimentoEm) atual.lidos.push(lido);
  }
  const saida: AudienciaDoJusbr[] = [];
  for (const [inicio, { movimentoEm, lidos }] of porHorario) {
    const escolhido = lidos.find((l) => l.situacao === "designada") ?? lidos[0]!;
    saida.push({ cnj, inicio, descricao: escolhido.descricao, situacao: escolhido.situacao, sala: escolhido.sala, orgao: escolhido.orgao, movimentoEm: movimentoEm || null });
  }
  return saida.sort((a, b) => a.inicio.localeCompare(b.inicio));
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
