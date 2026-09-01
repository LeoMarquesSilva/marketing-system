export const COMPLIANCE_FLAGS = [
  "commercial_cta",
  "promise_of_result",
  "self_aggrandizement",
  "comparison",
  "client_case",
  "confidentiality",
  "individual_legal_advice",
  "sensationalism",
  "unverified_claim",
  "other",
] as const;

export type ComplianceFlag = (typeof COMPLIANCE_FLAGS)[number];

export const SEVERE_COMPLIANCE_FLAGS: ComplianceFlag[] = [
  "promise_of_result",
  "commercial_cta",
  "client_case",
  "confidentiality",
  "individual_legal_advice",
];

export interface ComplianceResult {
  safe: boolean;
  flags: ComplianceFlag[];
  requiresHumanReview: boolean;
}

export const COMPLIANCE_FLAG_LABELS: Record<ComplianceFlag, string> = {
  commercial_cta: "CTA comercial",
  promise_of_result: "Promessa de resultado",
  self_aggrandizement: "Autoengrandecimento",
  comparison: "Comparação com concorrentes",
  client_case: "Caso de cliente",
  confidentiality: "Risco de confidencialidade",
  individual_legal_advice: "Consulta individual",
  sensationalism: "Sensacionalismo",
  unverified_claim: "Afirmação pouco segura",
  other: "Outro",
};

export function normalizeCompliance(raw: {
  safe?: boolean;
  flags?: unknown;
  requiresHumanReview?: boolean;
}): ComplianceResult {
  const flags = (Array.isArray(raw.flags) ? raw.flags : [])
    .map((flag) => String(flag))
    .filter((flag): flag is ComplianceFlag =>
      (COMPLIANCE_FLAGS as readonly string[]).includes(flag)
    );
  const severe = flags.some((flag) => SEVERE_COMPLIANCE_FLAGS.includes(flag));
  return {
    safe: raw.safe !== false && !severe,
    flags,
    requiresHumanReview: Boolean(raw.requiresHumanReview) || flags.length > 0,
  };
}

export function canSubmitForApproval(compliance: ComplianceResult | null | undefined): boolean {
  if (!compliance) return false;
  return !compliance.flags.some((flag) => SEVERE_COMPLIANCE_FLAGS.includes(flag));
}
