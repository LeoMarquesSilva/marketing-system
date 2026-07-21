"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Activity,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Play,
  Power,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { NfcToast, type NfcToastValue } from "@/components/nfc/nfc-toast";
import type { NfcTag } from "@/lib/nfc/types";

const ACTION_LABELS: Record<string, string> = {
  url: "Abrir URL",
  custom_page: "Página personalizada",
  form: "Formulário",
  webhook: "Webhook n8n",
  whatsapp: "WhatsApp",
  menu: "Menu de ações",
  sequence: "Sequência",
};

function tagPayload(tag: NfcTag, overrides: Partial<{ status: "active" | "inactive" }> = {}) {
  return {
    name: tag.name,
    description: tag.description,
    environment: tag.environment,
    location: tag.location,
    category: tag.category,
    responsibleUserId: tag.responsible_user_id,
    status: overrides.status ?? tag.status,
    accessMode: tag.access_mode,
    actionType: tag.action_type,
    actionConfig: tag.action_config,
    cooldownSeconds: tag.cooldown_seconds,
    notes: tag.notes,
  };
}

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || "Não foi possível concluir a ação.";
}

export function NfcTagsClient({ initialTags }: { initialTags: NfcTag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [environment, setEnvironment] = useState("all");
  const [category, setCategory] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NfcTag | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<NfcToastValue | null>(null);

  const environments = useMemo(
    () => [...new Set(tags.map((tag) => tag.environment).filter(Boolean) as string[])].sort(),
    [tags]
  );
  const categories = useMemo(
    () => [...new Set(tags.map((tag) => tag.category).filter(Boolean) as string[])].sort(),
    [tags]
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return tags.filter((tag) => {
      if (term && !`${tag.name} ${tag.code}`.toLocaleLowerCase("pt-BR").includes(term)) return false;
      if (status !== "all" && tag.status !== status) return false;
      if (environment !== "all" && tag.environment !== environment) return false;
      if (category !== "all" && tag.category !== category) return false;
      if (actionType !== "all" && tag.action_type !== actionType) return false;
      return true;
    });
  }, [tags, search, status, environment, category, actionType]);

  const showToast = (value: NfcToastValue) => {
    setToast(value);
    window.setTimeout(() => setToast(null), 4500);
  };

  const toggleStatus = async (tag: NfcTag) => {
    setBusyId(tag.id);
    setOpenMenuId(null);
    try {
      const nextStatus = tag.status === "active" ? "inactive" : "active";
      const response = await fetch(`/api/nfc/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tagPayload(tag, { status: nextStatus })),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = (await response.json()) as { tag: NfcTag };
      setTags((current) => current.map((item) => (item.id === tag.id ? body.tag : item)));
      showToast({ type: "success", message: nextStatus === "active" ? "Etiqueta ativada." : "Etiqueta desativada." });
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Falha ao atualizar." });
    } finally {
      setBusyId(null);
    }
  };

  const duplicateTag = async (tag: NfcTag) => {
    setBusyId(tag.id);
    setOpenMenuId(null);
    try {
      const response = await fetch(`/api/nfc/tags/${tag.id}/duplicate`, { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = (await response.json()) as { tag: NfcTag };
      setTags((current) => [body.tag, ...current]);
      showToast({ type: "success", message: "Cópia criada como inativa." });
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Falha ao duplicar." });
    } finally {
      setBusyId(null);
    }
  };

  const testTag = async (tag: NfcTag) => {
    setBusyId(tag.id);
    setOpenMenuId(null);
    try {
      const response = await fetch(`/api/nfc/tags/${tag.id}/test`, { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = (await response.json()) as { url: string };
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Falha ao testar." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const response = await fetch(`/api/nfc/tags/${deleting.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response));
      setTags((current) => current.filter((tag) => tag.id !== deleting.id));
      setDeleting(null);
      showToast({ type: "success", message: "Etiqueta excluída e histórico preservado." });
    } catch (error) {
      showToast({ type: "error", message: error instanceof Error ? error.message : "Falha ao excluir." });
    } finally {
      setBusyId(null);
    }
  };

  const actionMenu = (tag: NfcTag) => (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Ações de ${tag.name}`}
        aria-expanded={openMenuId === tag.id}
        onClick={() => setOpenMenuId((current) => (current === tag.id ? null : tag.id))}
        disabled={busyId === tag.id}
      >
        <MoreHorizontal />
      </Button>
      {openMenuId === tag.id && (
        <div className="absolute right-0 top-10 z-30 w-52 rounded-md border border-[#dce9eb] bg-white p-1 shadow-xl">
          <Link href={`/nfc/tags/${tag.id}`} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-[#e8f8f8]">
            <Eye className="h-4 w-4" /> Visualizar
          </Link>
          <Link href={`/nfc/tags/${tag.id}#editar`} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-[#e8f8f8]">
            <Pencil className="h-4 w-4" /> Editar
          </Link>
          <button type="button" onClick={() => testTag(tag)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-[#e8f8f8]">
            <Play className="h-4 w-4" /> Testar
          </button>
          <button type="button" onClick={() => duplicateTag(tag)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-[#e8f8f8]">
            <Copy className="h-4 w-4" /> Duplicar
          </button>
          <button type="button" onClick={() => toggleStatus(tag)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-[#e8f8f8]">
            <Power className="h-4 w-4" /> {tag.status === "active" ? "Desativar" : "Ativar"}
          </button>
          <Link href={`/nfc/logs?tag=${tag.id}`} className="flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-[#e8f8f8]">
            <Activity className="h-4 w-4" /> Consultar histórico
          </Link>
          <button
            type="button"
            onClick={() => {
              setDeleting(tag);
              setOpenMenuId(null);
            }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Etiquetas NFC"
        description="Gerencie URLs permanentes, regras de acesso e ações vinculadas às etiquetas físicas."
      />
      <NfcSubnav />

      <Card className="gap-4 py-4">
        <CardContent className="grid gap-3 px-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(150px,0.7fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou código"
              className="pl-9"
              aria-label="Buscar etiquetas"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ambientes</SelectItem>
              {environments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Tipo de ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {Object.entries(ACTION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="hidden overflow-visible rounded-md border border-[#dce9eb] bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Ambiente / local</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Leituras</TableHead>
              <TableHead>Última leitura</TableHead>
              <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tag) => (
              <TableRow key={tag.id}>
                <TableCell>
                  <Link href={`/nfc/tags/${tag.id}`} className="font-medium text-[#285f7a] hover:underline">{tag.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{tag.code}</p>
                </TableCell>
                <TableCell>
                  <span>{tag.environment || "—"}</span>
                  <p className="text-xs text-muted-foreground">{tag.location || "Local não informado"}</p>
                </TableCell>
                <TableCell>{tag.category || "—"}</TableCell>
                <TableCell>{ACTION_LABELS[tag.action_type]}</TableCell>
                <TableCell>
                  <Badge variant={tag.status === "active" ? "default" : "secondary"}>
                    {tag.status === "active" ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{tag.total_scans}</TableCell>
                <TableCell className="font-mono text-xs">
                  {tag.last_scanned_at ? new Date(tag.last_scanned_at).toLocaleString("pt-BR") : "Nunca"}
                </TableCell>
                <TableCell>{actionMenu(tag)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {filtered.map((tag) => (
          <Card key={tag.id} className="gap-3 py-4">
            <CardContent className="px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/nfc/tags/${tag.id}`} className="block truncate font-semibold text-[#285f7a]">{tag.name}</Link>
                  <p className="font-mono text-xs text-muted-foreground">{tag.code}</p>
                </div>
                {actionMenu(tag)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Ambiente</p><p>{tag.environment || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Localização</p><p>{tag.location || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Ação</p><p>{ACTION_LABELS[tag.action_type]}</p></div>
                <div><p className="text-xs text-muted-foreground">Leituras</p><p className="font-mono">{tag.total_scans}</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!filtered.length && (
        <Card className="border-dashed py-10">
          <CardContent className="text-center text-sm text-muted-foreground">
            Nenhuma etiqueta corresponde aos filtros selecionados.
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir etiqueta?</DialogTitle>
            <DialogDescription>
              A etiqueta “{deleting?.name}” será desativada e removida das listas. Leituras e execuções continuarão preservadas no histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={busyId === deleting?.id}>
              {busyId === deleting?.id ? "Excluindo..." : "Excluir etiqueta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <NfcToast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
