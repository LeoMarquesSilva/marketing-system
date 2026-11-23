import { describe, expect, it } from "vitest";
import { loginTerminou, msAteProximoHorario } from "./pauta.ts";

// 18/11/2026 em Brasília (UTC-3): horário de cada caso em UTC = Brasília + 3h.
const brasilia = (hhmm: string) => new Date(`2026-11-18T${hhmm}:00-03:00`).getTime();

describe("horários do ciclo da pauta", () => {
  it("vai para o próximo horário do dia", () => {
    expect(msAteProximoHorario(brasilia("06:00"), "06:45,11:45,16:45")).toBe(45 * 60_000);
    expect(msAteProximoHorario(brasilia("12:00"), "06:45,11:45,16:45")).toBe((4 * 60 + 45) * 60_000);
  });
  it("depois do último, vai para o primeiro do dia seguinte", () => {
    expect(msAteProximoHorario(brasilia("17:00"), "06:45,11:45,16:45")).toBe((13 * 60 + 45) * 60_000);
  });
  it("ignora horário mal escrito e aceita ordem qualquer", () => {
    expect(msAteProximoHorario(brasilia("10:00"), "16:45, 25h, 11:45")).toBe(105 * 60_000);
  });
});

describe("fim do login no PJe", () => {
  it("o retorno do SSO ainda não é o fim (sair dele deixa o PJe sem sessão)", () => {
    expect(loginTerminou("https://pje.trt15.jus.br/primeirograu/authenticateSSO.seam?state=x&code=y", "TRT15")).toBe(false);
    expect(loginTerminou("https://pje.trt15.jus.br/primeirograu/login.seam", "TRT15")).toBe(false);
    expect(loginTerminou("https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/auth?client_id=pje-trt15-1g", "TRT15")).toBe(false);
    expect(loginTerminou("https://pje.trt15.jus.br/pjekz/authorization?code=x", "TRT15")).toBe(false);
  });
  it("o painel do PJe do mesmo tribunal é o fim; outro tribunal não", () => {
    expect(loginTerminou("https://pje.trt15.jus.br/pjekz/painel/usuario-externo", "TRT15")).toBe(true);
    expect(loginTerminou("https://pje.trt15.jus.br/primeirograu/Painel/painel_usuario/advogado.seam", "TRT15")).toBe(true);
    expect(loginTerminou("https://pje.trt2.jus.br/pjekz/painel/usuario-externo", "TRT15")).toBe(false);
  });
});
