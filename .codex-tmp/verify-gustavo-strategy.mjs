import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/Leonardo Marques/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const bundle = await build({
  stdin: {
    contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { StrategyPresentation } from "@/components/gustavo-content/strategy-presentation";

      const strategy = {
        id: "main",
        positioning: "Ser reconhecido como uma fonte confiável de interpretação sobre empresas em crise, reestruturação, dívida e preservação de valor.",
        editorial_promise: "Gustavo não comenta simplesmente recuperações judiciais. Ele interpreta o que crises e reestruturações revelam sobre empresas.",
        strategic_rationale: "Notícia o mercado já recebe todos os dias. Explicação jurídica também. O espaço que queremos ocupar está na interpretação: conectar fatos a decisões, sinais, riscos e consequências para quem administra empresas e capital.",
        icp: ["Empresários e sócios", "CEOs e CFOs", "Conselheiros e investidores"],
        icp_context: "Decisores de empresas relevantes, prioritariamente com faturamento a partir de aproximadamente R$ 5 milhões, que enfrentam ou querem antecipar questões de liquidez, dívida, governança e continuidade.",
        content_pillars: [
          { title: "Crise antes do processo", description: "Ler os sinais empresariais que aparecem antes da medida jurídica.", reason: "Autoridade nasce ao ajudar o decisor a reconhecer o problema cedo, quando ainda existem mais opções." },
          { title: "Decisões sob pressão", description: "Explicar trade-offs de caixa, dívida, credores, ativos e governança.", reason: "O ICP se identifica com escolhas reais, não com aulas abstratas sobre procedimentos." },
          { title: "Preservação de valor", description: "Mostrar quando tempo, negociação e instrumentos protegem ou destroem valor.", reason: "Conecta a especialidade jurídica ao resultado empresarial sem fazer promessa comercial." },
          { title: "Leitura de mercado", description: "Interpretar grandes casos, movimentos empresariais e decisões que ajudam a entender para onde o mercado está indo.", reason: "Casos conhecidos funcionam como ponto de partida para discutir decisões que também aparecem, em outra escala, nas empresas do nosso ICP." },
        ],
        channel_roles: [
          { channel: "LinkedIn", role: "Análises mais completas, posicionamentos, teses e contexto executivo.", reason: "É o principal ambiente para alcançar decisores e sustentar raciocínios com maior profundidade." },
          { channel: "Instagram Reels", role: "Explicações diretas e humanas que fazem o público conhecer o rosto, a voz e a forma de pensar do Gustavo.", reason: "Amplia familiaridade e alcance sem transformar Gustavo em um influenciador jurídico genérico." },
        ],
        editorial_principles: [
          "A notícia é matéria-prima, não o conteúdo final",
          "O jurídico sustenta a análise, mas não precisa ser sempre o centro",
          "Opinião só entra quando estiver registrada ou validada pelo Gustavo",
          "Todo conteúdo deve entregar uma implicação para quem decide",
          "Clareza e consistência valem mais do que volume e viralização",
        ],
        avoidances: ["Resumo de notícia", "Juridiquês sem consequência empresarial", "CTA comercial ou promessa de resultado", "Tom professoral, sensacionalista ou de copywriter", "Opinião inventada pela IA"],
        success_signals: [
          "Gustavo passa a ser espontaneamente associado ao tema de reestruturação empresarial.",
          "Empresários e decisores passam a acompanhar, salvar, compartilhar e discutir suas análises.",
          "O conteúdo abre espaço para conversas, eventos, conexões e oportunidades qualificadas.",
          "Com o tempo, essa autoridade contribui para geração de demanda qualificada para o escritório.",
        ],
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-09T00:00:00Z",
      };
      const pulse = { linkedinThisWeek: 0, reelsThisWeek: 0, validatedTheses: 0, pendingTheses: 0, voiceSamples: 0, waitingGustavo: 16 };
      createRoot(document.getElementById("root")).render(
        <StrategyPresentation strategy={strategy} theses={[]} pulse={pulse} missingPillars={strategy.content_pillars.map((pillar) => pillar.title)} />
      );
    `,
    loader: "tsx",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
});

const cssDir = resolve(".next/static/css");
let css = "";
for (const file of await readdir(cssDir)) {
  if (file.endsWith(".css")) css += await readFile(join(cssDir, file), "utf8");
}

const server = createServer((req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
    return;
  }
  if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="editorial-surface"><main id="root" style="max-width:1380px;margin:auto;padding:24px"></main><script src="/bundle.js"></script></body></html>');
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const outputDir = resolve("outputs/gustavo-strategy-audit");
await mkdir(outputDir, { recursive: true });

try {
  const viewports = [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "notebook", width: 1024, height: 768 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.getByRole("heading", { name: "O resultado não é publicar mais" }).waitFor();

    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(outputDir, `${viewport.name}.png`), fullPage: true });

    if (viewport.name === "desktop") {
      const expectedIds = ["norte", "porque", "icp", "metodo", "pilares", "canais", "gustavo", "regras", "sucesso", "pulso"];
      const actualIds = await page.locator(expectedIds.map((id) => `#${id}`).join(",")).evaluateAll((nodes) => nodes.map((node) => node.id));
      assert.deepEqual(actualIds, expectedIds);
      const anchorHrefs = await page.getByRole("navigation", { name: "Capítulos da estratégia" }).locator("a").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
      assert.deepEqual(anchorHrefs, expectedIds.map((id) => `#${id}`));
      const body = await page.locator("body").innerText();
      for (const removed of ["Score do radar", "Aguardando o Gustavo", "A dor empresarial", "A opinião do Gustavo", "Teses e contrapontos"]) assert.equal(body.includes(removed), false);
      for (const required of ["Leitura de mercado", "Construir autoridade", "Construir familiaridade", "A IA pode pesquisar, organizar e escrever. Ela não pode decidir o que o Gustavo pensa.", "Pautas que precisam da sua visão"]) assert.equal(body.includes(required), true);
    }

    await page.close();
  }

  console.log("PASS: narrativa, 10 anchors, copies novas, runtime e responsividade em 1440/1024/768/390.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
