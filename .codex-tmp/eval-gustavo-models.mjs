import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });
const require = createRequire(import.meta.url);
const modulePath = resolve('.codex-tmp/gustavo-model-eval.cjs');
await build({ entryPoints: ['src/lib/gustavo-content/ai.ts'], bundle: true, platform: 'node', packages: 'external', format: 'cjs', outfile: modulePath });
const strategy = {
  id: 'main', updated_by: null, created_at: '', updated_at: '',
  positioning: 'Interpretacao de reestruturacao empresarial para executivos.',
  editorial_promise: 'Explicar a decisao empresarial por tras da noticia.',
  strategic_rationale: 'Clareza para empresas sob pressao de caixa.',
  icp: ['CEOs', 'CFOs', 'socios'], icp_context: 'Empresas com dificuldades de liquidez.',
  content_pillars: [], channel_roles: [], editorial_principles: ['Clareza', 'Sobriedade', 'Fatos verificaveis'],
  avoidances: ['Jargao sem explicacao', 'Promessas de resultado', 'Experiencias inventadas'], success_signals: [],
};
const base = {
  link: null, strategy, theses: [], voice: [], thesisSnapshot: null,
  history: { similarityRisk: 'low', similarItems: [], reason: 'Teste sem historico', varyAngle: false },
  sourceContext: null, reviewFeedback: null,
};
const cases = [
  {
    id: 'opiniao',
    title: 'Cenario ficticio de avaliacao: renegociacao sem corrigir a operacao',
    snippet: 'Empresa ficticia alonga vencimentos, mas segue com deficit operacional.',
    article: 'Cenario inteiramente ficticio para teste. Uma empresa alongou vencimentos da divida e manteve deficit de caixa operacional. A fonte nao informa valores, datas nem resultado da renegociacao.',
    businessProblem: 'O alivio no vencimento nao corrige a geracao de caixa.',
    selectedAngle: { type: 'opinion', title: 'Divida nao e operacao', thesis: 'Renegociar divida nao reestrutura sozinho um negocio deficitario.', whyItMatters: 'Nao confundir tempo comprado com recuperacao.' },
    questions: ['Qual e a leitura principal?'],
    answers: ['Opiniao ficticia fornecida apenas para este teste: renegociar a divida nao e o mesmo que reestruturar o negocio. Eu olharia primeiro para a geracao de caixa operacional. Nao tenho uma experiencia pessoal para citar.'],
    factualOnly: false,
  },
  {
    id: 'factual',
    title: 'Cenario ficticio de avaliacao: venda de ativo para reduzir divida',
    snippet: 'Industria ficticia vende um imovel que nao usa, reduz parte da divida e mantem as linhas de producao.',
    article: 'Cenario ficticio. Uma industria vendeu um imovel ocioso por R$ 80 milhoes, destinados a amortizar parte de uma divida de R$ 240 milhoes. As linhas de producao continuam operando. Nao ha dados sobre margem, fluxo de caixa, juros ou vencimentos. A venda nao equivale a liquidacao de toda a divida.',
    businessProblem: 'Diferenciar reducao da divida de capacidade recorrente de pagamento.',
    selectedAngle: { type: 'strategy', title: 'Venda de ativo e folego financeiro', thesis: 'A venda cria liquidez pontual, mas nao prova capacidade recorrente de pagamento.', whyItMatters: 'Avaliacao de continuidade.' },
    questions: [], answers: null, factualOnly: true,
  },
  {
    id: 'fonte-limitada',
    title: 'Cenario ficticio de avaliacao: empresa negocia com credores',
    snippet: 'A unica informacao disponivel e que uma empresa iniciou negociacoes com credores. Nao ha noticia integral.',
    article: '',
    businessProblem: 'Evitar concluir insolvencia a partir de negociacao isolada.',
    selectedAngle: { type: 'diagnosis', title: 'Negociar nao prova insolvencia', thesis: 'O anuncio isolado nao permite avaliar a gravidade da situacao financeira.', whyItMatters: 'Evitar diagnostico sem evidencia.' },
    questions: [], answers: null, factualOnly: true,
  },
];
const results = [];
let usage = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.ok) {
    const json = await response.clone().json().catch(() => null);
    if (json?.usage) usage = json.usage;
  }
  return response;
};
const out = resolve(process.env.EVAL_OUTPUT || 'outputs/gustavo-audit/model-comparison.json');
await mkdir(resolve('outputs/gustavo-audit'), { recursive: true });
for (const model of (process.env.EVAL_MODELS?.split(',') || ['gpt-4.1-mini', 'gpt-5.6-terra', 'gpt-5.6-sol'])) {
  process.env.GUSTAVO_CONTENT_MODEL_WRITING = model;
  delete require.cache[modulePath];
  const { generateEditorialContent } = require(modulePath);
  for (const fixture of cases) {
    if (process.env.EVAL_CASE && fixture.id !== process.env.EVAL_CASE) continue;
    const started = Date.now();
    usage = null;
    let result;
    try {
      const draft = await generateEditorialContent({ ...base, ...fixture });
      result = { model, case: fixture.id, elapsedMs: Date.now() - started, usage, draft };
    } catch (error) {
      result = { model, case: fixture.id, elapsedMs: Date.now() - started, error: { name: error.name, status: error.statusCode, finishReason: error.finishReason } };
    }
    results.push(result);
    await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Avaliacao exploratoria com tres pautas sinteticas; sem escrita no banco.', results }, null, 2));
    console.log(JSON.stringify({ model, case: fixture.id, seconds: result.elapsedMs / 1000, error: result.error ?? null, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens, characters: result.draft?.linkedinPost.length }));
  }
}
console.log('Resultados: ' + out);
