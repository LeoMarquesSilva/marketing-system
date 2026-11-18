"use client";

import { useMemo, useState } from "react";
import { ListChecks, Pencil, Plus, Send, Trash2, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteEmailList, type EmailCampaign, type EmailContact, type EmailList } from "@/lib/email-marketing";
import { ListFormDialog } from "./list-form-dialog";
import { CampaignStatusPill } from "./campaigns-tab";
import { BlockHeader, ClientLogoStack, clientLabel, summarizeClients, type ClientRef } from "./email-marketing-visuals";
import { useListMembers } from "./use-list-members";

interface ListsTabProps {
  lists: EmailList[];
  contacts: EmailContact[];
  campaigns: EmailCampaign[];
  onChanged: () => void;
}

interface ListSummary {
  total: number;
  subscribed: number;
  clients: ClientRef[];
  withoutClient: number;
}

function summarize(contacts: EmailContact[]): ListSummary {
  const { clients, withoutClient } = summarizeClients(contacts);
  return { total: contacts.length, subscribed: contacts.filter((c) => c.status === "subscribed").length, clients, withoutClient };
}

function topNames(clients: ClientRef[], n = 3): string {
  const names = clients.slice(0, n).map(clientLabel);
  const rest = clients.length - names.length;
  return rest > 0 ? `${names.join(", ")} e mais ${rest}` : names.join(", ");
}

function AudienceRow({
  icon: Icon,
  name,
  description,
  summary,
  campaigns,
  onOpen,
  actions,
  system,
}: {
  icon: typeof Users;
  name: string;
  description: string | null;
  summary: ListSummary | null;
  campaigns: EmailCampaign[];
  onOpen?: () => void;
  actions?: React.ReactNode;
  system?: boolean;
}) {
  return (
    <li
      className={cn(
        "grid gap-4 rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm transition sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_150px_minmax(0,1fr)_68px] lg:items-center",
        onOpen && "cursor-pointer hover:border-[#47cdd0]/70 hover:shadow-md"
      )}
      onClick={onOpen}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md", system ? "bg-[#04202f] text-[#47cdd0]" : "bg-[#eaf2f5] text-[#285f7a]")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-[#0d2a38]">{name}</p>
          <p className="line-clamp-2 text-sm text-[#5a717b]">{description || "Sem descrição"}</p>
        </div>
      </div>

      <div className="min-w-0">
        {summary === null ? (
          <div className="h-10 animate-pulse rounded-md bg-[#f4f6f8]" />
        ) : summary.clients.length ? (
          <div className="space-y-1.5">
            <ClientLogoStack clients={summary.clients} max={7} size="sm" />
            <p className="truncate text-xs text-[#5a717b]" title={summary.clients.map(clientLabel).join(", ")}>
              {summary.clients.length} cliente{summary.clients.length === 1 ? "" : "s"} · {topNames(summary.clients)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum cliente nesta lista</p>
        )}
      </div>

      <div className="flex gap-6">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-[#0d2a38]">{summary ? summary.total.toLocaleString("pt-BR") : "—"}</p>
          <p className="text-xs text-[#5a717b]">contatos</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-emerald-700">{summary ? summary.subscribed.toLocaleString("pt-BR") : "—"}</p>
          <p className="text-xs text-[#5a717b]">recebem</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-1 text-xs text-[#5a717b]">Campanhas</p>
        {campaigns.length ? (
          <ul className="space-y-1">
            {campaigns.slice(0, 2).map((campaign) => (
              <li key={campaign.id} className="flex min-w-0 items-center gap-2 text-sm text-[#0d2a38]">
                <Send className="size-3.5 shrink-0 text-[#3e84a8]" />
                <span className="min-w-0 flex-1 truncate" title={campaign.name}>
                  {campaign.name}
                </span>
                <CampaignStatusPill status={campaign.status} />
              </li>
            ))}
            {campaigns.length > 2 && <li className="text-xs text-muted-foreground">e mais {campaigns.length - 2}</li>}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma ainda</p>
        )}
      </div>

      {actions ? (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : (
        <span className="hidden w-[68px] lg:block" aria-hidden />
      )}
    </li>
  );
}

export function ListsTab({ lists, contacts, campaigns, onChanged }: ListsTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailList | null>(null);
  const { members, reload } = useListMembers(lists.map((l) => l.id));

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const allSubscribed = useMemo(() => summarize(contacts.filter((c) => c.status === "subscribed")), [contacts]);
  const summaries = useMemo(() => {
    if (!members) return null;
    return new Map(
      lists.map((list) => [
        list.id,
        summarize((members.get(list.id) ?? []).map((id) => contactById.get(id)).filter((c): c is EmailContact => Boolean(c))),
      ])
    );
  }, [lists, members, contactById]);

  const campaignsByList = useMemo(() => {
    const map = new Map<string | null, EmailCampaign[]>();
    for (const campaign of campaigns) {
      const list = map.get(campaign.listId) ?? [];
      list.push(campaign);
      map.set(campaign.listId, list);
    }
    return map;
  }, [campaigns]);

  const handleDelete = async (list: EmailList) => {
    if (!confirm(`Excluir a lista "${list.name}"? Os contatos não serão removidos da base.`)) return;
    await deleteEmailList(list.id);
    onChanged();
  };

  const openList = (list: EmailList | null) => {
    setEditing(list);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <BlockHeader
        icon={ListChecks}
        title="Públicos das campanhas"
        description="Cada lista é um público pronto para escolher na campanha. Os logos mostram os clientes que estão nela."
        action={
          <Button className="gap-2" onClick={() => openList(null)}>
            <Plus className="h-4 w-4" />
            Nova lista
          </Button>
        }
      />

      <ul className="space-y-2.5">
        <AudienceRow
          icon={UserCheck}
          system
          name="Todos os inscritos"
          description="Público padrão: quem está inscrito na base, sem precisar montar lista."
          summary={allSubscribed}
          campaigns={campaignsByList.get(null) ?? []}
        />
        {lists.map((list) => (
          <AudienceRow
            key={list.id}
            icon={Users}
            name={list.name}
            description={list.description}
            summary={summaries?.get(list.id) ?? null}
            campaigns={campaignsByList.get(list.id) ?? []}
            onOpen={() => openList(list)}
            actions={
              <>
                <Button variant="ghost" size="icon-sm" aria-label={`Editar a lista ${list.name}`} onClick={() => openList(list)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Excluir a lista ${list.name}`} onClick={() => void handleDelete(list)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            }
          />
        ))}
      </ul>

      {lists.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#dce9eb] bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaf2f5] text-[#285f7a]">
            <ListChecks className="h-5 w-5" />
          </span>
          <p className="font-medium text-[#0d2a38]">Nenhuma lista ainda</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Monte listas por cliente, cargo ou tag para mandar cada campanha só para quem interessa.
          </p>
        </div>
      )}

      <ListFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        list={editing}
        contacts={contacts}
        onSaved={async () => {
          await onChanged();
          await reload();
        }}
      />
    </div>
  );
}
