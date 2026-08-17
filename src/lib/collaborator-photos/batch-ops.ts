export const MAX_BATCH_PHOTO_OPS = 40;

export function assertBatchPhotoIds(photoIds: unknown, actionVerb: string): string[] {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    throw new Error(`Selecione ao menos uma foto para ${actionVerb}.`);
  }
  if (photoIds.length > MAX_BATCH_PHOTO_OPS) {
    throw new Error(`Selecione no máximo ${MAX_BATCH_PHOTO_OPS} fotos por vez.`);
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of photoIds) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Lista de fotos inválida.");
    }
    const id = value.trim();
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  if (unique.length === 0) {
    throw new Error(`Selecione ao menos uma foto para ${actionVerb}.`);
  }
  return unique;
}

export function assertBatchMoveSessionInput(input: {
  photoIds: unknown;
  sessionId: unknown;
}): { photoIds: string[]; sessionId: string } {
  const photoIds = assertBatchPhotoIds(input.photoIds, "mover de sessão");
  if (typeof input.sessionId !== "string" || !input.sessionId.trim()) {
    throw new Error("Selecione a sessão de destino.");
  }
  return { photoIds, sessionId: input.sessionId.trim() };
}
