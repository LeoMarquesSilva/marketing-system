import { normalizeTitleKey } from "@/lib/gustavo-content/text";
import type { GustavoThesis } from "@/lib/gustavo-content/theses";
import type { StrategyPillar } from "@/lib/gustavo-content/strategy";
import { overviewMetrics } from "@/lib/gustavo-content/filters";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";
import type { GustavoVoiceSample } from "@/lib/gustavo-content/voice";

const STOP = new Set([
  "como",
  "para",
  "sobre",
  "este",
  "esta",
  "isso",
  "uma",
  "uns",
  "com",
  "dos",
  "das",
  "por",
  "que",
  "nao",
  "sem",
  "mais",
  "antes",
  "depois",
  "quando",
  "onde",
  "pelo",
  "pela",
]);

function tokens(value: string): Set<string> {
  return new Set(
    normalizeTitleKey(value)
      .split(" ")
      .filter((token) => token.length > 3 && !STOP.has(token))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }
  return shared / Math.max(a.size, b.size);
}

export function matchThesesToPillar(
  pillar: StrategyPillar,
  theses: GustavoThesis[]
): GustavoThesis[] {
  const pillarTokens = tokens(`${pillar.title} ${pillar.description}`);
  return theses
    .filter((thesis) => thesis.status !== "disabled")
    .filter((thesis) => {
      const thesisTokens = tokens(
        `${thesis.title} ${thesis.thesis} ${thesis.tags.join(" ")}`
      );
      return overlap(pillarTokens, thesisTokens) >= 0.18;
    })
    .sort((a, b) => {
      if (a.status === "validated" && b.status !== "validated") return -1;
      if (b.status === "validated" && a.status !== "validated") return 1;
      return b.usage_count - a.usage_count;
    });
}

export function pillarsMissingTheses(
  pillars: StrategyPillar[],
  theses: GustavoThesis[]
): string[] {
  return pillars
    .filter((pillar) => matchThesesToPillar(pillar, theses).length === 0)
    .map((pillar) => pillar.title);
}

export function strategyOperatingPulse(input: {
  theses: GustavoThesis[];
  voice: GustavoVoiceSample[];
  items: GustavoContentItem[];
}) {
  const metrics = overviewMetrics(input.items);
  return {
    validatedTheses: input.theses.filter((thesis) => thesis.status === "validated").length,
    pendingTheses: input.theses.filter((thesis) => thesis.status === "pending").length,
    voiceSamples: input.voice.filter((sample) => sample.is_active).length,
    linkedinThisWeek: metrics.linkedinWeek,
    reelsThisWeek: metrics.reelWeek,
    waitingGustavo: metrics.waitingGustavo,
  };
}

export type StrategyOperatingPulse = ReturnType<typeof strategyOperatingPulse>;
