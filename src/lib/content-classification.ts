import { LEGAL_AREAS, type LegalArea } from "@/lib/content-areas";

/** Mapeia área do tema RSS (admin) → área jurídica do conteúdo. */
const TOPIC_AREA_TO_LEGAL: Record<string, LegalArea> = {
  Cível: "Cível",
  Trabalhista: "Trabalhista",
  Reestruturação: "Reestruturação (Insolvência)",
  "Societário e Contratos": "Societário e Contrato",
  "Operações Legais": "Operações Legais (Legal Ops)",
  "Distressed Deals - Special Situations": "Distressed Deals",
};

export function mapTopicAreaToLegalArea(topicLegalArea: string): LegalArea | null {
  return TOPIC_AREA_TO_LEGAL[topicLegalArea.trim()] ?? null;
}

const LEGAL_OPS_AREA: LegalArea = "Operações Legais (Legal Ops)";

/** Notícias claramente fora do escopo do escritório — não gerar post. */
const IRRELEVANT_PATTERNS: RegExp[] = [
  /pol[ií]cia civil/i,
  /pol[ií]cia federal/i,
  /opera[çc][ãa]o policial/i,
  /opera[çc][ãa]o contra/i,
  /comando vermelho/i,
  /tr[aá]fico de drogas/i,
  /\btraficante/i,
  /\bhom[ií]cid/i,
  /\bpreso[s]?\b/i,
  /\bpris[aã]o\b/i,
  /tce-[a-z]{2}\b/i,
  /tribunal de contas/i,
  /contas de cl[aá]udio castro/i,
  /rejeita contas do governo/i,
];

/** Falso positivo: "operação" policial/criminal confundida com Legal Ops. */
const LEGAL_OPS_FALSE_POSITIVE: RegExp[] = [
  ...IRRELEVANT_PATTERNS,
  /lavagem de dinheiro.*pol[ií]cia/i,
  /pol[ií]cia.*lavagem/i,
  /seguran[çc]a p[uú]blica/i,
  /crime organizado/i,
];

/** Indícios de que a notícia é sobre Legal Operations de fato. */
const LEGAL_OPS_POSITIVE: RegExp[] = [
  /legal\s*ops/i,
  /legal\s*operations/i,
  /legal\s*tech/i,
  /legaltech/i,
  /departamento jur[ií]dico/i,
  /escrit[oó]rio de advocacia.*(tecnologia|efici[eê]ncia|gest[aã]o|processo)/i,
  /software jur[ií]dico/i,
  /automa[çc][ãa]o.*contrato/i,
  /gest[aã]o de contratos/i,
  /\bclm\b/i,
  /contract lifecycle/i,
  /intelig[eê]ncia artificial.*jur[ií]d/i,
  /ia.*departamento jur[ií]dico/i,
  /legal design/i,
  /legal analytics/i,
  /legal management/i,
  /matter management/i,
  /ebilling|e-billing/i,
  /\bcloc\b/i,
  /business intelligence.*jur[ií]d/i,
  /m[eé]tricas jur[ií]dicas/i,
  /efici[eê]ncia operacional.*jur[ií]d/i,
  /transforma[çc][ãa]o digital.*jur[ií]d/i,
  /innovation.*legal/i,
  /inova[çc][ãa]o jur[ií]dica/i,
];

export function shouldSkipAsIrrelevant(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`;
  return IRRELEVANT_PATTERNS.some((p) => p.test(text));
}

export function isLegalOpsRelevant(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`;
  if (LEGAL_OPS_FALSE_POSITIVE.some((p) => p.test(text))) return false;
  return LEGAL_OPS_POSITIVE.some((p) => p.test(text));
}

/**
 * "Ruído de release corporativo": notícia batizada com termos de Legal Ops
 * (legaltech, departamento jurídico) mas que na prática é assessoria de
 * imprensa — captação de investimento, troca de sede, nomeação de executivo,
 * prêmio — sem conteúdo educativo aproveitável para um post. O Google News
 * ignora com frequência exclusões (`-"termo"`) na query quando há várias, então
 * este filtro roda em código, depois da busca, e é confiável.
 */
const PRESS_RELEASE_NOISE_PATTERNS: RegExp[] = [
  /capta\s+(r\$|us\$|recursos|investimento|com\s)/i,
  /rodada de investimento/i,
  /aporte de (r\$|us\$)/i,
  /levanta\s+(r\$|us\$)/i,
  /nova sede|inaugura (sua |a )?sede|instala.*sede/i,
  /tem nov[oa]\s+(diretor|diretora|ceo|presidente|s[oó]cio|s[oó]cia)/i,
  /assume\s+(a diretoria|o cargo|a presid[êe]ncia|a lideran[çc]a)/i,
  /[ée]\s+nomead[oa]/i,
  /vence\s+[^.]{0,40}(pr[êe]mio|awards?|summit)/i,
  /ganha\s+[^.]{0,40}pr[êe]mio/i,
  /reconhecid[oa]\s+[^.]{0,40}pr[êe]mio/i,
  /conquista\s+[^.]{0,40}(reconhecimento|pr[êe]mio)/i,
  /recebe\s+[^.]{0,40}pr[êe]mio/i,
  /eleit[oa]\s+[^.]{0,40}(melhor|top\s)/i,
  /precat[oó]rios?/i,
];

export function isPressReleaseNoise(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`;
  return PRESS_RELEASE_NOISE_PATTERNS.some((p) => p.test(text));
}

export function validateClassifiedArea(
  area: string,
  title: string,
  snippet: string
): { area: LegalArea; skip: boolean } {
  if (shouldSkipAsIrrelevant(title, snippet)) {
    return { area: area as LegalArea, skip: true };
  }

  if (area === LEGAL_OPS_AREA) {
    if (!isLegalOpsRelevant(title, snippet)) {
      return { area: area as LegalArea, skip: true };
    }
    if (isPressReleaseNoise(title, snippet)) {
      return { area: area as LegalArea, skip: true };
    }
  }

  if (!LEGAL_AREAS.includes(area as LegalArea)) {
    return { area: LEGAL_AREAS[0], skip: false };
  }

  return { area: area as LegalArea, skip: false };
}

/** Resposta da IA indicando que a notícia não rende post jurídico. */
export function isIrrelevantResponse(raw: string): boolean {
  return /^\s*["']?\s*irrelevante\s*["']?\s*$/i.test(raw);
}

export const CLASSIFY_PROMPT = `Você é um classificador jurídico especializado de um escritório de advocacia empresarial. Classifique a notícia em UMA ÚNICA área, com base no tema CENTRAL (não em palavras soltas).

ÁREAS DISPONÍVEIS:

- Cível — contratos civis, responsabilidade civil, família, sucessões, indenizações, direito do consumidor.
- Trabalhista — CLT, relações de trabalho, demissões, rescisões, acidentes de trabalho, sindicatos.
- Reestruturação (Insolvência) — falência, recuperação judicial, RJ, concurso de credores, massa falida, crise financeira de empresas.
- Societário e Contrato — M&A, fusões, aquisições, joint ventures, governança corporativa, acordo de acionistas, contratos comerciais entre empresas.
- Operações Legais (Legal Ops) — SOMENTE gestão operacional de departamentos jurídicos e escritórios: legal tech, software jurídico, automação de contratos (CLM), IA aplicada ao jurídico, legal design, métricas/BI jurídico, eficiência de processos internos, eBilling, matter management, transformação digital do jurídico (CLOC). NÃO é crime, polícia, compliance penal nem auditoria de governo.
- Distressed Deals — aquisição de empresas em crise, compra de ativos em insolvência, negociação com credores em cenário de distress.

REGRAS CRÍTICAS:
1. "Operação" policial, PF, Polícia Civil, lavagem de dinheiro criminal, tráfico, prisão → NÃO é Legal Ops. Classifique em Cível ou ignore o tema se for notícia criminal/policial pura.
2. Tribunal de Contas (TCE), prestação de contas de governo, política estadual → NÃO é Legal Ops.
3. Legal Ops exige contexto de gestão/tecnologia/processos do departamento jurídico ou escritório — não basta mencionar "legal" ou "compliance" genérico.
4. GPA, recuperação judicial, credores → Reestruturação (Insolvência) ou Societário e Contrato, nunca Legal Ops.
5. Na dúvida entre Legal Ops e outra área, escolha a outra área.

GATE DE RELEVÂNCIA (faça ANTES de classificar):
Se a notícia NÃO serve como base para um post jurídico educativo de um escritório de advocacia empresarial — por exemplo: nota puramente policial/criminal, política partidária, esporte, celebridades, fofoca, conteúdo regional sem tese jurídica, ou tema sem qualquer ângulo jurídico empresarial — responda EXATAMENTE com a palavra "IRRELEVANTE". Não invente um enquadramento jurídico para notícias que não têm.

NOTÍCIA:
Título: {{TITLE}}
Resumo: {{SNIPPET}}
{{TOPIC_HINT}}

Responda APENAS com "IRRELEVANTE" ou com o nome exato de uma área da lista. Exemplo: "Reestruturação (Insolvência)"`;

export function buildClassifyPrompt(
  title: string,
  snippet: string,
  topicLegalArea?: string | null
): string {
  const mapped = topicLegalArea ? mapTopicAreaToLegalArea(topicLegalArea) : null;
  const topicHint = mapped
    ? `\nContexto: esta notícia veio de um feed RSS configurado para a área "${mapped}". Use essa área se a notícia for compatível; só mude se o tema central for claramente de outra área da lista.`
    : "";

  return CLASSIFY_PROMPT.replace("{{TITLE}}", title)
    .replace("{{SNIPPET}}", snippet)
    .replace("{{TOPIC_HINT}}", topicHint);
}

export function parseClassifiedArea(raw: string): LegalArea {
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  const exact = LEGAL_AREAS.find((a) => a.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const partial = LEGAL_AREAS.find(
    (a) =>
      trimmed.toLowerCase().includes(a.toLowerCase().split(" ")[0] ?? "") ||
      a.toLowerCase().includes(trimmed.toLowerCase())
  );
  return partial ?? LEGAL_AREAS[0];
}
