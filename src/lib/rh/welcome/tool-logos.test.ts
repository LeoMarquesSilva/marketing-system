import { describe, expect, it } from "vitest";
import { toolLogoFor } from "./tool-logos";

describe("toolLogoFor", () => {
  it("reconhece cada sistema dos links de boas-vindas", () => {
    expect(toolLogoFor("https://bp.vios.com.br/?pag=sys/agenda/calendario.php")?.src).toBe("/rh/boas-vindas/logos/vios.png");
    expect(toolLogoFor("https://www.responsum.com.br/tickets")?.name).toBe("Responsum");
    expect(toolLogoFor("https://app.feedz.com.br/perfil")?.name).toBe("Feedz");
    expect(toolLogoFor("https://quoti.cloud/bismarchipires/app/solicitacoeslist")?.name).toBe("Legis");
    expect(toolLogoFor("https://planner.cloud.microsoft/webui/plan/x/view/board")?.name).toBe("Microsoft Planner");
  });

  it("planilha compartilhada do SharePoint mostra o Excel; site e lista mostram o SharePoint", () => {
    expect(toolLogoFor("https://bpplaw2.sharepoint.com/:x:/s/Controladoria/IQCHo?e=e6")?.name).toBe("Microsoft Excel");
    expect(toolLogoFor("https://bpplaw2-my.sharepoint.com/:x:/g/personal/x/IQAk?e=iO")?.name).toBe("Microsoft Excel");
    expect(toolLogoFor("https://bpplaw2.sharepoint.com/sites/BISMARCHIPIRES")?.name).toBe("SharePoint");
    expect(toolLogoFor("https://bpplaw2.sharepoint.com/sites/X/Lists/CONTROLE/PAINEL.aspx")?.name).toBe("SharePoint");
  });

  it("não confunde domínio parecido e devolve nulo para o que não conhece", () => {
    expect(toolLogoFor("https://naovios.com.br")).toBeNull();
    expect(toolLogoFor("https://exemplo.com")).toBeNull();
    expect(toolLogoFor("endereço inválido")).toBeNull();
  });
});
