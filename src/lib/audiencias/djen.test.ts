import { describe, expect, it } from "vitest";
import { audienciaNasIntimacoes, linksDeSala, modalidadeDoTrecho, textoLimpo } from "./djen";

// Textos no formato das intimações do TRT-15 no DJEN (conteúdo fictício).
const VIRTUAL = `PODER JUDICIÁRIO JUSTIÇA DO TRABALHO. Considerando a Portaria, decide este Juízo agendar sessão de
mediação/conciliação virtual para o dia 19/11/2026 09:20. A audiência será realizada virtualmente, por intermédio da
ferramenta ZOOM. Tutorial: https://sites.google.com/trt15.jus.br/zoomadv/pagina-inicial . Link da sala:
https://us02web.zoom.us/j/12345678901?pwd=abc .`;

const PRESENCIAL = `Com fulcro no artigo 765 da CLT e na Resolução 345/2020 do CNJ (plataforma digital), designa-se audiência
PRESENCIAL UNA - sala "SALA 1": 18/05/2026 10:45. As partes deverão comparecer com documento.`;

const ATA = `Considerando o equívoco material verificado na ata de audiência realizada em 12/08/2026, proceda-se a retificação.`;

const HIBRIDA = `Designo audiência UNA na modalidade HÍBRIDA para o dia 18/06/2026 10:10, com a publicação deste no DEJT.`;

describe("audienciaNasIntimacoes", () => {
  it("acha hora, modalidade e link da sala (e ignora o link do tutorial)", () => {
    const r = audienciaNasIntimacoes([{ data_disponibilizacao: "2026-10-21", texto: VIRTUAL }], "2026-11-19")!;
    expect(r.hora).toBe("09:20");
    expect(r.modalidade).toBe("video");
    expect(r.link).toBe("https://us02web.zoom.us/j/12345678901?pwd=abc");
    expect(r.dataDisponibilizacao).toBe("2026-10-21");
  });

  it("presencial dita na frase vence 'plataforma' e 'Resolução 345'", () => {
    const r = audienciaNasIntimacoes([{ data_disponibilizacao: "2025-09-19", texto: PRESENCIAL }], "2026-05-18")!;
    expect(r.modalidade).toBe("presencial");
    expect(r.hora).toBe("10:45");
    expect(r.link).toBeNull();
  });

  it("data que só aparece como 'audiência realizada em' não é designação", () => {
    expect(audienciaNasIntimacoes([{ data_disponibilizacao: "2026-08-18", texto: ATA }], "2026-08-12")).toBeNull();
  });

  it("híbrida e a intimação mais nova primeiro", () => {
    const r = audienciaNasIntimacoes(
      [
        { data_disponibilizacao: "2026-04-01", texto: PRESENCIAL.replace("18/05/2026", "18/06/2026") },
        { data_disponibilizacao: "2026-04-17", texto: HIBRIDA },
      ],
      "2026-06-18"
    )!;
    expect(r.modalidade).toBe("hibrida");
    expect(r.dataDisponibilizacao).toBe("2026-04-17");
  });
});

describe("peças da leitura", () => {
  it("links de sala: zoom antes de bit.ly, sem repetir", () => {
    expect(linksDeSala("veja https://bit.ly/sala2 ou https://trt15-jus-br.zoom.us/j/1 e https://trt15-jus-br.zoom.us/j/1?pwd=2")).toEqual([
      "https://trt15-jus-br.zoom.us/j/1",
      "https://bit.ly/sala2",
    ]);
  });
  it("modalidade do trecho", () => {
    expect(modalidadeDoTrecho("audiência telepresencial no Cejusc")).toBe("video");
    expect(modalidadeDoTrecho("que será realizada na forma PRESENCIAL")).toBe("presencial");
    expect(modalidadeDoTrecho("intimem-se as partes")).toBeNull();
  });
  it("limpa o HTML da comunicação", () => {
    expect(textoLimpo("<p>Audiência&nbsp;UNA<br/>dia 19/11/2026</p>")).toBe("Audiência UNA dia 19/11/2026");
  });
});
