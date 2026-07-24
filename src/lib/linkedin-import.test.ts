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

  it("recognizes followers and preserves negative daily movement", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Data", "Seguidores patrocinados", "Seguidores orgânicos", "Seguidores convidados automaticamente", "Total de seguidores"],
        ["07/20/2026", 0, -1, 0, -1],
        ["07/21/2026", 0, 4, 1, 5],
      ]),
      "Novos seguidores"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Localidade", "Total de seguidores"], ["Campinas, Brasil", 100]]),
      "Localidade"
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });

    const parsed = parseLinkedinWorkbook(buffer);
    expect(parsed.reportType).toBe("followers");
    expect(parsed.followerDailyMetrics).toHaveLength(2);
    expect(parsed.followerDailyMetrics[0].total_followers).toBe(-1);
    expect(parsed.demographics[0]).toMatchObject({ dimension: "location", metric_value: 100 });
  });

  it("recognizes visitor totals and demographic dimensions", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Data", "Total de visualizações da página (computadores)", "Total de visualizações da página (dispositivos móveis)", "Total de visualizações da página (total)", "Total de visitantes únicos (computadores)", "Total de visitantes únicos (dispositivos móveis)", "Total de visitantes únicos (total)"],
        ["07/20/2026", 5, 10, 15, 3, 7, 10],
      ]),
      "Métricas de visitantes"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Setor", "Total de visualizações"], ["Serviços advocatícios", 80]]),
      "Setor"
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "biff8" });

    const parsed = parseLinkedinWorkbook(buffer);
    expect(parsed.reportType).toBe("visitors");
    expect(parsed.visitorDailyMetrics[0]).toMatchObject({
      total_views_total: 15,
      total_unique_total: 10,
    });
    expect(parsed.demographics[0]).toMatchObject({ dimension: "industry", metric_value: 80 });
  });

  it("recognizes competitor benchmarks and their reporting period", () => {
    const fromDate = (Date.UTC(2025, 6, 20) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const toDate = (Date.UTC(2026, 6, 19) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        [fromDate, toDate],
        ["Page", "Novos seguidores", "Publicações", "Comentários", "Comentários por dia", "Reações"],
        ["Bismarchi | Pires Sociedade de Advogados", 765, 145, 115, 0, 2989],
        ["Concorrente Exemplo", 1200, 80, 60, 0, 3500],
      ]),
      "COMPETITORS"
    );
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const parsed = parseLinkedinWorkbook(buffer);
    expect(parsed.reportType).toBe("competitors");
    expect(parsed.dateFrom).toBe("2025-07-20");
    expect(parsed.dateTo).toBe("2026-07-19");
    expect(parsed.competitors).toHaveLength(2);
    expect(parsed.competitors[0]).toMatchObject({
      page_name: "Bismarchi | Pires Sociedade de Advogados",
      new_followers: 765,
      publications: 145,
      reactions: 2989,
    });
  });
});
