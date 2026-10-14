import { somarDiasUteis } from "./dias-uteis";
import { DEPARA_TAREFAS, type EtiquetaAgendamento, type PastaTipo } from "./vios-depara";

/** Opção do VIOS (tipo de tarefa ou usuário), como o robô do SAMA guarda no catálogo. */
export interface OpcaoVios {
  id: string;
  nome: string;
}

/** O que o jurídico escolhe para cada tarefa vinculada à publicação. */
export interface AgendamentoEntrada {
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  /** AAAA-MM-DD, escolhida no calendário (Providência). No Prazo é recalculada a partir da fatal (Enviar). */
  data: string;
  /** PRAZO: data fatal escolhida no calendário ou pelos atalhos de dias. */
  dataFatal?: string | null;
  /** PRAZO: atalho usado (5/10/15/30/60/90/180 dias úteis), se houver. */
  diasPrazo?: number | null;
  responsavel: string;
  revisor?: string | null;
  observacao?: string | null;
}

export interface AgendamentoValidado {
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  tarefaId: string;
  /** Data que vai para a tarefa no VIOS (no Prazo, o Enviar = fatal − 3 dias úteis). */
  data: string;
  dataFatal: string | null;
  diasPrazo: number | null;
  responsavel: string;
  responsavelId: string;
  revisor: string | null;
  revisorId: string | null;
  observacao: string | null;
}

export const MAX_AGENDAMENTOS = 10;
export const MAX_OBSERVACAO = 2000;

export function chaveNome(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(/[​-‍⁠﻿]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Tarefas que o jurídico pode escolher: as do de-para com a etiqueta escolhida
 * que o VIOS aceita na área da pasta (catálogo do SAMA). Nada fora disso é aceito.
 */
export function tarefasPermitidas(etapasDaArea: OpcaoVios[], etiqueta: EtiquetaAgendamento, pastaTipo: PastaTipo = "Processo"): OpcaoVios[] {
  const daEtiqueta = new Set(
    DEPARA_TAREFAS.filter((item) => item.etiqueta === etiqueta && item.pastas.includes(pastaTipo)).map((item) => chaveNome(item.nome))
  );
  const vistos = new Set<string>();
  return etapasDaArea
    .filter((etapa) => {
      const chave = chaveNome(etapa.nome);
      if (!daEtiqueta.has(chave) || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Área do catálogo do SAMA para a pasta: a área do processo no VIOS ou, sem ela, a do escritório. */
export function areaDoCatalogo(areaProcesso: string | null, escritorio: string | null, areasDisponiveis: string[]): string | null {
  const porChave = new Map(areasDisponiveis.map((area) => [chaveNome(area), area]));
  const candidatas = [areaProcesso, escritorio === "Reestruturação" ? "Cível | Insolvência" : escritorio];
  for (const candidata of candidatas) {
    const area = candidata ? porChave.get(chaveNome(candidata)) : undefined;
    if (area) return area;
  }
  return null;
}

/** Responsável sugerido: o advogado responsável da pasta, se for usuário do VIOS. */
export function responsavelSugerido(advogadoResponsavel: string | null, usuarios: OpcaoVios[]): OpcaoVios | null {
  const chave = chaveNome(advogadoResponsavel);
  if (!chave) return null;
  return usuarios.find((usuario) => chaveNome(usuario.nome) === chave) ?? null;
}

function dataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const data = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === iso;
}

/** AAAA-MM-DD → DD/MM/AAAA (contrato da fila do robô). */
export function paraDataVios(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Avisos (não bloqueiam) sobre a data escolhida. */
export function avisosDaData(iso: string, hoje: string): string[] {
  if (!dataValida(iso)) return [];
  const avisos: string[] = [];
  if (iso < hoje) avisos.push("Data no passado.");
  const diaSemana = new Date(`${iso}T12:00:00Z`).getUTCDay();
  if (diaSemana === 0 || diaSemana === 6) avisos.push("Data cai em fim de semana.");
  return avisos;
}

/**
 * Confere a vistagem antes de gravar: ao menos uma tarefa; cada uma com etiqueta,
 * tarefa da lista travada, data válida e responsável/revisor entre os usuários do VIOS.
 */
export function validarAgendamentos(
  entradas: AgendamentoEntrada[],
  contexto: { tarefas: Record<EtiquetaAgendamento, OpcaoVios[]>; usuarios: OpcaoVios[]; ehDiaUtil: (iso: string) => boolean }
): { ok: true; itens: AgendamentoValidado[] } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  if (!entradas.length) erros.push("Vincule ao menos uma tarefa à publicação.");
  if (entradas.length > MAX_AGENDAMENTOS) erros.push(`No máximo ${MAX_AGENDAMENTOS} tarefas por publicação.`);
  const usuarioPorChave = new Map(contexto.usuarios.map((usuario) => [chaveNome(usuario.nome), usuario]));

  const itens = entradas.map((entrada, indice): AgendamentoValidado | null => {
    const n = `Tarefa ${indice + 1}`;
    if (entrada.etiqueta !== "PRAZO" && entrada.etiqueta !== "PROVIDENCIA") {
      erros.push(`${n}: escolha Prazo ou Providência.`);
      return null;
    }
    const tarefa = contexto.tarefas[entrada.etiqueta].find((opcao) => chaveNome(opcao.nome) === chaveNome(entrada.tarefa));
    if (!tarefa) erros.push(`${n}: escolha uma tarefa da lista.`);
    const prazo = entrada.etiqueta === "PRAZO";
    const fatal = prazo && entrada.dataFatal && dataValida(entrada.dataFatal) ? entrada.dataFatal : null;
    // No Prazo, o VIOS recebe o Enviar (fatal − 3 dias úteis) e cria sozinho o Revisar (+1 útil)
    // e o Protocolar (+1 útil). Recalculado aqui; não vem da tela.
    const data = prazo ? (fatal ? somarDiasUteis(fatal, -3, contexto.ehDiaUtil) : "") : entrada.data;
    if (prazo && !fatal) erros.push(`${n}: escolha a data fatal do prazo.`);
    if (!prazo && !dataValida(data)) erros.push(`${n}: escolha a data no calendário.`);
    const responsavel = usuarioPorChave.get(chaveNome(entrada.responsavel));
    if (!responsavel) erros.push(`${n}: escolha o responsável na lista de usuários do VIOS.`);
    const revisor = entrada.revisor?.trim() ? usuarioPorChave.get(chaveNome(entrada.revisor)) : null;
    if (entrada.revisor?.trim() && !revisor) erros.push(`${n}: escolha o revisor na lista de usuários do VIOS.`);
    if (prazo && !entrada.revisor?.trim()) erros.push(`${n}: no Prazo o revisor é obrigatório.`);
    const observacao = entrada.observacao?.trim() || null;
    if (observacao && observacao.length > MAX_OBSERVACAO) erros.push(`${n}: observação com mais de ${MAX_OBSERVACAO} caracteres.`);
    if (!tarefa || !responsavel || !dataValida(data) || (prazo && !revisor)) return null;
    const diasPrazo = prazo && Number.isInteger(entrada.diasPrazo) && (entrada.diasPrazo ?? 0) > 0 ? (entrada.diasPrazo as number) : null;
    return {
      etiqueta: entrada.etiqueta,
      tarefa: tarefa.nome,
      tarefaId: tarefa.id,
      data,
      dataFatal: fatal,
      diasPrazo,
      responsavel: responsavel.nome,
      responsavelId: responsavel.id,
      revisor: revisor?.nome ?? null,
      revisorId: revisor?.id ?? null,
      observacao,
    };
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, itens: itens as AgendamentoValidado[] };
}

/** Teor máximo na descrição do VIOS; acima disso (raro) corta e avisa. */
export const LIMITE_TEOR_VIOS = 30_000;

const milhar = new Intl.NumberFormat("pt-BR");

/** Teor da Kurier vem numa linha só: separa o TEXTO do cabeçalho (PROCESSO, ORGÃO...) e tira linhas vazias em excesso. */
function teorParaVios(teor: string | null | undefined): string {
  const limpo = String(teor ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+TEXTO:\s*/, "\nTEXTO:\n")
    .trim();
  if (limpo.length <= LIMITE_TEOR_VIOS) return limpo;
  return `${limpo.slice(0, LIMITE_TEOR_VIOS).trimEnd()} […]\n(Teor cortado: ${milhar.format(LIMITE_TEOR_VIOS)} de ${milhar.format(limpo.length)} caracteres. Íntegra no Orquestra.)`;
}

/** Descrição da tarefa no VIOS: referência da publicação + observação do vistador + teor da publicação. */
export function montarObservacaoVios(
  publicacao: {
    dataPublicacao: string | null;
    tribunal: string | null;
    numeroProcesso: string | null;
    djenIdComunicacao: number | null;
    teor?: string | null;
  },
  observacao: string | null
): string {
  const referencia = [
    publicacao.dataPublicacao ? `Publicação de ${paraDataVios(publicacao.dataPublicacao)}` : "Publicação",
    publicacao.tribunal,
    publicacao.numeroProcesso ? `Processo ${publicacao.numeroProcesso}` : null,
    publicacao.djenIdComunicacao ? `ID comunicação ${publicacao.djenIdComunicacao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const cabecalho = [referencia, observacao?.trim(), "Vistagem pelo Orquestra."].filter(Boolean).join("\n");
  const teor = teorParaVios(publicacao.teor);
  return teor ? `${cabecalho}\n\nTEOR DA PUBLICAÇÃO\n${teor}` : cabecalho;
}

/** Sigla do VIOS a partir do nome (ex.: "Fernanda Voltarelli Arnoni" → "FVA"), com e sem preposições. */
export function siglasDoNome(nome: string): string[] {
  const palavras = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const sigla = (lista: string[]) => lista.map((palavra) => palavra[0].toUpperCase()).join("");
  return [...new Set([sigla(palavras.filter((p) => !/^(de|da|do|das|dos|e)$/i.test(p))), sigla(palavras)])];
}

/** Usuário do VIOS cuja sigla é a do auxiliar da pasta; null se não houver ou se for ambígua. */
export function usuarioPorSigla(sigla: string | null, usuarios: OpcaoVios[]): OpcaoVios | null {
  const alvo = sigla?.trim().toUpperCase();
  if (!alvo) return null;
  const candidatos = usuarios.filter((usuario) => siglasDoNome(usuario.nome).includes(alvo));
  return candidatos.length === 1 ? candidatos[0] : null;
}
