import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { currentMetricsAccess } from "@/lib/social-metrics/access";
import { fetchMetricsSummaryData } from "@/lib/social-metrics/server";
import { buildSummaryFacts } from "@/lib/social-metrics/summary";
import { parseMetricsPeriod, resolveMetricsPeriod } from "@/lib/social-metrics/period";
import { openAIKey } from "@/lib/openai-keys";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return createClient(url, key);
}

const INSTRUCTIONS = `Você é a analista de marketing do escritório de advocacia Bismarchi | Pires.
Escreva a leitura do período para os sócios, em português do Brasil, com 3 a 5 tópicos curtos.
Regras:
- Cada tópico começa com "- " e tem uma frase de no máximo 30 palavras.
- Use só os números dos fatos abaixo. Não invente dado, causa nem meta.
- Comece pelo que mais mudou em relação à comparação; depois o que funcionou (formato ou post); termine com uma recomendação prática.
- Se um canal estiver sem dados no período, diga isso em um tópico (ex.: LinkedIn sem importação recente).
- Tom sóbrio, sem jargão de marketing, sem emojis e sem exclamações.
- Escreva "Operações Legais" (nunca "Legal Ops") e "Bismarchi | Pires".`;

function periodFromBody(body: Record<string, unknown>) {
  const state = parseMetricsPeriod({
    periodo: typeof body.periodo === "string" ? body.periodo : undefined,
    comparar: typeof body.comparar === "string" ? body.comparar : undefined,
    de: typeof body.de === "string" ? body.de : undefined,
    ate: typeof body.ate === "string" ? body.ate : undefined,
  });
  return resolveMetricsPeriod(state);
}

/** Gera a leitura do período com a IA (a partir dos números do banco) e guarda. */
export async function POST(request: Request) {
  try {
    const access = await currentMetricsAccess();
    if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!access.canWriteReading) {
      return NextResponse.json({ error: "A leitura usa os três canais; peça acesso ao Instagram, LinkedIn e Site." }, { status: 403 });
    }
    const apiKey = openAIKey("analisePublicacao");
    if (!apiKey) return NextResponse.json({ error: "Chave da OpenAI não configurada." }, { status: 500 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const period = periodFromBody(body);
    const data = await fetchMetricsSummaryData(access.channels);
    const facts = buildSummaryFacts(data, period);

    const openai = createOpenAI({ apiKey });
    const { text } = await generateText({
      model: openai(OPENAI_DEFAULT_MODEL),
      system: INSTRUCTIONS,
      prompt: `FATOS DO PERÍODO\n${facts}`,
      ...openAIGenerationOptions(OPENAI_DEFAULT_MODEL, { reasoningEffort: "low", temperature: 0.4 }),
    });
    const aiSummary = (text ?? "").trim();
    if (!aiSummary) throw new Error("A IA não devolveu texto.");

    const aiGeneratedAt = new Date().toISOString();
    const { error } = await adminDb()
      .from("social_metrics_notes")
      .upsert(
        { period_start: period.from, period_end: period.to, ai_summary: aiSummary, ai_generated_at: aiGeneratedAt },
        { onConflict: "period_start,period_end" }
      );
    if (error) throw new Error(error.message);
    revalidatePath("/metricas");
    return NextResponse.json({ success: true, periodStart: period.from, periodEnd: period.to, aiSummary, aiGeneratedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao gerar a leitura.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Salva o comentário do marketing para o período. */
export async function PATCH(request: Request) {
  try {
    const access = await currentMetricsAccess();
    if (!access) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!access.canWriteReading) return NextResponse.json({ error: "Sem permissão para comentar a leitura." }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const period = periodFromBody(body);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    const noteUpdatedAt = new Date().toISOString();
    const { error } = await adminDb()
      .from("social_metrics_notes")
      .upsert(
        {
          period_start: period.from,
          period_end: period.to,
          note: note || null,
          note_updated_by: access.userId,
          note_updated_at: noteUpdatedAt,
        },
        { onConflict: "period_start,period_end" }
      );
    if (error) throw new Error(error.message);
    revalidatePath("/metricas");
    return NextResponse.json({ success: true, note: note || null, noteUpdatedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao salvar o comentário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
