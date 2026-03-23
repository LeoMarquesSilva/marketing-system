"use client";

import { useState, useMemo, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Loader2, Send, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type InspirationSource = "hooks" | "frameworks" | "archetypes" | "trending";

type InspirationData = {
  hooks: string | null;
  frameworks: string | null;
  archetypes: string | null;
  trending: string | null;
};

const SOURCE_LABELS: Record<InspirationSource, string> = {
  hooks: "Hooks",
  frameworks: "Frameworks",
  archetypes: "Arquétipos",
  trending: "Em alta",
};

type VibeMarketingChatProps = {
  inspirationData?: InspirationData;
};

export function VibeMarketingChat({ inspirationData }: VibeMarketingChatProps) {
  const [input, setInput] = useState("");

  const availableSources = useMemo(() => {
    if (!inspirationData) return [];
    return (["hooks", "frameworks", "archetypes", "trending"] as const).filter(
      (key) => inspirationData[key]
    );
  }, [inspirationData]);

  const [selectedSources, setSelectedSources] = useState<Set<InspirationSource>>(
    () => new Set(availableSources)
  );

  useEffect(() => {
    if (availableSources.length > 0) {
      setSelectedSources(new Set(availableSources));
    }
  }, [
    inspirationData?.hooks,
    inspirationData?.frameworks,
    inspirationData?.archetypes,
    inspirationData?.trending,
  ]);

  const toggleSource = (source: InspirationSource) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSources(new Set(availableSources));
  };

  const selectNone = () => {
    setSelectedSources(new Set());
  };

  const context = useMemo(() => {
    if (!inspirationData) return "";
    const parts: string[] = [];
    if (selectedSources.has("hooks") && inspirationData.hooks) {
      parts.push(`## Hooks\n${inspirationData.hooks}`);
    }
    if (selectedSources.has("frameworks") && inspirationData.frameworks) {
      parts.push(`## Frameworks de copywriting\n${inspirationData.frameworks}`);
    }
    if (selectedSources.has("archetypes") && inspirationData.archetypes) {
      parts.push(`## Arquétipos de voz\n${inspirationData.archetypes}`);
    }
    if (selectedSources.has("trending") && inspirationData.trending) {
      parts.push(`## Conteúdo em alta\n${inspirationData.trending}`);
    }
    return parts.join("\n\n---\n\n");
  }, [inspirationData, selectedSources]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/vibe-marketing/chat",
      }),
    []
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    transport,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(
      { text: input.trim() },
      context ? { body: { context } } : undefined
    );
    setInput("");
  };

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Chat com IA
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Peça sugestões de posts, hooks ou use os dados de pesquisa como referência.
        </p>

        {availableSources.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Incluir no contexto da IA:
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={selectAll}
                  className="h-6 text-xs"
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={selectNone}
                  className="h-6 text-xs"
                >
                  Nenhum
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSources.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => toggleSource(source)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    selectedSources.has(source)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  {SOURCE_LABELS[source]}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[400px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                {availableSources.length > 0
                  ? selectedSources.size > 0
                    ? "A IA usará os dados selecionados. Peça sugestões de posts!"
                    : "Selecione os dados acima ou peça sugestões gerais."
                  : "Busque inspiração na aba Inspiração para enriquecer o contexto."}
              </p>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg px-3 py-2",
                message.role === "user"
                  ? "ml-8 bg-primary/10 text-primary"
                  : "mr-8 bg-muted/50"
              )}
            >
              <div className="text-xs font-medium opacity-70 mb-1">
                {message.role === "user" ? "Você" : "IA"}
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <span key={i}>{part.text}</span>
                  ) : null
                )}
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Pensando...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span>{error.message}</span>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Fechar
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 border-t p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Ex: Crie 3 hooks para um post sobre produtividade no LinkedIn..."
            rows={2}
            disabled={isStreaming}
            className="flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 resize-none"
          />
          {isStreaming ? (
            <Button type="button" variant="outline" size="icon" onClick={stop}>
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
