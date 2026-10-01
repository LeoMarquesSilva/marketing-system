"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesGuest, normalizeGuestText, type GuestCandidate, type GuestImportSource } from "@/lib/event-guest-import";
import type { EventInvite } from "@/lib/eventos";
import { EventPerson } from "./event-person";

export function EventGuestImportDialog({ eventId, source, invites, onClose, onImported }: {
  eventId: string;
  source: GuestImportSource;
  invites: EventInvite[];
  onClose: () => void;
  onImported: (result: { imported: number; skipped: number }) => Promise<void>;
}) {
  const [candidates, setCandidates] = useState<GuestCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const office = source === "office";
  const endpoint = `/api/eventos/${eventId}/guest-import`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${endpoint}?source=${source}`, { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar a lista.");
        if (!controller.signal.aborted) setCandidates(body.candidates);
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, source, attempt]);

  const existing = useMemo(() => new Set(candidates.filter(candidate => invites.some(guest => matchesGuest(candidate, guest))).map(candidate => candidate.key)), [candidates, invites]);
  const available = candidates.filter(candidate => !existing.has(candidate.key));
  const filtered = candidates.filter(candidate => normalizeGuestText(`${candidate.name} ${candidate.email ?? ""} ${candidate.company ?? ""} ${candidate.detail ?? ""}`).includes(normalizeGuestText(search)));
  const visibleAvailable = filtered.filter(candidate => !existing.has(candidate.key));
  const selection = selected.filter(key => available.some(candidate => candidate.key === key));

  async function importSelected() {
    if (saving || !selection.length) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, keys: selection }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível adicionar os convidados.");
      await onImported(body);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível adicionar os convidados.");
    } finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl" showCloseButton={!saving}>
      <DialogHeader className="border-b p-5 pr-12">
        <DialogTitle>{office ? "Adicionar pessoas do escritório" : "Importar de Meus Clientes"}</DialogTitle>
        <DialogDescription>{office ? "Selecione colaboradores ativos do cadastro do escritório, incluindo quem não tem acesso ao sistema." : "Pessoas e contatos marcados para a Festa de 10 anos, conforme seu acesso em Meus Clientes."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 border-b px-5 py-4">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar pessoas para adicionar" placeholder={office ? "Buscar por nome ou área…" : "Buscar por nome ou empresa…"} value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{candidates.length} {candidates.length === 1 ? "pessoa" : "pessoas"} · {existing.size} já na lista · {selection.length} selecionadas</span>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" disabled={loading || saving || !available.length} onClick={() => setSelected(available.map(candidate => candidate.key))}>{office ? "Selecionar todo o escritório" : "Selecionar todos os marcados"}</Button>
            {selection.length > 0 && <Button size="sm" variant="ghost" disabled={saving} onClick={() => setSelected([])}>Limpar seleção</Button>}
          </div>
        </div>
      </div>
      {error && <div role="alert" className="mx-5 mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}{!saving && <Button variant="ghost" size="sm" onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Atualizar lista</Button>}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2" aria-busy={loading}>
        {loading ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando pessoas…</div> : <>
          {filtered.length > 0 && <label className="flex min-h-10 items-center gap-3 border-b text-xs text-muted-foreground"><input type="checkbox" aria-label="Selecionar todas as pessoas exibidas" disabled={saving || !visibleAvailable.length} checked={visibleAvailable.length > 0 && visibleAvailable.every(candidate => selection.includes(candidate.key))} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, ...visibleAvailable.map(candidate => candidate.key)])] : previous.filter(key => !visibleAvailable.some(candidate => candidate.key === key)))} />Selecionar pessoas exibidas ({visibleAvailable.length})</label>}
          {filtered.map(candidate => {
            const added = existing.has(candidate.key);
            return <label key={candidate.key} className={`flex min-h-20 items-center gap-3 border-b border-border/60 py-3 ${added ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}>
              <input type="checkbox" aria-label={`Adicionar ${candidate.name}`} disabled={added || saving} checked={added || selection.includes(candidate.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, candidate.key] : previous.filter(key => key !== candidate.key))} />
              <div className="min-w-0 flex-1"><EventPerson name={candidate.name} avatar={candidate.avatarUrl} /><p className="mt-1 break-words text-xs text-muted-foreground">{[candidate.company, candidate.detail, candidate.email || "Sem e-mail cadastrado"].filter(Boolean).join(" · ")}</p></div>
              {added && <span className="flex shrink-0 items-center gap-1 text-xs"><Check className="size-3" />Já adicionado</span>}
            </label>;
          })}
          {!filtered.length && <p className="py-12 text-center text-sm text-muted-foreground">{search ? "Nenhuma pessoa encontrada nesta busca." : office ? "Nenhum colaborador ativo encontrado." : "Nenhuma pessoa marcada para a Festa de 10 anos no seu escopo de Meus Clientes."}</p>}
        </>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 p-5">
        <p className="max-w-xs text-xs text-muted-foreground">A inclusão prepara a lista de convidados. Os convites não são enviados nesta etapa.</p>
        <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Cancelar</Button><Button disabled={saving || loading || !selection.length} onClick={importSelected}>{saving && <Loader2 className="size-4 animate-spin" />}{saving ? "Adicionando…" : `Adicionar ${selection.length} ${selection.length === 1 ? "pessoa" : "pessoas"}`}</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
