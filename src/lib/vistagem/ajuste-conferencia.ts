import { chaveDoCaminho, dataValida, mesmasPessoas, paraDataVios, separarNomes } from "./agendamento";
import type { DataDoFluxo, EnvioStatus, MudancaNaTarefa, PublicacaoStatus } from "./types";

/** O que a controladoria pode ajustar numa tarefa na Conferência; o tipo de tarefa e a observação ficam como o jurídico pediu. */
export interface CamposDaTarefa {
  /** No Prazo, o Enviar; nas outras classes, a data da tarefa. */
  data: string;
  dataFatal: string | null;
  hora: string | null;
  horaFim: string | null;
  /** SESSÃO DE JULGAMENTO: data limite no VIOS; nos outros tipos, null. */
  dataLimite?: string | null;
  responsavel: string;
  revisor: string | null;
  fluxoDatas: DataDoFluxo[];
}

/**
 * A mudança ainda chega ao VIOS: a conferir (o robô lê a tarefa ao validar) ou com erro no robô (lê ao rodar de novo).
 * Com o robô, ou já lançada, editar aqui não mudaria nada lá.
 */
export function podeEditarNaConferencia(status: PublicacaoStatus, envio: EnvioStatus): boolean {
  return (status === "controladoria_vistar" && envio === "nao_enviado") || (status === "pronto_para_agendar" && envio === "erro");
}

/** O que mudou na tarefa, em texto de tela: é o que a Conferência registra e mostra no cartão. */
export function mudancasNaTarefa(antes: CamposDaTarefa, depois: CamposDaTarefa): MudancaNaTarefa[] {
  const mudancas: MudancaNaTarefa[] = [];
  const anotar = (campo: string, de: string, para: string) => {
    if (de !== para) mudancas.push({ campo, de, para });
  };
  const dia = (iso: string | null | undefined, vazio: string) => (iso ? paraDataVios(iso) : vazio);
  const pessoas = (campo: string, de: string[], para: string[], vazio: string) => {
    if (!mesmasPessoas(de, para)) mudancas.push({ campo, de: de.join(", ") || vazio, para: para.join(", ") || vazio });
  };

  anotar("Data fatal", dia(antes.dataFatal, "sem fatal"), dia(depois.dataFatal, "sem fatal"));
  anotar(depois.dataFatal ? "Enviar no VIOS" : "Data no VIOS", dia(antes.data, "sem data"), dia(depois.data, "sem data"));
  anotar("Horário", antes.hora ?? "sem horário", depois.hora ?? "sem horário");
  anotar("Hora final", antes.horaFim ?? "sem hora final", depois.horaFim ?? "sem hora final");
  // Só a SESSÃO DE JULGAMENTO tem data limite própria; sem ela gravada, era a própria data.
  if (depois.dataLimite) anotar("Data limite", dia(antes.dataLimite ?? antes.data, "sem data"), dia(depois.dataLimite, "sem data"));
  pessoas("Responsável", separarNomes(antes.responsavel), separarNomes(depois.responsavel), "sem responsável");
  pessoas("Revisor", separarNomes(antes.revisor), separarNomes(depois.revisor), "sem revisor");

  const porCaminho = (lista: DataDoFluxo[]) => new Map(lista.map((item) => [chaveDoCaminho(item.caminho), item]));
  const fluxoAntes = porCaminho(antes.fluxoDatas);
  const fluxoDepois = porCaminho(depois.fluxoDatas);
  for (const chave of new Set([...fluxoAntes.keys(), ...fluxoDepois.keys()])) {
    const de = fluxoAntes.get(chave);
    const para = fluxoDepois.get(chave);
    // O caminho inteiro: o mesmo tipo pode aparecer duas vezes no fluxo (2. REVISAR e Embargos › 2. REVISAR).
    const nome = ((para ?? de)?.caminho ?? []).join(" › ");
    anotar(`${nome}: data`, dia(de?.data, "a do VIOS"), dia(para?.data, "a do VIOS"));
    pessoas(`${nome}: responsável`, de?.responsaveis ?? [], para?.responsaveis ?? [], "o padrão");
  }
  return mudancas;
}

/**
 * O Enviar de uma tarefa de Prazo editada na Conferência. Vazio segue a conta pela fatal. Escolhido à mão, vale como
 * está (o VIOS cria o Revisar e o Protocolar a partir dele), desde que não passe da fatal; data no passado só se já
 * era a da tarefa (fatal vencida: não há o que apertar).
 */
export function enviarDoPrazo(
  pedido: string | null | undefined,
  contexto: { calculado: string; anterior: string; fatal: string; hoje: string }
): { ok: true; data: string } | { ok: false; erro: string } {
  if (!pedido || !dataValida(pedido)) return { ok: true, data: contexto.calculado };
  if (pedido > contexto.fatal) return { ok: false, erro: "A data do Enviar não pode ficar depois da data fatal." };
  if (pedido < contexto.hoje && pedido !== contexto.anterior) return { ok: false, erro: "A data do Enviar não pode ficar no passado." };
  return { ok: true, data: pedido };
}
