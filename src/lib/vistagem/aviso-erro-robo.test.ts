import { describe, expect, it } from "vitest";
import { mensagemErrosDoRobo, resumoDoErro } from "./aviso-erro-robo";

describe("resumo do erro do robô para o WhatsApp", () => {
  it("execução interrompida: avisa para conferir no VIOS antes de reenviar", () => {
    expect(resumoDoErro("Execução interrompida (RPA reiniciou ou travou). Conferir manualmente no VIOS antes de reenviar.")).toBe(
      "Execução interrompida: o robô reiniciou no meio. Confira no VIOS antes de reenviar."
    );
  });

  it("certificado e rede do VIOS saem sem o log do navegador", () => {
    const certificado =
      'page.goto: net::ERR_CERT_DATE_INVALID at https://bp.vios.com.br/\nCall log:\n  - navigating to "https://bp.vios.com.br/", waiting until "domcontentloaded"\n';
    expect(resumoDoErro(certificado)).toBe("O certificado do site do VIOS está inválido: o robô não conseguiu entrar.");
    expect(resumoDoErro("page.goto: net::ERR_CONNECTION_RESET at https://bp.vios.com.br/")).toBe(
      "O robô não conseguiu abrir o VIOS (ERR_CONNECTION_RESET)."
    );
  });

  it("tira o que muda a cada publicação, para juntar o mesmo erro", () => {
    expect(
      resumoDoErro("A intimação com ID de comunicação 778669304 não está em Intimações do VIOS (ainda não capturada ou já lançada). Nada foi agendado.")
    ).toBe("A publicação não está em Intimações do VIOS. Nada foi agendado.");
    expect(resumoDoErro("Tarefa 1 (CIÊNCIA NF): o tipo de tarefa 316 (CIÊNCIA NF) não está na lista do VIOS para este processo.")).toBe(
      "O tipo de tarefa CIÊNCIA NF não está na lista do VIOS para este processo."
    );
    expect(resumoDoErro("Tempo limite de 180s excedido")).toBe("O robô passou do tempo limite (180 s) e parou.");
  });

  it("o ATENÇÃO do robô fica, sem o detalhe técnico (mesmo se o detalhe for de rede)", () => {
    expect(
      resumoDoErro(
        "ATENÇÃO: o lançamento já tinha sido enviado — confira no VIOS (processo CI 55658) antes de reenviar. Detalhe: page.goto: net::ERR_CONNECTION_RESET\nCall log: …"
      )
    ).toBe("ATENÇÃO: o lançamento já tinha sido enviado — confira no VIOS (processo CI 55658) antes de reenviar.");
  });

  it("erro desconhecido: a primeira linha, encurtada", () => {
    expect(resumoDoErro("Excedeu 3 tentativas de envio ao RPA.")).toBe("Excedeu 3 tentativas de envio ao RPA.");
    const longo = resumoDoErro(`Falhou ${"x".repeat(400)}\nsegunda linha`);
    expect(longo.length).toBe(200);
    expect(longo.endsWith("…")).toBe(true);
    expect(resumoDoErro(null)).toBe("Erro sem descrição.");
  });
});

describe("mensagem dos erros do robô no grupo de Operações Legais", () => {
  it("um processo: o erro resumido e o número", () => {
    expect(
      mensagemErrosDoRobo([
        { numeroProcesso: "0922156-75.2025.8.19.0001", erro: "Execução interrompida (RPA reiniciou ou travou). Conferir manualmente no VIOS antes de reenviar." },
      ])
    ).toBe(
      "⚠️ *Erro no agendamento do robô*\n\nExecução interrompida: o robô reiniciou no meio. Confira no VIOS antes de reenviar.\n• 0922156-75.2025.8.19.0001"
    );
  });

  it("junta o mesmo erro e não repete o processo das várias tarefas da publicação", () => {
    const tipo = (n: number) => `Tarefa 1 (CIÊNCIA NF): o tipo de tarefa 316 (CIÊNCIA NF) não está na lista do VIOS para este processo. (${n})`;
    const texto = mensagemErrosDoRobo([
      { numeroProcesso: "1001536-54.2025.8.26.0260", erro: tipo(1) },
      { numeroProcesso: "1001536-54.2025.8.26.0260", erro: tipo(2) },
      { numeroProcesso: "4068181-68.2026.8.26.0100", erro: tipo(3) },
      { numeroProcesso: null, erro: "Tempo limite de 180s excedido" },
    ]);
    expect(texto).toBe(
      [
        "⚠️ *Erro no agendamento do robô*",
        "O tipo de tarefa CIÊNCIA NF não está na lista do VIOS para este processo.\n• 1001536-54.2025.8.26.0260\n• 4068181-68.2026.8.26.0100",
        "O robô passou do tempo limite (180 s) e parou.\n• sem número de processo",
      ].join("\n\n")
    );
  });

  it("muitos processos com o mesmo erro (ex.: certificado vencido) cabem numa mensagem", () => {
    const erros = Array.from({ length: 23 }, (_, i) => ({ numeroProcesso: `000000${i}-00.2026.8.26.0100`, erro: "net::ERR_CERT_DATE_INVALID" }));
    const linhas = mensagemErrosDoRobo(erros)!.split("\n");
    expect(linhas.filter((linha) => linha.startsWith("• 0"))).toHaveLength(20);
    expect(linhas.at(-1)).toBe("• … e mais 3");
  });

  it("sem erro, sem mensagem", () => {
    expect(mensagemErrosDoRobo([])).toBeNull();
  });
});
