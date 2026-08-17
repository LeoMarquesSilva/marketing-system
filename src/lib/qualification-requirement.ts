export interface QualificationRequirementProfile {
  qualification_required_at?: string | null;
  qualification_completed_at?: string | null;
}

/**
 * Uma solicitação fica pendente enquanto não houver conclusão posterior a ela.
 * Comparação ISO funciona porque os valores vêm de timestamptz em UTC.
 */
export function isQualificationPending(
  profile: QualificationRequirementProfile | null | undefined
): boolean {
  const requiredAt = profile?.qualification_required_at;
  if (!requiredAt) return false;

  const completedAt = profile?.qualification_completed_at;
  return !completedAt || completedAt < requiredAt;
}
