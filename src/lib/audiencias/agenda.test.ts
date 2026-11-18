import { describe, expect, it } from "vitest";
import { alertasDaAudiencia, cidadeDoOrgao, conflitoDaPessoa, local, opcoesDeTroca, proximosDiasUteis, type Contexto } from "./agenda";
import type { Audiencia, PessoaPauta } from "./tipos";

function pessoa(id: string, nome: string, extra: Partial<PessoaPauta> = {}): PessoaPauta {
  return { id, nomeVios: nome, nomeCurto: nome.split(" ")[0]!, sigla: null, userId: null, email: null, whatsapp: null, cargo: null, fazAudiencia: true, coordenacao: false, ativo: true, ...extra };
}

let seq = 0;
function aud(p: Partial<Audiencia>): Audiencia {
  seq += 1;
  return {
    id: `a${seq}`,
    chave: `pje:TRT15:${seq}`,
    origem: "pje",
    tribunal: "TRT15",
    cnj: "0011111-22.2026.5.15.0001",
    inicio: "2026-11-19T13:20:00.000Z",
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
    titularId: "laura",
    backupId: "vera",
    substituiId: null,
    mudancas: [],
    mudancaConferidaEm: null,
    viosInicio: null,
    viosSituacao: null,
    djenConferidoEm: null,
    djenData: null,
    djenInicio: null,
    djenModalidade: null,
    correspondente: null,
    observacao: null,
    lidaEm: "2026-11-18T12:00:00.000Z",
    ...p,
  };
}

const pessoas = new Map(
  [pessoa("laura", "Laura Mendes"), pessoa("vera", "Vera Souto"), pessoa("clara", "Clara Antunes"), pessoa("lucia", "Lúcia Zanetti"), pessoa("marina", "Marina Assis", { fazAudiencia: false })].map(
    (p) => [p.id, p]
  )
);

describe("horário e dias úteis", () => {
  it("mostra no horário de Brasília", () => {
    expect(local("2026-11-19T11:40:00.000Z")).toEqual({ dia: "2026-11-19", hora: "08:40", minutos: 520 });
  });
  it("quarta antes do feriado de sexta vê quinta e segunda", () => {
    const util = (d: string) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()) && d !== "2026-11-20";
    expect(proximosDiasUteis("2026-11-18", 2, util)).toEqual(["2026-11-19", "2026-11-23"]);
  });
  it("cidade do órgão", () => {
    expect(cidadeDoOrgao("CON1 - Campinas")).toBe("campinas");
    expect(cidadeDoOrgao("CEJUSC ARARAQUARA - JT Centro Judiciário")).toBe("araraquara");
    expect(cidadeDoOrgao("1ª Vara do Trabalho de Jundiaí")).toBe("jundiai");
  });
});

describe("conflitos", () => {
  it("presencial em Campinas às 9h e vídeo às 10:20: deslocamento", () => {
    const presencial = aud({ inicio: "2026-11-19T12:00:00.000Z", tipo: "inicial", modalidadeTribunal: "presencial", orgao: "CON1 - Campinas" });
    const video = aud({ inicio: "2026-11-19T13:20:00.000Z", tipo: "instrucao" });
    const ctx: Contexto = { pessoas, todas: [presencial, video] };
    expect(conflitoDaPessoa("laura", video, ctx.todas)).toMatchObject({ tipo: "deslocamento", com: { id: presencial.id } });
    expect(alertasDaAudiencia(video, ctx).map((a) => a.tipo)).toContain("deslocamento");
  });

  it("mesmo horário é choque; audiência cancelada não conta", () => {
    const a = aud({ inicio: "2026-11-19T13:15:00.000Z", tipo: "una", titularId: "lucia" });
    const b = aud({ inicio: "2026-11-19T13:20:00.000Z" });
    const cancelada = aud({ inicio: "2026-11-19T13:20:00.000Z", titularId: "clara", situacao: "cancelada" });
    expect(conflitoDaPessoa("lucia", b, [a, b, cancelada])).toMatchObject({ tipo: "choque" });
    expect(conflitoDaPessoa("clara", b, [a, b, cancelada])).toBeNull();
  });

  it("opções de troca: livre primeiro, choque por último, quem não faz audiência fica de fora", () => {
    const a = aud({ inicio: "2026-11-19T13:15:00.000Z", tipo: "una", titularId: "lucia", backupId: null });
    const b = aud({ inicio: "2026-11-19T13:20:00.000Z" });
    const opcoes = opcoesDeTroca(b, "titular", { pessoas, todas: [a, b] });
    expect(opcoes.map((o) => [o.pessoa.id, o.estado])).toEqual([
      ["laura", "atual"],
      ["clara", "livre"],
      ["vera", "atencao"],
      ["lucia", "choque"],
    ]);
  });
});

describe("alertas", () => {
  it("sem titular, cedo, sem link e mudança no PJe", () => {
    const a = aud({ inicio: "2026-11-19T11:40:00.000Z", titularId: null, linkSala: null, mudancas: ["tipo"] });
    const tipos = alertasDaAudiencia(a, { pessoas, todas: [a] }).map((x) => [x.tipo, x.grave]);
    expect(tipos).toEqual([
      ["sem_titular", true],
      ["mudou", true],
      ["cedo", false],
      ["sem_link", false],
    ]);
  });
  it("mudança conferida some; cancelada pede conferência até ser conferida", () => {
    const conferida = aud({ mudancas: ["horario"], mudancaConferidaEm: "2026-11-18T12:00:00Z" });
    expect(alertasDaAudiencia(conferida, { pessoas, todas: [conferida] })).toEqual([]);
    const cancelada = aud({ situacao: "cancelada" });
    expect(alertasDaAudiencia(cancelada, { pessoas, todas: [cancelada] })[0]).toMatchObject({ tipo: "cancelada", grave: true });
  });
  it("VIOS com outro horário e híbrida sem escolha da equipe", () => {
    const a = aud({ viosInicio: "2026-11-19T14:20:00.000Z", modalidadeTribunal: "hibrida", linkSala: null });
    const tipos = alertasDaAudiencia(a, { pessoas, todas: [a] }).map((x) => x.tipo);
    expect(tipos).toEqual(["vios_diverge", "a_completar"]);
  });
});
