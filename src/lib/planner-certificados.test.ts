import { describe, expect, it } from "vitest";
import {
  CERTIFICADO_DROP_IDS,
  certificadoSectionFromDropId,
  getCertificadoSection,
  isCertificadoRequest,
  summarizeCertificadoCard,
} from "@/lib/planner-certificados";

const NOTA =
  "Origem: Responsum — Desenvolvimento Contínuo da Equipe\nTicket ID: abc\nTicket: https://x\n\n" +
  "Tipo: Workshop\nTema: Workshop: Oitiva Estratégica\nData da realização: 29/10/2026\nDuração: 120 minutos\nÁrea: Cível";

describe("planner-certificados", () => {
  it("separa os certificados pelo tipo da solicitação", () => {
    expect(isCertificadoRequest({ request_type: "Certificados" })).toBe(true);
    expect(isCertificadoRequest({ request_type: "PPT" })).toBe(false);
  });

  it("só o que está em revisado conta como pronto para a gráfica", () => {
    expect(getCertificadoSection({ workflow_stage: "revisado" })).toBe("pronto");
    expect(getCertificadoSection({ workflow_stage: "tarefas" })).toBe("a_fazer");
    expect(getCertificadoSection({ workflow_stage: "em_producao" })).toBe("a_fazer");
    expect(getCertificadoSection({ workflow_stage: null })).toBe("a_fazer");
  });

  it("reconhece as áreas de soltar da coluna e ignora as etapas normais", () => {
    expect(certificadoSectionFromDropId(CERTIFICADO_DROP_IDS.pronto)).toBe("pronto");
    expect(certificadoSectionFromDropId(CERTIFICADO_DROP_IDS.a_fazer)).toBe("a_fazer");
    expect(certificadoSectionFromDropId("revisado")).toBeNull();
  });

  it("conta os certificados pela lista de presença", () => {
    const summary = summarizeCertificadoCard(`${NOTA}\n\nPresença:\n- Ana\n- Bruno\n- Carla`);
    expect(summary).toEqual({ dataRealizacao: "29/10/2026", quantidade: 3, presenca: "preenchida" });
  });

  it("diferencia presença não preenchida de presença que ainda não chegou", () => {
    expect(summarizeCertificadoCard(`${NOTA}\n\nPresença: não preenchida`)?.presenca).toBe("nao_preenchida");
    expect(summarizeCertificadoCard(NOTA)).toEqual({
      dataRealizacao: "29/10/2026",
      quantidade: null,
      presenca: "aguardando",
    });
  });

  it("ignora descrição escrita à mão", () => {
    expect(summarizeCertificadoCard("Certificados do evento X")).toBeNull();
  });
});
