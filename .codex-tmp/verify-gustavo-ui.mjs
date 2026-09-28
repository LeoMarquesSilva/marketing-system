import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Leonardo Marques/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ItemWorkspace} from '@/components/gustavo-content/item-workspace'; import {ProductionBoard} from '@/components/gustavo-content/production-board'; createRoot(document.getElementById('root')).render(location.pathname === '/queue' ? <ProductionBoard /> : <ItemWorkspace itemId="fixture" isAdmin={true} isOwner={true} />);`,
    loader: 'tsx', resolveDir: process.cwd(),
  },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' },
});
const cssDir = resolve('.next/static/css');
let css = '';
for (const file of await readdir(cssDir)) if (file.endsWith('.css')) css += await readFile(join(cssDir, file), 'utf8');
const server = createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
  else if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root" style="max-width:1360px;margin:auto;padding:20px"></main><script src="/bundle.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', err => errors.push(err.message));
const angle = { type: 'diagnosis', title: 'Caixa antes da renegociacao', thesis: 'Alongar a divida nao corrige o caixa operacional.', whyItMatters: 'Preservar continuidade.' };
const base = {
  id: 'fixture', title: 'Pauta ficticia para validacao da interface', source: 'manual_idea',
  status: 'sugestao', selected_angle: angle, angles: [angle], opinion_status: 'needs_gustavo',
  gustavo_questions: [], gustavo_answers: null, content_snippet: 'Empresa ficticia precisa corrigir o caixa operacional.',
  linkedin_post: null, reel_script: null, source_context: null, editorial_score: 78,
};
let row = { ...base };
let failGeneration = false;
let failLoad = false;
const calls = [];
await page.route('**/api/gustavo-content/items/fixture', async route => {
  if (failLoad) return route.abort();
  if (route.request().method() === 'PATCH') {
    const body = route.request().postDataJSON();
    calls.push(body.action);
    if (body.action === 'answer') row = { ...row, gustavo_answers: body.answers, opinion_status: 'validated' };
    if (body.action === 'generate') {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (failGeneration) return route.fulfill({ status: 502, json: { error: 'Falha de geracao simulada' } });
      row = { ...row, status: 'rascunho', linkedin_post: 'Gancho novo\n\nCorpo preservado.', alternative_hooks: ['Gancho alternativo'], reel_script: JSON.stringify({ hook: 'Caixa', talkingPoints: ['Ponto'], duration: '60s', closing: 'Fecho', recordingNote: 'Natural' }) };
      row.source_context = { ...row.source_context, draftStale: false };
    }
    if (body.action === 'save') row = { ...row, status: 'rascunho', linkedin_post: body.linkedin_post, reel_script: body.reel_script };
  }
  await route.fulfill({ status: 200, json: row });
});
const post = () => page.getByPlaceholder('O post textual aparece aqui depois da geração.');
async function open(overrides = {}) {
  row = { ...base, ...overrides };
  calls.length = 0;
  await page.goto(url);
  await page.getByRole('heading', { name: base.title }).waitFor();
}

try {
  await open();
  await page.getByLabel('Visão do Gustavo', { exact: true }).fill('Preservar caixa antes de renegociar.');
  failGeneration = true;
  await page.getByRole('button', { name: 'Adicionar minha visão e gerar' }).click();
  await page.getByText('Falha de geracao simulada').waitFor();
  assert.deepEqual(row.gustavo_answers, ['Preservar caixa antes de renegociar.']);
  failGeneration = false;
  await page.getByRole('button', { name: 'Tentar gerar de novo' }).click();
  await page.getByRole('button', { name: 'Revisar e enviar' }).waitFor();
  assert.equal(calls.filter(action => action === 'answer').length, 1);

  await post().fill('Minha edicao local\n\nCorpo preservado.');
  assert.equal(await page.getByRole('button', { name: 'Gerar nova versão' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Gancho alternativo', exact: true }).click();
  assert.equal(await post().inputValue(), 'Gancho alternativo\n\nCorpo preservado.');
  await page.getByRole('button', { name: 'Desfazer aplicação do gancho' }).click();
  assert.equal(await post().inputValue(), 'Minha edicao local\n\nCorpo preservado.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await page.getByRole('button', { name: 'Revisar e enviar' }).waitFor();
  assert.equal(row.linkedin_post, 'Minha edicao local\n\nCorpo preservado.');

  await open({ status: 'aprovado', linkedin_post: 'Texto aprovado' });
  assert.equal(await post().getAttribute('readonly'), '');
  assert.equal(await page.getByRole('button', { name: 'Gerar análise factual' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Caixa antes da renegociacao', exact: false }).isDisabled(), true);

  await open({ status: 'rejeitado', linkedin_post: 'Texto rejeitado' });
  await page.getByRole('button', { name: 'Gerar nova versão' }).click();
  await page.getByRole('button', { name: 'Revisar e enviar' }).waitFor();

  await open();
  const factual = page.getByRole('button', { name: 'Gerar análise factual' });
  await factual.evaluate(el => { el.click(); el.click(); });
  await page.getByRole('button', { name: 'Revisar e enviar' }).waitFor();
  assert.equal(calls.filter(action => action === 'generate').length, 1);
  await post().fill('Edicao nao salva');
  assert.equal(await page.getByRole('button', { name: 'Gerar análise factual' }).isDisabled(), true);

  await mkdir(resolve('outputs/gustavo-audit'), { recursive: true });
  await open({ status: 'rascunho', linkedin_post: 'Texto da leitura anterior', source_context: { draftStale: true } });
  await page.getByRole('alert').filter({ hasText: 'Texto gerado com outra leitura' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Revisar e enviar' }).count(), 0);
  await page.getByRole('button', { name: 'Atualizar texto', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar e enviar' }).waitFor();
  const editorBox = await post().boundingBox();
  const angleBox = await page.getByRole('button', { name: 'Caixa antes da renegociacao', exact: false }).boundingBox();
  assert.ok(editorBox.y < angleBox.y, 'editor deve aparecer antes da escolha editorial');
  await page.screenshot({ path: resolve('outputs/gustavo-audit/desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve('outputs/gustavo-audit/mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

  await page.route('**/api/gustavo-content/items?view=producao', route => route.fulfill({ json: [
    { ...base, id: 'choose', selected_angle: null, updated_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'answer', updated_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'edit', status: 'rejeitado', linkedin_post: 'Texto', updated_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'approve', status: 'aguardando_aprovacao', updated_at: '2026-09-01T00:00:00Z' },
    { ...base, id: 'publish', status: 'enviado_mkt', updated_at: '2026-09-01T00:00:00Z' },
  ] }));
  await page.goto(url + '/queue');
  await page.getByRole('heading', { name: 'Fila editorial' }).waitFor();
  for (const label of ['Escolher leitura', 'Responder opinião', 'Editar conteúdo', 'Aprovar conteúdo', 'Acompanhar publicação']) {
    await page.getByRole('heading', { name: label + ' · 1', exact: true }).waitFor();
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: resolve('outputs/gustavo-audit/queue-mobile.png'), fullPage: true });

  failLoad = true;
  await page.goto(url);
  await page.getByText('Não foi possível conectar para abrir a pauta. Tente novamente.').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: falha/retry, respostas preservadas, edicao/gancho/desfazer, aprovacao protegida, rejeicao corrigivel, clique duplo, mobile sem overflow e erro de rede.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
