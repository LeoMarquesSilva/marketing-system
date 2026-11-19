import { parse } from "csv-parse/sync";
import { cnjComMascara, horaLocalParaIso, tipoDaDescricao } from "./pje";
import type { TipoAudiencia } from "./tipos";

/**
 * Relatório de tarefas do VIOS (pxe-lista, CSV ";" em windows-1252, CI como ="41835"): só as audiências e
 * perícias. Serve para conferir a pauta com o VIOS (data e hora iguais? ainda aberta?).
 */

export interface AudienciaNoVios {
  tarefaCi: string;
  ciProcesso: string | null;
  cnj: string;
  inicio: string;
  tipo: TipoAudiencia;
  tarefa: string;
  status: "aberta" | "concluida" | "cancelada";
  area: string | null;
  responsaveis: string[];
  auxiliares: string[];
}

const EH_AUDIENCIA = /(AUDI[EÊ]NCIA|AUD\.|SESS[AÃ]O DE JULGAMENTO|PER[IÍ]CIA)/i;
const NAO_EH = /(LEMBRETE|INSERIR PAUTA|ATA|ALERTA|CI[EÊ]NCIA|SOLICITAR|MANIFESTA|LAUDO|INFORMAR)/i;

function semIgual(valor: string | undefined): string {
  return (valor ?? "").replace(/^="?|"$/g, "").trim();
}

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(/[|;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function status(valor: string | undefined): AudienciaNoVios["status"] {
  const t = (valor ?? "").toLowerCase();
  if (/cancel/.test(t)) return "cancelada";
  if (/conclu/.test(t)) return "concluida";
  return "aberta";
}

/** "19/11/2026" + "09:50 - 10:50" → ISO de 19/11 às 09:50 em Brasília. */
export function inicioDoVios(data: string | undefined, horario: string | undefined): string | null {
  const d = (data ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!d) return null;
  const h = (horario ?? "").match(/(\d{1,2}):(\d{2})/);
  return horaLocalParaIso(`${d[3]}-${d[2]}-${d[1]}T${h ? h[1]!.padStart(2, "0") : "00"}:${h ? h[2] : "00"}:00`);
}

export function lerCsvDoVios(texto: string): AudienciaNoVios[] {
  const linhas = parse(texto, { delimiter: ";", columns: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
  const saida: AudienciaNoVios[] = [];
  for (const l of linhas) {
    const tarefa = (l["Tarefa"] ?? "").trim();
    if (!EH_AUDIENCIA.test(tarefa) || NAO_EH.test(tarefa)) continue;
    const cnj = cnjComMascara(l["Nro CNJ"]);
    const inicio = inicioDoVios(l["Data limite"] || l["Data para conclusão"], l["Horário"]);
    const tarefaCi = semIgual(l["CI"]);
    if (!cnj || !inicio || !tarefaCi) continue;
    saida.push({
      tarefaCi,
      ciProcesso: semIgual(l["CI do Processo"]) || null,
      cnj,
      inicio,
      tipo: tipoDaDescricao(tarefa.replace(/AUD\./i, "audiência")),
      tarefa,
      status: status(l["Status"]),
      area: (l["Área do Processo"] ?? "").trim() || null,
      responsaveis: lista(l["Responsáveis"]),
      auxiliares: lista(l["Auxiliares"]),
    });
  }
  return saida;
}
