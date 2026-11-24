import { describe, expect, it } from "vitest";
import { buildNotificationEmail } from "./email";

describe("buildNotificationEmail", () => {
  it("monta o link absoluto, usa o primeiro nome e não deixa HTML passar", () => {
    const { subject, html } = buildNotificationEmail({
      recipientName: "Valentina Iacovacci",
      title: "Leonardo te deu um <b>reconhecimento</b>",
      intro: "Você recebeu um feedback no ORQESTRAI.",
      link: "/feedback?f=abc",
    });
    expect(subject).toBe("Leonardo te deu um <b>reconhecimento</b>");
    expect(html).toContain("https://www.orqestrai.com.br/feedback?f=abc");
    expect(html).toContain("Olá, Valentina!");
    expect(html).not.toContain("<b>reconhecimento</b>");
    expect(html).toContain("&lt;b&gt;reconhecimento&lt;/b&gt;");
    expect(html).toContain("Abrir no ORQESTRAI");
  });
});
