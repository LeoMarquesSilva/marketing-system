"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudienceIcon, AudienceSelect, audienceIconStyle, ToolLogo } from "@/components/rh/registration/welcome-ui";
import { AUDIENCE_ALL, audienceLabel, groupLinksByAudience } from "@/lib/rh/welcome/audience";
import { toolLogoFor } from "@/lib/rh/welcome/tool-logos";
import type { WelcomeLink, WelcomeLinkInput } from "@/lib/rh/welcome/types";
import { cn } from "@/lib/utils";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const EMPTY: WelcomeLinkInput = {
  title: "",
  url: "",
  description: null,
  internalNote: null,
  audience: AUDIENCE_ALL,
  isActive: true,
};

async function postLinks(body: Record<string, unknown>): Promise<{ links?: WelcomeLink[]; error?: string }> {
  const response = await fetch("/api/rh/boas-vindas/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = (await response?.json().catch(() => null)) as { links?: WelcomeLink[]; error?: string } | null;
  if (!response?.ok) return { error: data?.error ?? "Não foi possível salvar agora." };
  return { links: data?.links ?? [] };
}

/** Links que o colaborador encontra em Meus links: o RH mantém aqui, sem depender de código. */
export function WelcomeLinksDialog({
  open,
  links,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  links: WelcomeLink[];
  onOpenChange: (open: boolean) => void;
  onChange: (links: WelcomeLink[]) => void;
}) {
  const [editing, setEditing] = useState<WelcomeLinkInput | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = groupLinksByAudience(links);

  async function run(key: string, body: Record<string, unknown>): Promise<boolean> {
    setBusy(key);
    setError(null);
    const result = await postLinks(body);
    setBusy(null);
    if (result.error || !result.links) {
      setError(result.error ?? "Não foi possível salvar agora.");
      return false;
    }
    onChange(result.links);
    return true;
  }

  async function save() {
    if (!editing) return;
    if (await run("save", { action: "save", link: editing })) setEditing(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(null);
          setConfirmDelete(null);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>{editing ? (editing.id ? "Editar link" : "Novo link") : "Links de boas-vindas"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Aparece em Meus links para quem é do público escolhido."
              : "O que cada pessoa encontra em Meus links, no ORQESTRAI. Cada link é para todos, para uma divisão ou para uma equipe."}
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="link-title">Nome</Label>
                <Input
                  id="link-title"
                  value={editing.title}
                  maxLength={120}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                  placeholder="Ex.: Pauta trabalhista"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="link-audience">Para quem</Label>
                <AudienceSelect
                  id="link-audience"
                  value={editing.audience}
                  onChange={(audience) => setEditing({ ...editing, audience })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-url">Endereço</Label>
              <Input
                id="link-url"
                value={editing.url}
                onChange={(event) => setEditing({ ...editing, url: event.target.value })}
                placeholder="https://"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-description">Explicação</Label>
              <Textarea
                id="link-description"
                rows={2}
                maxLength={240}
                value={editing.description ?? ""}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                placeholder="Uma frase sobre para que serve."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-note">Nota interna</Label>
              <Textarea
                id="link-note"
                rows={2}
                maxLength={240}
                value={editing.internalNote ?? ""}
                onChange={(event) => setEditing({ ...editing, internalNote: event.target.value })}
                placeholder="Ex.: senha padrão do primeiro acesso."
              />
              <p className="text-xs text-muted-foreground">Aparece em destaque embaixo do link, em Meus links.</p>
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[#285f7a]"
                  checked={editing.isActive}
                  onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })}
                />
                <span>
                  <span className="block text-sm font-medium">Ativo</span>
                  <span className="block text-xs text-muted-foreground">Desmarque para pausar sem apagar.</span>
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {groups.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum link ainda.</p>
            )}
            {groups.map((group) => (
              <section key={group.key} className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className={cn("rounded-md p-1.5 ring-1", audienceIconStyle(group.key))}>
                    <AudienceIcon audience={group.key} className="size-3.5" />
                  </span>
                  {audienceLabel(group.key)}
                  <span className="text-xs font-normal text-muted-foreground">{group.links.length}</span>
                </h3>
                <ul className="divide-y rounded-xl border">
                  {group.links.map((link, index) => (
                    <li key={link.id} className={cn("flex items-start gap-3 px-3 py-2.5", !link.isActive && "opacity-60")}>
                      <ToolLogo url={link.url} size={32} className="mt-0.5 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                          {link.title}
                          {!link.isActive && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Pausado</span>
                          )}
                        </p>
                        {link.description && <p className="text-xs text-muted-foreground">{link.description}</p>}
                        {link.internalNote && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-800">
                            <KeyRound className="size-3 shrink-0" aria-hidden />
                            {link.internalNote}
                          </p>
                        )}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#285f7a] hover:underline"
                        >
                          {toolLogoFor(link.url)?.name ?? hostOf(link.url)}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      </div>
                      {confirmDelete === link.id ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Excluir?</span>
                          <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                            Não
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy === `delete-${link.id}`}
                            onClick={() => void run(`delete-${link.id}`, { action: "delete", id: link.id })}
                          >
                            {busy === `delete-${link.id}` && <Loader2 className="size-3.5 animate-spin" />}
                            Excluir
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Subir"
                            disabled={index === 0 || !!busy}
                            onClick={() => void run(`move-${link.id}`, { action: "move", id: link.id, direction: "up" })}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Descer"
                            disabled={index === group.links.length - 1 || !!busy}
                            onClick={() => void run(`move-${link.id}`, { action: "move", id: link.id, direction: "down" })}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Editar"
                            onClick={() =>
                              setEditing({
                                id: link.id,
                                title: link.title,
                                url: link.url,
                                description: link.description,
                                internalNote: link.internalNote,
                                audience: link.audience,
                                isActive: link.isActive,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label="Excluir"
                            onClick={() => setConfirmDelete(link.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <DialogFooter className="items-center gap-2 border-t px-6 py-4 sm:gap-2">
          {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={busy === "save"}>
                Voltar
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={() => void save()}
                disabled={busy === "save" || !editing.title.trim() || !editing.url.trim()}
              >
                {busy === "save" && <Loader2 className="size-4 animate-spin" />}
                Salvar link
              </Button>
            </>
          ) : (
            <Button type="button" className="gap-2" onClick={() => setEditing({ ...EMPTY })}>
              <Plus className="size-4" />
              Novo link
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
