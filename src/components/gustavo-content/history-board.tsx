"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUSTAVO_CONTENT_STATUS_LABELS } from "@/lib/gustavo-content/constants";
import type { GustavoContentItem } from "@/lib/gustavo-content/types";

export function HistoryBoard() {
  const [items, setItems] = useState<GustavoContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetch("/api/gustavo-content/items?view=historico")
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!query.trim()) return true;
        const blob = `${item.title ?? ""} ${item.thesis_title ?? ""} ${item.linkedin_post ?? ""}`.toLowerCase();
        return blob.includes(query.toLowerCase());
      }),
    [items, status, query]
  );

  if (loading) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[#04202f]/15 bg-[#04202f]/[0.02] px-5 py-10">
        <h4 className="text-lg font-semibold text-[#04202f]">
          Ainda não há conteúdos publicados neste módulo.
        </h4>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          O histórico entra na geração para evitar repetir a mesma tese, o mesmo gancho ou o mesmo
          ângulo sobre a mesma empresa.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por pauta, tese ou post"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="publicado">Publicado</SelectItem>
            <SelectItem value="enviado_mkt">Enviado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
            <SelectItem value="arquivado">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        {visible.map((item) => (
          <Link
            key={item.id}
            href={`/conteudo/gustavo/producao/${item.id}`}
            className="block rounded-2xl border border-black/[0.06] bg-white p-4"
          >
            <p className="text-[11px] uppercase tracking-wide text-[#347796]">
              {GUSTAVO_CONTENT_STATUS_LABELS[item.status]}
            </p>
            <h4 className="mt-1 font-semibold text-[#04202f]">{item.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.thesis_title ?? "Sem tese"}
              {item.selected_angle ? ` · ${item.selected_angle.title}` : ""}
              {` · ${format(new Date(item.updated_at), "dd MMM yyyy", { locale: ptBR })}`}
            </p>
            {item.linkedin_published_url && (
              <p className="mt-2 text-xs text-[#347796]">LinkedIn publicado</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
