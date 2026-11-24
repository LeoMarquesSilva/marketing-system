import { describe, expect, it } from "vitest";
import { alertasDaAudiencia, respostasDosConvites } from "./agenda";
import { duplaDaPasta, nomeCurto, pessoaPorSigla, siglaDoNome } from "./duplas";
import { mensagemDaPauta, mensagemDeTroca, soDigitos } from "./mensagens";
import { eventoDoConvite, localDoConvite, respostaDoGraph, versaoDoEvento } from "./outlook";
import type { Audiencia, ConvitePauta, PessoaPauta } from "./tipos";
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
    ciProcesso: null, reclamanteIniciais: "F. H. M. M.", titularId: "p1", backupId: "p2", substituiId: null, mudancas: [], mudancaConferidaEm: null, viosInicio: null, viosSituacao: null, viosTarefaCi: null, viosConferidoEm: null,
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
    expect(m.texto).toContain("08:40 Inicial · Exemplo · online · @5519999990001 (backup Carla)");
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
    expect(titular.subject).toBe("Inicial · Exemplo · 08:40 · Online");
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
  it("corpo como no desenho: Juízo 100% Digital, papel do backup e links da tarefa e da pasta no VIOS", () => {
    const comVios = aud({ viosTarefaCi: "882538", ciProcesso: "59984" });
    const titular = eventoDoConvite(comVios, "titular", equipe[0]!, mapa).body.content;
    expect(titular).toContain("Juízo 100% Digital");
    expect(titular).toContain('href="https://bp.vios.com.br/index.php?pag=sys/processos/pxe.php&amp;pxe_id=882538">CI 882538</a>');
    expect(titular).toContain("processos_id=59984");
    expect(titular).not.toContain("Seu papel");
    const backup = eventoDoConvite(comVios, "backup", equipe[1]!, mapa).body.content;
    expect(backup).toContain("Assumir se a titular não puder");
    expect(eventoDoConvite(aud({ juizoDigital: false }), "titular", equipe[0]!, mapa).body.content).not.toContain("Juízo 100% Digital");
  });
  it("local: vara e link da sala por vídeo; vara e sala presencial", () => {
    expect(localDoConvite(aud())).toBe("CON1 - Piracicaba · https://us02web.zoom.us/j/1111");
    expect(localDoConvite(aud({ modalidadeTribunal: "presencial", sala: "Sala 2" }))).toBe("CON1 - Piracicaba · Sala 2");
    expect(localDoConvite(aud({ modalidadeTribunal: "hibrida", modalidadeEquipe: "presencial", sala: "Sala 2" }))).toBe("CON1 - Piracicaba · Sala 2");
    expect(localDoConvite(aud({ orgao: null, linkSala: null }))).toBe("A confirmar");
  });
  it("a tarefa do VIOS aparecer depois não atualiza o convite sozinha (cada atualização manda e-mail)", () => {
    const v1 = versaoDoEvento(eventoDoConvite(aud(), "titular", equipe[0]!, mapa));
    expect(versaoDoEvento(eventoDoConvite(aud({ viosTarefaCi: "882538", ciProcesso: "59984" }), "titular", equipe[0]!, mapa))).toBe(v1);
    expect(versaoDoEvento(eventoDoConvite(aud({ observacao: "levar preposto" }), "titular", equipe[0]!, mapa))).not.toBe(v1);
  });
});

describe("resposta ao convite", () => {
  const convite = (p: Partial<ConvitePauta>): ConvitePauta => ({ audienciaId: "a1", papel: "titular", pessoaId: "p1", status: "enviado", resposta: "sem_resposta", ...p });
  it("vale só o convite enviado de verdade e da pessoa que está hoje no papel", () => {
    const r = respostasDosConvites(
      [convite({ resposta: "recusado" }), convite({ papel: "backup", pessoaId: "p2", resposta: "aceito" }), convite({ audienciaId: "a2", status: "simulado" })],
      [aud(), aud({ id: "a2" })]
    );
    expect(r.get("a1")).toEqual({ titular: "recusado", backup: "aceito" });
    expect(r.has("a2")).toBe(false);
    // Trocou a titular: a recusa era da anterior.
    expect(respostasDosConvites([convite({ resposta: "recusado" })], [aud({ titularId: "p3" })]).get("a1")).toBeUndefined();
  });
  it("titular que recusou vai para o vermelho; backup que recusou é só aviso", () => {
    const respostas = respostasDosConvites([convite({ resposta: "recusado" }), convite({ papel: "backup", pessoaId: "p2", resposta: "recusado" })], [aud()]);
    const alertas = alertasDaAudiencia(aud(), { pessoas: mapa, todas: [aud()], respostas });
    expect(alertas.find((a) => a.tipo === "recusou")).toMatchObject({ grave: true, texto: "Bruna Teixeira recusou o convite do Outlook: trocar a titular." });
    expect(alertas.find((a) => a.tipo === "backup_recusou")?.grave).toBe(false);
    expect(alertasDaAudiencia(aud(), { pessoas: mapa, todas: [aud()] }).some((a) => a.tipo === "recusou")).toBe(false);
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
