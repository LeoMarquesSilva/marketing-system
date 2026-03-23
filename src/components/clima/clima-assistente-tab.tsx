"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Sparkles } from "lucide-react";
import type { Indicator, ActionPlan } from "@/lib/clima-types";

const SUGGESTED_PROMPTS = [
  "Quais os 3 indicadores mais críticos?",
  "Sugira ações prioritárias para melhorar o clima",
  "Resuma os planos urgentes e seus responsáveis",
  "Quais afirmações precisam de atenção imediata?",
];

interface ClimaAssistenteTabProps {
  indicadores: Indicator[];
  planosAcao: ActionPlan[];
}

export function ClimaAssistenteTab({
  indicadores,
  planosAcao,
}: ClimaAssistenteTabProps) {
  const [input, setInput] = useState("");

  const contextPayload = useMemo(
    () => ({
      indicadores: indicadores.map((i) => ({
        id: i.id,
        name: i.name,
        question: i.question,
        statementsCount: i.statements.length,
        actions: i.actions,
      })),
      planosAcao: planosAcao.map((p) => ({
        id: p.id,
        title: p.title,
        priority: p.priority,
        responsible: p.responsible,
        what: p.what,
      })),
    }),
    [indicadores, planosAcao]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/clima/assistente",
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({
    transport,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "streaming") return;
    sendMessage(
      { text: input.trim() },
      { body: { indicadores: contextPayload.indicadores, planosAcao: contextPayload.planosAcao } }
    );
    setInput("");
  };

  const handleSuggested = (text: string) => {
    setInput(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Assistente de IA</h2>
        <p className="text-sm text-muted-foreground">
          Pergunte sobre os dados da pesquisa. O assistente tem contexto dos indicadores e planos de ação.
        </p>
      </div>

      <Card className="rounded-xl">
        <CardHeader>
          <span className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4" />
            Sugestões rápidas
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((text) => (
              <Button
                key={text}
                variant="outline"
                size="sm"
                onClick={() => handleSuggested(text)}
                className="text-left"
              >
                {text}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Faça uma pergunta sobre os dados da pesquisa de clima.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 ${
                  m.role === "user"
                    ? "ml-8 bg-[#101f2e] text-white"
                    : "mr-8 bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">
                  {m.parts
                    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                    .map((p) => p.text)
                    .join("") ?? ""}
                </p>
              </div>
            ))}
            {status === "streaming" && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Pensando...</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre os indicadores ou planos..."
              disabled={status === "streaming"}
              className="flex-1"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || status === "streaming"}
            >
              {status === "streaming" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
