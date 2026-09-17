import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { buildInstagramExcelWorkbook, serializeInstagramExcelWorkbook } from "./instagram-report-excel";
import type { InstagramReport, PostReportRow } from "./instagram-report";

function postRow(partial: Partial<PostReportRow> = {}): PostReportRow {
  return {
    date: "17/09/2026",
    areas: "Operações Legais",
    authors: "Ana",
    format: "Reels",
    tags: "Newsletter",
    collab: "Não",
    linkStatus: "Vinculado",
    caption: "Post de teste com legenda longa o suficiente para quebrar linha na coluna.",
    reach: 1000,
    views: 2000,
    likes: 80,
    comments: 10,
    shares: 5,
    saves: 20,
    engagementActions: 110,
    engagementRate: 11,
    permalink: "https://www.instagram.com/p/abc",
    ...partial,
  };
}

function report(partial: Partial<InstagramReport> = {}): InstagramReport {
  const top = postRow();
  return {
    generatedAt: "2026-09-17T20:00:00.000Z",
    accountUsername: "bismarchipires",
    followers: 1500,
    periodFrom: "01/09/2026",
    periodTo: "17/09/2026",
    filterDescription: "Setembro 2026",
    totalPosts: 2,
    linkedPosts: 2,
    pendingPosts: 0,
    totalReach: 1500,
    totalViews: 3000,
    totalEngagementActions: 200,
    avgEngagementActions: 100,
    aggregateEngagementRate: 13.33,
    totalLikes: 150,
    totalComments: 20,
    totalSaves: 30,
    topAreaByPosts: "Operações Legais",
    topAreaByEngagement: "Operações Legais",
    topPostCaption: top.caption,
    topPostEngagementActions: top.engagementActions,
    areaRows: [
      {
        area: "Operações Legais",
        posts: 2,
        reach: 1500,
        views: 3000,
        likes: 150,
        comments: 20,
        shares: 8,
        saves: 30,
        engagementActions: 200,
        avgEngagementActions: 100,
        avgReach: 750,
        avgViews: 1500,
        engagementRate: 13.33,
        postsSharePct: 100,
        engagementSharePct: 100,
        topFormat: "Reels",
        collaboratorsWithPosts: 1,
      },
    ],
    collaboratorRows: [
      {
        area: "Operações Legais",
        name: "Ana",
        status: "Ativo",
        posts: 2,
        reach: 1500,
        views: 3000,
        engagementActions: 200,
        avgEngagementActions: 100,
      },
    ],
    formatRows: [
      {
        format: "Reels",
        posts: 2,
        reach: 1500,
        views: 3000,
        engagementActions: 200,
        avgEngagementActions: 100,
        sharePct: 100,
      },
    ],
    topPosts: [top],
    postRows: [top, postRow({ date: "16/09/2026", permalink: "" })],
    narrative: "relatório",
    ...partial,
  };
}

describe("buildInstagramExcelWorkbook", () => {
  it("gera abas formatadas com colunas ajustadas, filtro e números tipados", async () => {
    const wb = buildInstagramExcelWorkbook(report());

    expect(wb.SheetNames).toEqual([
      "Resumo",
      "Por Área",
      "Colaboradores",
      "Por Formato",
      "Top Posts",
      "Posts",
    ]);

    const area = wb.Sheets["Por Área"];
    expect(area["!cols"]?.map((col) => col.wch)).toEqual(
      expect.arrayContaining([24, 10, 13])
    );
    expect(area["!autofilter"]?.ref).toMatch(/^A4:/);
    expect(area.A1?.v).toBe("Desempenho por área");
    expect(area.A4?.v).toBe("Área");
    expect(area.A4?.s?.font?.bold).toBe(true);
    expect(area.B5?.t).toBe("n");
    expect(area.B5?.z).toBe("#,##0");
    expect(area.A7?.v).toBe("Total");
    expect(area.B7?.v).toBe(2);

    const posts = wb.Sheets["Posts"];
    expect(posts.A4?.v).toBe("Data");
    expect(posts.Q5?.v).toBe("Abrir post");
    expect(posts.Q5?.l?.Target).toBe("https://www.instagram.com/p/abc");
    expect(posts.Q6?.v).toBe("—");

    const buffer = await serializeInstagramExcelWorkbook(report());
    const parsed = XLSX.read(buffer, { type: "array" });
    expect(parsed.SheetNames).toEqual(wb.SheetNames);
    expect(parsed.Sheets["Resumo"].A1?.v).toBe("Relatório Instagram Insights");

    const zip = await JSZip.loadAsync(buffer);
    const areaXml = await zip.file("xl/worksheets/sheet2.xml")?.async("string");
    expect(areaXml).toContain("customWidth");
    expect(areaXml).toContain("autoFilter");
    expect(areaXml).toMatch(/state="frozen"/);
    expect(areaXml).toContain('ySplit="4"');
    expect(areaXml).toContain('xSplit="1"');
  });

  it("mantém cabeçalhos e mensagem vazia quando não há linhas", () => {
    const wb = buildInstagramExcelWorkbook(
      report({
        areaRows: [],
        collaboratorRows: [],
        formatRows: [],
        topPosts: [],
        postRows: [],
      })
    );
    expect(wb.Sheets["Por Área"].A5?.v).toBe("Nenhum registro no filtro atual.");
    expect(wb.Sheets["Por Área"].A7).toBeUndefined();
  });
});
