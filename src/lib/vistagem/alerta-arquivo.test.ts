import { describe, expect, it } from "vitest";
import { mensagemArquivoAtrasado, situacaoDoDia } from "./alerta-arquivo";

const FERIADOS = ["2026-11-02"];

describe("arquivo da Kurier do dia", () => {
  it("atrasado só em dia útil, depois das 8h e sem arquivo processado", () => {
    expect(situacaoDoDia({ hoje: "2026-10-27", hora: 9, feriados: FERIADOS, arquivosDeHoje: [] })).toMatchObject({ diaUtil: true, chegou: false, atrasado: true });
    expect(situacaoDoDia({ hoje: "2026-10-27", hora: 7, feriados: FERIADOS, arquivosDeHoje: [] }).atrasado).toBe(false);
    expect(situacaoDoDia({ hoje: "2026-10-27", hora: 9, feriados: FERIADOS, arquivosDeHoje: [{ status: "processado", erro: null }] }).atrasado).toBe(false);
    // sábado e feriado não esperam arquivo
    expect(situacaoDoDia({ hoje: "2026-10-31", hora: 11, feriados: FERIADOS, arquivosDeHoje: [] }).atrasado).toBe(false);
    expect(situacaoDoDia({ hoje: "2026-11-02", hora: 11, feriados: FERIADOS, arquivosDeHoje: [] })).toMatchObject({ diaUtil: false, atrasado: false });
  });

  it("arquivo que chegou com erro conta como atrasado e leva o erro", () => {
    const situacao = situacaoDoDia({ hoje: "2026-10-27", hora: 10, feriados: FERIADOS, arquivosDeHoje: [{ status: "erro", erro: "planilha sem aba Publicações" }] });
    expect(situacao).toMatchObject({ chegou: false, atrasado: true, erro: "planilha sem aba Publicações" });
    expect(mensagemArquivoAtrasado(situacao)).toContain("27/10/2026 chegou, mas a importação falhou (planilha sem aba Publicações)");
  });

  it("mensagem de arquivo que não chegou", () => {
    const situacao = situacaoDoDia({ hoje: "2026-10-27", hora: 10, feriados: FERIADOS, arquivosDeHoje: [] });
    expect(mensagemArquivoAtrasado(situacao)).toContain("27/10/2026 ainda não chegou");
  });
});
