import { describe, expect, it } from "vitest";
import { alertasDaAudiencia, conferidaDepoisDaCopia, estadoNoVios, mesmoHorario, pendenteNoVios } from "./agenda";
import { completarCnj, conferirPautaComVios, juntarFontesDoVios, mudancaResolvidaNoVios, tribunalDoCnj } from "./conferencia-vios";
import type { Audiencia } from "./tipos";
import { deTarefaDoSama, lerCsvDoVios, type AudienciaNoVios } from "./vios-csv";

const CNJ = "0011111-22.2026.5.15.0001";
const AGORA = new Date("2026-11-23T12:00:00.000Z");

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
    lidaEm: "2026-11-23T09:45:00.000Z",
    ...p,
  };
}

let ci = 900000;
function tarefa(p: Partial<AudienciaNoVios> = {}): AudienciaNoVios {
  ci += 1;
  return {
    tarefaCi: String(ci),
    ciProcesso: "50001",
    cnj: CNJ,
    inicio: "2026-12-10T12:00:00.000Z",
    tipo: "instrucao",
    tarefa: "AUDIÊNCIA DE INSTRUÇÃO",
    status: "aberta",
    area: "Trabalhista",
    responsaveis: [],
    auxiliares: [],
    ...p,
  };
}

describe("cópia do VIOS no SAMA", () => {
  it("lê data ISO, horário, CNJ sem máscara e responsáveis em lista", () => {
    const t = deTarefaDoSama({
      ci: 941234,
      ci_do_processo: 50001,
      nro_cnj: "00111112220265150001",
      tarefa: "AUDIÊNCIA UNA",
      data_limite: "2026-12-10",
      horario: "09:00 - 10:00",
      vios_status: "Pendente",
      area_do_processo: "Trabalhista",
      responsaveis: [{ nome: "Carla Duarte" }, "Vera Lima"],
      auxiliares: null,
    });
    expect(t).toMatchObject({ tarefaCi: "941234", ciProcesso: "50001", cnj: CNJ, inicio: "2026-12-10T12:00:00.000Z", tipo: "una", status: "aberta", responsaveis: ["Carla Duarte", "Vera Lima"], auxiliares: [] });
  });
  it("concluída, cancelada, sem horário e o que não é audiência", () => {
    expect(deTarefaDoSama({ ci: 1, nro_cnj: CNJ, tarefa: "AUDIÊNCIA INICIAL", data_limite: "2026-12-10", vios_status: "Concluída" })?.status).toBe("concluida");
    expect(deTarefaDoSama({ ci: 2, nro_cnj: CNJ, tarefa: "AUDIÊNCIA INICIAL", data_limite: "2026-12-10", vios_status: "Cancelada" })?.status).toBe("cancelada");
    expect(deTarefaDoSama({ ci: 3, nro_cnj: CNJ, tarefa: "AUDIÊNCIA INICIAL", data_limite: "2026-12-10", horario: "" })?.inicio).toBe("2026-12-10T03:00:00.000Z");
    expect(deTarefaDoSama({ ci: 4, nro_cnj: CNJ, tarefa: "INSERIR PAUTA DE AUDIÊNCIA", data_limite: "2026-12-10" })).toBeNull();
    expect(deTarefaDoSama({ ci: 6, nro_cnj: CNJ, tarefa: "VERIFICAR AUDIÊNCIA - ALTERAÇÃO/INCLUSÃO/CANCELAMENTO DE AUDIÊNCIA", data_limite: "2026-12-10" })).toBeNull();
    expect(deTarefaDoSama({ ci: 7, nro_cnj: CNJ, tarefa: "RELATÓRIO DA PERÍCIA + AGENDAR PRAZO DE ENTREGA PARECER TÉCNICO", data_limite: "2026-12-10" })).toBeNull();
    expect(deTarefaDoSama({ ci: 8, nro_cnj: CNJ, tarefa: "AUD. INSTRUÇÃO", data_limite: "2026-12-10" })?.tipo).toBe("instrucao");
    expect(deTarefaDoSama({ ci: 9, nro_cnj: CNJ, tarefa: "AUDIÊNCIA UNA/INICIAL", data_limite: "2026-12-10" })?.tipo).toBe("una");
    expect(deTarefaDoSama({ ci: 5, nro_cnj: "123", tarefa: "AUDIÊNCIA UNA", data_limite: "2026-12-10" })).toBeNull();
  });
});

describe("casamento da pauta com o VIOS", () => {
  it("mesmo processo e mesmo horário: confere", () => {
    const a = aud();
    const t = tarefa();
    const r = conferirPautaComVios([a], [t], AGORA);
    expect(r.tarefaDa.get(a.id)).toBe(t);
    expect(r.soNoVios).toEqual([]);
  });

  it("duas audiências no mesmo processo ficam cada uma com a sua tarefa", () => {
    const a1 = aud({ inicio: "2026-12-10T12:00:00.000Z" });
    const a2 = aud({ inicio: "2027-01-20T12:00:00.000Z" });
    const t2 = tarefa({ inicio: "2027-01-20T12:00:00.000Z" });
    const t1 = tarefa({ inicio: "2026-12-10T12:00:00.000Z" });
    const r = conferirPautaComVios([a1, a2], [t2, t1], AGORA);
    expect(r.tarefaDa.get(a1.id)).toBe(t1);
    expect(r.tarefaDa.get(a2.id)).toBe(t2);
  });

  it("redesignação com o VIOS na data velha: a tarefa vai para a audiência nova (designada antes da cancelada)", () => {
    const velha = aud({ situacao: "cancelada", inicio: "2026-12-01T12:00:00.000Z" });
    const nova = aud({ inicio: "2026-12-15T13:00:00.000Z", mudancas: ["horario"] });
    const t = tarefa({ inicio: "2026-12-01T12:00:00.000Z" });
    const r = conferirPautaComVios([velha, nova], [t], AGORA);
    expect(r.tarefaDa.get(nova.id)).toBe(t);
    expect(r.tarefaDa.get(velha.id)).toBeNull();
  });

  it("tarefa aberta antes da cancelada, mesmo em outro horário", () => {
    const a = aud();
    const cancelada = tarefa({ status: "cancelada" });
    const aberta = tarefa({ inicio: "2026-12-10T17:00:00.000Z" });
    expect(conferirPautaComVios([a], [cancelada, aberta], AGORA).tarefaDa.get(a.id)).toBe(aberta);
  });

  it("longe demais (mais de 120 dias) não casa; outro processo também não", () => {
    const a = aud();
    const r = conferirPautaComVios([a], [tarefa({ inicio: "2027-06-10T12:00:00.000Z" }), tarefa({ cnj: "0099999-11.2026.5.15.0001" })], AGORA);
    expect(r.tarefaDa.get(a.id)).toBeNull();
  });

  it("só no VIOS: abertas, futuras, dos tribunais lidos, sem sessão e perícia", () => {
    const a = aud();
    const sobra = tarefa({ cnj: "0022222-33.2026.5.15.0002", inicio: "2026-12-05T12:00:00.000Z" });
    const outroTribunal = tarefa({ cnj: "0033333-44.2026.8.26.0100", tarefa: "AUDIÊNCIA DE CONCILIAÇÃO" });
    const outroTrt = tarefa({ cnj: "0044444-55.2026.5.03.0001" });
    const concluida = tarefa({ cnj: "0022222-33.2026.5.15.0002", status: "concluida" });
    const passada = tarefa({ cnj: "0022222-33.2026.5.15.0002", inicio: "2026-11-20T12:00:00.000Z" });
    const sessao = tarefa({ cnj: "0022222-33.2026.5.15.0002", tarefa: "SESSÃO DE JULGAMENTO", tipo: "sessao" });
    const pericia = tarefa({ cnj: "0022222-33.2026.5.15.0002", tarefa: "PERÍCIA", tipo: "pericia" });
    const r = conferirPautaComVios([a], [tarefa(), sobra, outroTribunal, outroTrt, concluida, passada, sessao, pericia], AGORA);
    expect(r.soNoVios).toEqual([sobra]);
  });

  it("tribunal pelo CNJ", () => {
    expect(tribunalDoCnj("0011111-22.2026.5.02.0001")).toBe("TRT2");
    expect(tribunalDoCnj(CNJ)).toBe("TRT15");
    expect(tribunalDoCnj("0033333-44.2026.8.26.0100")).toBeNull();
  });
});

describe("Tarefas.csv + cópia do SAMA", () => {
  const RELATORIO_EM = Date.parse("2026-11-23T10:40:00.000Z");
  const antes = Date.parse("2026-11-23T05:00:00.000Z");
  const depois = Date.parse("2026-11-23T15:09:00.000Z");

  const doArquivo = (...ts: AudienciaNoVios[]) => ts.map((t) => ({ tarefa: t, em: RELATORIO_EM }));

  it("soma as fontes: o arquivo traz a tarefa que o SAMA pulou e o SAMA traz o que o recorte do arquivo não tem", () => {
    const pulada = tarefa({ tarefaCi: "882502" });
    const soNoSama = tarefa({ tarefaCi: "700009", inicio: "2026-12-02T12:00:00.000Z" });
    const juntas = juntarFontesDoVios(doArquivo(pulada), [{ tarefa: soNoSama, em: antes }]);
    expect(juntas.map((t) => t.tarefaCi).sort()).toEqual(["700009", "882502"]);
  });

  it("para cada CI vale a versão mais nova, venha de onde vier", () => {
    const noArquivo = tarefa({ tarefaCi: "700001", status: "aberta" });
    const concluidaDepois = { ...noArquivo, status: "concluida" as const };
    expect(juntarFontesDoVios(doArquivo(noArquivo), [{ tarefa: concluidaDepois, em: depois }])[0]!.status).toBe("concluida");
    const velha = { ...noArquivo, inicio: "2026-12-01T12:00:00.000Z" };
    expect(juntarFontesDoVios(doArquivo(noArquivo), [{ tarefa: velha, em: antes }])[0]!.inicio).toBe(noArquivo.inicio);
  });

  it("sem arquivo, fica a cópia do SAMA inteira", () => {
    const t = tarefa();
    expect(juntarFontesDoVios([{ tarefa: t, em: antes }])).toEqual([t]);
  });

  it("completa o número do processo pela CI do processo; sem como completar, fica de fora", () => {
    const semNumero = tarefa({ tarefaCi: "1", cnj: "", ciProcesso: "59214" });
    const semNada = tarefa({ tarefaCi: "2", cnj: "", ciProcesso: "11111" });
    const r = completarCnj([semNumero, semNada, tarefa({ tarefaCi: "3" })], new Map([["59214", "0010918-11.2026.5.15.0131"]]));
    expect(r.tarefas.map((t) => [t.tarefaCi, t.cnj])).toEqual([
      ["1", "0010918-11.2026.5.15.0131"],
      ["3", CNJ],
    ]);
    expect(r.semCnj).toBe(1);
  });

  it("lê o Tarefas.csv e descarta o que não é audiência", () => {
    const csv = [
      "CI;CI do Processo;Nro CNJ;Tarefa;Status;Data para conclusão;Data limite;Horário;Área do Processo;Responsáveis;Auxiliares",
      '="882502";="59214";0010918-11.2026.5.15.0131;AUDIÊNCIA UNA/INICIAL;Aberta;23/11/2026;23/11/2026;13:00 - 14:00;Trabalhista;Lorena Lourenço Miranda;',
      '="882505";="59214";0010918-11.2026.5.15.0131;CONTESTAÇÃO;Concluída;08/11/2026;08/11/2026;;Trabalhista;Lorena Lourenço Miranda;',
      '="882516";="59214";0010918-11.2026.5.15.0131;VERIFICAR ATA;Aberta;24/11/2026;24/11/2026;;Trabalhista;Larissa de Oliveira Pereira;',
      '="895090";="59984";;AUDIÊNCIA UNA/INICIAL;Aberta;24/11/2026;24/11/2026;08:35 - 09:35;Trabalhista;Pamela Klava Senna Patricio;',
      '="895099";;;AUDIÊNCIA UNA/INICIAL;Aberta;24/11/2026;24/11/2026;;Trabalhista;;',
    ].join("\n");
    expect(lerCsvDoVios(csv)).toEqual([
      expect.objectContaining({ tarefaCi: "882502", cnj: "0010918-11.2026.5.15.0131", inicio: "2026-11-23T16:00:00.000Z", tipo: "una", status: "aberta" }),
      expect.objectContaining({ tarefaCi: "895090", cnj: "", ciProcesso: "59984", inicio: "2026-11-24T11:35:00.000Z" }),
    ]);
  });
});

describe("mudança que o VIOS já mostra feita", () => {
  it("horário novo já no VIOS: resolvida; com vara junto, não", () => {
    const a = aud({ mudancas: ["horario"] });
    expect(mudancaResolvidaNoVios(a, tarefa())).toBe(true);
    expect(mudancaResolvidaNoVios(a, tarefa({ inicio: "2026-12-01T12:00:00.000Z" }))).toBe(false);
    expect(mudancaResolvidaNoVios({ ...a, mudancas: ["horario", "vara"] }, tarefa())).toBe(false);
    expect(mudancaResolvidaNoVios({ ...a, mudancaConferidaEm: "2026-11-23T10:00:00Z" }, tarefa())).toBe(false);
  });
  it("cancelada no PJe: resolvida quando não há tarefa aberta", () => {
    const a = aud({ situacao: "cancelada", mudancas: ["cancelada"] });
    expect(mudancaResolvidaNoVios(a, null)).toBe(true);
    expect(mudancaResolvidaNoVios(a, tarefa({ status: "cancelada" }))).toBe(true);
    expect(mudancaResolvidaNoVios(a, tarefa())).toBe(false);
  });
});

describe("estado no VIOS e alertas", () => {
  const COPIA = "2026-11-23T15:00:00.000Z";
  const pessoas = new Map();
  const tipos = (a: Audiencia) => alertasDaAudiencia(a, { pessoas, todas: [a] }).map((x) => x.tipo);

  it("sem horário no VIOS vale o mesmo dia", () => {
    expect(mesmoHorario("2026-12-10T12:00:00.000Z", "2026-12-10T03:00:00.000Z")).toBe(true);
    expect(mesmoHorario("2026-12-10T12:00:00.000Z", "2026-12-11T03:00:00.000Z")).toBe(false);
    expect(mesmoHorario("2026-12-10T12:00:00.000Z", "2026-12-10T13:00:00.000Z")).toBe(false);
  });

  it("ainda não conferida: nenhum alerta do VIOS", () => {
    const a = aud();
    expect(estadoNoVios(a)).toBeNull();
    expect(tipos(a)).not.toContain("vios_falta");
  });

  it("falta, concluída, outro horário e confere", () => {
    const base = { viosConferidoEm: COPIA };
    const falta = aud(base);
    expect(estadoNoVios(falta, AGORA.getTime())).toBe("falta");
    expect(tipos(falta)).toContain("vios_falta");
    const cancelada = aud({ ...base, viosTarefaCi: "900001", viosSituacao: "cancelada", viosInicio: "2026-12-10T12:00:00.000Z" });
    expect(alertasDaAudiencia(cancelada, { pessoas, todas: [] }).find((x) => x.tipo === "vios_falta")?.texto).toBe("A tarefa (CI 900001) está cancelada no VIOS.");
    const concluida = aud({ ...base, viosTarefaCi: "900002", viosSituacao: "concluida", viosInicio: "2026-12-10T12:00:00.000Z" });
    expect(estadoNoVios(concluida, AGORA.getTime())).toBe("concluida");
    expect(estadoNoVios(concluida, new Date("2026-12-11T00:00:00Z").getTime())).toBe("confere");
    const outra = aud({ ...base, viosTarefaCi: "900003", viosSituacao: "aberta", viosInicio: "2026-12-11T03:00:00.000Z" });
    expect(alertasDaAudiencia(outra, { pessoas, todas: [] }).find((x) => x.tipo === "vios_diverge")?.texto).toBe("No VIOS está 11/12 (sem horário).");
    const confere = aud({ ...base, viosTarefaCi: "900004", viosSituacao: "aberta", viosInicio: "2026-12-10T12:00:00.000Z" });
    expect(estadoNoVios(confere)).toBe("confere");
    expect(pendenteNoVios(confere)).toBe(false);
  });

  it("cancelada no PJe com a tarefa aberta no VIOS pede tirar do VIOS; sem tarefa aberta, nada", () => {
    const aberta = aud({ situacao: "cancelada", mudancas: ["cancelada"], viosConferidoEm: COPIA, viosTarefaCi: "900005", viosSituacao: "aberta", viosInicio: "2026-12-10T12:00:00.000Z" });
    expect(tipos(aberta)).toEqual(["vios_aberta"]);
    const saiu = aud({ situacao: "cancelada", mudancas: ["cancelada"], viosConferidoEm: COPIA });
    expect(tipos(saiu)).toEqual([]);
    const semConferir = aud({ situacao: "cancelada", mudancas: ["cancelada"] });
    expect(tipos(semConferir)).toEqual(["cancelada"]);
  });

  it("'Conferido no VIOS' depois da cópia cala o alerta até chegar cópia mais nova", () => {
    const depois = aud({ viosConferidoEm: COPIA, mudancaConferidaEm: "2026-11-23T16:00:00.000Z" });
    expect(conferidaDepoisDaCopia(depois)).toBe(true);
    expect(tipos(depois)).not.toContain("vios_falta");
    const copiaNova = { ...depois, viosConferidoEm: "2026-11-24T05:00:00.000Z" };
    expect(conferidaDepoisDaCopia(copiaNova)).toBe(false);
    expect(tipos(copiaNova)).toContain("vios_falta");
  });
});
