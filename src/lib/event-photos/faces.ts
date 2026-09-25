/** Regras puras do reconhecimento facial das Fotos de eventos (sem I/O, sem modelo). */

export const FACE_CONSENT_VERSION = "2026-09-25";
export const FACE_DESCRIPTOR_LENGTH = 128;
/** Distância euclidiana máxima para considerar o mesmo rosto (0,6 é o padrão do modelo; 0,5 erra menos). */
export const FACE_MATCH_THRESHOLD = 0.5;
/** Rostos menores que isso (px na prévia) geram descritor pouco confiável. */
export const FACE_MIN_SIZE_PX = 40;
export const FACE_MAX_REFERENCES = 5;

export type FaceDescriptor = number[];

export interface FaceReferenceSet {
  userId: string;
  descriptors: FaceDescriptor[];
}

export interface FaceMatch {
  userId: string;
  distance: number;
}

export function isFaceDescriptor(value: unknown): value is FaceDescriptor {
  return (
    Array.isArray(value) &&
    value.length === FACE_DESCRIPTOR_LENGTH &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Cruza rostos detectados numa foto com as referências de quem consentiu.
 * Cada rosto vai para no máximo uma pessoa (a mais próxima abaixo do limite) e cada
 * pessoa aparece uma vez, com a menor distância encontrada.
 */
export function matchFacesToPeople(
  faces: ArrayLike<number>[],
  people: FaceReferenceSet[],
  threshold = FACE_MATCH_THRESHOLD
): FaceMatch[] {
  const best = new Map<string, number>();
  for (const face of faces) {
    let winner: FaceMatch | null = null;
    for (const person of people) {
      for (const ref of person.descriptors) {
        const distance = euclideanDistance(face, ref);
        if (distance < threshold && (!winner || distance < winner.distance)) {
          winner = { userId: person.userId, distance };
        }
      }
    }
    if (!winner) continue;
    const current = best.get(winner.userId);
    if (current === undefined || winner.distance < current) best.set(winner.userId, winner.distance);
  }
  return [...best.entries()]
    .map(([userId, distance]) => ({ userId, distance: Math.round(distance * 10000) / 10000 }))
    .sort((a, b) => a.distance - b.distance);
}

/** Arredonda o descritor para caber leve no JSON sem perder precisão útil. */
export function compactDescriptor(descriptor: ArrayLike<number>): FaceDescriptor {
  return Array.from(descriptor, (n) => Math.round(n * 1e6) / 1e6);
}
