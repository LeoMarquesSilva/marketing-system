import { paraDataVios, revisorFicaNaTarefa, separarNomes } from "./agendamento";
import type { AgendamentoResumo } from "./types";

/** Uma linha do "Fluxo das tarefas" (como fica no VIOS): a tarefa pedida ou uma que o fluxo cria junto com ela. */
export interface LinhaNoVios {
  chave: string;
  nome: string;
  /** AAAA-MM-DD; null quando o VIOS data sozinho. */
  data: string | null;
  hora: string | null;
  responsaveis: string | null;
  /** A tarefa que a vistagem pediu (as outras o VIOS cria). */
  principal: boolean;
  /** Tarefa do fluxo que nasce de outra do fluxo (Embargos › 2. REVISAR): o nome da que a cria. */
  criadaPor: string | null;
  /** Depois do robô: o CI da tarefa no VIOS. */
  ci: string | null;
  /** O jurídico mudou a data que o VIOS daria. */
  editada: boolean;
  dataVios: string | null;
  /** Prazo apertado: a tarefa pedida vai com o Enviar de hoje; a nota diz qual era o vistado. */
  nota: string | null;
}

export interface AgendaNoVios {
  /** true: já é o que o robô gravou (com CI); false: o que o VIOS vai criar. */
  gravada: boolean;
  linhas: LinhaNoVios[];
  /** Tarefas que o VIOS só cria quando esta for concluída (responsável padrão do VIOS). */
  aoConcluir: string[];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2027-02-16" → { dia: "16", mes: "fev", semana: "ter", ano: "2027" }, sem fuso (a data é do calendário). */
export function partesDaData(iso: string): { dia: string; mes: string; semana: string; ano: string } {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  return { dia: String(dia).padStart(2, "0"), mes: MESES[mes - 1] ?? "", semana: SEMANA[semana] ?? "", ano: String(ano) };
}

/** "Manoela Brisighello Angotti" → "Manoela Angotti": cabe ao lado da foto na agenda; o nome inteiro fica no título. */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.length > 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes.join(" ");
}

/** Sem data vai para o fim; no mesmo dia, a tarefa pedida vem antes das do fluxo. */
function ordenar(a: LinhaNoVios, b: LinhaNoVios): number {
  if (a.data !== b.data) return a.data === null ? 1 : b.data === null ? -1 : a.data.localeCompare(b.data);
  return Number(b.principal) - Number(a.principal);
}

/**
 * Como a tarefa fica no VIOS, em ordem de data: a pedida (Enviar, no Prazo) e as que o fluxo cria junto. Depois do
 * robô, são as tarefas gravadas, com o CI; antes, a previsão do fluxo com as datas e quem fica em cada uma.
 */
export function agendaNoVios(item: AgendamentoResumo): AgendaNoVios {
  const aoConcluir = (item.fluxoPrevisto ?? []).filter((tarefa) => tarefa.quando === "conclusao").map((tarefa) => tarefa.nome);
  const gravadas = item.viosTarefas ?? [];
  if (gravadas.length) {
    return {
      gravada: true,
      aoConcluir: [],
      linhas: gravadas
        .map((tarefa) => ({
          chave: tarefa.ci,
          nome: tarefa.principal ? item.tarefa : tarefa.tipo ?? "Tarefa do fluxo",
          data: tarefa.data,
          hora: tarefa.hora,
          responsaveis: tarefa.responsaveis,
          principal: tarefa.principal,
          criadaPor: null,
          ci: tarefa.ci,
          editada: false,
          dataVios: null,
          nota: null,
        }))
        .sort(ordenar),
    };
  }
  const pedida: LinhaNoVios = {
    chave: `pedida-${item.id}`,
    nome: item.tarefa,
    // Prazo apertado: o robô lança com o Enviar de hoje (o vistado já passou).
    data: item.enviarHoje ?? (item.data || null),
    hora: item.hora,
    responsaveis: revisorFicaNaTarefa(item.tarefa) && item.revisor ? separarNomes(`${item.responsavel},${item.revisor}`).join(", ") : item.responsavel,
    principal: true,
    criadaPor: null,
    ci: null,
    editada: false,
    dataVios: null,
    nota: item.enviarHoje && item.data ? `vistado para ${paraDataVios(item.data)}, que já passou: vai hoje` : null,
  };
  const doFluxo: LinhaNoVios[] = (item.fluxoPrevisto ?? [])
    .filter((tarefa) => tarefa.quando === "criacao")
    .map((tarefa) => ({
      chave: tarefa.caminho.join(" › "),
      nome: tarefa.nome,
      data: tarefa.data,
      hora: null,
      responsaveis: tarefa.responsaveis || null,
      principal: false,
      criadaPor: tarefa.nivel > 1 ? tarefa.caminho[tarefa.caminho.length - 2] ?? null : null,
      ci: null,
      editada: tarefa.editada,
      dataVios: tarefa.dataVios,
      nota: null,
    }));
  return { gravada: false, aoConcluir, linhas: [pedida, ...doFluxo].sort(ordenar) };
}
