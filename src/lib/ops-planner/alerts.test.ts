import { describe, expect, it } from "vitest";
import { criarCalendario } from "@/lib/vistagem/dias-uteis";
import {
  buildDailyNotifications,
  buildDigest,
  buildRoutineGeneratedNotifications,
  isDigestEmpty,
  newlyAssigned,
  type AlertContext,
  type AlertTask,
} from "./alerts";
import { renderDigestEmail } from "./digest-email";

const ehDiaUtil = criarCalendario(["2026-11-02"]);

function ctx(today: string): AlertContext {
  return {
    today,
    ehDiaUtil,
    spaceName: (id) => (id === "rh" ? "Pessoas e Cultura" : id),
    spaceManagers: (id) => (id === "rh" ? ["lider", "gestor"] : []),
    personName: (id) => ({ ana: "Ana", bia: "Bia" })[id] ?? id,
  };
}

function task(overrides: Partial<AlertTask>): AlertTask {
  return {
    id: "t1",
    space_id: "rh",
    title: "Folha",
    status: "a_fazer",
    due_date: null,
    assignee_ids: ["ana"],
    waiting_on: null,
    waiting_since: null,
    routine_id: null,
    ...overrides,
  };
}

const kinds = (list: { kind: string; recipient_id: string }[]) => list.map((n) => `${n.kind}→${n.recipient_id}`);

describe("buildDailyNotifications", () => {
  it("avisa quem é responsável no dia do vencimento", () => {
    const out = buildDailyNotifications([task({ due_date: "2026-10-23" })], ctx("2026-10-23"));
    expect(kinds(out)).toEqual(["vence_hoje→ana"]);
    expect(out[0].title).toBe("Vence hoje: Folha");
    expect(out[0].dedupe_key).toBe("vence_hoje:t1:2026-10-23:ana");
  });

  it("na sexta, avisa o que vence no próximo dia útil (terça, depois de Finados)", () => {
    const out = buildDailyNotifications([task({ due_date: "2026-11-03" })], ctx("2026-10-30"));
    expect(kinds(out)).toEqual(["vence_amanha→ana"]);
    expect(out[0].title).toBe("Vence 03/11: Folha");
  });

  it("no fim de semana não manda o aviso de véspera", () => {
    expect(buildDailyNotifications([task({ due_date: "2026-11-01" })], ctx("2026-10-31"))).toEqual([]);
  });

  it("atrasada há mais de 2 dias úteis escala para líder e gestor", () => {
    const out = buildDailyNotifications([task({ due_date: "2026-10-27" })], ctx("2026-10-30"));
    expect(kinds(out)).toEqual(["atrasada→ana", "escalada→lider", "escalada→gestor"]);
    expect(out[1].title).toBe("Atrasada há 3 dias úteis: Folha");
    expect(out[1].body).toBe("Ana · Pessoas e Cultura");
  });

  it("atrasada há só 2 dias úteis ainda não escala", () => {
    const out = buildDailyNotifications([task({ due_date: "2026-10-28" })], ctx("2026-10-30"));
    expect(kinds(out)).toEqual(["atrasada→ana"]);
  });

  it("parada em Aguardando há mais de 5 dias úteis escala com quem está segurando", () => {
    const out = buildDailyNotifications(
      [task({ status: "aguardando", waiting_on: "Felipe", waiting_since: "2026-10-23" })],
      ctx("2026-11-03")
    );
    // 26 a 30/10 + 03/11 = 6 dias úteis (02/11 é feriado).
    expect(kinds(out)).toEqual(["escalada→lider", "escalada→gestor"]);
    expect(out[0].title).toBe("Parada há 6 dias úteis: Folha");
    expect(out[0].body).toBe("Aguardando Felipe · Pessoas e Cultura");
  });

  it("sem responsável, quem recebe é a liderança do espaço", () => {
    const out = buildDailyNotifications([task({ assignee_ids: [], due_date: "2026-10-23" })], ctx("2026-10-23"));
    expect(kinds(out)).toEqual(["vence_hoje→lider", "vence_hoje→gestor"]);
  });

  it("líder que também é responsável não recebe a escalada da própria tarefa", () => {
    const out = buildDailyNotifications([task({ assignee_ids: ["lider"], due_date: "2026-10-27" })], ctx("2026-10-30"));
    expect(kinds(out)).toEqual(["atrasada→lider", "escalada→gestor"]);
  });

  it("ignora concluídas e canceladas", () => {
    const out = buildDailyNotifications(
      [task({ status: "concluida", due_date: "2026-10-23" }), task({ status: "cancelada", due_date: "2026-10-20" })],
      ctx("2026-10-23")
    );
    expect(out).toEqual([]);
  });
});

describe("avisos de rotina e de atribuição", () => {
  it("rotina gerada avisa os responsáveis com o vencimento", () => {
    const out = buildRoutineGeneratedNotifications([task({ routine_id: "r1", due_date: "2026-11-09" })], ctx("2026-11-06"));
    expect(out).toEqual([
      expect.objectContaining({ kind: "rotina_gerada", recipient_id: "ana", body: "Vence em 09/11 · Pessoas e Cultura", routine_id: "r1" }),
    ]);
  });

  it("só avisa quem entrou agora, nunca quem fez a mudança", () => {
    expect(newlyAssigned(["ana"], ["ana", "bia", "eu"], "eu")).toEqual(["bia"]);
  });
});

describe("resumo por e-mail", () => {
  it("junta as tarefas da pessoa e o que está atrasado nas equipes dela", () => {
    const tasks = [
      task({ id: "a", title: "Atrasada", due_date: "2026-10-26" }),
      task({ id: "b", title: "Hoje", due_date: "2026-10-30" }),
      task({ id: "c", title: "Terça", due_date: "2026-11-03" }),
      task({ id: "d", title: "Da Bia", assignee_ids: ["bia"], due_date: "2026-10-20" }),
    ];
    const digest = buildDigest("ana", tasks, ["rh"], ctx("2026-10-30"));
    expect(digest.overdue.map((item) => item.title)).toEqual(["Atrasada"]);
    expect(digest.today.map((item) => item.title)).toEqual(["Hoje"]);
    expect(digest.next.map((item) => item.title)).toEqual(["Terça"]);
    expect(digest.teams[0].overdue.map((item) => item.title)).toEqual(["Da Bia", "Atrasada"]);
    expect(isDigestEmpty(digest)).toBe(false);

    const email = renderDigestEmail(digest, { name: "Ana Souza", baseUrl: "https://orqestrai.com.br", today: "2026-10-30" });
    expect(email.subject).toBe("Planner Ops: 2 tarefas para hoje ou atrasadas");
    expect(email.html).toContain("Bom dia, Ana");
    expect(email.html).toContain("https://orqestrai.com.br/operacoes-legais/planner?tarefa=a");
  });

  it("sem nada para mostrar, o resumo fica vazio e não é enviado", () => {
    expect(isDigestEmpty(buildDigest("ana", [task({ due_date: "2026-12-01" })], [], ctx("2026-10-30")))).toBe(true);
  });

  it("escapa o título no HTML", () => {
    const digest = buildDigest("ana", [task({ title: "<b>NF</b>", due_date: "2026-10-30" })], [], ctx("2026-10-30"));
    expect(renderDigestEmail(digest, { name: "Ana", baseUrl: "https://x", today: "2026-10-30" }).html).toContain("&lt;b&gt;NF&lt;/b&gt;");
  });
});
