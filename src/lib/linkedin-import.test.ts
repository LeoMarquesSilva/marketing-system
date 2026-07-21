import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseLinkedinWorkbook } from "@/lib/linkedin-import";

describe("LinkedIn workbook parser", () => {
  it("parses the legacy LinkedIn BIFF export", () => {
    const excelDate =
      (Date.UTC(2026, 6, 10) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const metrics = [
      ["Relatório agregado"],
      [
        "Data", "Impressões (orgânicas)", "Impressões (patrocinadas)", "Impressões (total)",
        "Impressões únicas (orgânicas)", "Cliques (orgânicos)", "Cliques (patrocinados)",
        "Cliques (total)", "Reações (orgânicas)", "Reações (patrocinadas)", "Reações (total)",
        "Comentários (orgânicos)", "Comentários (patrocinados)", "Comentários (total)",
        "Compartilhamentos (orgânicos)", "Compartilhamentos (patrocinados)", "Compartilhamentos (total)",
        "Taxa de engajamento (orgânico)", "Taxa de engajamento (patrocinado)", "Taxa de engajamento (total)",
      ],
      [excelDate, 100, 0, 100, 70, 10, 0, 10, 5, 0, 5, 1, 0, 1, 1, 0, 1, 0.17, 0, 0.17],
    ];
    const posts = [
      ["Relatório por publicação"],
      [
        "Título da publicação", "Link da publicação", "Tipo de publicação", "Nome da campanha",
        "Publicada por", "Criação", "Data de início da campanha", "Data de término da campanha", "Público",
        "Impressões", "Visualizações", "Visualizações fora do site", "Cliques", "Taxa de cliques (CTR)",
        "Gostaram", "Comentários", "Compartilhamentos", "Seguidores", "Taxa de engajamento", "Tipo de conteúdo",
      ],
      [
        "Planejamento societário.\n\nPor: Dra. Ana", "https://www.linkedin.com/feed/update/urn:li:activity:12345",
        "Orgânico", "", "Leonardo", excelDate, "", "", "Todos os seguidores",
        100, 20, 0, 10, 0.1, 5, 1, 1, 0, 0.17, "Vídeo",
      ],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metrics), "Métricas");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(posts), "Todas as publicações");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });

    const parsed = parseLinkedinWorkbook(buffer);
    expect(parsed.dailyMetrics).toHaveLength(1);
    expect(parsed.dailyMetrics[0]).toMatchObject({ metric_date: "2026-07-10", total_impressions: 100 });
    expect(parsed.posts).toHaveLength(1);
    expect(parsed.posts[0]).toMatchObject({ linkedin_urn: "12345", byline: "Dra. Ana", content_type: "Vídeo" });
  });
});
