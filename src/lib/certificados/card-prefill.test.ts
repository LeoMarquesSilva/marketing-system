import { describe, expect, it } from "vitest";
import { parseCertificadoWorkshopDescription, splitNames } from "../certificado-workshop";
import {
  buildCardPrefill,
  matchEventType,
  parseDataRealizacao,
  parseDuracaoMinutos,
  splitCargaHoraria,
} from "./card-prefill";

describe("duração do card", () => {
  it("entende os formatos que aparecem no Responsum", () => {
    expect(parseDuracaoMinutos("60 minutos")).toBe(60);
    expect(parseDuracaoMinutos("90 minutos")).toBe(90);
    expect(parseDuracaoMinutos("240 minutos")).toBe(240);
    expect(parseDuracaoMinutos("45 min")).toBe(45);
    expect(parseDuracaoMinutos("2 horas")).toBe(120);
    expect(parseDuracaoMinutos("1 hora")).toBe(60);
    expect(parseDuracaoMinutos("1h30")).toBe(90);
    expect(parseDuracaoMinutos("1h 30min")).toBe(90);
    expect(parseDuracaoMinutos("1 hora e 30 minutos")).toBe(90);
    expect(parseDuracaoMinutos("2 horas e 15")).toBe(135);
    expect(parseDuracaoMinutos("1,5 hora")).toBe(90);
    expect(parseDuracaoMinutos("2hs")).toBe(120);
    expect(parseDuracaoMinutos("1:30")).toBe(90);
  });

  it("devolve null quando não dá para ler", () => {
    expect(parseDuracaoMinutos(undefined)).toBeNull();
    expect(parseDuracaoMinutos("")).toBeNull();
    expect(parseDuracaoMinutos("a definir")).toBeNull();
    expect(parseDuracaoMinutos("90")).toBeNull();
    expect(parseDuracaoMinutos("0 minutos")).toBeNull();
  });

  it("vira horas e minutos dos campos da tela", () => {
    expect(splitCargaHoraria(90)).toEqual({ horas: "1", minutos: "30" });
    expect(splitCargaHoraria(60)).toEqual({ horas: "1", minutos: "0" });
    expect(splitCargaHoraria(45)).toEqual({ horas: "0", minutos: "45" });
    expect(splitCargaHoraria(240)).toEqual({ horas: "4", minutos: "0" });
  });
});

describe("data do card", () => {
  it("converte dd/mm/aaaa para yyyy-mm-dd", () => {
    expect(parseDataRealizacao("08/10/2026")).toBe("2026-10-08");
    expect(parseDataRealizacao("3/9/2026")).toBe("2026-09-03");
    expect(parseDataRealizacao(" 17-09-2026 ")).toBe("2026-09-17");
  });

  it("recusa datas que não existem ou fora do formato", () => {
    expect(parseDataRealizacao("31/02/2026")).toBeNull();
    expect(parseDataRealizacao("2026-10-08")).toBeNull();
    expect(parseDataRealizacao("08/10/26")).toBeNull();
    expect(parseDataRealizacao(undefined)).toBeNull();
  });
});

describe("tipo do card", () => {
  it("casa com a lista ignorando acento e caixa", () => {
    expect(matchEventType("Workshop")).toBe("Workshop");
    expect(matchEventType("TREINAMENTO")).toBe("Treinamento");
    expect(matchEventType("seminario")).toBe("Seminário");
    expect(matchEventType(" Imersao ")).toBe("Imersão");
  });

  it("devolve null para tipo desconhecido", () => {
    expect(matchEventType("Happy hour")).toBeNull();
    expect(matchEventType(undefined)).toBeNull();
  });
});

describe("divisão de nomes", () => {
  it("separa por vírgula, “e”, barra e &", () => {
    expect(splitNames("Fernanda Andrade Camolesi, Lucas Sebinel Miranda")).toEqual([
      "Fernanda Andrade Camolesi",
      "Lucas Sebinel Miranda",
    ]);
    expect(splitNames("Ana Nunes Galvão e Wagner Armani / Midian Barbosa & Raíssa Minari")).toEqual([
      "Ana Nunes Galvão",
      "Wagner Armani",
      "Midian Barbosa",
      "Raíssa Minari",
    ]);
  });

  it("não quebra nomes que só contêm a letra e", () => {
    expect(splitNames("Henrique Franco Nascimento")).toEqual(["Henrique Franco Nascimento"]);
  });
});

describe("card inteiro", () => {
  // Mesmo formato da automação: campos numa linha só e o bloco de presença no fim.
  const description =
    "Origem: Responsum Ticket ID: 123 Ticket: https://responsum.example/ticket/123 Tipo: Treinamento " +
    "Tema: Workshop Reestruturação: Depois do Stay Period Responsável (Gerente da área): Fulana " +
    "E-mail do responsável: fulana@bismarchipires.com.br " +
    "Facilitador(es): fernanda andrade camolesi, Lucas Sebinel Miranda Data da realização: 17/09/2026 " +
    "Duração: 90 minutos Área: Reestruturação Lista de presença: https://sharepoint.example/lista" +
    "\nPresença:\n- ana clara borba tavares\n- fernanda.camolesi@bpplaw.com.br\n- Fernanda Andrade Camolesi" +
    "\n- thayna.cabalin@bpplaw.com.br\n- Pessoa Sem Cadastro";

  const users = [
    { name: "Ana Clara Borba Tavares", email: "ana.tavares@bismarchipires.com.br" },
    { name: "Fernanda Andrade Camolesi", email: "fernanda.camolesi@bismarchipires.com.br" },
  ];

  it("preenche curso, data, carga, facilitadores e participantes", () => {
    const info = parseCertificadoWorkshopDescription(description);
    expect(info).not.toBeNull();
    const prefill = buildCardPrefill(info!, users);

    expect(prefill.tipo).toBe("Treinamento");
    expect(prefill.curso).toBe("Workshop Reestruturação: Depois do Stay Period");
    expect(prefill.dataInicio).toBe("2026-09-17");
    expect(prefill.cargaHorariaMinutos).toBe(90);
    expect(prefill.facilitadores).toEqual(["Fernanda Andrade Camolesi", "Lucas Sebinel Miranda"]);
    expect(prefill.presenca).toBe("preenchida");
    expect(prefill.participantes.map(({ nome, email }) => ({ nome, email }))).toEqual([
      { nome: "Ana Clara Borba Tavares", email: "ana.tavares@bismarchipires.com.br" },
      { nome: "Fernanda Andrade Camolesi", email: "fernanda.camolesi@bismarchipires.com.br" },
      { nome: "thayna.cabalin@bpplaw.com.br", email: "thayna.cabalin@bpplaw.com.br" },
      { nome: "Pessoa Sem Cadastro", email: null },
    ]);
    expect(prefill.semCadastro).toEqual(["thayna.cabalin@bpplaw.com.br", "Pessoa Sem Cadastro"]);
  });

  it("usa Workshop quando o tipo não é conhecido e marca presença não buscada", () => {
    const prefill = buildCardPrefill({ tipo: "Happy hour", tema: "Algo", duracao: "a definir" }, []);
    expect(prefill.tipo).toBe("Workshop");
    expect(prefill.cargaHorariaMinutos).toBeNull();
    expect(prefill.dataInicio).toBeNull();
    expect(prefill.facilitadores).toEqual([]);
    expect(prefill.participantes).toEqual([]);
    expect(prefill.presenca).toBe("nao_buscada");
  });
});
