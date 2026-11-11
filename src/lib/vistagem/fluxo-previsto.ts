import { chaveDoCaminho, separarNomes } from "./agendamento";
import { datasDoPrazo, somarDiasCorridos, somarDiasUteis } from "./dias-uteis";
import { PESSOA_FIXA_PROTOCOLAR, cadeiaDoFluxo, cadeiaDoVios, type FluxoDaTarefa, type PapelNoFluxo, type ResponsabilidadeDoTipo, type TarefaDoFluxo } from "./fluxo-vios";
import type { AgendamentoResumo, DataDoFluxo, TarefaPrevista } from "./types";

/** O Orquestra não sabe o nome do estagiário da pasta: o VIOS põe quem está na pasta. */
export const ESTAGIARIO_DA_PASTA = "Estagiário da pasta";

/**
 * Quem fica numa tarefa que o fluxo do VIOS cria junto: a mesma regra do robô no lançamento (sama-rpa
 * regras-fluxo.js), com o que o VIOS põe pelo cadastro do tipo.
 * - 2. REVISAR: o revisor da vistagem; 3. PROTOCOLAR: o responsável e o Samuel.
 * - Tipo que o VIOS dá a pessoas fixas ou ao estagiário da pasta, sem a regra do advogado: fica como o VIOS cria
 *   (Larissa no Verificar Ata, o estagiário no Inserir Pauta e na Habilitação).
 * - Regra do advogado com outra: o responsável da vistagem e quem o VIOS põe.
 * - Só a regra do auxiliar: o revisor da vistagem. Só a do advogado, nenhuma, ou cadastro não lido: o responsável.
 * Com só os fixos lidos (catálogo antigo), ficam os fixos: é o que o VIOS cria quando o tipo não tem a regra do advogado.
 */
export function quemFicaNoFluxo(
  papel: PapelNoFluxo,
  responsabilidade: ResponsabilidadeDoTipo | null,
  pessoas: { responsavel: string | null; revisor: string | null }
): string {
  const responsavel = pessoas.responsavel || "responsável";
  if (papel === "revisor") return pessoas.revisor || "padrão do VIOS (sem revisor)";
  if (papel === "protocolar") return `${responsavel} + ${PESSOA_FIXA_PROTOCOLAR}`;
  if (!responsabilidade) return responsavel;
  const { fixos, regras } = responsabilidade;
  if (!regras) return fixos.length ? fixos.join(", ") : responsavel;
  // O coordenador e o grupo o Orquestra não sabe quem são: aparecem como "padrão do VIOS" quando são só eles.
  const doVios = [...fixos, ...(regras.estagiario ? [ESTAGIARIO_DA_PASTA] : [])];
  const outraRegra = regras.estagiario || regras.coordenador || regras.grupo || fixos.length > 0;
  if (outraRegra && !regras.advogado && !regras.auxiliar) return doVios.length ? doVios.join(", ") : "padrão do VIOS";
  if (outraRegra && regras.advogado) return separarNomes([responsavel, ...doVios].join(",")).join(", ");
  if (regras.auxiliar && !regras.advogado) return pessoas.revisor || "auxiliar da pasta";
  return responsavel;
}

/** Data pela regra do VIOS: N dias (úteis ou corridos; negativo = antes) do dia da criação ou da data da tarefa pai. */
function dataPelaRegra(regra: NonNullable<TarefaDoFluxo["regra"]>, dataDoPai: string | null, hoje: string, ehDiaUtil: (iso: string) => boolean): string | null {
  const inicio = regra.base === "atual" ? hoje : dataDoPai;
  if (!inicio) return null;
  const dias = regra.negativo ? -regra.dias : regra.dias;
  return regra.corridos ? somarDiasCorridos(inicio, dias) : somarDiasUteis(inicio, dias, ehDiaUtil);
}

/**
 * O que o fluxo automático do VIOS vai criar com a tarefa agendada, para conferir antes de mandar ao robô: as
 * tarefas criadas junto (e as que estas criam), com a data de cada uma e quem fica nela (`quemFicaNoFluxo`), e as
 * criadas ao concluir.
 *
 * A data segue as regras do VIOS lidas pelo robô (aba Prazos do tipo e Fluxo Automático - Criação do pai): N dias
 * úteis ou corridos, para a frente ou para trás, a partir do dia do lançamento (`hoje`) ou da data da tarefa pai.
 * Sem a regra lida, só o Revisar e o Protocolar têm data (conta antiga, pela cadeia do fluxo).
 *
 * `datas`: o que o jurídico mudou (data e/ou responsáveis). A filha de uma tarefa mudada é sugerida a partir da nova
 * data, mas o VIOS a cria pela data dele (`dataVios`); o robô grava no VIOS toda data que ficou diferente e os
 * responsáveis escolhidos (`fluxoParaOVios`).
 */
export function fluxoPrevisto(
  agendamento: Pick<AgendamentoResumo, "data" | "responsavel" | "revisor">,
  fluxo: FluxoDaTarefa | null,
  ehDiaUtil: (iso: string) => boolean,
  opcoes: {
    hoje: string;
    datas?: DataDoFluxo[] | null;
    /**
     * Prazo curto (`datasDoPrazo` com `ajustada`): o Revisar e o Protocolar da agendada vão nestas datas, não na
     * conta do VIOS a partir do Enviar (que passaria da fatal). A data escolhida pelo jurídico continua valendo.
     * Com `motivo: "antecipada"` (regra da insolvência), só o Protocolar vem aqui: 1 dia útil antes da fatal.
     */
    apertada?: DatasFixasDoFluxo | null;
  }
): TarefaPrevista[] {
  if (!fluxo) return [];
  // A conta antiga segue o VIOS (o que ele cria a partir do Enviar); a regra da insolvência vem em `apertada`.
  const cadeia = cadeiaDoVios(fluxo);
  const escolhas = new Map((opcoes.datas ?? []).map((item) => [chaveDoCaminho(item.caminho), item]));
  const quem = (tarefa: TarefaDoFluxo) => quemFicaNoFluxo(tarefa.papel, tarefa.responsabilidade ?? null, agendamento);
  // Conta antiga (sem a regra lida): só o Revisar e o Protocolar da agendada, pela cadeia do fluxo.
  const legado = (tarefa: TarefaDoFluxo, dataDoPai: string | null, nivel: number) => {
    if (nivel > 1 || !dataDoPai || !cadeia) return null;
    if (tarefa.papel === "revisor") return cadeia.revisar === null ? null : somarDiasUteis(dataDoPai, cadeia.revisar, ehDiaUtil);
    if (tarefa.papel === "protocolar") return somarDiasUteis(dataDoPai, cadeia.protocolar, ehDiaUtil);
    return null;
  };
  const dataDe = (tarefa: TarefaDoFluxo, dataDoPai: string | null, nivel: number) =>
    tarefa.regra ? dataPelaRegra(tarefa.regra, dataDoPai, opcoes.hoje, ehDiaUtil) : legado(tarefa, dataDoPai, nivel);

  const previstas: TarefaPrevista[] = [];
  const visitar = (tarefas: TarefaDoFluxo[], caminhoDoPai: string[], viosDoPai: string | null, finalDoPai: string | null, nivel: number) => {
    for (const tarefa of tarefas) {
      const caminho = [...caminhoDoPai, tarefa.nome];
      const dataVios = dataDe(tarefa, viosDoPai, nivel);
      const escolha = escolhas.get(chaveDoCaminho(caminho));
      const pedida = escolha?.data || null;
      const escolhidos = escolha?.responsaveis?.length ? escolha.responsaveis : null;
      const apertada =
        !pedida && nivel === 1 && opcoes.apertada
          ? tarefa.papel === "revisor"
            ? opcoes.apertada.revisar
            : tarefa.papel === "protocolar"
              ? opcoes.apertada.protocolar
              : null
          : null;
      const calculada = pedida ?? apertada ?? dataDe(tarefa, finalDoPai, nivel);
      // Nada antes de hoje: a regra do VIOS pode dar uma data passada (ex.: Enviar Custas 5 dias corridos antes de um
      // Enviar que já é hoje); vai para hoje, e o robô grava no VIOS. A escolhida pelo jurídico vale como está.
      const passada = !pedida && calculada !== null && calculada < opcoes.hoje;
      const data = passada ? opcoes.hoje : calculada;
      const ajustada = passada ? ("hoje" as const) : apertada && apertada !== dataVios ? (opcoes.apertada?.motivo ?? "fatal") : null;
      previstas.push({
        nome: tarefa.nome,
        caminho,
        nivel,
        data,
        dataVios,
        editada: Boolean(pedida),
        ...(ajustada && data !== dataVios ? { ajustada } : {}),
        responsaveis: escolhidos ? escolhidos.join(", ") : quem(tarefa),
        ...(escolhidos ? { responsaveisEscolhidos: escolhidos, responsaveisPadrao: quem(tarefa) } : {}),
        quando: "criacao",
        classe: tarefa.classe ?? null,
      });
      visitar(tarefa.filhas, caminho, dataVios, data, nivel + 1);
    }
  };
  visitar(fluxo.criacao, [], agendamento.data || null, agendamento.data || null, 1);
  for (const tarefa of fluxo.conclusao) {
    previstas.push({
      nome: tarefa.nome,
      caminho: [tarefa.nome],
      nivel: 1,
      data: null,
      dataVios: null,
      editada: false,
      responsaveis: "padrão do VIOS",
      quando: "conclusao",
    });
  }
  return previstas;
}

/**
 * As tarefas do fluxo em árvore, como o VIOS cria: embaixo de cada uma, as que ela cria (Embargos › Revisar ›
 * Protocolar; Apelação › Revisar › Protocolar), mesmo que as datas fiquem fora da ordem do calendário. Entre irmãs,
 * pela data (sem data por último) e, no empate, na ordem do fluxo.
 */
export function emOrdemDeArvore(previstas: TarefaPrevista[]): TarefaPrevista[] {
  const filhas = new Map<string, TarefaPrevista[]>();
  for (const tarefa of previstas) {
    const pai = chaveDoCaminho(tarefa.caminho.slice(0, -1));
    filhas.set(pai, [...(filhas.get(pai) ?? []), tarefa]);
  }
  const ordem = new Map(previstas.map((tarefa, indice) => [tarefa, indice]));
  const porData = (a: TarefaPrevista, b: TarefaPrevista) =>
    (a.data && b.data ? a.data.localeCompare(b.data) : a.data ? -1 : b.data ? 1 : 0) || (ordem.get(a) ?? 0) - (ordem.get(b) ?? 0);
  const saida: TarefaPrevista[] = [];
  const vistas = new Set<TarefaPrevista>();
  const visitar = (chave: string) => {
    for (const tarefa of [...(filhas.get(chave) ?? [])].sort(porData)) {
      if (vistas.has(tarefa)) continue;
      vistas.add(tarefa);
      saida.push(tarefa);
      visitar(chaveDoCaminho(tarefa.caminho));
    }
  };
  visitar(chaveDoCaminho([]));
  // Garantia: nenhuma fica de fora (caminho sem o pai na lista).
  return saida.length === previstas.length ? saida : [...saida, ...previstas.filter((tarefa) => !vistas.has(tarefa))];
}

type MotivoDoAjuste = NonNullable<TarefaPrevista["ajustada"]>;

/** Por que a data saiu da conta do VIOS (`TarefaPrevista.ajustada`), no selo da Conferência. */
export const ROTULO_AJUSTE_CURTO: Record<MotivoDoAjuste, string> = {
  fatal: "apertada antes da fatal",
  hoje: "VIOS daria antes de hoje",
  antecipada: "regra da insolvência",
};

/** O mesmo, por extenso, na lista do fluxo da vistagem. */
export const ROTULO_AJUSTE: Record<MotivoDoAjuste, string> = {
  fatal: "apertada para caber antes da fatal",
  hoje: "o VIOS daria antes de hoje: vai hoje",
  antecipada: "regra da insolvência: fica 1 dia útil antes da fatal",
};

/**
 * Revisar e Protocolar da agendada fora da conta do VIOS a partir do Enviar (`fluxoPrevisto` › `apertada`; null =
 * fica a do VIOS). Sem `motivo`, o prazo curto; `"antecipada"`, a regra da insolvência (`ANTECIPACAO_INSOLVENCIA`).
 */
export interface DatasFixasDoFluxo {
  revisar: string | null;
  protocolar: string | null;
  motivo?: "antecipada";
}

/**
 * Prazo curto a partir de hoje (`datasDoPrazo` com `ajustada`): o Enviar que vai para o VIOS (hoje) e as datas
 * apertadas do Revisar e do Protocolar, até 1 dia útil antes da fatal. Null quando a cadeia do fluxo cabe.
 *
 * Com `data` depois de hoje, não aperta: pela conta da fatal, um Enviar futuro nunca precisa apertar, então só
 * chega aqui o escolhido à mão na Conferência, que vale como está (senão o robô receberia o de hoje no lugar dele).
 *
 * Regra da insolvência (`cadeia.antecipada`), quando não aperta: o Enviar é o da tarefa e o VIOS cria o Revisar 1 dia
 * útil depois dele, como deve; o Protocolar ele criaria 2 dias depois, então vai 1 dia útil antes da fatal
 * (`motivo: "antecipada"`), onde estaria sem a regra. O robô grava no VIOS só se ficar diferente.
 */
export function prazoApertado(
  agendamento: { etiqueta: string; dataFatal: string | null; data?: string | null },
  fluxo: FluxoDaTarefa | null,
  ehDiaUtil: (iso: string) => boolean,
  hoje: string
): ({ enviar: string } & DatasFixasDoFluxo) | null {
  if (agendamento.etiqueta !== "PRAZO" || !agendamento.dataFatal) return null;
  const cadeia = cadeiaDoFluxo(fluxo);
  const datas = datasDoPrazo(agendamento.dataFatal, ehDiaUtil, cadeia, hoje);
  const futuro = Boolean(agendamento.data && agendamento.data > hoje);
  if (datas.ajustada && !futuro) return { enviar: datas.enviar, revisar: datas.revisar, protocolar: datas.protocolar };
  if (!cadeia?.antecipada) return null;
  const enviar = agendamento.data || datas.enviar;
  const protocolar = somarDiasUteis(agendamento.dataFatal, -1, ehDiaUtil);
  return protocolar >= enviar ? { enviar, revisar: null, protocolar, motivo: "antecipada" } : null;
}

/**
 * O que o robô grava nas tarefas do fluxo depois de lançar: as datas que ficaram diferentes da que o VIOS dá e os
 * responsáveis escolhidos pelo jurídico (a Ciência repetida o robô cancela: não vai).
 */
export function fluxoParaOVios(previstas: TarefaPrevista[]): DataDoFluxo[] {
  return previstas.flatMap((tarefa) => {
    if (tarefa.quando !== "criacao" || tarefa.repetida) return [];
    const data = tarefa.data && tarefa.data !== tarefa.dataVios ? tarefa.data : null;
    const responsaveis = tarefa.responsaveisEscolhidos?.length ? tarefa.responsaveisEscolhidos : null;
    if (!data && !responsaveis) return [];
    return [{ caminho: tarefa.caminho, ...(data ? { data } : {}), ...(responsaveis ? { responsaveis } : {}) }];
  });
}

/** Caminhos das tarefas que o fluxo cria junto (para aceitar só datas de tarefas que existem). */
export function caminhosDoFluxo(fluxo: FluxoDaTarefa | null): Set<string> {
  const caminhos = new Set<string>();
  const visitar = (tarefas: TarefaDoFluxo[], acima: string[]) => {
    for (const tarefa of tarefas) {
      const caminho = [...acima, tarefa.nome];
      caminhos.add(chaveDoCaminho(caminho));
      visitar(tarefa.filhas, caminho);
    }
  };
  visitar(fluxo?.criacao ?? [], []);
  return caminhos;
}
