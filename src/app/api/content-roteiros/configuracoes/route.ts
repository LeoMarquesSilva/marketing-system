import { NextResponse } from "next/server";
import { getAuthenticatedContentUser, isContentManager } from "@/lib/content-access";
import { getServerDb } from "@/lib/users-server";
import { fetchContentTopics } from "@/lib/content-topics";
import { fetchRecentFetchRuns } from "@/lib/content-roteiros";
import {
  getGeneratorSettings,
  getLatestLearning,
  listLearningHistory,
  saveGeneratorSettings,
} from "@/lib/content-generator/server";
import { computeLearningStats, type LearningRoteiroRow } from "@/lib/content-generator/learning";
import type { GeneratorSettings } from "@/lib/content-generator/settings";
import { fetchAllPages } from "@/lib/supabase-pages";

export const dynamic = "force-dynamic";

const SOURCES_WINDOW_DAYS = 120;

async function requireManager() {
  const auth = await getAuthenticatedContentUser();
  if (!auth?.profile) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (!isContentManager(auth.profile)) {
    return { error: NextResponse.json({ error: "Só a equipe de Marketing mexe nas configurações." }, { status: 403 }) };
  }
  return { profile: auth.profile };
}

/** Tudo o que a tela de Configurações mostra: regras, fontes com desempenho, buscas e aprendizado. */
export async function GET() {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  try {
    const db = await getServerDb();
    const since = new Date(Date.now() - SOURCES_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const [settings, learning, history, topics, runs, roteiros] = await Promise.all([
      getGeneratorSettings(),
      getLatestLearning(),
      listLearningHistory(),
      fetchContentTopics(true),
      fetchRecentFetchRuns(10),
      fetchAllPages<LearningRoteiroRow>((from, to) =>
        db
          .from("content_roteiros")
          .select("id, topic_id, title, area, status, created_at, approved_by_id")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    const sources = computeLearningStats({
      posts: [],
      roteiros,
      topics,
      edits: 0,
    }).sources;
    return NextResponse.json({ settings, learning, history, topics, sources, runs, sourcesWindowDays: SOURCES_WINDOW_DAYS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao carregar as configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireManager();
  if (auth.error) return auth.error;
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<GeneratorSettings>;
    const settings = await saveGeneratorSettings(body, { id: auth.profile.id, name: auth.profile.name });
    return NextResponse.json({ settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar as configurações.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
