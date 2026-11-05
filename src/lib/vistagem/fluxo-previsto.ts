import { chaveDoCaminho, separarNomes } from "./agendamento";
import { somarDiasCorridos, somarDiasUteis } from "./dias-uteis";
import { PESSOA_FIXA_PROTOCOLAR, cadeiaDoFluxo, type FluxoDaTarefa, type PapelNoFluxo, type ResponsabilidadeDoTipo, type TarefaDoFluxo } from "./fluxo-vios";
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
 * `datas`: as que o jurídico mudou. A filha de uma tarefa mudada é sugerida a partir da nova data, mas o VIOS a
 * cria pela data dele (`dataVios`); o robô grava no VIOS toda data que ficou diferente (`datasParaOVios`).
 */
export function fluxoPrevisto(
  agendamento: Pick<AgendamentoResumo, "data" | "responsavel" | "revisor">,
  fluxo: FluxoDaTarefa | null,
  ehDiaUtil: (iso: string) => boolean,
  opcoes: { hoje: string; datas?: DataDoFluxo[] | null }
): TarefaPrevista[] {
  if (!fluxo) return [];
  const cadeia = cadeiaDoFluxo(fluxo);
  const pedidas = new Map((opcoes.datas ?? []).map((item) => [chaveDoCaminho(item.caminho), item.data]));
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
      const pedida = pedidas.get(chaveDoCaminho(caminho)) ?? null;
      const data = pedida ?? dataDe(tarefa, finalDoPai, nivel);
      previstas.push({ nome: tarefa.nome, caminho, nivel, data, dataVios, editada: Boolean(pedida), responsaveis: quem(tarefa), quando: "criacao" });
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

/** Datas que o robô grava no VIOS depois de lançar: as do fluxo que ficaram diferentes da que o VIOS dá. */
export function datasParaOVios(previstas: TarefaPrevista[]): DataDoFluxo[] {
  return previstas
    .filter((tarefa) => tarefa.quando === "criacao" && tarefa.data && tarefa.data !== tarefa.dataVios)
    .map((tarefa) => ({ caminho: tarefa.caminho, data: tarefa.data as string }));
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
