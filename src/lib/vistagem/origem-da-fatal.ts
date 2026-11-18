import { CAMPO_DATA_FATAL } from "./ajuste-conferencia";
import type { OrigemPrazo } from "./agendamento";
import { ROTULO_CONTAGEM, type ContagemPrazo } from "./dias-uteis";
import type { AjusteNaTarefa } from "./types";

/**
 * Como a fatal do Prazo foi escolhida na vistagem, explícito em todos os históricos (pedido de 18/11/2026: "se o
 * responsável usou o Calendário ou 5/10/15…"): cartões da Conferência, do Vistado e do Check, e o Histórico da publicação.
 * Se a Conferência mudou a fatal depois, continua valendo o que o vistador usou, com "mudada na conferência".
 */
export interface OrigemDaFatal {
  /** null: não ficou registrado (vistada antes de 11/11/2026, ou fatal mudada na conferência antes de 18/11/2026). */
  origem: OrigemPrazo | null;
  /** Texto do selo, depois de "Fatal:": "Calendário", "Botão 15 dias úteis"… */
  rotulo: string;
  /** A frase inteira, para a dica e o leitor de tela. */
  descricao: string;
  /** A Conferência mudou a fatal depois da vistagem. */
  mudadaNaConferencia: boolean;
}

export interface TarefaComFatal {
  etiqueta: string;
  dataFatal: string | null;
  origemPrazo?: OrigemPrazo | null;
  diasPrazo?: number | null;
  contagemPrazo?: ContagemPrazo | null;
  ajustes?: AjusteNaTarefa[] | null;
}

function dias(item: TarefaComFatal): string | null {
  return item.diasPrazo ? `${item.diasPrazo} ${ROTULO_CONTAGEM[item.contagemPrazo ?? "uteis"]}` : null;
}

/** Null fora do Prazo com data fatal (Providência, Compromisso, Prazo sem fatal como a SENTENÇA). */
export function origemDaFatal(item: TarefaComFatal): OrigemDaFatal | null {
  if (item.etiqueta !== "PRAZO" || !item.dataFatal) return null;
  const mudadaNaConferencia = (item.ajustes ?? []).some((ajuste) => ajuste.mudancas.some((mudanca) => mudanca.campo === CAMPO_DATA_FATAL));
  const contagem = dias(item);
  const origem = item.origemPrazo ?? null;
  let rotulo: string;
  let descricao: string;
  switch (origem) {
    case "atalho":
      rotulo = contagem ? `Botão ${contagem}` : "Botões de dias";
      descricao = contagem
        ? `Na vistagem, a fatal veio do botão de ${contagem} após a publicação (5/10/15…), não do calendário.`
        : "Na vistagem, a fatal veio dos botões de dias (5/10/15…), não do calendário.";
      break;
    case "calendario":
      rotulo = "Calendário";
      descricao = "Na vistagem, a data fatal foi escolhida no calendário, sem os botões de dias (5/10/15…).";
      break;
    case "tarefa":
      rotulo = contagem ? `Prazo legal da tarefa (${contagem})` : "Prazo legal da tarefa";
      descricao = "Na vistagem, a fatal veio do prazo legal que a tarefa traz, preenchido sozinho, sem botão nem calendário.";
      break;
    case "publicacao":
      rotulo = contagem ? `Dias lidos na publicação (${contagem})` : "Dias lidos na publicação";
      descricao = "Na vistagem, a fatal veio do \"Usar N dias\" do leitor da publicação, sem botão nem calendário.";
      break;
    case "sugestao_ia":
      rotulo = contagem ? `Sugestão da IA (${contagem})` : "Sugestão da IA";
      descricao = "Na vistagem, a fatal veio da sugestão da IA, aceita sem mudar pelo botão nem pelo calendário.";
      break;
    default:
      rotulo = "não registrado se foi botão ou calendário";
      descricao =
        "Não ficou registrado se a fatal veio dos botões de dias (5/10/15…) ou do calendário: vistada antes de 11/11/2026, ou com a fatal mudada na conferência antes de 18/11/2026.";
  }
  // O selo fica com o que o vistador usou; "mudada na conferência" vai num selo ao lado.
  if (mudadaNaConferencia) descricao = `${descricao} Depois, a Conferência mudou a data fatal.`;
  return { origem, rotulo, descricao, mudadaNaConferencia };
}
