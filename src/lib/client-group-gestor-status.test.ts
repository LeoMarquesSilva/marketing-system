import { describe, expect, it } from "vitest";
import {
  mapClientGroupGestorStatus,
  resolveGroupAtividade,
  validateClientGroupGestorStatusInput,
} from "@/lib/client-group-gestor-status";
import { emptySioeClienteAtividadeIndex } from "@/lib/sioe-cliente-atividade";

describe("client-group-gestor-status", () => {
  it("prioriza confirmação do gestor sobre SIOE", () => {
    const sioe = emptySioeClienteAtividadeIndex("2026-07");
    sioe.byGrupoKey["grupo x"] = "inativo";

    expect(
      resolveGroupAtividade(
        { name: "Grupo X", clientGroupId: "id-1" },
        {
          gestorAtividade: "ativo",
          inativoEncerramentoTipo: null,
          contratoVigenciaTermino: null,
          rescisaoContratualData: null,
          confirmedAt: "2026-07-07T00:00:00Z",
          confirmedByUserId: "u1",
        },
        sioe
      )
    ).toBe("ativo");
  });

  it("exige tipo de encerramento quando inativo", () => {
    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
      })
    ).toContain("Selecione");
  });

  it("permite salvar inativo sem data de encerramento", () => {
    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "termino_vigencia",
      })
    ).toBeNull();

    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "rescisao_contratual",
      })
    ).toBeNull();
  });

  it("valida formato da data opcional quando preenchida", () => {
    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "termino_vigencia",
        contratoVigenciaTermino: "31/12/2026",
      })
    ).toContain("inválida");

    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "rescisao_contratual",
        rescisaoContratualData: "2026-12-31",
      })
    ).toBeNull();
  });

  it("mapeia colunas do banco", () => {
    expect(
      mapClientGroupGestorStatus({
        gestor_atividade: "inativo",
        inativo_encerramento_tipo: "rescisao_contratual",
        rescisao_contratual_data: "2026-12-31",
        gestor_atividade_confirmed_at: "2026-07-07T12:00:00Z",
        gestor_atividade_confirmed_by_user_id: "user-1",
      })
    ).toMatchObject({
      gestorAtividade: "inativo",
      inativoEncerramentoTipo: "rescisao_contratual",
      rescisaoContratualData: "2026-12-31",
    });
  });
});
