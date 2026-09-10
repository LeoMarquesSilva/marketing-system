import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssigneeIssueCard } from "./content-schedule-assignee-review";

const collaborator = {
  id: "person-1",
  name: "Caroline Simel Abdalla",
  department: "Trabalhista",
  avatar_url: null,
};

describe("AssigneeIssueCard", () => {
  it("explica quando o nome abreviado confirma uma identidade histórica", () => {
    const html = renderToStaticMarkup(<AssigneeIssueCard
      issue={{
        key: "trabalhista::carol",
        area: "Trabalhista",
        sourceName: "Carol Abdalla",
        reason: "abbreviated",
        mode: "identity",
        slotCount: 6,
        pastSlotCount: 4,
        futureSlotCount: 2,
        affectedSlotCount: 6,
        dates: ["2026-01-10", "2026-09-18"],
        suggestedCollaboratorId: collaborator.id,
        suggestedCollaboratorName: collaborator.name,
        suggestedCollaboratorAvatarUrl: null,
      }}
      collaborators={[collaborator]}
      selectedId={collaborator.id}
      saving={false}
      onSelect={() => undefined}
      onConfirm={() => undefined}
    />);
    expect(html).toContain("Nome abreviado");
    expect(html).toContain("Associar identidade");
    expect(html).toContain("6 tarefas serão associadas");
    expect(html).toContain("inclusive o histórico");
  });

  it("preserva o histórico ao substituir ex-colaborador", () => {
    const html = renderToStaticMarkup(<AssigneeIssueCard
      issue={{
        key: "civel::antigo",
        area: "Cível",
        sourceName: "Pessoa Antiga",
        reason: "inactive",
        mode: "future_replacement",
        slotCount: 5,
        pastSlotCount: 3,
        futureSlotCount: 2,
        affectedSlotCount: 2,
        dates: ["2026-01-10", "2026-09-18"],
        suggestedCollaboratorId: null,
        suggestedCollaboratorName: null,
        suggestedCollaboratorAvatarUrl: null,
      }}
      collaborators={[{ ...collaborator, department: "Cível" }]}
      selectedId={collaborator.id}
      saving={false}
      onSelect={() => undefined}
      onConfirm={() => undefined}
    />);
    expect(html).toContain("Ex-colaborador");
    expect(html).toContain("Reatribuir próximas");
    expect(html).toContain("3 passadas ficam preservadas");
  });
});
