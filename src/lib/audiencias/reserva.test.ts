import { describe, expect, it } from "vitest";
import { alertasDaAudiencia, conflitoDaPessoa, geraAvisos, ocupaAgenda } from "./agenda";
import { lidoAtePorTribunal } from "./conferencia-vios";
import { itemDaVistagem, itemDoVios, juntarReservas, motivoParaSair, noHorizonte, reservasComTribunal, reservasDoVios, type AgendamentoDeAudiencia } from "./reserva";
import type { Audiencia } from "./tipos";
import { lerCsvDoVios, type AudienciaNoVios } from "./vios-csv";

const CNJ = "0011111-22.2026.5.15.0001";
const OUTRO_TRT = "0100222-33.2026.5.01.0401";
const HOJE = "2026-11-24";
const AGORA = new Date("2026-11-24T12:00:00.000Z");

let seq = 0;
function aud(p: Partial<Audiencia> = {}): Audiencia {
  seq += 1;
  return {
    id: `a${seq}`,
    chave: `pje:TRT15:${seq}`,
    origem: "pje",
    tribunal: "TRT15",
    cnj: CNJ,
    inicio: "2026-12-10T12:00:00.000Z",
    fim: null,
    tipo: "instrucao",
    tipoDescricao: null,
    ritoSumarissimo: false,
    modalidadeTribunal: "video",
    modalidadeEquipe: null,
    orgao: "CON1 - Jundiaí",
    sala: null,
    juizoDigital: null,
    situacao: "designada",
    linkSala: "https://x.zoom.us/j/1",
    linkFonte: "pje",
    linkFonteData: null,
    linkAnterior: null,
    cliente: null,
    grupoCliente: "Grupo Exemplo",
    ciProcesso: null,
    reclamanteIniciais: null,
    titularId: null,
    backupId: null,
    substituiId: null,
    mudancas: [],
    mudancaConferidaEm: null,
    viosInicio: null,
    viosSituacao: null,
    viosTarefaCi: null,
    viosConferidoEm: null,
    djenConferidoEm: null,
    djenData: null,
    djenInicio: null,
    djenModalidade: null,
    correspondente: null,
    observacao: null,
    lidaEm: "2026-11-24T09:45:00.000Z",
    ...p,
  };
}

let ci = 700000;
function tarefa(p: Partial<AudienciaNoVios> = {}): AudienciaNoVios {
  ci += 1;
  return {
    tarefaCi: String(ci),
    ciProcesso: "50001",
    cnj: CNJ,
    inicio: "2026-12-10T12:00:00.000Z",
    tipo: "instrucao",
    tarefa: "AUD. INSTRUÇÃO",
    status: "aberta",
    area: "Trabalhista",
    responsaveis: [],
    auxiliares: [],
    ...p,
  };
}

function agendamento(p: Partial<AgendamentoDeAudiencia> = {}): AgendamentoDeAudiencia {
  return { id: "ag1", tarefa: "SESSÃO DE JULGAMENTO", data: "2026-11-26", dataLimite: "2026-12-03", hora: "13:15", viosTarefaCi: null, cnj: CNJ.replace(/\D/g, ""), area: "Trabalhista", ciProcesso: "50001", ...p };
}

const SEM_ROBO = { hoje: HOJE, lidoAte: new Map<string, string>() };

describe("leitura do VIOS: primeiro dia da sessão virtual", () => {
  it("guarda a data para conclusão quando vem antes da data limite", () => {
    const csv = [
      "CI;CI do Processo;Nro CNJ;Tarefa;Status;Data para conclusão;Data limite;Horário;Área do Processo;Responsáveis;Auxiliares",
      `="943354";="58001";${CNJ};SESSÃO DE JULGAMENTO;Aberta;26/11/2026;03/12/2026;13:15 - 14:15;Trabalhista;;`,
      `="943355";="58001";${CNJ};AUD. INSTRUÇÃO;Aberta;10/12/2026;10/12/2026;09:00 - 10:00;Trabalhista;;`,
    ].join("\n");
    const [sessao, audiencia] = lerCsvDoVios(csv);
    expect(sessao!.inicio).toBe("2026-12-03T16:15:00.000Z");
    expect(sessao!.conclusao).toBe("2026-11-26T16:15:00.000Z");
    expect(audiencia!.conclusao).toBeNull();
  });
});

describe("itens a confirmar", () => {
  it("sessão virtual do VIOS começa no primeiro dia e diz até quando vai", () => {
    const item = itemDoVios(tarefa({ tarefaCi: "943354", tipo: "sessao", tarefa: "SESSÃO DE JULGAMENTO", inicio: "2026-12-03T16:15:00.000Z", conclusao: "2026-11-26T16:15:00.000Z" }));
    expect(item).toMatchObject({ chave: "vios:943354", inicio: "2026-11-26T16:15:00.000Z", ultimoDia: "2026-12-03", tipoDescricao: "SESSÃO DE JULGAMENTO (até 03/12)", viosInicio: "2026-11-26T16:15:00.000Z" });
  });

  it("perícia entra como presencial", () => {
    expect(itemDoVios(tarefa({ tipo: "pericia", tarefa: "PERÍCIA" })).modalidade).toBe("presencial");
  });

  it("agendamento da Vistagem: sem CI fica pela id; com CI, a mesma chave da tarefa do VIOS", () => {
    expect(itemDaVistagem(agendamento())).toMatchObject({ chave: "vistagem:ag1", cnj: CNJ, tipo: "sessao", inicio: "2026-11-26T16:15:00.000Z", ultimoDia: "2026-12-03" });
    expect(itemDaVistagem(agendamento({ viosTarefaCi: "943354" }))?.chave).toBe("vios:943354");
  });

  it("agendamento que não é audiência, de outra área ou sem processo não entra", () => {
    expect(itemDaVistagem(agendamento({ tarefa: "AGRAVO DE INSTRUMENTO" }))).toBeNull();
    expect(itemDaVistagem(agendamento({ tarefa: "INSERIR PAUTA + ATUALIZAR SISTEMA" }))).toBeNull();
    expect(itemDaVistagem(agendamento({ area: "Recuperação de Crédito" }))).toBeNull();
    expect(itemDaVistagem(agendamento({ cnj: null }))).toBeNull();
    // Sessão do TJ (publicação sem área): a pauta é da Justiça do Trabalho.
    expect(itemDaVistagem(agendamento({ cnj: "5056980-28.2026.8.24.0000", area: null }))).toBeNull();
  });
});

describe("o que entra na pauta", () => {
  it("só tarefa aberta, trabalhista e que o tribunal não tomou para si", () => {
    const usada = tarefa();
    const lista = [
      usada,
      tarefa({ status: "concluida" }),
      tarefa({ status: "cancelada" }),
      tarefa({ area: "Cível" }),
      tarefa({ cnj: "1008214-37.2022.8.26.0019", area: null }),
      tarefa({ tipo: "pericia", tarefa: "PERÍCIA" }),
    ];
    const itens = reservasDoVios(lista, new Set([usada.tarefaCi]), SEM_ROBO);
    expect(itens.map((i) => i.tipo)).toEqual(["pericia"]);
  });

  it("até 60 dias; sessão virtual que já começou entra até o último dia", () => {
    expect(noHorizonte({ cnj: CNJ, tipo: "instrucao", inicio: "2027-01-22T12:00:00.000Z", ultimoDia: "2027-01-22" }, SEM_ROBO)).toBe(true);
    expect(noHorizonte({ cnj: CNJ, tipo: "instrucao", inicio: "2027-01-24T12:00:00.000Z", ultimoDia: "2027-01-24" }, SEM_ROBO)).toBe(false);
    expect(noHorizonte({ cnj: CNJ, tipo: "sessao", inicio: "2026-11-20T12:00:00.000Z", ultimoDia: "2026-11-27" }, SEM_ROBO)).toBe(true);
    expect(noHorizonte({ cnj: CNJ, tipo: "sessao", inicio: "2026-11-16T12:00:00.000Z", ultimoDia: "2026-11-23" }, SEM_ROBO)).toBe(false);
  });

  it("audiência de tribunal que o robô lê: só até onde ele leu; sessão, perícia e outro TRT não esperam o robô", () => {
    const lidoAte = lidoAtePorTribunal([aud({ inicio: "2026-12-20T12:00:00.000Z" }), aud({ origem: "jusbr", inicio: "2027-01-10T12:00:00.000Z" })]);
    expect(lidoAte.get("TRT15")).toBe("2026-12-20");
    const crit = { hoje: HOJE, lidoAte };
    expect(noHorizonte({ cnj: CNJ, tipo: "instrucao", inicio: "2027-01-05T12:00:00.000Z", ultimoDia: "2027-01-05" }, crit)).toBe(false);
    expect(noHorizonte({ cnj: CNJ, tipo: "pericia", inicio: "2027-01-05T12:00:00.000Z", ultimoDia: "2027-01-05" }, crit)).toBe(true);
    expect(noHorizonte({ cnj: OUTRO_TRT, tipo: "instrucao", inicio: "2027-01-05T12:00:00.000Z", ultimoDia: "2027-01-05" }, crit)).toBe(true);
  });

  it("junta VIOS e Vistagem: um item por audiência, e sai o que o tribunal já mostra no dia", () => {
    const doVios = [itemDoVios(tarefa({ tarefaCi: "943354", tipo: "sessao", tarefa: "SESSÃO DE JULGAMENTO", inicio: "2026-12-03T16:15:00.000Z", conclusao: "2026-11-26T16:15:00.000Z" }))];
    const daVistagem = [
      itemDaVistagem(agendamento({ id: "ag1", viosTarefaCi: "943354" }))!, // mesma chave: vale o do VIOS
      itemDaVistagem(agendamento({ id: "ag2" }))!, // sem CI, mas o VIOS já tem a sessão no dia
      itemDaVistagem(agendamento({ id: "ag3", tarefa: "AUD. CONCILIAÇÃO", data: "2026-12-10", dataLimite: "2026-12-10", hora: "09:00" }))!, // o tribunal já tem no dia
      itemDaVistagem(agendamento({ id: "ag4", tarefa: "AUDIÊNCIA UNA/INICIAL", data: "2026-12-11", dataLimite: "2026-12-11", hora: "10:00" }))!, // nova
    ];
    const itens = juntarReservas(doVios, daVistagem, [aud({ inicio: "2026-12-10T15:00:00.000Z" })]);
    expect(itens.map((i) => [i.chave, i.fonte])).toEqual([
      ["vios:943354", "vios"],
      ["vistagem:ag4", "vistagem"],
    ]);
  });
});

describe("quando o tribunal confirma ou a fonte some", () => {
  it("a do tribunal vale: pela tarefa que casou na conferência ou pelo mesmo dia (perícia só pela tarefa)", () => {
    const doPje = aud({ inicio: "2026-12-17T12:00:00.000Z" });
    const pelaTarefa = aud({ origem: "vios", chave: "vios:1", viosTarefaCi: "1", inicio: "2026-12-10T12:00:00.000Z" });
    const doDia = aud({ origem: "vios", chave: "vios:2", viosTarefaCi: "2", inicio: "2026-12-17T15:00:00.000Z" });
    const pericia = aud({ origem: "vios", chave: "vios:3", viosTarefaCi: "3", tipo: "pericia", inicio: "2026-12-17T13:00:00.000Z" });
    const pares = reservasComTribunal([doPje, pelaTarefa, doDia, pericia], new Map([["1", doPje]]));
    expect(pares.map((p) => [p.reserva.chave, p.tribunal.id])).toEqual([
      ["vios:1", doPje.id],
      ["vios:2", doPje.id],
    ]);
  });

  it("sai da pauta quando a tarefa é cancelada, concluída antes da data ou some do relatório completo", () => {
    const a = aud({ origem: "vios", chave: "vios:10", inicio: "2026-12-10T12:00:00.000Z" });
    const ctx = (t: AudienciaNoVios | null, relatorioCompleto = true) => ({
      tarefasPorCi: new Map(t ? [["10", t]] : []),
      agendamentos: new Set<string>(),
      relatorioCompleto,
      agora: AGORA,
    });
    expect(motivoParaSair(a, ctx(tarefa({ tarefaCi: "10" })))).toBeNull();
    expect(motivoParaSair(a, ctx(tarefa({ tarefaCi: "10", status: "cancelada" })))).toBe("tarefa cancelada no VIOS");
    expect(motivoParaSair(a, ctx(tarefa({ tarefaCi: "10", status: "concluida" })))).toBe("tarefa concluída no VIOS antes da data");
    expect(motivoParaSair({ ...a, inicio: "2026-11-24T11:00:00.000Z" }, ctx(tarefa({ tarefaCi: "10", status: "concluida" })))).toBeNull();
    expect(motivoParaSair(a, ctx(null))).toBe("a tarefa não está mais no VIOS");
    expect(motivoParaSair(a, ctx(null, false))).toBeNull();
    const daVistagem = aud({ origem: "vios", chave: "vistagem:ag9" });
    expect(motivoParaSair(daVistagem, { ...ctx(null), agendamentos: new Set(["ag9"]) })).toBeNull();
    expect(motivoParaSair(daVistagem, ctx(null))).toBe("o agendamento saiu da Vistagem");
  });
});

describe("sessão e perícia na agenda e nos avisos", () => {
  it("não geram convite nem WhatsApp (decisão pendente)", () => {
    expect(geraAvisos(aud({ tipo: "sessao" }))).toBe(false);
    expect(geraAvisos(aud({ tipo: "pericia" }))).toBe(false);
    expect(geraAvisos(aud({ origem: "vios", tipo: "una" }))).toBe(true);
  });

  it("sessão e compromisso sem horário não dão choque", () => {
    expect(ocupaAgenda(aud({ tipo: "sessao", inicio: "2026-12-10T16:00:00.000Z" }))).toBe(false);
    expect(ocupaAgenda(aud({ tipo: "pericia", inicio: "2026-12-10T03:00:00.000Z" }))).toBe(false);
    const sessao = aud({ tipo: "sessao", titularId: "p1", inicio: "2026-12-10T16:00:00.000Z" });
    const instrucao = aud({ titularId: "p1", inicio: "2026-12-10T16:00:00.000Z" });
    expect(conflitoDaPessoa("p1", instrucao, [sessao, instrucao])).toBeNull();
    const pessoas = new Map();
    expect(alertasDaAudiencia(sessao, { pessoas, todas: [sessao, instrucao] }).map((x) => x.tipo)).not.toContain("choque");
  });

  it("sessão sem modalidade não pede para completar; sem horário não é 'antes das 8h'", () => {
    const sessao = aud({ tipo: "sessao", modalidadeTribunal: null, linkSala: null, titularId: "p1", inicio: "2026-12-10T03:00:00.000Z" });
    const tipos = alertasDaAudiencia(sessao, { pessoas: new Map(), todas: [sessao] }).map((x) => x.tipo);
    expect(tipos).not.toContain("a_completar");
    expect(tipos).not.toContain("cedo");
  });
});
