import { criarCalendario, somarDiasUteis } from "./dias-uteis";

/** Publicação na fila do jurídico, como o resumo precisa dela. */
export interface PublicacaoDoResumo {
  escritorio: string | null;
  /** Dia em que ficou disponível para a vistagem (AAAA-MM-DD, São Paulo). */
  dia: string;
  demandaRisco: boolean;
  grupo: string | null;
}

/** O resumo é do jurídico: a fila de Operações Legais não entra. */
const FORA_DO_RESUMO = new Set(["OPERAÇÕES LEGAIS"]);

const SEPARADOR = "_".repeat(30);

/** AAAA-MM-DD do instante em São Paulo. */
export function diaEmSaoPaulo(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(instante);
}

/** O Teams junta as linhas de uma mensagem de texto: em HTML, cada quebra vira <br>. */
export function resumoEmHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

/**
 * Dias de atraso da vistagem. Mesma regra do "Vistado em D+1" do BKP (vistadoD1): vale até 12h (São Paulo)
 * do próximo dia útil depois da disponibilização. Depois disso, 1 dia de atraso mais 1 por dia útil seguinte.
 */
export function diasDeAtraso(dia: string, agora: Date, feriados: Iterable<string>): number {
  const ehDiaUtil = criarCalendario(feriados);
  const limite = somarDiasUteis(dia, 1, ehDiaUtil);
  // São Paulo não tem horário de verão desde 2019.
  if (agora.getTime() <= new Date(`${limite}T12:00:00-03:00`).getTime()) return 0;
  const hoje = diaEmSaoPaulo(agora);
  let atraso = 0;
  for (let atual = somarDiasUteis(limite, 1, ehDiaUtil); atual <= hoje; atual = somarDiasUteis(atual, 1, ehDiaUtil)) {
    atraso += 1;
  }
  return Math.max(1, atraso);
}

function selo(atraso: number): string {
  if (atraso === 0) return "🟢";
  return atraso === 1 ? "🟡" : "🔴";
}

function dataNoResumo(dia: string): string {
  const [ano, mes, data] = dia.split("-");
  return `${data}-${mes}-${ano}`;
}

interface Conjunto {
  area: string;
  dia: string;
  risco: boolean;
  total: number;
  atraso: number;
  grupos: Set<string>;
}

/** Texto do aviso: uma linha por conjunto de área + dia + tipo de demanda, igual ao resumo que saía da lista do SharePoint. */
export function montarResumoSla(publicacoes: PublicacaoDoResumo[], agora: Date, feriados: Iterable<string>): string {
  const feriadosDoAno = [...feriados];
  const conjuntos = new Map<string, Conjunto>();
  for (const publicacao of publicacoes) {
    const area = (publicacao.escritorio?.trim() || "Sem área").toLocaleUpperCase("pt-BR");
    if (FORA_DO_RESUMO.has(area)) continue;
    const chave = `${area}|${publicacao.dia}|${publicacao.demandaRisco}`;
    const conjunto =
      conjuntos.get(chave) ??
      { area, dia: publicacao.dia, risco: publicacao.demandaRisco, total: 0, atraso: diasDeAtraso(publicacao.dia, agora, feriadosDoAno), grupos: new Set<string>() };
    conjunto.total += 1;
    const grupo = publicacao.grupo?.trim();
    if (grupo) conjunto.grupos.add(grupo);
    conjuntos.set(chave, conjunto);
  }

  const lista = [...conjuntos.values()];
  const total = lista.reduce((soma, conjunto) => soma + conjunto.total, 0);
  const fora = lista.reduce((soma, conjunto) => soma + (conjunto.atraso > 0 ? conjunto.total : 0), 0);
  const cabecalho = ["📊 Resumo SLA Publicações — JURÍDICO VISTAR", `Conjuntos: ${lista.length} | Publicações: ${total} | Fora SLA: ${fora}`];

  const porArea = new Map<string, Conjunto[]>();
  for (const conjunto of lista) porArea.set(conjunto.area, [...(porArea.get(conjunto.area) ?? []), conjunto]);

  const blocos = [...porArea.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([area, daArea]) => {
      const linhas = [...daArea]
        // Mais antigos primeiro; no mesmo dia, a demanda de risco vem antes.
        .sort((a, b) => a.dia.localeCompare(b.dia) || Number(b.risco) - Number(a.risco))
        .flatMap((conjunto) => {
          const foraDoConjunto = conjunto.atraso > 0 ? conjunto.total : 0;
          return [
            `${selo(conjunto.atraso)} ${dataNoResumo(conjunto.dia)} - ${conjunto.risco ? "Demanda de Risco" : "Demanda Comum"}`,
            `Grupos: ${[...conjunto.grupos].join(", ") || "—"}`,
            `Total: ${conjunto.total} | Dentro SLA: ${conjunto.total - foraDoConjunto} | Fora SLA: ${foraDoConjunto}`,
            `Maior atraso: ${conjunto.atraso} ${conjunto.atraso === 1 ? "dia" : "dias"}`,
          ];
        });
      return [area, ...linhas].join("\n");
    });

  return [cabecalho.join("\n"), blocos.join(`\n${SEPARADOR}\n`)].filter(Boolean).join("\n");
}
