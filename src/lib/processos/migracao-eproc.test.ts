import { describe, expect, it } from "vitest";
import { migracaoParaEproc } from "./migracao-eproc";

const CERTIDAO =
  "CERTIDÃO Ficam as partes e seus representantes cientificados de que o presente p rocesso passará a tramitar eletronicamente no Sistema Eproc do Tribunal de Justiça do Estado de São Paulo, sob o núm ero00000000020238260000. Caso seja advogado";
const RODAPE_GUIA = "Importante: As custas dos processos eproc NÃO devem ser geradas neste Portal. Cronograma de implantação: www.tjsp.jus.br/eproc";

describe("migração do e-SAJ para o eproc", () => {
  it("acha a certidão na última página, com o número do eproc", () => {
    const achado = migracaoParaEproc(["Petição inicial", RODAPE_GUIA, "Despacho", CERTIDAO]);
    expect(achado).toMatchObject({ pagina: 4, numero: "0000000-00.2023.8.26.0000" });
    expect(achado?.trecho).toContain("tramitar eletronicamente no Sistema Eproc");
  });

  it("não confunde com as menções genéricas ao eproc", () => {
    expect(migracaoParaEproc(["Petição inicial", RODAPE_GUIA, "Sentença"])).toBeNull();
  });

  it("sem o número na certidão, ainda reconhece a migração", () => {
    expect(migracaoParaEproc(["O processo foi migrado para o sistema eproc."])).toMatchObject({ pagina: 1, numero: null });
  });
});
