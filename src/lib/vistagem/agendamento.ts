import { CONTAGENS_PRAZO, DIAS_PRAZO, DIAS_PRAZO_TRABALHISTA, datasDoPrazo, type ContagemPrazo } from "./dias-uteis";
import type { CadeiaDoPrazo } from "./fluxo-vios";
import type { DataDoFluxo } from "./types";

/**
 * Classe da tarefa, igual à etiqueta do tipo no VIOS: PRAZO = ENVIAR; PROVIDENCIA =
 * PROVIDÊNCIA; COMPROMISSO = COMPROMISSO (audiência, perícia, leilão, sessão…).
 */
export type EtiquetaAgendamento = "PRAZO" | "PROVIDENCIA" | "COMPROMISSO";

export const ETIQUETAS_AGENDAMENTO: readonly EtiquetaAgendamento[] = ["PRAZO", "PROVIDENCIA", "COMPROMISSO"];

export const ROTULO_ETIQUETA: Record<EtiquetaAgendamento, string> = { PRAZO: "Prazo", PROVIDENCIA: "Providência", COMPROMISSO: "Compromisso" };

/**
 * Id da etiqueta no VIOS (tipos_tarefas_x_etiquetas) de cada classe. As demais etiquetas
 * (2. REVISAR, 3. PROTOCOLAR…) são de tarefas que o fluxo do VIOS cria sozinho.
 */
export const ETIQUETA_VIOS: Record<EtiquetaAgendamento, number> = { PRAZO: 1, PROVIDENCIA: 204, COMPROMISSO: 205 };

/** Classe do tipo de tarefa pelas etiquetas dele no VIOS; null sem nenhuma das três ou com mais de uma. */
export function classeDasEtiquetas(etiquetas: readonly number[]): EtiquetaAgendamento | null {
  const classes = (Object.keys(ETIQUETA_VIOS) as EtiquetaAgendamento[]).filter((classe) => etiquetas.includes(ETIQUETA_VIOS[classe]));
  return classes.length === 1 ? classes[0] : null;
}

/** Opção do VIOS (tipo de tarefa ou usuário), como o robô do SAMA guarda no catálogo. */
export interface OpcaoVios {
  id: string;
  nome: string;
}

/** Tipo de tarefa que o VIOS aceita na área, com as etiquetas configuradas nele (SAMA: vios_tipos_tarefa). */
export interface EtapaVios extends OpcaoVios {
  etiquetas: number[];
  /** Responsáveis fixos do tipo no VIOS (ex.: ATUALIZAÇÃO DE CADASTRO); vazio = segue o advogado da pasta. */
  responsaveis?: string[];
}

/** Tarefa da lista do jurídico. `nome` é único na lista; `nomeVios` vem quando o nome ganhou o tipo para desempatar. */
export interface OpcaoTarefa extends OpcaoVios {
  nomeVios?: string;
  /** Responsáveis fixos do tipo no VIOS: a vistagem já vem com eles. */
  responsaveis?: string[];
}

/** O que o jurídico escolhe para cada tarefa vinculada à publicação. */
export interface AgendamentoEntrada {
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  /** Tipo de tarefa do VIOS escolhido na lista (desempata nomes repetidos). */
  tarefaId?: string | null;
  /** AAAA-MM-DD, escolhida no calendário (Providência/Compromisso). No Prazo é recalculada a partir da fatal (Enviar). */
  data: string;
  /** PRAZO: data fatal escolhida no calendário ou pelos atalhos de dias. */
  dataFatal?: string | null;
  /** PRAZO: atalho usado (5/10/15/30/60/90/180 dias), se houver. */
  diasPrazo?: number | null;
  /** PRAZO com atalho: dias úteis ou corridos, escolhido no modal. */
  contagemPrazo?: ContagemPrazo | null;
  /** COMPROMISSO: HH:MM da audiência, perícia, sessão… (obrigatório). */
  hora?: string | null;
  /** COMPROMISSO: HH:MM em que termina (Hora final no VIOS); sem ela, 1 hora depois da inicial. */
  horaFim?: string | null;
  responsavel: string;
  revisor?: string | null;
  observacao?: string | null;
  /** Datas e responsáveis de tarefas do fluxo que a pessoa mudou (o robô grava no VIOS depois de lançar). */
  fluxoDatas?: DataDoFluxo[] | null;
}

export interface AgendamentoValidado {
  etiqueta: EtiquetaAgendamento;
  tarefa: string;
  tarefaId: string;
  /** Data que vai para a tarefa no VIOS (no Prazo, o Enviar: fatal − 1 − dias do 3. PROTOCOLAR do fluxo). */
  data: string;
  dataFatal: string | null;
  diasPrazo: number | null;
  /** Só com diasPrazo; sem atalho (fatal no calendário), null. */
  contagemPrazo: ContagemPrazo | null;
  /** COMPROMISSO: HH:MM; nas outras classes, null. */
  hora: string | null;
  /** COMPROMISSO: Hora final no VIOS (HH:MM, depois da inicial); nas outras classes, null. */
  horaFim: string | null;
  responsavel: string;
  responsavelId: string;
  revisor: string | null;
  revisorId: string | null;
  observacao: string | null;
  fluxoDatas: DataDoFluxo[];
}

export const MAX_AGENDAMENTOS = 10;
export const MAX_OBSERVACAO = 2000;
/** O maior fluxo do VIOS cria uns 15 tipos junto (Audiência UNA/Inicial com Contestação e Revisar/Protocolar dela). */
const MAX_DATAS_DO_FLUXO = 40;
/** Pessoas numa tarefa do fluxo escolhidas pelo jurídico. */
const MAX_RESPONSAVEIS_DO_FLUXO = 10;

/** Chave de uma tarefa do fluxo pelo caminho de tipos a partir da agendada (ex.: "EMBARGOS DE DECLARACAO > 2. REVISAR"). */
export function chaveDoCaminho(caminho: string[]): string {
  return caminho.map(chaveNome).join(" > ");
}

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
 * Tarefas que o jurídico pode escolher: as que o VIOS aceita na área da pasta (catálogo
 * do SAMA) e que têm no VIOS a etiqueta da classe escolhida. Nada fora disso é aceito. Tipos diferentes com o mesmo nome (ex.: APELAÇÃO 36 e 486, com fluxos
 * diferentes) aparecem os dois, com o número do tipo no nome.
 */
export function tarefasPermitidas(etapasDaArea: EtapaVios[], etiqueta: EtiquetaAgendamento): OpcaoTarefa[] {
  const alvo = ETIQUETA_VIOS[etiqueta];
  const vistos = new Set<string>();
  const etapas = etapasDaArea.filter((etapa) => {
    if (!etapa.etiquetas.includes(alvo) || vistos.has(etapa.id)) return false;
    vistos.add(etapa.id);
    return true;
  });
  const repetidos = new Map<string, number>();
  for (const etapa of etapas) repetidos.set(chaveNome(etapa.nome), (repetidos.get(chaveNome(etapa.nome)) ?? 0) + 1);
  return etapas
    .map((etapa): OpcaoTarefa => {
      const opcao: OpcaoTarefa =
        (repetidos.get(chaveNome(etapa.nome)) ?? 0) > 1 ? { id: etapa.id, nome: `${etapa.nome} (tipo ${etapa.id})`, nomeVios: etapa.nome } : { id: etapa.id, nome: etapa.nome };
      return etapa.responsaveis?.length ? { ...opcao, responsaveis: etapa.responsaveis } : opcao;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
}

/** Nomes que existem na lista de usuários do VIOS da área, com a grafia de lá. */
export function responsaveisNaArea(nomes: string[], usuarios: OpcaoVios[]): string[] {
  const porChave = new Map(usuarios.map((usuario) => [chaveNome(usuario.nome), usuario.nome]));
  return [...new Set(nomes.map((nome) => porChave.get(chaveNome(nome))).filter((nome): nome is string => Boolean(nome)))];
}

/** Escopo "*" (liderança em Usuários) e sócio patrimonial (departamento "Sócio" no RH): a pessoa vale para todas as áreas. */
export const TODAS_AS_AREAS = "*";

/**
 * Área no nome dos escritórios da vistagem. RH, VIOS e Usuários chamam a mesma área de jeitos diferentes:
 * Insolvência e "Cível | Insolvência" são Reestruturação; Special Situations é Distressed Deals;
 * "Operações Legais (Legal Ops)" é Operações Legais; "Societário e Contratos" é Contratos.
 */
export function escritorioDaArea(area: string | null | undefined): string | null {
  const chave = chaveNome(area);
  if (!chave) return null;
  if (chave.includes("INSOLV")) return "Reestruturação";
  if (chave.includes("SPECIAL SITUATIONS")) return "Distressed Deals";
  if (chave.includes("LEGAL OPS")) return "Operações Legais";
  if (chave.includes("CONTRATOS")) return "Contratos";
  return String(area).trim();
}

/** Time da Controladoria Jurídica no organograma: dentro de Operações Legais, é ele que vista e agenda. */
export const TIME_CONTROLADORIA = "controladoria";

/**
 * Departamento que vale para a vistagem. O departamento "Operações Legais" do RH junta Controladoria, Financeiro,
 * Marketing, Facilities, P&C e outros: só a Controladoria (e a liderança da área, que não tem time) fica em
 * Operações Legais; quem é de outro time passa a ter o nome do time e sai da lista da área.
 */
export function departamentoNaVistagem(departamento: string | null, times: { chave: string; rotulo: string }[]): string | null {
  if (chaveNome(escritorioDaArea(departamento)) !== chaveNome("Operações Legais") || !times.length) return departamento;
  return times.some((time) => time.chave === TIME_CONTROLADORIA) ? departamento : times[0].rotulo;
}

/** Áreas de uma pessoa: o departamento no RH e o escopo de liderança em Usuários (Férias personalizado), sem repetir. */
export function areasDaPessoa(departamento: string | null | undefined, escopo?: string[] | null): string[] {
  const areas = new Map<string, string>();
  for (const valor of [departamento, ...(escopo ?? [])]) {
    const area = valor?.trim() === TODAS_AS_AREAS || chaveNome(valor) === "SOCIO" ? TODAS_AS_AREAS : escritorioDaArea(valor);
    if (area && !areas.has(chaveNome(area))) areas.set(chaveNome(area), area);
  }
  return [...areas.values()];
}

/** Quem aparece nos campos de pessoa da publicação: `area` é o rótulo (ex.: "Trabalhista"); `nomes`, com a grafia do VIOS. */
export interface PessoasDaArea {
  area: string;
  nomes: string[];
}

/**
 * Usuários do VIOS que aparecem em Responsável e Revisor: os das áreas da publicação (escritório da fila e área
 * do processo; no ex-cliente, Operações Legais e a área do processo). Também aparecem quem vale para todas as
 * áreas (sócio patrimonial, escopo "*"), quem não tem área conhecida (fora do RH e de Usuários: não some sem
 * critério) e as pessoas da pasta (advogado e auxiliar). Null quando nenhum usuário é das áreas (ex.: Distressed
 * Deals sem colaborador ativo) ou a área é desconhecida: a lista fica inteira.
 */
export function pessoasDaArea(
  usuarios: OpcaoVios[],
  areasDe: Record<string, string[]>,
  areasDaPublicacao: (string | null | undefined)[],
  daPasta: (string | null | undefined)[] = []
): PessoasDaArea | null {
  const alvo = new Map<string, string>();
  for (const valor of areasDaPublicacao) {
    const area = escritorioDaArea(valor);
    if (area && !alvo.has(chaveNome(area))) alvo.set(chaveNome(area), area);
  }
  if (!alvo.size) return null;
  const areasDoUsuario = (nome: string) => (areasDe[chaveNome(nome)] ?? []).map(chaveNome);
  const ehDaArea = (nome: string) => areasDoUsuario(nome).some((area) => alvo.has(area));
  if (!usuarios.some((usuario) => ehDaArea(usuario.nome))) return null;
  const fixos = new Set(daPasta.map(chaveNome).filter(Boolean));
  const nomes = usuarios
    .filter((usuario) => {
      const areas = areasDoUsuario(usuario.nome);
      return !areas.length || areas.includes(TODAS_AS_AREAS) || ehDaArea(usuario.nome) || fixos.has(chaveNome(usuario.nome));
    })
    .map((usuario) => usuario.nome);
  return { area: [...alvo.values()].join(" e "), nomes };
}

/**
 * Pessoas de um campo de responsáveis como aparece nas telas: separadas por vírgula ou por " + " (no Protocolar o
 * fluxo junta o responsável e a pessoa fixa), sem repetir.
 */
export function nomesDasPessoas(texto: string | null | undefined): string[] {
  return separarNomes(String(texto ?? "").replace(/\s\+\s/g, ","));
}

/** Nomes separados por vírgula, sem repetir (a fila do robô usa o mesmo formato). */
export function separarNomes(texto: string | null | undefined): string[] {
  const vistos = new Set<string>();
  return String(texto ?? "")
    .split(",")
    .map((nome) => nome.trim())
    .filter((nome) => {
      const chave = chaveNome(nome);
      if (!chave || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}

/**
 * SESSÃO DE JULGAMENTO: o fluxo dela não tem "2. REVISAR", então o revisor fica na própria tarefa, junto com o
 * responsável. É a regra do robô no lançamento (sama-rpa regras-fluxo.js, responsaveisDaTarefaLancada).
 */
export function revisorFicaNaTarefa(tarefa: string | null | undefined): boolean {
  return chaveNome(tarefa) === "SESSAO DE JULGAMENTO";
}

/** Área do catálogo do SAMA para a pasta: a área do processo no VIOS ou, sem ela, a do escritório. */
export function areaDoCatalogo(areaProcesso: string | null, escritorio: string | null, areasDisponiveis: string[]): string | null {
  const porChave = new Map(areasDisponiveis.map((area) => [chaveNome(area), area]));
  const candidatas = [areaProcesso, escritorio];
  for (const candidata of candidatas) {
    const area = candidata ? porChave.get(chaveNome(candidata)) : undefined;
    if (area) return area;
  }
  return null;
}

/**
 * Como o Prazo começa marcado na vistagem: na Insolvência, dias corridos (Lei 11.101, art. 189); nas outras áreas
 * (inclusive Cível | Insolvência), dias úteis. O jurídico pode trocar na tarefa.
 */
export function contagemPadraoDaArea(area: string | null | undefined): ContagemPrazo {
  return chaveNome(area) === "INSOLVENCIA" ? "corridos" : "uteis";
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

/** HH:MM de 00:00 a 23:59. */
export function horaValida(hora: string | null | undefined): hora is string {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora ?? ""));
}

/** Hora final padrão do Compromisso: 1 hora depois da inicial, sem passar das 23:59 ("09:30" → "10:30"). */
export function horaFinalPadrao(hora: string | null | undefined): string {
  if (!horaValida(hora)) return "";
  const [h, m] = hora.split(":").map(Number);
  const minutos = Math.min(h * 60 + m + 60, 23 * 60 + 59);
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
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
 * tarefa da lista travada, data válida e responsável/revisor entre os usuários do VIOS
 * (revisor obrigatório no Prazo, opcional no Compromisso e ignorado na Providência).
 */
export function validarAgendamentos(
  entradas: AgendamentoEntrada[],
  contexto: {
    tarefas: Record<EtiquetaAgendamento, OpcaoTarefa[]>;
    usuarios: OpcaoVios[];
    ehDiaUtil: (iso: string) => boolean;
    /** Cadeia do fluxo do VIOS para o tipo de tarefa (null: o VIOS não cria Protocolar). */
    cadeiaDaTarefa: (tarefaId: string) => CadeiaDoPrazo | null;
    /** Tarefas que o fluxo do tipo cria junto (chaveDoCaminho), para aceitar só datas delas. */
    caminhosDaTarefa?: (tarefaId: string) => Set<string>;
    /** Tarefa de Prazo sem prazo próprio no VIOS (a SENTENÇA): vai com a data dela, sem fatal. */
    semPrazoProprio?: (tarefaId: string) => boolean;
    /** Dia da vistagem: o Enviar do Prazo nunca fica antes dele (prazo curto aperta a cadeia). */
    hoje?: string;
  }
): { ok: true; itens: AgendamentoValidado[] } | { ok: false; erros: string[] } {
  const erros: string[] = [];
  if (!entradas.length) erros.push("Vincule ao menos uma tarefa à publicação.");
  if (entradas.length > MAX_AGENDAMENTOS) erros.push(`No máximo ${MAX_AGENDAMENTOS} tarefas por publicação.`);
  const usuarioPorChave = new Map(contexto.usuarios.map((usuario) => [chaveNome(usuario.nome), usuario]));

  const itens = entradas.map((entrada, indice): AgendamentoValidado | null => {
    const n = `Tarefa ${indice + 1}`;
    if (!ETIQUETAS_AGENDAMENTO.includes(entrada.etiqueta)) {
      erros.push(`${n}: escolha Prazo, Providência ou Compromisso.`);
      return null;
    }
    const opcoes = contexto.tarefas[entrada.etiqueta];
    const tarefa = entrada.tarefaId
      ? opcoes.find((opcao) => opcao.id === entrada.tarefaId)
      : opcoes.find((opcao) => chaveNome(opcao.nome) === chaveNome(entrada.tarefa));
    if (!tarefa) erros.push(`${n}: escolha uma tarefa da lista.`);
    const prazo = entrada.etiqueta === "PRAZO";
    const semFatal = prazo && Boolean(tarefa && contexto.semPrazoProprio?.(tarefa.id));
    const fatalPedida = prazo && entrada.dataFatal && dataValida(entrada.dataFatal) ? entrada.dataFatal : null;
    const fatal = semFatal ? null : fatalPedida;
    // No Prazo, o VIOS recebe o Enviar e cria sozinho o Revisar e o Protocolar conforme o
    // fluxo do tipo de tarefa. Recalculado aqui; não vem da tela. Sem prazo próprio, vale a data da tela
    // (ou, de uma aba aberta antes desta versão, o Enviar da fatal que ela ainda pede).
    const data =
      prazo && !(semFatal && entrada.data)
        ? fatalPedida && tarefa
          ? datasDoPrazo(fatalPedida, contexto.ehDiaUtil, contexto.cadeiaDaTarefa(tarefa.id), contexto.hoje ?? null).enviar
          : ""
        : entrada.data;
    if (prazo && !semFatal && !fatal) erros.push(`${n}: escolha a data fatal do prazo.`);
    if ((!prazo || semFatal) && !dataValida(data)) erros.push(`${n}: escolha a data no calendário.`);
    // Audiência, perícia, sessão…: o horário vai junto para o VIOS.
    const compromisso = entrada.etiqueta === "COMPROMISSO";
    const hora = compromisso && horaValida(entrada.hora?.trim()) ? (entrada.hora as string).trim() : null;
    if (compromisso && !hora) erros.push(`${n}: informe o horário do compromisso.`);
    // Hora final: a escolhida (depois da inicial) ou 1 hora depois; sem ela o VIOS grava 00:00 (CI 934918).
    const horaFimPedida = entrada.horaFim?.trim() || "";
    if (compromisso && hora && horaFimPedida && (!horaValida(horaFimPedida) || horaFimPedida <= hora)) {
      erros.push(`${n}: a hora final tem de ser depois da hora do compromisso.`);
    }
    const horaFim = compromisso && hora ? (horaValida(horaFimPedida) && horaFimPedida > hora ? horaFimPedida : horaFinalPadrao(hora)) : null;
    // Pode haver mais de um responsável (ex.: tipos com responsáveis fixos no VIOS), separados por vírgula.
    const nomesResponsaveis = separarNomes(entrada.responsavel);
    const encontrados = nomesResponsaveis.map((nome) => usuarioPorChave.get(chaveNome(nome)));
    const responsavel = nomesResponsaveis.length && encontrados.every(Boolean) ? (encontrados as OpcaoVios[]) : null;
    if (!responsavel) erros.push(`${n}: escolha o responsável na lista de usuários do VIOS.`);
    // Providência não tem revisor: nenhum tipo de Providência cria 2. REVISAR no VIOS (conferido em 05/11/2026).
    const comRevisor = entrada.etiqueta !== "PROVIDENCIA";
    const revisor = comRevisor && entrada.revisor?.trim() ? usuarioPorChave.get(chaveNome(entrada.revisor)) : null;
    if (comRevisor && entrada.revisor?.trim() && !revisor) erros.push(`${n}: escolha o revisor na lista de usuários do VIOS.`);
    if (prazo && !entrada.revisor?.trim()) erros.push(`${n}: no Prazo o revisor é obrigatório.`);
    // Observação opcional: vai na descrição da tarefa no VIOS, abaixo da data da publicação.
    const observacao = entrada.observacao?.trim() || null;
    if (observacao && observacao.length > MAX_OBSERVACAO) erros.push(`${n}: observação com mais de ${MAX_OBSERVACAO} caracteres.`);
    const diasPrazo = prazo && !semFatal && Number.isInteger(entrada.diasPrazo) && (entrada.diasPrazo ?? 0) > 0 ? (entrada.diasPrazo as number) : null;
    const contagemPrazo = diasPrazo ? CONTAGENS_PRAZO.find((contagem) => contagem === entrada.contagemPrazo) ?? null : null;
    if (diasPrazo && !contagemPrazo) erros.push(`${n}: escolha se o prazo é em dias úteis ou corridos.`);
    // O que a pessoa mudou no fluxo do VIOS: só de tarefas que o fluxo do tipo cria, com data válida e/ou
    // responsáveis da lista de usuários do VIOS (com o nome como está no VIOS, que o robô procura).
    let pessoaForaDoVios = false;
    const fluxoDatas = (Array.isArray(entrada.fluxoDatas) ? entrada.fluxoDatas : [])
      .filter(
        (item) =>
          Array.isArray(item?.caminho) &&
          item.caminho.length > 0 &&
          item.caminho.length <= 5 &&
          item.caminho.every((parte) => typeof parte === "string" && parte.trim() && parte.length <= 200)
      )
      .slice(0, MAX_DATAS_DO_FLUXO)
      .flatMap((item): DataDoFluxo[] => {
        const dataDoFluxo = item.data && dataValida(String(item.data)) ? item.data : null;
        const pedidos = (Array.isArray(item.responsaveis) ? item.responsaveis : [])
          .filter((nome): nome is string => typeof nome === "string" && Boolean(nome.trim()))
          .slice(0, MAX_RESPONSAVEIS_DO_FLUXO)
          .map((nome) => usuarioPorChave.get(chaveNome(nome)));
        if (pedidos.some((usuario) => !usuario)) pessoaForaDoVios = true;
        const responsaveis = [...new Set(pedidos.flatMap((usuario) => (usuario ? [usuario.nome] : [])))];
        if (!dataDoFluxo && !responsaveis.length) return [];
        return [
          {
            caminho: item.caminho.map((parte) => parte.trim()),
            ...(dataDoFluxo ? { data: dataDoFluxo } : {}),
            ...(responsaveis.length ? { responsaveis } : {}),
          },
        ];
      });
    if (pessoaForaDoVios) erros.push(`${n}: escolha os responsáveis das tarefas do fluxo na lista de usuários do VIOS.`);
    const caminhos = tarefa && contexto.caminhosDaTarefa ? contexto.caminhosDaTarefa(tarefa.id) : null;
    if (caminhos && fluxoDatas.some((item) => !caminhos.has(chaveDoCaminho(item.caminho)))) {
      erros.push(`${n}: há data ou responsável de tarefa do fluxo que esse tipo não cria no VIOS; confira o Fluxo das tarefas.`);
    }
    if (!tarefa || !responsavel || !dataValida(data) || (prazo && !revisor) || (compromisso && !hora) || (diasPrazo && !contagemPrazo)) {
      return null;
    }
    return {
      etiqueta: entrada.etiqueta,
      tarefa: tarefa.nomeVios ?? tarefa.nome,
      tarefaId: tarefa.id,
      data,
      dataFatal: fatal,
      diasPrazo,
      contagemPrazo,
      hora,
      horaFim,
      responsavel: responsavel.map((usuario) => usuario.nome).join(", "),
      responsavelId: responsavel.map((usuario) => usuario.id).join(","),
      revisor: revisor?.nome ?? null,
      revisorId: revisor?.id ?? null,
      observacao,
      fluxoDatas,
    };
  });

  if (erros.length) return { ok: false, erros };
  return { ok: true, itens: itens as AgendamentoValidado[] };
}

/** Referência curta da publicação (só para a linha da fila do robô, não vai para a tarefa). */
export function referenciaDaPublicacao(publicacao: {
  dataPublicacao: string | null;
  tribunal: string | null;
  numeroProcesso: string | null;
  djenIdComunicacao: number | null;
}): string {
  return [
    publicacao.dataPublicacao ? `Publicação de ${paraDataVios(publicacao.dataPublicacao)}` : "Publicação",
    publicacao.tribunal,
    publicacao.numeroProcesso ? `Processo ${publicacao.numeroProcesso}` : null,
    publicacao.djenIdComunicacao ? `ID comunicação ${publicacao.djenIdComunicacao}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Descrição da tarefa no VIOS: "Publicação de dd/mm/aaaa" e, se houver, a observação do vistador.
 * O teor não vai: lançada na publicação, o próprio VIOS junta o texto da intimação.
 */
export function montarObservacaoVios(dataPublicacao: string | null | undefined, observacao: string | null): string {
  const cabecalho = dataPublicacao ? `Publicação de ${paraDataVios(dataPublicacao)}` : "Publicação";
  const texto = observacao?.trim();
  return texto ? `${cabecalho}\n${texto}` : cabecalho;
}

/** Atalhos de dias do Prazo: o Trabalhista tem também 8 e 16 dias. */
export function atalhosDePrazo(areaDoCatalogo: string | null | undefined): readonly number[] {
  return chaveNome(areaDoCatalogo) === "TRABALHISTA" ? DIAS_PRAZO_TRABALHISTA : DIAS_PRAZO;
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
