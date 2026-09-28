"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/gustavo-content/ai.ts
var ai_exports = {};
__export(ai_exports, {
  analyzeCompliance: () => analyzeCompliance,
  analyzeScore: () => analyzeScore,
  generateAngles: () => generateAngles,
  generateEditorialContent: () => generateEditorialContent,
  reviewEditorialContent: () => reviewEditorialContent
});
module.exports = __toCommonJS(ai_exports);
var import_ai = require("ai");
var import_openai = require("@ai-sdk/openai");

// src/lib/gustavo-content/constants.ts
var GUSTAVO_CONTENT_MODEL = process.env.GUSTAVO_CONTENT_MODEL ?? "gpt-4.1-mini";
var GUSTAVO_CONTENT_MODEL_SCORE = process.env.GUSTAVO_CONTENT_MODEL_SCORE ?? GUSTAVO_CONTENT_MODEL;
var GUSTAVO_CONTENT_MODEL_WRITING = process.env.GUSTAVO_CONTENT_MODEL_WRITING ?? process.env.GUSTAVO_CONTENT_MODEL ?? "gpt-5.6-sol";
var GUSTAVO_CONTENT_MODEL_REVIEW = process.env.GUSTAVO_CONTENT_MODEL_REVIEW ?? GUSTAVO_CONTENT_MODEL;
var SCORE_MAX = {
  icpRelevance: 25,
  thesisPotential: 20,
  businessImpact: 15,
  thesisFit: 10,
  freshness: 10,
  differentiation: 10,
  sourceQuality: 10
};
var GUSTAVO_PLANNER_ASSIGNEE_NAME = process.env.GUSTAVO_PLANNER_ASSIGNEE_NAME?.trim() || null;

// src/lib/gustavo-content/errors.ts
var GustavoContentError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "GustavoContentError";
  }
};

// src/lib/gustavo-content/prompts.ts
var GUSTAVO_EDITOR_SYSTEM = `Voc\xEA \xE9 o editor estrat\xE9gico do posicionamento de Gustavo Bismarchi em reestrutura\xE7\xE3o empresarial.

MISS\xC3O
Transformar fatos p\xFAblicos, not\xEDcias, dados, acontecimentos empresariais e teses em conte\xFAdo de thought leadership voltado a empres\xE1rios, s\xF3cios, CEOs, CFOs, conselheiros e decisores de empresas relevantes.

POSICIONAMENTO
Gustavo Bismarchi deve ser percebido como uma fonte confi\xE1vel de interpreta\xE7\xE3o sobre empresas em crise.
Ele n\xE3o \xE9 um perfil de not\xEDcias jur\xEDdicas.
Ele analisa: crise empresarial, liquidez, d\xEDvida, credores, negocia\xE7\xE3o, governan\xE7a, recupera\xE7\xE3o judicial, recupera\xE7\xE3o extrajudicial, distressed assets, preserva\xE7\xE3o de valor e continuidade empresarial.

REGRA CENTRAL
A not\xEDcia \xE9 somente o gatilho.
Nunca produza um conte\xFAdo cujo principal valor seja resumir uma mat\xE9ria.
Procure a decis\xE3o, o sinal, a tens\xE3o, o erro, o trade-off, a consequ\xEAncia, a tese ou a li\xE7\xE3o empresarial por tr\xE1s do fato.

AUDI\xCANCIA
Escreva prioritariamente para empres\xE1rios, CEOs, CFOs, s\xF3cios, conselheiros, investidores e executivos.
N\xE3o escreva prioritariamente para outros advogados.
O conhecimento jur\xEDdico deve aparecer quando necess\xE1rio para sustentar a an\xE1lise.

VOZ
S\xF3bria, executiva, segura, t\xE9cnica, natural, did\xE1tica, direta.
Evite sensacionalismo, juridiqu\xEAs desnecess\xE1rio, tom professoral, copywriting agressivo e frases gen\xE9ricas de intelig\xEAncia artificial.

AUTORIA
Nunca invente uma opini\xE3o de Gustavo.
Utilize somente teses com status validated na BIBLIOTECA_DE_TESES ou respostas fornecidas diretamente por ele. Teses pendentes n\xE3o s\xE3o opini\xF5es aprovadas.
Se for necess\xE1rio um posicionamento que ainda n\xE3o existe: N\xC3O ESCREVA COMO SE SOUBESSE. Marque que falta valida\xE7\xE3o e formule no m\xE1ximo 3 perguntas objetivas.

VOZ HIST\xD3RICA
Use os textos reais em VOZ_HISTORICA_GUSTAVO para entender estilo.
N\xE3o copie frases de maneira mec\xE2nica.
N\xE3o transforme Gustavo em uma caricatura de seus posts anteriores.

HIST\xD3RICO
Considere HISTORICO_EDITORIAL_GUSTAVO.
Evite repetir a mesma tese, o mesmo gancho, a mesma empresa pelo mesmo \xE2ngulo ou a mesma estrutura.
Se o risco de similaridade for alto, varie a abertura e a estrutura, preservando o \xE2ngulo escolhido pelo usu\xE1rio.

LINKEDIN
Priorize tese, contexto breve, interpreta\xE7\xE3o, consequ\xEAncia empresarial e conclus\xE3o.
N\xE3o iniciar com "Voc\xEA sabia?", "Em um cen\xE1rio...", "No mundo atual...".
N\xE3o utilizar CTA comercial. N\xE3o terminar todo texto em pergunta. N\xE3o utilizar emojis por padr\xE3o.
Hashtags: 0 a 3, s\xF3 se fizer sentido, sempre inteiramente em letras min\xFAsculas, inclusive nomes e siglas. Nunca use iniciais mai\xFAsculas nem CamelCase nas hashtags.

INSTAGRAM REEL
Escrever para fala. 45 a 75 segundos. Um assunto por v\xEDdeo.
Entregar gancho + pontos de fala + fecho. N\xE3o criar um texto para decorar.

OAB
Conte\xFAdo informativo, discreto e s\xF3brio.
N\xE3o: prometer resultado; divulgar honor\xE1rios; oferecer desconto; comparar-se a concorrentes; induzir contrata\xE7\xE3o; expor caso ou resultado de cliente; autoengrandecimento; transformar conte\xFAdo em consulta individual.

FATOS
Separe FATOS DA FONTE de INTERPRETA\xC7\xC3O DO GUSTAVO.
Nunca transforme interpreta\xE7\xE3o em fato.
Use n\xFAmeros, datas e nomes somente quando estiverem presentes na mat\xE9ria ou em FATOS_DA_FONTE.
N\xE3o apresente saldos, percentuais ou resultados calculados como n\xFAmeros confirmados pela fonte. Uma venda destinada \xE0 amortiza\xE7\xE3o n\xE3o comprova o saldo final da d\xEDvida: podem existir custos, juros e outras movimenta\xE7\xF5es n\xE3o informadas. Prefira descrever a redu\xE7\xE3o parcial sem calcular um saldo n\xE3o publicado.
Se a evid\xEAncia for insuficiente, escreva de forma prudente e n\xE3o complete lacunas por plausibilidade.`;
var SCORE_INSTRUCTIONS = `Analise a pauta para thought leadership de reestrutura\xE7\xE3o empresarial.

O radar N\xC3O \xE9 restrito a not\xEDcia jur\xEDdica. Not\xEDcia econ\xF4mica, financeira, de cr\xE9dito, M&A, d\xEDvida, gest\xE3o ou governan\xE7a pode ser relevante se houver rela\xE7\xE3o clara com reestrutura\xE7\xE3o (venda de ativos, renegocia\xE7\xE3o, waiver, troca de controle, falta de capital, default, downgrade, financiamento).

Problema empresarial: N\xC3O resuma o fato jur\xEDdico. Diga o problema de neg\xF3cio por tr\xE1s.

Score 0\u2013100, crit\xE9rios com teto:
- icpRelevance 25
- thesisPotential 20
- businessImpact 15
- thesisFit 10
- freshness 10
- differentiation 10
- sourceQuality 10

shouldPersist \xE9 decis\xE3o do sistema a partir do total. Voc\xEA s\xF3 pontua.`;
var ANGLES_INSTRUCTIONS = `Gere exatamente 3 \xE2ngulos:
1. diagnosis \u2014 o que esta not\xEDcia revela
2. strategy \u2014 que decis\xE3o empresarial est\xE1 por tr\xE1s
3. opinion \u2014 qual leitura menos \xF3bvia pode ser feita

Depois compare com as teses ativas.
N\xC3O invente opini\xE3o do Gustavo.
Se houver tese validada aderente, devolva o thesisId dela.
Se n\xE3o houver tese suficiente, confidence = none e at\xE9 3 perguntas objetivas para o Gustavo.`;
var EDITORIAL_BRIEF_INSTRUCTIONS = `Antes de escrever qualquer texto, monte um resumo editorial enxuto (editorialBrief):
1. centralThesis: o argumento \xFAnico que o post inteiro vai sustentar. Baseie-se nas respostas do Gustavo ou em tese aprovada; na aus\xEAncia delas, uma conclus\xE3o factual, sem atribuir a ele uma opini\xE3o pessoal.
2. icp: para qual tipo de decisor este conte\xFAdo \xE9 \xFAtil.
3. businessDecision: qual decis\xE3o empresarial est\xE1 em jogo.
4. supportingFacts: 2 a 3 fatos de apoio, distinguindo fonte de interpreta\xE7\xE3o.
5. practicalConsequence: o que o leitor deve entender na pr\xE1tica.
6. limits: afirma\xE7\xF5es que N\xC3O podem ser feitas com os dados dispon\xEDveis.

Depois, avalie angleAlignment: o \xE2ngulo escolhido pelo usu\xE1rio \xE9 compat\xEDvel com a opini\xE3o/tese dispon\xEDvel?
Se n\xE3o for, aligned=false e explique a diverg\xEAncia em note \u2014 nunca troque o \xE2ngulo escolhido silenciosamente.

Todo o texto gerado (LinkedIn e Reel) deve sustentar exclusivamente essa tese central. Cada par\xE1grafo contribui para ela.`;
var LINKEDIN_CONTENT_INSTRUCTIONS = `Gere o LinkedIn como objeto estruturado (linkedin: hook, body, closing, hashtags), nunca como bloco \xFAnico de texto.
hook: abertura concreta com tens\xE3o, consequ\xEAncia ou contraste relevante para o ICP \u2014 nunca gen\xE9rica, nunca sensacionalista, nunca uma promessa.
body: um argumento por par\xE1grafo, par\xE1grafos curtos, sustentando a centralThesis do brief.
closing: fechamento que refor\xE7a a implica\xE7\xE3o pr\xE1tica, sem CTA comercial e sem terminar em pergunta autom\xE1tica.
hashtags: 0 a 3, s\xF3 se fizer sentido, sempre inteiramente em letras min\xFAsculas. Exemplo: #recupera\xE7\xE3ojudicial, nunca #Recupera\xE7\xE3oJudicial.
alternativeHooks: exatamente 3 aberturas distintas entre si, todas alinhadas \xE0 mesma centralThesis \u2014 nunca pequenas reformula\xE7\xF5es do t\xEDtulo da not\xEDcia.
N\xE3o use "Voc\xEA sabia?", "Em um cen\xE1rio...", "No mundo atual...". N\xE3o use emoji por padr\xE3o.
Se ainda faltar opini\xE3o validada (modo factual), escreva como leitura anal\xEDtica, nunca em primeira pessoa fingindo ser a opini\xE3o do Gustavo.
Se o hist\xF3rico pediu varia\xE7\xE3o, varie gancho/estrutura/exemplos \u2014 mantendo o mesmo \xE2ngulo e a mesma tese central j\xE1 escolhidos.`;
var REEL_CONTENT_INSTRUCTIONS = `Gere o roteiro de Reel em bullets de fala (reel: duration, hook, talkingPoints, closing, recordingNote), sustentando a mesma centralThesis do LinkedIn.
45 a 75 segundos, um assunto por v\xEDdeo. N\xE3o escreva um texto para decorar.`;
var CONTENT_INSTRUCTIONS = `${LINKEDIN_CONTENT_INSTRUCTIONS}

${REEL_CONTENT_INSTRUCTIONS}`;
var EDITORIAL_REVIEW_INSTRUCTIONS = `Revise o post de LinkedIn gerado, de forma independente do compliance OAB.
Avalie: existe gancho concreto (n\xE3o gen\xE9rico)? O texto tem par\xE1grafos, n\xE3o um bloco \xFAnico? \xC9 claro, coerente e espec\xEDfico?
Cada par\xE1grafo sustenta a tese central informada, sem se perder em assuntos paralelos? A linguagem evita frases gen\xE9ricas de IA?
N\xE3o avalie fatos novos nem opini\xE3o \u2014 isso j\xE1 foi definido antes. Avalie s\xF3 reda\xE7\xE3o e estrutura.
passesReview=false quando houver falha real de gancho, estrutura ou clareza. Liste os problemas em issues, de forma objetiva e acion\xE1vel.`;
var COMPLIANCE_INSTRUCTIONS = `Avalie o texto gerado contra as regras da OAB para conte\xFAdo institucional.
Flags graves: promise_of_result, commercial_cta, client_case, confidentiality, individual_legal_advice.
N\xE3o marque grave por observa\xE7\xE3o leve.`;

// src/lib/gustavo-content/schemas.ts
var import_zod = require("zod");

// src/lib/gustavo-content/compliance.ts
var COMPLIANCE_FLAGS = [
  "commercial_cta",
  "promise_of_result",
  "self_aggrandizement",
  "comparison",
  "client_case",
  "confidentiality",
  "individual_legal_advice",
  "sensationalism",
  "unverified_claim",
  "other"
];
var SEVERE_COMPLIANCE_FLAGS = [
  "promise_of_result",
  "commercial_cta",
  "client_case",
  "confidentiality",
  "individual_legal_advice"
];
function normalizeCompliance(raw) {
  const flags = (Array.isArray(raw.flags) ? raw.flags : []).map((flag) => String(flag)).filter(
    (flag) => COMPLIANCE_FLAGS.includes(flag)
  );
  const severe = flags.some((flag) => SEVERE_COMPLIANCE_FLAGS.includes(flag));
  return {
    safe: raw.safe !== false && !severe,
    flags,
    requiresHumanReview: Boolean(raw.requiresHumanReview) || flags.length > 0
  };
}

// src/lib/gustavo-content/schemas.ts
var scoreObjectSchema = import_zod.z.object({
  breakdown: import_zod.z.object({
    icpRelevance: import_zod.z.number(),
    thesisPotential: import_zod.z.number(),
    businessImpact: import_zod.z.number(),
    thesisFit: import_zod.z.number(),
    freshness: import_zod.z.number(),
    differentiation: import_zod.z.number(),
    sourceQuality: import_zod.z.number()
  }),
  reason: import_zod.z.string(),
  businessProblem: import_zod.z.string(),
  sourceContext: import_zod.z.object({
    facts: import_zod.z.array(import_zod.z.string()),
    numbers: import_zod.z.array(import_zod.z.string()),
    companies: import_zod.z.array(import_zod.z.string()),
    dates: import_zod.z.array(import_zod.z.string()),
    sourceUrls: import_zod.z.array(import_zod.z.string())
  }),
  recommendedChannels: import_zod.z.object({
    linkedin: import_zod.z.object({
      recommended: import_zod.z.boolean(),
      reason: import_zod.z.string()
    }),
    instagramReel: import_zod.z.object({
      recommended: import_zod.z.boolean(),
      reason: import_zod.z.string()
    })
  })
});
var anglesObjectSchema = import_zod.z.object({
  angles: import_zod.z.array(
    import_zod.z.object({
      type: import_zod.z.enum(["diagnosis", "strategy", "opinion"]),
      title: import_zod.z.string(),
      thesis: import_zod.z.string(),
      whyItMatters: import_zod.z.string()
    })
  ).min(3).max(3),
  thesisMatch: import_zod.z.object({
    thesisId: import_zod.z.string().nullable(),
    confidence: import_zod.z.enum(["high", "medium", "low", "none"]),
    reason: import_zod.z.string()
  }),
  questions: import_zod.z.array(import_zod.z.string()).max(3)
});
var contentObjectSchema = import_zod.z.object({
  editorialBrief: import_zod.z.object({
    centralThesis: import_zod.z.string().trim().min(1),
    icp: import_zod.z.string(),
    businessDecision: import_zod.z.string(),
    supportingFacts: import_zod.z.array(import_zod.z.string()).max(3),
    practicalConsequence: import_zod.z.string(),
    // OpenAI structured outputs (strict) exige toda propriedade em `required`;
    // opcionalidade se expressa com nullable, não com `.optional()`.
    limits: import_zod.z.array(import_zod.z.string()).nullable()
  }),
  angleAlignment: import_zod.z.object({
    aligned: import_zod.z.boolean(),
    note: import_zod.z.string()
  }),
  linkedin: import_zod.z.object({
    hook: import_zod.z.string().trim().min(1),
    body: import_zod.z.array(import_zod.z.string().trim().min(1)).min(1).max(6),
    closing: import_zod.z.string().nullable(),
    hashtags: import_zod.z.array(import_zod.z.string()).max(3).nullable()
  }),
  alternativeHooks: import_zod.z.array(import_zod.z.string().trim().min(1)).length(3),
  reel: import_zod.z.object({
    duration: import_zod.z.string(),
    hook: import_zod.z.string().trim().min(1),
    talkingPoints: import_zod.z.array(import_zod.z.string().trim().min(1)).min(1),
    closing: import_zod.z.string(),
    recordingNote: import_zod.z.string()
  })
});
var complianceObjectSchema = import_zod.z.object({
  safe: import_zod.z.boolean(),
  flags: import_zod.z.array(import_zod.z.enum(COMPLIANCE_FLAGS)),
  requiresHumanReview: import_zod.z.boolean(),
  notes: import_zod.z.array(import_zod.z.string()).nullable()
});
var editorialReviewObjectSchema = import_zod.z.object({
  passesReview: import_zod.z.boolean(),
  issues: import_zod.z.array(import_zod.z.string()),
  notes: import_zod.z.string()
});

// src/lib/gustavo-content/score.ts
function clamp(value, max) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}
function clampScoreBreakdown(raw) {
  const breakdown = {
    icpRelevance: clamp(Number(raw.icpRelevance ?? 0), SCORE_MAX.icpRelevance),
    thesisPotential: clamp(Number(raw.thesisPotential ?? 0), SCORE_MAX.thesisPotential),
    businessImpact: clamp(Number(raw.businessImpact ?? 0), SCORE_MAX.businessImpact),
    thesisFit: clamp(Number(raw.thesisFit ?? 0), SCORE_MAX.thesisFit),
    freshness: clamp(Number(raw.freshness ?? 0), SCORE_MAX.freshness),
    differentiation: clamp(Number(raw.differentiation ?? 0), SCORE_MAX.differentiation),
    sourceQuality: clamp(Number(raw.sourceQuality ?? 0), SCORE_MAX.sourceQuality)
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, breakdown };
}
var SCORE_CRITERIA = [
  { key: "icpRelevance", label: "Relev\xE2ncia para ICP", max: SCORE_MAX.icpRelevance },
  { key: "thesisPotential", label: "Potencial de tese", max: SCORE_MAX.thesisPotential },
  { key: "businessImpact", label: "Impacto empresarial", max: SCORE_MAX.businessImpact },
  { key: "thesisFit", label: "Ader\xEAncia \xE0s teses", max: SCORE_MAX.thesisFit },
  { key: "freshness", label: "Atualidade", max: SCORE_MAX.freshness },
  { key: "differentiation", label: "Diferencia\xE7\xE3o", max: SCORE_MAX.differentiation },
  { key: "sourceQuality", label: "Qualidade das fontes", max: SCORE_MAX.sourceQuality }
];

// src/lib/gustavo-content/text.ts
function splitLinkedInBlocks(text) {
  const normalized = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return { hook: "", rest: "" };
  const match = normalized.match(/^([\s\S]*?)\n\s*\n([\s\S]*)$/);
  if (match) {
    return { hook: match[1].trim(), rest: match[2].trim() };
  }
  return { hook: normalized, rest: "" };
}
function lowercaseHashtags(text) {
  return text.replace(
    /(^|[^\p{L}\p{M}\p{N}_/#])#([\p{L}\p{M}\p{N}_]+)/gu,
    (_match, prefix, tag) => `${prefix}#${tag.toLocaleLowerCase("pt-BR")}`
  );
}
function assembleLinkedInPost(input) {
  const parts = [
    input.hook.trim(),
    ...input.body.map((paragraph) => paragraph.trim()).filter(Boolean)
  ];
  if (input.closing?.trim()) parts.push(input.closing.trim());
  if (input.hashtags?.length) {
    parts.push(
      input.hashtags.map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.startsWith("#") ? tag : `#${tag}`).join(" ")
    );
  }
  return lowercaseHashtags(parts.filter(Boolean).join("\n\n"));
}

// src/lib/gustavo-content/history.ts
function buildEditorialHistoryPrompt(assessment) {
  if (assessment.similarItems.length === 0) {
    return `Risco ${assessment.similarityRisk}. ${assessment.reason}`;
  }
  const examples = assessment.similarItems.map((item, index) => {
    const hook = splitLinkedInBlocks(item.linkedin_post).hook || "\u2014";
    const post = (item.linkedin_post ?? "\u2014").replace(/\s+/g, " ").slice(0, 500);
    const angle = item.selected_angle?.title ?? item.selected_angle?.type ?? "\u2014";
    return [
      `HIST\xD3RICO ${index + 1}`,
      `Pauta: ${item.title ?? "\u2014"}`,
      `\xC2ngulo anterior: ${angle}`,
      `Hook anterior: ${hook}`,
      `Trecho anterior: ${post}`,
      `Data: ${item.created_at ?? "\u2014"}`
    ].join("\n");
  });
  return [
    `Risco ${assessment.similarityRisk}. ${assessment.reason}`,
    ...examples,
    assessment.varyAngle ? "OBRIGAT\xD3RIO: mantenha o \xE2ngulo e a tese j\xE1 escolhidos para esta pauta; varie s\xF3 gancho, estrutura, exemplos e \xEAnfase em rela\xE7\xE3o aos exemplos acima." : "Diferencie o gancho e a estrutura quando houver proximidade, mantendo o \xE2ngulo e a tese escolhidos."
  ].join("\n\n");
}

// src/lib/gustavo-content/strategy.ts
function buildStrategyPrompt(strategy) {
  const pillars = strategy.content_pillars.map(
    (pillar) => `- ${pillar.title}: ${pillar.description || "\u2014"} POR QU\xCA: ${pillar.reason || "\u2014"}`
  ).join("\n");
  const channels = strategy.channel_roles.map(
    (channel) => `- ${channel.channel}: ${channel.role || "\u2014"} POR QU\xCA: ${channel.reason || "\u2014"}`
  ).join("\n");
  return [
    `POSICIONAMENTO DESEJADO
${strategy.positioning}`,
    `PROMESSA EDITORIAL
${strategy.editorial_promise}`,
    `POR QUE ESSA ESTRAT\xC9GIA EXISTE
${strategy.strategic_rationale}`,
    `ICP
${strategy.icp.join(" | ")}
${strategy.icp_context}`,
    `PILARES E JUSTIFICATIVAS
${pillars || "\u2014"}`,
    `PAPEL DOS CANAIS
${channels || "\u2014"}`,
    `PRINC\xCDPIOS: ${strategy.editorial_principles.join(" | ") || "\u2014"}`,
    `EVITAR: ${strategy.avoidances.join(" | ") || "\u2014"}`,
    `SINAIS DE SUCESSO: ${strategy.success_signals.join(" | ") || "\u2014"}`
  ].join("\n\n");
}

// src/lib/gustavo-content/ai.ts
function getOpenAI() {
  const apiKey = process.env.NEXT_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new GustavoContentError("Configure OPENAI_API_KEY ou NEXT_OPENAI_API_KEY no servidor.", 503);
  }
  return (0, import_openai.createOpenAI)({ apiKey });
}
function requestLimits(timeoutMs, signal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return {
    abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    maxRetries: 1
  };
}
function scoreModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_SCORE);
}
function writingModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_WRITING);
}
function reviewModel() {
  return getOpenAI()(GUSTAVO_CONTENT_MODEL_REVIEW);
}
function thesesBlock(theses) {
  if (theses.length === 0) return "Nenhuma tese cadastrada.";
  return theses.map(
    (thesis) => `- id=${thesis.id} status=${thesis.status} [${thesis.conviction}] ${thesis.title}: ${thesis.thesis}`
  ).join("\n");
}
function voiceBlock(samples) {
  if (samples.length === 0) return "Nenhuma amostra de voz.";
  return samples.slice(0, 6).map((sample) => sample.original_text.slice(0, 700)).join("\n---\n");
}
async function analyzeScore(input) {
  const result = await (0, import_ai.generateObject)({
    ...requestLimits(3e4),
    model: scoreModel(),
    schema: scoreObjectSchema,
    schemaName: "gustavo_editorial_score",
    system: `${GUSTAVO_EDITOR_SYSTEM}

${SCORE_INSTRUCTIONS}`,
    prompt: [
      `T\xCDTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MAT\xC9RIA: ${input.article || "(n\xE3o dispon\xEDvel \u2014 use t\xEDtulo e resumo)"}`,
      `LINK: ${input.link ?? "\u2014"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:
${buildStrategyPrompt(input.strategy)}`,
      `BIBLIOTECA_DE_TESES:
${thesesBlock(input.theses)}`
    ].join("\n\n"),
    temperature: 0.2
  });
  const clamped = clampScoreBreakdown(result.object.breakdown);
  return {
    total: clamped.total,
    breakdown: clamped.breakdown,
    reason: result.object.reason,
    businessProblem: result.object.businessProblem,
    sourceContext: result.object.sourceContext,
    recommendedChannels: result.object.recommendedChannels
  };
}
async function generateAngles(input) {
  const result = await (0, import_ai.generateObject)({
    ...requestLimits(3e4),
    model: scoreModel(),
    schema: anglesObjectSchema,
    schemaName: "gustavo_editorial_angles",
    system: `${GUSTAVO_EDITOR_SYSTEM}

${ANGLES_INSTRUCTIONS}`,
    prompt: [
      `T\xCDTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MAT\xC9RIA: ${input.article || "(n\xE3o dispon\xEDvel)"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:
${buildStrategyPrompt(input.strategy)}`,
      `BIBLIOTECA_DE_TESES:
${thesesBlock(input.theses)}`
    ].join("\n\n"),
    temperature: 0.35
  });
  return result.object;
}
async function generateEditorialContent(input) {
  const usesReasoning = GUSTAVO_CONTENT_MODEL_WRITING.startsWith("gpt-5") && !GUSTAVO_CONTENT_MODEL_WRITING.includes("-chat") || /^o[134](?:-|$)/.test(GUSTAVO_CONTENT_MODEL_WRITING);
  const result = await (0, import_ai.generateObject)({
    ...requestLimits(5e4, input.abortSignal),
    model: writingModel(),
    schema: contentObjectSchema,
    schemaName: "gustavo_editorial_content",
    system: `${GUSTAVO_EDITOR_SYSTEM}

${EDITORIAL_BRIEF_INSTRUCTIONS}

${LINKEDIN_CONTENT_INSTRUCTIONS}

${REEL_CONTENT_INSTRUCTIONS}`,
    prompt: [
      `T\xCDTULO: ${input.title}`,
      `RESUMO: ${input.snippet}`,
      `MAT\xC9RIA: ${input.article || "(n\xE3o dispon\xEDvel)"}`,
      `FATOS_DA_FONTE:
${(input.sourceContext?.facts ?? []).map((fact) => `- ${fact}`).join("\n") || "\u2014"}`,
      `N\xDAMEROS_DA_FONTE:
${(input.sourceContext?.numbers ?? []).map((number) => `- ${number}`).join("\n") || "\u2014"}`,
      `EMPRESAS_E_DATAS: ${(input.sourceContext?.companies ?? []).join(", ") || "\u2014"} | ${(input.sourceContext?.dates ?? []).join(", ") || "\u2014"}`,
      `FONTES: ${(input.sourceContext?.sourceUrls ?? []).join(" | ") || input.link || "\u2014"}`,
      `LINK: ${input.link ?? "\u2014"}`,
      `ESTRATEGIA_DE_POSICIONAMENTO:
${buildStrategyPrompt(input.strategy)}`,
      `PROBLEMA_EMPRESARIAL: ${input.businessProblem ?? "\u2014"}`,
      `ANGULO_SELECIONADO: ${JSON.stringify(input.selectedAngle ?? null)}`,
      `TESE: ${input.thesisSnapshot ?? "\u2014"}`,
      `PERGUNTAS: ${(input.questions ?? []).join(" | ") || "\u2014"}`,
      `RESPOSTAS_DO_GUSTAVO: ${(input.answers ?? []).join(" | ") || "\u2014"}`,
      input.factualOnly ? "MODO: factual \u2014 n\xE3o h\xE1 opini\xE3o validada do Gustavo. Escreva an\xE1lise factual e interpreta\xE7\xE3o de mercado, sem atribuir a ele experi\xEAncias, opini\xF5es pessoais ou aprova\xE7\xE3o. N\xE3o escreva em primeira pessoa como se fosse ele falando." : "MODO: opini\xE3o \u2014 h\xE1 opini\xE3o validada do Gustavo (tese ou respostas). Pode escrever em primeira pessoa quando apoiado por ela.",
      `BIBLIOTECA_DE_TESES:
${thesesBlock(input.theses)}`,
      `VOZ_HISTORICA_GUSTAVO:
${voiceBlock(input.voice)}`,
      `HISTORICO_EDITORIAL_GUSTAVO:
${buildEditorialHistoryPrompt(input.history)}`,
      input.previousDraft ? `RASCUNHO_A_CORRIGIR (preserve a tese central, os fatos e o \xE2ngulo; ajuste somente os problemas da revis\xE3o):
${JSON.stringify(input.previousDraft)}` : "",
      input.reviewFeedback?.length ? `REVISAO_EDITORIAL_ANTERIOR (corrija sem perder a tese e os fatos j\xE1 usados):
${input.reviewFeedback.map((issue) => `- ${issue}`).join("\n")}` : ""
    ].filter(Boolean).join("\n\n"),
    ...usesReasoning ? { providerOptions: { openai: { reasoningEffort: "low" } } } : { temperature: 0.55 },
    // Modelos de raciocinio compartilham o limite entre raciocinio e JSON final.
    maxOutputTokens: usesReasoning ? 6e3 : 4e3
  });
  return {
    linkedinPost: assembleLinkedInPost(result.object.linkedin),
    alternativeHooks: result.object.alternativeHooks.map(lowercaseHashtags),
    reel: {
      ...result.object.reel,
      hook: lowercaseHashtags(result.object.reel.hook),
      talkingPoints: result.object.reel.talkingPoints.map(lowercaseHashtags),
      closing: lowercaseHashtags(result.object.reel.closing),
      recordingNote: lowercaseHashtags(result.object.reel.recordingNote)
    },
    editorialBrief: result.object.editorialBrief,
    angleAlignment: result.object.angleAlignment
  };
}
async function reviewEditorialContent(input) {
  const result = await (0, import_ai.generateObject)({
    ...requestLimits(1e4, input.abortSignal),
    model: reviewModel(),
    schema: editorialReviewObjectSchema,
    schemaName: "gustavo_editorial_review",
    system: `${GUSTAVO_EDITOR_SYSTEM}

${EDITORIAL_REVIEW_INSTRUCTIONS}`,
    prompt: `TESE_CENTRAL: ${input.centralThesis}

LINKEDIN:
${input.linkedinPost}`,
    temperature: 0.1
  });
  return result.object;
}
async function analyzeCompliance(input) {
  const result = await (0, import_ai.generateObject)({
    ...requestLimits(15e3, input.abortSignal),
    model: reviewModel(),
    schema: complianceObjectSchema,
    schemaName: "gustavo_compliance",
    system: `${GUSTAVO_EDITOR_SYSTEM}

${COMPLIANCE_INSTRUCTIONS}`,
    prompt: `LINKEDIN:
${input.linkedinPost}

REEL:
${input.reelScript}`,
    temperature: 0.1
  });
  return normalizeCompliance(result.object);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeCompliance,
  analyzeScore,
  generateAngles,
  generateEditorialContent,
  reviewEditorialContent
});
