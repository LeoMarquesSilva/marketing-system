"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  Lightbulb,
  ShieldCheck,
  Wrench,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { VibeMarketingChat } from "./vibe-marketing-chat";
import { type ToolInfo, NETWORKS, PLATFORMS, FRAMEWORKS } from "./vibe-marketing-constants";

type TabId = "inspiracao" | "validar" | "chat" | "ferramentas";

async function callTool(
  server: string,
  tool: string,
  args: Record<string, string | number | boolean>
): Promise<string> {
  const res = await fetch("/api/vibe-marketing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ server, tool, args }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao executar");
  const text = data.content?.[0]?.text ?? JSON.stringify(data.content ?? data);
  return typeof text === "string" ? text : JSON.stringify(text, null, 2);
}

function convertArgs(
  formValues: Record<string, string>,
  schema: { [key: string]: { type?: string } }
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(formValues)) {
    if (value === "") continue;
    if (schema[key]?.type === "number") {
      const n = Number(value);
      if (!Number.isNaN(n)) result[key] = n;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function VibeMarketingClient() {
  const [activeTab, setActiveTab] = useState<TabId>("inspiracao");
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [toolsServerFilter, setToolsServerFilter] = useState<string>("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inspiração
  const [inspNetwork, setInspNetwork] = useState("instagram");
  const [inspCategory, setInspCategory] = useState("");
  const [inspHooks, setInspHooks] = useState<string | null>(null);
  const [inspFrameworks, setInspFrameworks] = useState<string | null>(null);
  const [inspArchetypes, setInspArchetypes] = useState<string | null>(null);
  const [inspTrending, setInspTrending] = useState<string | null>(null);

  // Validar
  const [validText, setValidText] = useState("");
  const [validPlatform, setValidPlatform] = useState("instagram");
  const [validResults, setValidResults] = useState<{ label: string; text: string }[]>([]);

  const fetchTools = useCallback(async () => {
    setLoadingTools(true);
    setError(null);
    try {
      const res = await fetch("/api/vibe-marketing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar ferramentas");
      const flat: ToolInfo[] = [];
      for (const group of data.tools || []) {
        for (const t of group.tools || []) {
          flat.push({
            server: group.server,
            serverName: group.serverName,
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          });
        }
      }
      setTools(flat);
      if (flat.length && !selectedTool) setSelectedTool(`${flat[0].server}:${flat[0].name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoadingTools(false);
    }
  }, [selectedTool]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const filteredTools = toolsServerFilter
    ? tools.filter((t) => t.server === toolsServerFilter)
    : tools;
  const currentTool = tools.find(
    (t) => `${t.server}:${t.name}` === selectedTool
  );

  const runInspiracao = async () => {
    setLoading(true);
    setError(null);
    setInspHooks(null);
    setInspFrameworks(null);
    setInspArchetypes(null);
    setInspTrending(null);
    try {
      const [hooks, frameworks, archetypes, trending] = await Promise.all([
        callTool("vibe-marketing", "find-hooks", {
          network: inspNetwork,
          ...(inspCategory && { category: inspCategory }),
          limit: 8,
        }),
        callTool("vibe-marketing", "list-copywriting-frameworks", { network: inspNetwork }),
        callTool("vibe-marketing", "list-archetypes", {}),
        callTool("vibe-marketing", "get-trending-content", { limit: 5, networks: "twitter" }),
      ]);
      setInspHooks(hooks);
      setInspFrameworks(frameworks);
      setInspArchetypes(archetypes);
      setInspTrending(trending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const runValidarTudo = async () => {
    if (!validText.trim()) {
      setError("Cole o texto para validar.");
      return;
    }
    setLoading(true);
    setError(null);
    setValidResults([]);
    try {
      const [validate, flag, preview] = await Promise.all([
        callTool("vibe-marketing", "validate-content-before-fold", {
          text: validText,
          platform: validPlatform,
        }),
        callTool("vibe-marketing", "flag-problematic-phrases", { text: validText }),
        callTool("vibe-marketing", "get-text-before-fold", {
          text: validText,
          platform: validPlatform,
        }),
      ]);
      setValidResults([
        { label: "Validação (limites)", text: validate },
        { label: "Frases problemáticas (IA)", text: flag },
        { label: "Preview (antes do fold)", text: preview },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTool || !currentTool) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const args = convertArgs(formValues, currentTool?.inputSchema?.properties ?? {});
      const text = await callTool(currentTool.server, currentTool.name, args);
      setResult(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const getCopyContent = () => {
    if (activeTab === "inspiracao" && (inspHooks || inspFrameworks || inspArchetypes || inspTrending)) {
      const parts: string[] = [];
      if (inspHooks) parts.push(`## Hooks\n${inspHooks}`);
      if (inspFrameworks) parts.push(`## Frameworks\n${inspFrameworks}`);
      if (inspArchetypes) parts.push(`## Arquétipos\n${inspArchetypes}`);
      if (inspTrending) parts.push(`## Em alta\n${inspTrending}`);
      return parts.join("\n\n");
    }
    if (activeTab === "validar" && validResults.length > 0) {
      return validResults.map((r) => `### ${r.label}\n${r.text}`).join("\n\n");
    }
    return result ?? "";
  };

  const copyResult = () => {
    const toCopy = getCopyContent();
    if (!toCopy) return;
    navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderField = (
    key: string,
    schema: { type?: string; description?: string; enum?: string[] }
  ) => {
    const value = formValues[key] ?? "";
    const setValue = (v: string) => setFormValues((prev) => ({ ...prev, [key]: v }));

    if (schema.enum) {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{schema.description || key}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder={`Selecione ${key}`} />
            </SelectTrigger>
            <SelectContent>
              {schema.enum.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (key === "network" && !schema.enum) {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{schema.description || key}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder="Rede" />
            </SelectTrigger>
            <SelectContent>
              {NETWORKS.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (key === "platform" && !schema.enum) {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{schema.description || key}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (key === "framework" && !schema.enum) {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{schema.description || key}</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger id={key} className="w-full">
              <SelectValue placeholder="Framework" />
            </SelectTrigger>
            <SelectContent>
              {FRAMEWORKS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    const isNumber = schema.type === "number";
    if (key === "text") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{schema.description || key}</Label>
          <textarea
            id={key}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={schema.description || key}
            rows={4}
            className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30 resize-y"
          />
        </div>
      );
    }
    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={key}>{schema.description || key}</Label>
        <Input
          id={key}
          type={isNumber ? "number" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={schema.description || key}
          className="w-full"
        />
      </div>
    );
  };

  const fields =
    currentTool?.inputSchema?.properties &&
    Object.keys(currentTool.inputSchema.properties).length > 0
      ? Object.entries(currentTool.inputSchema.properties).map(
          ([key, schema]) => renderField(key, schema ?? {})
        )
      : null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "inspiracao", label: "Inspiração", icon: <Lightbulb className="h-4 w-4" /> },
    { id: "validar", label: "Validar conteúdo", icon: <ShieldCheck className="h-4 w-4" /> },
    { id: "chat", label: "Chat com IA", icon: <MessageCircle className="h-4 w-4" /> },
    { id: "ferramentas", label: "Todas as ferramentas", icon: <Wrench className="h-4 w-4" /> },
  ];

  if (loadingTools) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && tools.length === 0) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-center text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchTools}>Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const displayResult = activeTab === "validar" && validResults.length > 0
    ? validResults.map((r) => `### ${r.label}\n${r.text}`).join("\n\n")
    : result;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "inspiracao" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" />
                Pesquisa rápida
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Busque hooks, frameworks e arquétipos para a rede escolhida em um clique.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rede</Label>
                  <Select value={inspNetwork} onValueChange={setInspNetwork}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORKS.map((n) => (
                        <SelectItem key={n} value={n}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Categoria (opcional)</Label>
                  <Input
                    value={inspCategory}
                    onChange={(e) => setInspCategory(e.target.value)}
                    placeholder="ex: storytelling, engagement"
                  />
                </div>
              </div>
              <Button onClick={runInspiracao} disabled={loading} className="w-full gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Buscar inspiração</>
                )}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resultado</CardTitle>
              {(inspHooks || inspFrameworks || inspArchetypes || inspTrending) && (
                <Button variant="ghost" size="sm" onClick={copyResult} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {inspHooks || inspFrameworks || inspArchetypes || inspTrending ? (
                <div className="space-y-6">
                  {inspHooks && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-3.5 w-3.5" /> Hooks
                      </h4>
                      <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {inspHooks}
                      </pre>
                    </div>
                  )}
                  {inspFrameworks && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Frameworks de copywriting</h4>
                      <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {inspFrameworks}
                      </pre>
                    </div>
                  )}
                  {inspArchetypes && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Arquétipos de voz</h4>
                      <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {inspArchetypes}
                      </pre>
                    </div>
                  )}
                  {inspTrending && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Conteúdo em alta</h4>
                      <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {inspTrending}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <Lightbulb className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Selecione a rede e clique em Buscar inspiração.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "validar" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                Validar antes de publicar
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Cole o texto e valide limites, frases de IA e preview em um clique.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Texto do post</Label>
                <textarea
                  value={validText}
                  onChange={(e) => setValidText(e.target.value)}
                  placeholder="Cole aqui o texto que vai publicar..."
                  rows={6}
                  className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm dark:bg-input/30 resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label>Plataforma</Label>
                <Select value={validPlatform} onValueChange={setValidPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runValidarTudo} disabled={loading || !validText.trim()} className="w-full gap-2">
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Validando…</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Validar tudo</>
                )}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resultado</CardTitle>
              {validResults.length > 0 && (
                <Button variant="ghost" size="sm" onClick={copyResult} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {validResults.length > 0 ? (
                <div className="space-y-4">
                  {validResults.map((r) => (
                    <div key={r.label}>
                      <h4 className="mb-2 text-sm font-semibold">{r.label}</h4>
                      <pre className="max-h-32 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {r.text}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Cole o texto e clique em Validar tudo.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "chat" && (
        <div className="grid gap-6 lg:grid-cols-1">
          <VibeMarketingChat
            inspirationData={{
              hooks: inspHooks,
              frameworks: inspFrameworks,
              archetypes: inspArchetypes,
              trending: inspTrending,
            }}
          />
        </div>
      )}

      {activeTab === "ferramentas" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4" />
                Executar ferramenta
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Vibe Marketing e AI Marketing Agent (gratuitos).
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Servidor</Label>
                    <Select
                      value={toolsServerFilter || "all"}
                      onValueChange={(v) => {
                        setToolsServerFilter(v === "all" ? "" : v);
                        setSelectedTool("");
                        setFormValues({});
                        setResult(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os servidores</SelectItem>
                        {[...new Set(tools.map((t) => t.server))].map((s) => {
                          const t0 = tools.find((t) => t.server === s);
                          return (
                            <SelectItem key={s} value={s}>
                              {t0?.serverName ?? s}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ferramenta</Label>
                    <Select
                      value={selectedTool}
                      onValueChange={(v) => {
                        setSelectedTool(v);
                        setFormValues({});
                        setResult(null);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione uma ferramenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTools.map((t) => (
                          <SelectItem key={`${t.server}:${t.name}`} value={`${t.server}:${t.name}`}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {currentTool && (
                  <p className="text-sm text-muted-foreground">{currentTool.description}</p>
                )}
                {fields && (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">{fields}</div>
                )}
                <Button type="submit" disabled={loading} className="w-full gap-2">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Executando…</>
                  ) : (
                    <><ChevronRight className="h-4 w-4" /> Executar</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resultado</CardTitle>
              {displayResult && (
                <Button variant="ghost" size="sm" onClick={copyResult} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {displayResult ? (
                <pre className="max-h-[400px] overflow-auto rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap break-words">
                  {displayResult}
                </pre>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <Wrench className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Selecione uma ferramenta e execute.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
