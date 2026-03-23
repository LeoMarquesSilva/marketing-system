"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Loader2, Plus, Pencil, Trash2, AlertCircle, Play, Newspaper } from "lucide-react";
import { AREAS } from "@/lib/constants";

/** Converte palavras-chave (vírgula ou quebra de linha) em query RSS do Google News. */
function keywordsToRssQuery(keywords: string): string {
  const terms = keywords
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return "";
  return terms.map((t) => `"${t}"`).join(" OR ");
}

/** Extrai palavras-chave de uma query RSS salva para exibir no campo simples. */
function rssQueryToKeywords(rssQuery: string): string {
  if (!rssQuery.trim()) return "";
  const matches = rssQuery.match(/"([^"]+)"/g);
  if (!matches) return rssQuery;
  return matches.map((m) => m.slice(1, -1)).join(", ");
}

interface ContentTopic {
  id: string;
  name: string;
  rss_query: string;
  legal_area: string;
  is_active: boolean;
  months_back?: number;
  item_limit?: number;
  created_at: string;
}

export function ConteudoTemasClient() {
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<ContentTopic | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    rss_query: "",
    keywords: "",
    legal_area: "",
    is_active: true,
    months_back: 4,
    item_limit: 20,
  });

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch("/api/admin/content-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list",
          includeInactive: true,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao carregar temas");
      }
      const data = await res.json();
      setTopics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const resetForm = () => {
    setForm({
      name: "",
      rss_query: "",
      keywords: "",
      legal_area: "",
      is_active: true,
      months_back: 4,
      item_limit: 20,
    });
    setEditingTopic(null);
    setIsCreateOpen(false);
  };

  const handleCreate = async () => {
    const rssQuery = form.keywords ? keywordsToRssQuery(form.keywords) : form.rss_query;
    if (!form.name || !rssQuery || !form.legal_area) {
      setError("Preencha nome, palavras-chave e área.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada.");
        return;
      }
      const res = await fetch("/api/admin/content-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          rss_query: rssQuery,
          legal_area: form.legal_area,
          is_active: form.is_active,
          months_back: form.months_back,
          item_limit: form.item_limit,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
      setTopics((prev) => [...prev, data]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    const rssQuery = form.keywords ? keywordsToRssQuery(form.keywords) : form.rss_query;
    if (!editingTopic || !form.name || !rssQuery || !form.legal_area) {
      setError("Preencha todos os campos.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada.");
        return;
      }
      const res = await fetch("/api/admin/content-topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTopic.id,
          name: form.name,
          rss_query: rssQuery,
          legal_area: form.legal_area,
          is_active: form.is_active,
          months_back: form.months_back,
          item_limit: form.item_limit,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
      setTopics((prev) =>
        prev.map((t) => (t.id === editingTopic.id ? data : t))
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este tema? Os posts vinculados também serão removidos.")) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada.");
        return;
      }
      const res = await fetch("/api/admin/content-topics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir");
      setTopics((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (topic: ContentTopic) => {
    setGeneratingTopicId(topic.id);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Sessão expirada. Faça login novamente.");
        setGeneratingTopicId(null);
        return;
      }
      const res = await fetch("/api/content-roteiros/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicIds: [topic.id],
          monthsBack: topic.months_back ?? 4,
          limit: topic.item_limit ?? 20,
          accessToken: session.access_token,
          refreshToken: session.refresh_token ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar");
      const msg = data.errors?.length
        ? `Criados: ${data.created}. Alguns erros: ${data.errors.slice(0, 2).join("; ")}`
        : `Pronto! ${data.created} conteúdo(s) de post criado(s). Veja em Conteúdo para Post.`;
      setError(null);
      alert(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar");
    } finally {
      setGeneratingTopicId(null);
    }
  };

  const openEdit = (topic: ContentTopic) => {
    setEditingTopic(topic);
    const keywords = rssQueryToKeywords(topic.rss_query);
    setForm({
      name: topic.name,
      rss_query: topic.rss_query,
      keywords: keywords || topic.rss_query,
      legal_area: topic.legal_area,
      is_active: topic.is_active,
      months_back: topic.months_back ?? 4,
      item_limit: topic.item_limit ?? 20,
    });
  };

  const isDialogOpen = isCreateOpen || !!editingTopic;

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Temas configurados</CardTitle>
          <div className="flex gap-2">
            <Link href="/conteudo/roteiros">
              <Button variant="outline" size="sm" className="gap-2">
                <Newspaper className="h-4 w-4" />
                Ver posts
              </Button>
            </Link>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo tema
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {topics.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <p className="text-sm">Nenhum tema. Clique em Novo tema para adicionar.</p>
            </div>
          ) : (
            <>
            <p className="text-xs text-muted-foreground mb-4">
              Clique em <strong>Gerar</strong> para buscar notícias e criar conteúdo de post (carrossel). Depois veja em Conteúdo para Post para aprovar.
            </p>
            <div className="space-y-3">
              {topics.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border p-4 bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium">{t.name}</h4>
                    <p className="text-sm text-muted-foreground truncate" title={t.rss_query}>
                      {rssQueryToKeywords(t.rss_query) || (t.rss_query.length > 80 ? `${t.rss_query.slice(0, 80)}…` : t.rss_query)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.legal_area} • {t.months_back ?? 4} meses • máx. {t.item_limit ?? 20} • {t.is_active ? "Ativo" : "Inativo"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(t)}
                      disabled={generatingTopicId !== null || !t.is_active}
                      className="gap-1.5"
                    >
                      {generatingTopicId === t.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Gerar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTopic ? "Editar tema" : "Novo tema"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Reestruturação - GPA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Palavras-chave para busca</Label>
              <textarea
                id="keywords"
                value={form.keywords}
                onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
                placeholder="Digite os termos separados por vírgula. Ex: GPA, PCAR3, recuperação judicial, insolvência, credores"
                rows={3}
                className="w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Cada termo será buscado no Google News. Separe por vírgula ou quebra de linha.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="months_back">Meses para trás</Label>
                <Input
                  id="months_back"
                  type="number"
                  min={1}
                  max={12}
                  value={form.months_back}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      months_back: Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 4)),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Buscar notícias dos últimos N meses</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item_limit">Quantidade máxima</Label>
                <Input
                  id="item_limit"
                  type="number"
                  min={1}
                  max={50}
                  value={form.item_limit}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      item_limit: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 20)),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Máx. de notícias por execução</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="legal_area">Área jurídica</Label>
              <Select
                value={form.legal_area}
                onValueChange={(v) => setForm((p) => ({ ...p, legal_area: v }))}
              >
                <SelectTrigger id="legal_area">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingTopic && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-input"
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              onClick={editingTopic ? handleUpdate : handleCreate}
              disabled={saving}
              className="gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingTopic ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
