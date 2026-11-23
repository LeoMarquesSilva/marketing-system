import { parse } from "csv-parse/sync";
import { cnjComMascara, horaLocalParaIso, tipoDaDescricao } from "./pje";
import type { TipoAudiencia } from "./tipos";

/**
 * Tarefas de audiência do VIOS, de duas fontes com as mesmas colunas: o relatório pxe-lista (CSV ";" em
 * windows-1252, CI como ="41835") e a cópia dele no SAMA (vios_tarefas, relida do VIOS às 2h e às 12h).
 * Só as audiências e perícias. Serve para conferir a pauta com o VIOS (data e hora iguais? ainda aberta?).
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
// "VERIFICAR AUDIÊNCIA - ALTERAÇÃO/INCLUSÃO/CANCELAMENTO" e "RELATÓRIO DA PERÍCIA + ... PARECER TÉCNICO" são
// tarefas sobre a audiência, não a audiência (vistas na 1ª conferência, 23/11/2026).
const NAO_EH = /(LEMBRETE|INSERIR PAUTA|ATA|ALERTA|CI[EÊ]NCIA|SOLICITAR|MANIFESTA|LAUDO|INFORMAR|VERIFICAR|RELAT[OÓ]RIO|PARECER)/i;

export function ehTarefaDeAudiencia(tarefa: string): boolean {
  return EH_AUDIENCIA.test(tarefa) && !NAO_EH.test(tarefa);
}

function semIgual(valor: string | undefined): string {
  return (valor ?? "").replace(/^="?|"$/g, "").trim();
}

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(/[|;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Nomes de uma coluna de pessoas: texto separado por vírgula, lista de textos ou lista de { nome }. */
function nomes(valor: unknown): string[] {
  if (typeof valor === "string") return lista(valor);
  if (!Array.isArray(valor)) return [];
  return valor
    .map((v) => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        return String(o.nome ?? o.name ?? "");
      }
      return "";
    })
    .map((v) => v.trim())
    .filter(Boolean);
}

function status(valor: string | null | undefined): AudienciaNoVios["status"] {
  const t = (valor ?? "").toLowerCase();
  if (/cancel/.test(t)) return "cancelada";
  if (/conclu/.test(t)) return "concluida";
  return "aberta";
}

/**
 * "19/11/2026" (ou "2026-11-19") + "09:50 - 10:50" → ISO de 19/11 às 09:50 em Brasília. Sem horário, fica à
 * meia-noite: a conferência entende 00:00 como "o VIOS só tem o dia".
 */
export function inicioDoVios(data: string | null | undefined, horario: string | null | undefined): string | null {
  const texto = data ?? "";
  const br = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dia = br ? `${br[3]}-${br[2]}-${br[1]}` : iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  if (!dia) return null;
  const h = (horario ?? "").match(/(\d{1,2}):(\d{2})/);
  return horaLocalParaIso(`${dia}T${h ? h[1]!.padStart(2, "0") : "00"}:${h ? h[2] : "00"}:00`);
}

/**
 * Lê o relatório de tarefas do VIOS. O Tarefas.csv do SharePoint traz o escritório inteiro: as linhas que não são
 * audiência saem já na leitura (on_record), para não montar dezenas de milhares de objetos.
 */
export function lerCsvDoVios(texto: string): AudienciaNoVios[] {
  const linhas = parse(texto, {
    delimiter: ";",
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
    on_record: (registro: Record<string, string>) => (ehTarefaDeAudiencia((registro["Tarefa"] ?? "").trim()) ? registro : null),
  }) as Record<string, string>[];
  const saida: AudienciaNoVios[] = [];
  for (const l of linhas) {
    const tarefa = (l["Tarefa"] ?? "").trim();
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

/** Uma linha de vios_tarefas do SAMA (só as colunas que a conferência usa). */
export interface TarefaDoSama {
  ci: string | number | null;
  ci_do_processo?: string | number | null;
  nro_cnj?: string | null;
  tarefa?: string | null;
  data_limite?: string | null;
  data_para_conclusao?: string | null;
  horario?: string | null;
  vios_status?: string | null;
  area_do_processo?: string | null;
  responsaveis?: unknown;
  auxiliares?: unknown;
}

/** A mesma leitura do CSV, para uma linha da cópia do VIOS no SAMA. Null quando não é audiência ou falta dado. */
export function deTarefaDoSama(l: TarefaDoSama): AudienciaNoVios | null {
  const tarefa = (l.tarefa ?? "").trim();
  if (!ehTarefaDeAudiencia(tarefa)) return null;
  const cnj = cnjComMascara(l.nro_cnj);
  const inicio = inicioDoVios(l.data_limite || l.data_para_conclusao, l.horario);
  const tarefaCi = l.ci === null || l.ci === undefined ? "" : semIgual(String(l.ci));
  if (!cnj || !inicio || !tarefaCi) return null;
  const ciProcesso = l.ci_do_processo === null || l.ci_do_processo === undefined ? "" : semIgual(String(l.ci_do_processo));
  return {
    tarefaCi,
    ciProcesso: ciProcesso || null,
    cnj,
    inicio,
    tipo: tipoDaDescricao(tarefa.replace(/AUD\./i, "audiência")),
    tarefa,
    status: status(l.vios_status),
    area: (l.area_do_processo ?? "").trim() || null,
    responsaveis: nomes(l.responsaveis),
    auxiliares: nomes(l.auxiliares),
  };
}
