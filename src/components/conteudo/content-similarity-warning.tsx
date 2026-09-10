"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface SimilarContent {
  id: string;
  title: string;
  kind: "exact_source" | "similar_topic";
  evidence: string[];
  status: string;
  publishedAt?: string;
  url?: string;
  collaboratorName?: string;
}

export function ContentSimilarityWarning({ contentId }: { contentId: string | null | undefined }) {
  return contentId ? <ContentSimilarityResults key={contentId} contentId={contentId} /> : null;
}

function ContentSimilarityResults({ contentId }: { contentId: string }) {
  const [warnings, setWarnings] = useState<SimilarContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/content-schedule/similar?contentId=${encodeURIComponent(contentId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Consulta indisponível");
        const data = await response.json();
        if (!controller.signal.aborted) setWarnings(data.warnings ?? []);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [contentId]);

  if (loading) return <p className="text-xs text-muted-foreground" role="status">Consultando conteúdos anteriores e em produção…</p>;
  if (failed) return <p className="text-xs text-muted-foreground" role="status">Consulta de temas semelhantes indisponível. Você pode continuar.</p>;
  if (!warnings.length) return null;
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Conteúdos semelhantes">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4 shrink-0" aria-hidden />Este assunto pode já ter sido abordado</p>
      <p className="mt-1">Confira os conteúdos abaixo. Você pode continuar com a sua escolha.</p>
      <ul className="mt-3 space-y-3">
        {warnings.slice(0, 5).map((item) => (
          <li key={item.id}>
            {item.url && /^(https?:\/\/|\/)/.test(item.url) ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">{item.title}</a> : <span className="font-medium">{item.title}</span>}
            <p className="mt-0.5 text-xs">{item.kind === "exact_source" ? "Mesma notícia" : "Assunto semelhante"} · {item.status === "published" ? "Publicado" : "Em produção"}{item.collaboratorName ? ` · ${item.collaboratorName}` : ""}{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}</p>
            {item.evidence?.length > 0 && <p className="mt-0.5 text-xs">{item.evidence.join(". ")}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
