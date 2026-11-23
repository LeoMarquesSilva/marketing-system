import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ profile: null }) }));

import { FollowupAlertCard, postHref } from "./followup-alerts";
import type { FollowupAlert } from "@/lib/content-generator/server";

const alert: FollowupAlert = {
  id: "a1",
  roteiroId: "r-novo",
  ref: {
    source: "instagram",
    id: "p1",
    title: "Casas Bahia em recuperação judicial: uma nova etapa na reestruturação do grupo",
    url: "https://www.instagram.com/p/abc/",
    date: "2026-08-21T15:00:00.000Z",
    people: [{ id: "u1", name: "Lavinia Ferraz Crispim" }],
  },
  note: "O TJSP autorizou o processamento da recuperação judicial.",
  createdAt: "2026-11-18T12:00:00.000Z",
  roteiro: { title: "Justiça autoriza processamento da RJ da Casas Bahia", area: "Reestruturação", imageUrl: null, status: "aguardando_aprovacao" },
};

describe("aviso de desdobramento", () => {
  it("mostra o post original, o que há de novo e leva à matéria nova", () => {
    const html = renderToStaticMarkup(<FollowupAlertCard alert={alert} onDismiss={() => {}} />);
    expect(html).toContain("Seu post no Instagram · 21/08/2026");
    expect(html).toContain("O que há de novo:");
    expect(html).toContain("O TJSP autorizou o processamento");
    expect(html).toContain(`href="${postHref("r-novo").replace("&", "&amp;")}"`);
    expect(html).toContain("Fazer a continuação");
    expect(html).toContain("Agora não");
  });
});
