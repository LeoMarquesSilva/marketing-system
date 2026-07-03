"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import {
  COMMUNICATION_CHANNEL_LABEL,
  formatDateBR,
  type EventCommunication,
  type EventCommunicationChannel,
} from "@/lib/eventos";
import type { User } from "@/lib/users";

export function EventoComunicacaoTab({
  communications,
  users,
  onAddCommunication,
  onDeleteCommunication,
  isLoading = false,
}: {
  communications: EventCommunication[];
  users: User[];
  onAddCommunication: (input: {
    channel: EventCommunicationChannel;
    title: string;
    content?: string;
    plannedDate?: string;
    responsibleUserId?: string;
  }) => void;
  onDeleteCommunication: (id: string) => void;
  isLoading?: boolean;
}) {
  const [channel, setChannel] = useState<EventCommunicationChannel>("email");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<EventCommunicationChannel | "__all__">("__all__");
  const [sortBy, setSortBy] = useState<"latest" | "planned_asc" | "planned_desc">("latest");

  const filteredCommunications = useMemo(() => {
    const base = communications.filter((c) => {
      if (channelFilter !== "__all__" && c.channel !== channelFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(s) ||
        (c.content ?? "").toLowerCase().includes(s) ||
        (c.responsibleUserName ?? "").toLowerCase().includes(s)
      );
    });
    if (sortBy === "planned_asc") {
      return [...base].sort((a, b) => (a.plannedDate ?? "9999-12-31").localeCompare(b.plannedDate ?? "9999-12-31"));
    }
    if (sortBy === "planned_desc") {
      return [...base].sort((a, b) => (b.plannedDate ?? "0000-01-01").localeCompare(a.plannedDate ?? "0000-01-01"));
    }
    return base;
  }, [communications, search, channelFilter, sortBy]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as EventCommunicationChannel)}
          >
            {(Object.keys(COMMUNICATION_CHANNEL_LABEL) as EventCommunicationChannel[]).map((c) => (
              <option key={c} value={c}>
                {COMMUNICATION_CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <Input placeholder="Título *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <DatePickerField value={plannedDate} onChange={setPlannedDate} placeholder="Data planejada" />
          <UserSelectSearch
            users={users}
            value={responsibleUserId}
            onValueChange={setResponsibleUserId}
            placeholder="Responsável"
            allowClear
          />
        </div>
        <textarea
          className="mt-2 flex min-h-[70px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Conteúdo"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button
            onClick={() => {
              if (!title.trim()) return;
              onAddCommunication({
                channel,
                title: title.trim(),
                content: content.trim() || undefined,
                plannedDate: plannedDate || undefined,
                responsibleUserId: responsibleUserId || undefined,
              });
              setTitle("");
              setContent("");
              setPlannedDate("");
              setResponsibleUserId("");
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar item
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-4 mt-2">
          <Input placeholder="Buscar comunicação..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as EventCommunicationChannel | "__all__")}
          >
            <option value="__all__">Todos os canais</option>
            {(Object.keys(COMMUNICATION_CHANNEL_LABEL) as EventCommunicationChannel[]).map((c) => (
              <option key={c} value={c}>
                {COMMUNICATION_CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "latest" | "planned_asc" | "planned_desc")}
          >
            <option value="latest">Ordenar: mais recentes</option>
            <option value="planned_asc">Ordenar: data planejada crescente</option>
            <option value="planned_desc">Ordenar: data planejada decrescente</option>
          </select>
          <div className="h-9 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground flex items-center">
            {filteredCommunications.length} comunicação(ões) exibida(s)
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Planejada</TableHead>
              <TableHead>Publicada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCommunications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma comunicação cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredCommunications.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{COMMUNICATION_CHANNEL_LABEL[c.channel]}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell>{c.responsibleUserName || "—"}</TableCell>
                  <TableCell>{formatDateBR(c.plannedDate)}</TableCell>
                  <TableCell>{formatDateBR(c.publishedDate)}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteCommunication(c.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}
