import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { lerIndicesDaPlanilha } from "./indices-tjsp";

/** Planilha mínima no formato da do TJSP: aba "ÍNDICES", cabeçalhos na linha 3, dados a partir da 7. */
async function planilha(cabecalhoTabela: string, linhas: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("xl/workbook.xml", '<workbook><sheets><sheet name="CÁLCULO INICIAL" sheetId="1" r:id="rId1"/><sheet name="ÍNDICES" sheetId="3" r:id="rId3"/></sheets></workbook>');
  zip.file("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>');
  zip.file("xl/sharedStrings.xml", `<sst><si><t>${cabecalhoTabela}</t></si><si><t>Acumulado Selic menos correção: Tabela Prática TJSP - Lei 14.905/2024</t></si><si><t>Tabela Prática TJSP - Lei 14.905/2024 - Selic menos correção</t></si></sst>`);
  zip.file("xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>");
  zip.file(
    "xl/worksheets/sheet3.xml",
    `<worksheet><sheetData><row r="3"><c r="O3" t="s"><v>0</v></c><c r="AJ3" t="s"><v>1</v></c><c r="AV3" t="s"><v>2</v></c></row>${linhas}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

// 45505 = 01/08/2024; 45536 = 01/09/2024; 45566 = 01/10/2024 (datas do Excel).
const DADOS =
  '<row r="7"><c r="A7"><v>45505</v></c><c r="O7"><v>95.912469</v></c><c r="AJ7"><v>242.28</v></c><c r="AV7"><v>0.645444</v></c></row>' +
  '<row r="8"><c r="A8"><v>45536</v></c><c r="O8"><v>96.094702</v></c><c r="AV8"><v>0.676227</v></c></row>' +
  '<row r="9"><c r="A9"><v>45566</v></c><c r="O9"><v>96.219625</v></c></row>' +
  '<row r="10"><c r="A10"><v>45597</v></c></row>';

describe("índices da planilha do TJSP", () => {
  it("lê a Tabela Prática e a taxa legal pelas colunas do cabeçalho", async () => {
    const indices = await lerIndicesDaPlanilha(await planilha("Tabela Prática TJSP - Lei 14.905/2024", DADOS));
    expect(indices).toEqual([
      { mes: "2024-08-01", tabelaPratica: 95.912469, taxaLegal: 0.645444 },
      { mes: "2024-09-01", tabelaPratica: 96.094702, taxaLegal: 0.676227 },
      { mes: "2024-10-01", tabelaPratica: 96.219625, taxaLegal: null },
    ]);
  });

  it("recusa a planilha quando o cabeçalho da Tabela Prática mudou", async () => {
    await expect(lerIndicesDaPlanilha(await planilha("Tabela Prática nova", DADOS))).rejects.toThrow(/planilha do TJSP mudou/);
  });
});
