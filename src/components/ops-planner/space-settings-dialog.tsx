"use client";

import { useMemo, useState } from "react";
import { Archive, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleInSpace, type OpsAccess } from "@/lib/ops-planner/domain";
import {
  OPS_SPACE_ROLE_LABEL,
  OPS_SPACE_ROLES,
  type OpsList,
  type OpsMember,
  type OpsPerson,
  type OpsSpace,
  type OpsSpaceRole,
} from "@/lib/ops-planner/types";
import { userMatchesSearch } from "@/lib/user-search";
import { cn } from "@/lib/utils";
import { errorMessage, opsApi } from "./ops-client";
import { PersonAvatar } from "./ops-ui";

type Tab = "membros" | "listas" | "limite";

export function SpaceSettingsDialog({
  space,
  access,
  members,
  lists,
  people,
  onClose,
  onSpaceChange,
  onMembersChange,
  onListsChange,
}: {
  space: OpsSpace;
  access: OpsAccess;
  members: OpsMember[];
  lists: OpsList[];
  people: OpsPerson[];
  onClose: () => void;
  onSpaceChange: (space: OpsSpace) => void;
  onMembersChange: (members: OpsMember[]) => void;
  onListsChange: (lists: OpsList[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("membros");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newList, setNewList] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [wip, setWip] = useState(String(space.wip_limit));
  const isGestor = access.isAdmin || roleInSpace(access, space.id) === "gestor";
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const spaceMembers = members
    .filter((member) => member.space_id === space.id)
    .sort((a, b) => OPS_SPACE_ROLES.indexOf(a.role) - OPS_SPACE_ROLES.indexOf(b.role) || (byId.get(a.user_id)?.name ?? "").localeCompare(byId.get(b.user_id)?.name ?? ""));
  const memberIds = new Set(spaceMembers.map((member) => member.user_id));
  const candidates = search.trim()
    ? people
        .filter((person) => person.is_active && !memberIds.has(person.id))
        .filter((person) => userMatchesSearch(`${person.name} ${person.department ?? ""} ${person.email ?? ""}`, search))
        .slice(0, 8)
    : [];
  const spaceLists = lists.filter((list) => list.space_id === space.id);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  }

  const otherMembers = members.filter((member) => member.space_id !== space.id);

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="gap-1 border-b border-[#e6eef0] px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-lg">Configurar {space.name}</DialogTitle>
          <DialogDescription>Quem participa, as listas do espaço e o limite de tarefas em andamento por pessoa.</DialogDescription>
          <div role="tablist" aria-label="Configurações do espaço" className="mt-2 flex gap-1">
            {(
              [
                ["membros", "Membros"],
                ["listas", "Listas"],
                ["limite", "Limite em andamento"],
              ] as Array<[Tab, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  tab === id ? "bg-[#e8f8f8] text-[#285f7a]" : "text-muted-foreground hover:bg-slate-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "membros" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ops-member-search" className="mb-1.5 block text-xs font-semibold text-[#315f73]">
                  Adicionar pessoa
                </Label>
                <Input id="ops-member-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, área ou e-mail" />
                {candidates.length > 0 && (
                  <ul className="mt-2 divide-y divide-[#eef3f4] rounded-md border border-[#dce9eb]">
                    {candidates.map((person) => (
                      <li key={person.id} className="flex items-center gap-2 px-3 py-2">
                        <PersonAvatar person={person} className="size-7" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{person.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{person.department}</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy === person.id}
                          onClick={() =>
                            void run(person.id, async () => {
                              const { member } = await opsApi.post<{ member: OpsMember }>(`/spaces/${space.id}/members`, { user_id: person.id, role: "membro" });
                              onMembersChange([...otherMembers, ...spaceMembers, member]);
                              setSearch("");
                            })
                          }
                        >
                          <UserPlus className="size-4" />
                          Adicionar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ul className="divide-y divide-[#eef3f4] rounded-md border border-[#dce9eb]">
                {spaceMembers.map((member) => {
                  const person = byId.get(member.user_id);
                  const locked = member.role === "gestor" && !isGestor;
                  return (
                    <li key={member.user_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                      <PersonAvatar person={person} className="size-7" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{person?.name ?? "Pessoa"}</span>
                      <Select
                        value={member.role}
                        disabled={locked || busy === member.user_id}
                        onValueChange={(value) =>
                          void run(member.user_id, async () => {
                            const { member: saved } = await opsApi.patch<{ member: OpsMember }>(`/spaces/${space.id}/members/${member.user_id}`, { role: value });
                            onMembersChange([...otherMembers, ...spaceMembers.map((item) => (item.user_id === saved.user_id ? saved : item))]);
                          })
                        }
                      >
                        <SelectTrigger aria-label={`Papel de ${person?.name ?? "pessoa"}`} className="h-9 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPS_SPACE_ROLES.filter((role) => isGestor || role !== "gestor").map((role: OpsSpaceRole) => (
                            <SelectItem key={role} value={role}>
                              {OPS_SPACE_ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                          {!isGestor && member.role === "gestor" && <SelectItem value="gestor">Gestor</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remover ${person?.name ?? "pessoa"} do espaço`}
                        disabled={locked || busy === member.user_id}
                        className="text-muted-foreground hover:text-red-700"
                        onClick={() =>
                          void run(member.user_id, async () => {
                            await opsApi.del(`/spaces/${space.id}/members/${member.user_id}`);
                            onMembersChange([...otherMembers, ...spaceMembers.filter((item) => item.user_id !== member.user_id)]);
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  );
                })}
                {spaceMembers.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Ninguém no espaço ainda.</li>}
              </ul>
              <p className="text-xs text-muted-foreground">Gestor vê todos os espaços em que está; líder administra o espaço; membro vê e trabalha nas tarefas do espaço.</p>
            </div>
          )}

          {tab === "listas" && (
            <div className="space-y-4">
              <ul className="divide-y divide-[#eef3f4] rounded-md border border-[#dce9eb]">
                {spaceLists.map((list) => {
                  const value = names[list.id] ?? list.name;
                  return (
                    <li key={list.id} className="flex items-center gap-2 px-3 py-2">
                      <Input
                        value={value}
                        aria-label={`Nome da lista ${list.name}`}
                        className="h-9"
                        onChange={(event) => setNames((current) => ({ ...current, [list.id]: event.target.value }))}
                        onBlur={() => {
                          const name = value.trim();
                          if (!name || name === list.name) return;
                          void run(list.id, async () => {
                            const { list: saved } = await opsApi.patch<{ list: OpsList }>(`/lists/${list.id}`, { name });
                            onListsChange(lists.map((item) => (item.id === saved.id ? saved : item)));
                          });
                        }}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Arquivar a lista ${list.name}`}
                        disabled={busy === list.id}
                        className="text-muted-foreground hover:text-red-700"
                        onClick={() =>
                          void run(list.id, async () => {
                            await opsApi.del(`/lists/${list.id}`);
                            onListsChange(lists.filter((item) => item.id !== list.id));
                          })
                        }
                      >
                        <Archive className="size-4" />
                      </Button>
                    </li>
                  );
                })}
                {spaceLists.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sem listas. As tarefas ficam todas juntas.</li>}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = newList.trim();
                  if (!name) return;
                  void run("nova", async () => {
                    const { list } = await opsApi.post<{ list: OpsList }>(`/spaces/${space.id}/lists`, { name });
                    onListsChange([...lists, list]);
                    setNewList("");
                  });
                }}
              >
                <Input value={newList} onChange={(event) => setNewList(event.target.value)} placeholder="Nova lista (ex.: Reembolsos)" aria-label="Nome da nova lista" />
                <Button type="submit" variant="secondary" disabled={busy === "nova" || !newList.trim()}>
                  {busy === "nova" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Criar
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">Arquivar uma lista não apaga as tarefas: elas ficam &quot;sem lista&quot; no espaço.</p>
            </div>
          )}

          {tab === "limite" && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const value = Number(wip);
                if (!Number.isInteger(value) || value < 1 || value > 20) return setError("Use um número de 1 a 20.");
                void run("wip", async () => {
                  const { space: saved } = await opsApi.patch<{ space: OpsSpace }>(`/spaces/${space.id}`, { wip_limit: value });
                  onSpaceChange(saved);
                });
              }}
            >
              <Label htmlFor="ops-wip" className="block text-xs font-semibold text-[#315f73]">
                Tarefas em andamento por pessoa
              </Label>
              <div className="flex gap-2">
                <Input id="ops-wip" type="number" min={1} max={20} value={wip} onChange={(event) => setWip(event.target.value)} className="w-28" />
                <Button type="submit" disabled={busy === "wip"}>
                  {busy === "wip" && <Loader2 className="size-4 animate-spin" />}
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Quem passa do limite aparece em destaque na Gestão. É só um aviso: ninguém é impedido de puxar tarefa.
              </p>
            </form>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-6 mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
        <div className="flex justify-end border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-4">
          <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
