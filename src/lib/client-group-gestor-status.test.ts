import { describe, expect, it } from "vitest";
import {
  canEditNpsContactsForGroup,
  isClientGroupInactiveForOutreach,
  mapClientGroupGestorStatus,
  resolveGroupAtividade,
  validateClientGroupGestorStatusInput,
} from "@/lib/client-group-gestor-status";
import { emptySioeClienteAtividadeIndex, grupoClienteKey } from "@/lib/sioe-cliente-atividade";

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

  it("permite salvar término da vigência sem data", () => {
    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "termino_vigencia",
      })
    ).toBeNull();
  });

  it("exige data da rescisão contratual", () => {
    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "rescisao_contratual",
      })
    ).toContain("data da rescisão");

    expect(
      validateClientGroupGestorStatusInput({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "rescisao_contratual",
        rescisaoContratualData: "2026-12-31",
      })
    ).toBeNull();
  });

  it("valida formato da data quando preenchida", () => {
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

  it("exclui inativos confirmados e o fallback SIOE do outreach", () => {
    const sioe = emptySioeClienteAtividadeIndex("2026-07");
    sioe.byGrupoCategoriaAtividade[grupoClienteKey("Grupo Y")] = "inativo";

    expect(
      isClientGroupInactiveForOutreach({ name: "Grupo X", gestorAtividade: "inativo" }, sioe)
    ).toBe(true);
    expect(
      isClientGroupInactiveForOutreach({ name: "Grupo X", gestorAtividade: "ativo" }, sioe)
    ).toBe(false);
    expect(
      isClientGroupInactiveForOutreach({ name: "Grupo Y", gestorAtividade: null }, sioe)
    ).toBe(true);
    expect(
      isClientGroupInactiveForOutreach({ name: "Grupo Z", gestorAtividade: null }, sioe)
    ).toBe(false);
  });

  it("só libera edição NPS depois do status confirmado", () => {
    expect(canEditNpsContactsForGroup(null)).toBe(false);
    expect(
      canEditNpsContactsForGroup({
        gestorAtividade: null,
        inativoEncerramentoTipo: null,
        contratoVigenciaTermino: null,
        rescisaoContratualData: null,
        confirmedAt: null,
        confirmedByUserId: null,
      })
    ).toBe(false);
    expect(
      canEditNpsContactsForGroup({
        gestorAtividade: "ativo",
        inativoEncerramentoTipo: null,
        contratoVigenciaTermino: null,
        rescisaoContratualData: null,
        confirmedAt: "2026-09-02T00:00:00Z",
        confirmedByUserId: "u1",
      })
    ).toBe(true);
    expect(
      canEditNpsContactsForGroup({
        gestorAtividade: "inativo",
        inativoEncerramentoTipo: "rescisao_contratual",
        contratoVigenciaTermino: null,
        rescisaoContratualData: "2026-08-01",
        confirmedAt: "2026-09-02T00:00:00Z",
        confirmedByUserId: "u1",
      })
    ).toBe(true);
  });
});
