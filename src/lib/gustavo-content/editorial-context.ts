import type { SourceContext } from "@/lib/gustavo-content/types";

const MAX_EDITORIAL_SOURCE_CHARS = 12_000;

export function sourceTextForGeneration(input: {
  contentSnippet: string | null | undefined;
  sourceContext: SourceContext | null | undefined;
}): string {
  const article = input.sourceContext?.articleText?.trim();
  const fallback = input.contentSnippet?.trim() ?? "";
  return (article || fallback).slice(0, MAX_EDITORIAL_SOURCE_CHARS);
}

export function preserveArticleText(text: string | null | undefined): string | null {
  const clean = text?.trim();
  return clean ? clean.slice(0, MAX_EDITORIAL_SOURCE_CHARS) : null;
}
