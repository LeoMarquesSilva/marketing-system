import { describe, expect, it } from "vitest";
import { parseCertificadoWorkshopDescription } from "./certificado-workshop";

const SAMPLE = `Origem: Responsum — Desenvolvimento Contínuo da Equipe Ticket ID: 63e3b829-7289-4795-aa81-478c726ec646 Ticket: https://www.responsum.com.br/tickets/63e3b829-7289-4795-aa81-478c726ec646 Tipo: Workshop Tema: Workshop Reestruturação: Depois do Stay Period - Limites da Proteção Patrimonial da Empresa em Recuperação Judicial Responsável (Gerente da área): Leonardo Loureiro Basso E-mail do responsável: leonardo@bismarchipires.com.br Facilitador(es): Mariana Manuel Araújo Data da realização: 03/09/2026 Duração: 60 minutos Área: Reestruturação Lista de presença: https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURIDICA/Lists/TREINA?env=WebViewList Consultar após o workshop quem preencheu o registro de presença.`;

describe("parseCertificadoWorkshopDescription", () => {
  it("returns null for empty/undefined input", () => {
    expect(parseCertificadoWorkshopDescription(null)).toBeNull();
    expect(parseCertificadoWorkshopDescription(undefined)).toBeNull();
    expect(parseCertificadoWorkshopDescription("")).toBeNull();
  });

  it("returns null for descriptions that don't follow the known template", () => {
    expect(parseCertificadoWorkshopDescription("Design de certificados para evento jurídico")).toBeNull();
  });

  it("parses every field from the Responsum workshop note", () => {
    const info = parseCertificadoWorkshopDescription(SAMPLE);
    expect(info).not.toBeNull();
    expect(info?.origem).toBe("Responsum — Desenvolvimento Contínuo da Equipe");
    expect(info?.ticketId).toBe("63e3b829-7289-4795-aa81-478c726ec646");
    expect(info?.ticketUrl).toBe("https://www.responsum.com.br/tickets/63e3b829-7289-4795-aa81-478c726ec646");
    expect(info?.tipo).toBe("Workshop");
    // Mantém o valor inteiro mesmo contendo ":" (Reestruturação:) pois só
    // rótulos conhecidos quebram o campo, evitando falso corte no meio do tema.
    expect(info?.tema).toBe(
      "Workshop Reestruturação: Depois do Stay Period - Limites da Proteção Patrimonial da Empresa em Recuperação Judicial"
    );
    expect(info?.responsavelNome).toBe("Leonardo Loureiro Basso");
    expect(info?.responsavelEmail).toBe("leonardo@bismarchipires.com.br");
    expect(info?.facilitadores).toBe("Mariana Manuel Araújo");
    expect(info?.dataRealizacao).toBe("03/09/2026");
    expect(info?.duracao).toBe("60 minutos");
    expect(info?.area).toBe("Reestruturação");
    expect(info?.listaPresencaUrl).toContain(
      "https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURIDICA/Lists/TREINA"
    );
    expect(info?.presenca).toBeUndefined();
  });

  it("extrai o bloco de presença anexado pela edge function (preenchida)", () => {
    const withPresenca = `${SAMPLE}\n\nPresença:\n- Mariana Manuel Araújo\n- Leonardo Loureiro Basso`;
    const info = parseCertificadoWorkshopDescription(withPresenca);
    expect(info?.presenca).toEqual({
      status: "preenchida",
      nomes: ["Mariana Manuel Araújo", "Leonardo Loureiro Basso"],
    });
    // O bloco de presença não deve vazar para dentro do campo anterior.
    expect(info?.listaPresencaUrl).not.toContain("Presença");
  });

  it("extrai o bloco de presença anexado pela edge function (não preenchida)", () => {
    const withPresenca = `${SAMPLE}\n\nPresença: não preenchida`;
    const info = parseCertificadoWorkshopDescription(withPresenca);
    expect(info?.presenca).toEqual({ status: "nao_preenchida", nomes: [] });
  });
});
