import { describe, expect, it } from "vitest";
import { duplaDaPasta, nomeCurto, pessoaPorSigla, siglaDoNome } from "./duplas";
import { mensagemDaPauta, mensagemDeTroca, soDigitos } from "./mensagens";
import { eventoDoConvite, respostaDoGraph, versaoDoEvento } from "./outlook";
import type { Audiencia, PessoaPauta } from "./tipos";
import { inicioDoVios, lerCsvDoVios } from "./vios-csv";

function pessoa(id: string, nome: string, extra: Partial<PessoaPauta> = {}): PessoaPauta {
  return { id, nomeVios: nome, nomeCurto: nomeCurto(nome), sigla: null, userId: null, email: null, whatsapp: null, cargo: null, fazAudiencia: true, coordenacao: false, ativo: true, ...extra };
}

const equipe = [
  pessoa("p1", "Bruna Teixeira Alves Rocha", { whatsapp: "(19) 99999-0001", email: "bruna@exemplo.com.br" }),
  pessoa("p2", "Carla Duarte Nunes", { email: "carla@exemplo.com.br" }),
  pessoa("p3", "Diana de Souza Lima"),
  pessoa("p4", "Daniel Silva Leite"),
];
const mapa = new Map(equipe.map((p) => [p.id, p]));

function aud(p: Partial<Audiencia> = {}): Audiencia {
  return {
    id: "a1", chave: "pje:TRT15:1", origem: "pje", tribunal: "TRT15", cnj: "0099991-11.2026.5.15.0001", inicio: "2026-11-19T11:40:00.000Z", fim: "2026-11-19T11:50:00.000Z",
    tipo: "inicial", tipoDescricao: "Inicial por videoconferência", ritoSumarissimo: false, modalidadeTribunal: "video", modalidadeEquipe: null, orgao: "CON1 - Piracicaba", sala: null,
    juizoDigital: true, situacao: "designada", linkSala: "https://us02web.zoom.us/j/1111", linkFonte: "pje", linkFonteData: null, linkAnterior: null, cliente: null, grupoCliente: "Grupo Exemplo",
    ciProcesso: null, reclamanteIniciais: "F. H. M. M.", titularId: "p1", backupId: "p2", substituiId: null, mudancas: [], mudancaConferidaEm: null, viosInicio: null, viosSituacao: null,
    djenConferidoEm: null, djenData: null, djenInicio: null, djenModalidade: null, correspondente: null, observacao: null, lidaEm: "2026-11-18T12:00:00.000Z", ...p,
  };
}

describe("duplas do VIOS", () => {
  it("sigla sem preposição e nome curto", () => {
    expect(siglaDoNome("Diana de Souza Lima")).toBe("DSL");
    expect(siglaDoNome("Helena Prado Costa")).toBe("HPC");
    expect(nomeCurto("Diana de Souza Lima")).toBe("Diana Souza");
  });
  it("sigla ambígua não vale", () => {
    expect(pessoaPorSigla(equipe, "DSL")).toBeNull();
    expect(pessoaPorSigla(equipe, "CDN")?.id).toBe("p2");
  });
  it("titular pelo nome completo, backup pela sigla", () => {
    expect(duplaDaPasta(equipe, { advogadoResponsavel: "Bruna Teixeira Alves Rocha", auxiliarSigla: "CDN" })).toEqual({ titularId: "p1", backupId: "p2" });
    expect(duplaDaPasta(equipe, { advogadoResponsavel: "Alguém de Fora", auxiliarSigla: null })).toEqual({ titularId: null, backupId: null });
  });
});

describe("mensagens do WhatsApp", () => {
  it("marca quem tem número e escreve o nome de quem não tem", () => {
    const m = mensagemDaPauta("Pauta de amanhã", "2026-11-19", [aud()], mapa)!;
    expect(m.texto).toContain("qui 19/11");
    expect(m.texto).toContain("08:40 Inicial · Exemplo · vídeo · @5519999990001 (backup Carla)");
    expect(m.mencoes).toEqual(["5519999990001"]);
    expect(soDigitos("123")).toBeNull();
  });
  it("troca de titular diz quem sai e por quê", () => {
    const m = mensagemDeTroca(aud({ titularId: "p3" }), "titular", "p1", "p3", "Deslocamento", mapa);
    expect(m.texto).toContain("Troca de titular");
    expect(m.texto).toContain("Sai: Bruna Teixeira (deslocamento)");
  });
});

describe("convite do Outlook", () => {
  it("titular ocupada, backup livre e com [BACKUP]", () => {
    const titular = eventoDoConvite(aud(), "titular", equipe[0]!, mapa);
    const backup = eventoDoConvite(aud(), "backup", equipe[1]!, mapa);
    expect(titular.subject).toBe("Inicial · Exemplo · 08:40 · Vídeo");
    expect(titular.showAs).toBe("busy");
    expect(titular.start).toEqual({ dateTime: "2026-11-19T08:40:00", timeZone: "America/Sao_Paulo" });
    expect(titular.end.dateTime).toBe("2026-11-19T09:40:00");
    expect(backup.subject.startsWith("[BACKUP] ")).toBe(true);
    expect(backup.showAs).toBe("free");
  });
  it("a versão muda com a sala e não muda à toa", () => {
    const v1 = versaoDoEvento(eventoDoConvite(aud(), "titular", equipe[0]!, mapa));
    expect(versaoDoEvento(eventoDoConvite(aud(), "titular", equipe[0]!, mapa))).toBe(v1);
    expect(versaoDoEvento(eventoDoConvite(aud({ linkSala: "https://us02web.zoom.us/j/2222" }), "titular", equipe[0]!, mapa))).not.toBe(v1);
  });
  it("sem e-mail não há convite", () => {
    expect(() => eventoDoConvite(aud(), "titular", equipe[2]!, mapa)).toThrow(/e-mail/);
    expect(respostaDoGraph("tentativelyAccepted")).toBe("provisorio");
  });
});

describe("relatório do VIOS", () => {
  it("lê só as audiências do pxe-lista", () => {
    const csv = [
      '"CI";"CI do Processo";"Data limite";"Horário";"Nro CNJ";"Área do Processo";"Tarefa";"Status";"Responsáveis";"Auxiliares"',
      '="901";="90001";"19/11/2026";"08:40 - 09:40";"0099991-11.2026.5.15.0001";"Trabalhista";"AUDIÊNCIA UNA/INICIAL";"Pendente";"Bruna Teixeira Alves Rocha";"Carla Duarte Nunes"',
      '="902";="90001";"15/11/2026";"";"0099991-11.2026.5.15.0001";"Trabalhista";"LEMBRETE AUDIÊNCIA + REGULARIZAÇÃO";"Pendente";"Bruna";""',
      '="903";="90002";"23/11/2026";"10:20";"00999922220255150002";"Trabalhista";"AUD. INSTRUÇÃO";"Cancelada";"Joana";"Helena"',
    ].join("\n");
    const lidas = lerCsvDoVios(csv);
    expect(lidas.map((l) => [l.tarefaCi, l.tipo, l.status, l.inicio])).toEqual([
      ["901", "una", "aberta", "2026-11-19T11:40:00.000Z"],
      ["903", "instrucao", "cancelada", "2026-11-23T13:20:00.000Z"],
    ]);
    expect(lidas[1]!.cnj).toBe("0099992-22.2025.5.15.0002");
    expect(inicioDoVios("19/11/2026", "")).toBe("2026-11-19T03:00:00.000Z");
  });
});
