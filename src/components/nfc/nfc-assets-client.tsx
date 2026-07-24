"use client";

import { useState } from "react";
import {
  Boxes,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Search,
  ShieldCheck,
  Umbrella,
  Wrench,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { NfcAssetCreateDialog } from "@/components/nfc/nfc-asset-create-dialog";
import { NfcAssetEditDialog } from "@/components/nfc/nfc-asset-edit-dialog";
import { NfcAssetReturnDialog } from "@/components/nfc/nfc-asset-return-dialog";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { NfcToast, type NfcToastValue } from "@/components/nfc/nfc-toast";
import type {
  NfcAssetAdminData,
  NfcAssetInventoryItem,
  NfcAssetLoanAdminItem,
  NfcAssetStatus,
} from "@/lib/nfc/types";

type View = "loans" | "inventory" | "history";

const STATUS_CONFIG: Record<
  NfcAssetStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  available: {
    label: "Disponível",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  loaned: {
    label: "Emprestado",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  maintenance: {
    label: "Manutenção",
    className: "border-orange-200 bg-orange-50 text-orange-800",
    icon: Wrench,
  },
  inactive: {
    label: "Inativo",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: ShieldCheck,
  },
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function formatElapsed(from: string) {
  const milliseconds = Math.max(0, Date.now() - new Date(from).getTime());
  const hours = Math.floor(milliseconds / 3_600_000);
  if (hours < 1) return "há menos de 1 hora";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

function AssetStatusBadge({ status }: { status: NfcAssetStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      <config.icon />
      {config.label}
    </Badge>
  );
}

function BorrowerAvatar({ loan }: { loan: NfcAssetLoanAdminItem }) {
  return (
    <Avatar className="size-10 border border-[#dce9eb] bg-[#e8f8f8]">
      <AvatarImage
        src={loan.borrower.avatarUrl || undefined}
        alt={loan.borrower.name}
      />
      <AvatarFallback className="bg-[#e8f8f8] text-xs font-semibold text-[#285f7a]">
        {getInitials(loan.borrower.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function NfcAssetsClient({ initialData }: { initialData: NfcAssetAdminData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("loans");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<NfcAssetInventoryItem | null>(
    null
  );
  const [selectedLoan, setSelectedLoan] = useState<NfcAssetLoanAdminItem | null>(
    null
  );
  const [toast, setToast] = useState<NfcToastValue | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/nfc/assets", { cache: "no-store" });
      const body = (await response.json()) as {
        data?: NfcAssetAdminData;
        error?: string;
      };
      if (!response.ok || !body.data) {
        throw new Error(body.error || "Não foi possível atualizar os dados.");
      }
      setData(body.data);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChanged = async (message: string) => {
    try {
      await refresh();
      setToast({ type: "success", message });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Não foi possível atualizar os dados.",
      });
    }
  };

  const handleError = (message: string) => {
    setToast({ type: "error", message });
  };

  const query = normalize(search);
  const matchesTag = (tagId: string) => tagFilter === "all" || tagId === tagFilter;
  const matchesQuery = (...values: Array<string | null | undefined>) =>
    !query || normalize(values.filter(Boolean).join(" ")).includes(query);

  const filteredAssets = data.assets.filter(
    (asset) =>
      matchesTag(asset.tagId) &&
      (statusFilter === "all" || asset.status === statusFilter) &&
      matchesQuery(
        asset.assetNumber,
        asset.label,
        asset.tagName,
        asset.tagCode,
        asset.notes
      )
  );

  const filteredOpenLoans = data.openLoans.filter(
    (loan) =>
      matchesTag(loan.tagId) &&
      matchesQuery(
        loan.assetNumber,
        loan.assetLabel,
        loan.borrower.name,
        loan.borrower.department,
        loan.tagName
      )
  );

  const filteredHistory = data.history.filter(
    (loan) =>
      matchesTag(loan.tagId) &&
      matchesQuery(
        loan.assetNumber,
        loan.assetLabel,
        loan.borrower.name,
        loan.returnedByName,
        loan.tagName,
        loan.returnNotes
      )
  );

  const totals = {
    total: data.assets.length,
    available: data.assets.filter((asset) => asset.status === "available").length,
    loaned: data.openLoans.length,
    maintenance: data.assets.filter((asset) => asset.status === "maintenance").length,
  };

  const metrics = [
    {
      label: "Itens cadastrados",
      value: totals.total,
      icon: Boxes,
      tone: "bg-[#e8f8f8] text-[#347796]",
    },
    {
      label: "Disponíveis agora",
      value: totals.available,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Emprestados",
      value: totals.loaned,
      icon: Clock3,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Em manutenção",
      value: totals.maintenance,
      icon: Wrench,
      tone: "bg-orange-50 text-orange-700",
    },
  ];

  const views: Array<{ id: View; label: string; count: number; icon: typeof Clock3 }> = [
    { id: "loans", label: "Emprestados", count: data.openLoans.length, icon: Clock3 },
    { id: "inventory", label: "Inventário", count: data.assets.length, icon: Umbrella },
    { id: "history", label: "Histórico", count: data.history.length, icon: History },
  ];

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Itens e empréstimos"
        description="Cadastre o inventário, acompanhe quem está com cada item e registre devoluções ou manutenção."
        primaryAction={false}
        action={
          <NfcAssetCreateDialog
            tags={data.tags}
            onCreated={(message) => void handleChanged(message)}
            onError={handleError}
          />
        }
      />
      <NfcSubnav />

      {!data.tags.length && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 px-4 py-4 text-sm text-amber-900">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <p>
              Crie uma etiqueta do tipo “Retirada e devolução” antes de cadastrar o
              inventário.
            </p>
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Resumo do inventário"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {metrics.map((metric) => (
          <Card key={metric.label} className="gap-3 py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${metric.tone}`}
              >
                <metric.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-2xl font-semibold">{metric.value}</p>
                <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <div
          role="tablist"
          aria-label="Áreas do controle de itens"
          className="flex overflow-x-auto border-b border-[#dce9eb] bg-[#f8fbfb] p-1.5 [scrollbar-width:none]"
        >
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => setView(item.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition sm:flex-1 sm:justify-center ${
                view === item.id
                  ? "bg-white text-[#285f7a] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
              <span className="rounded-full bg-[#e8f8f8] px-2 py-0.5 font-mono text-[11px] text-[#347796]">
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 border-b border-[#e5eef0] p-4 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar número, item ou colaborador"
              aria-label="Buscar no controle de itens"
              className="pl-9"
            />
          </div>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Etiqueta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etiquetas</SelectItem>
              {data.tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view === "inventory" ? (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="loaned">Emprestados</SelectItem>
                <SelectItem value="maintenance">Em manutenção</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <LoaderCircle className={refreshing ? "animate-spin" : ""} />
              Atualizar
            </Button>
          )}
        </div>

        <CardContent className="p-4 sm:p-5">
          {view === "loans" && (
            filteredOpenLoans.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredOpenLoans.map((loan) => (
                  <article
                    key={loan.id}
                    className="group relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/70 p-4"
                  >
                    <div className="absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-amber-200/30" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-amber-700">
                          {loan.tagCode}
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">
                          {loan.assetLabel} {loan.assetNumber}
                        </h3>
                      </div>
                      <AssetStatusBadge status="loaned" />
                    </div>

                    <div className="relative mt-5 flex items-center gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-amber-100">
                      <BorrowerAvatar loan={loan} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {loan.borrower.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {loan.borrower.department || "Área não informada"}
                        </p>
                      </div>
                    </div>

                    <div className="relative mt-4 flex items-end justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p>{new Date(loan.checkedOutAt).toLocaleString("pt-BR")}</p>
                        <p className="mt-0.5 font-medium text-amber-800">
                          {formatElapsed(loan.checkedOutAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setSelectedLoan(loan)}
                      >
                        <RotateCcw />
                        Devolver
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="size-7" />
                </span>
                <h3 className="mt-4 font-semibold">Nenhum item emprestado</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Todos os itens filtrados estão disponíveis ou ainda não houve retiradas.
                </p>
              </div>
            )
          )}

          {view === "inventory" && (
            filteredAssets.length ? (
              <>
                <div className="grid gap-3 md:hidden">
                  {filteredAssets.map((asset) => (
                    <article
                      key={asset.id}
                      className="rounded-2xl border border-[#dce9eb] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-[#347796]">
                            {asset.assetNumber}
                          </p>
                          <h3 className="truncate font-semibold">{asset.label}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {asset.tagName} · {asset.tagCode}
                          </p>
                        </div>
                        <AssetStatusBadge status={asset.status} />
                      </div>
                      {asset.notes && (
                        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                          {asset.notes}
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <Pencil />
                        Editar item
                      </Button>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-[#dce9eb] md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Etiqueta</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAssets.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono font-semibold text-[#347796]">
                            {asset.assetNumber}
                          </TableCell>
                          <TableCell className="font-medium">{asset.label}</TableCell>
                          <TableCell>
                            <p className="font-medium">{asset.tagName}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {asset.tagCode}
                            </p>
                          </TableCell>
                          <TableCell>
                            <AssetStatusBadge status={asset.status} />
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate text-muted-foreground">
                            {asset.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAsset(asset)}
                            >
                              <Pencil />
                              Editar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#e8f8f8] text-[#347796]">
                  <Umbrella className="size-7" />
                </span>
                <h3 className="mt-4 font-semibold">Nenhum item encontrado</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Ajuste os filtros ou cadastre os primeiros itens do inventário.
                </p>
              </div>
            )
          )}

          {view === "history" && (
            filteredHistory.length ? (
              <>
                <div className="grid gap-3 md:hidden">
                  {filteredHistory.map((loan) => (
                    <article
                      key={loan.id}
                      className="rounded-2xl border border-[#dce9eb] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#347796]">
                            {loan.tagCode}
                          </p>
                          <h3 className="mt-1 font-semibold">
                            {loan.assetLabel} {loan.assetNumber}
                          </h3>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-800"
                        >
                          <CheckCircle2 />
                          Devolvido
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <BorrowerAvatar loan={loan} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {loan.borrower.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {loan.borrower.department || "Área não informada"}
                          </p>
                        </div>
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f7fafb] p-3 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Retirada</dt>
                          <dd className="mt-1 font-medium">
                            {new Date(loan.checkedOutAt).toLocaleString("pt-BR")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Devolução</dt>
                          <dd className="mt-1 font-medium">
                            {loan.returnedAt
                              ? new Date(loan.returnedAt).toLocaleString("pt-BR")
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      {(loan.returnedByName || loan.returnNotes) && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {loan.returnedByName && `Registrado por ${loan.returnedByName}`}
                          {loan.returnedByName && loan.returnNotes && " · "}
                          {loan.returnNotes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-[#dce9eb] md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Retirada</TableHead>
                        <TableHead>Devolução</TableHead>
                        <TableHead>Registrado por</TableHead>
                        <TableHead>Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell>
                            <p className="font-medium">
                              {loan.assetLabel}{" "}
                              <span className="font-mono text-[#347796]">
                                {loan.assetNumber}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {loan.tagName}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <BorrowerAvatar loan={loan} />
                              <span className="font-medium">{loan.borrower.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {new Date(loan.checkedOutAt).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {loan.returnedAt
                              ? new Date(loan.returnedAt).toLocaleString("pt-BR")
                              : "—"}
                          </TableCell>
                          <TableCell>{loan.returnedByName || "—"}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {loan.returnNotes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#e8f8f8] text-[#347796]">
                  <History className="size-7" />
                </span>
                <h3 className="mt-4 font-semibold">Histórico vazio</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  As devoluções aparecerão aqui com responsável, datas e observações.
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      <NfcAssetEditDialog
        key={selectedAsset?.id ?? "asset-dialog"}
        asset={selectedAsset}
        open={Boolean(selectedAsset)}
        onOpenChange={(open) => !open && setSelectedAsset(null)}
        onSaved={(message) => void handleChanged(message)}
        onError={handleError}
      />
      <NfcAssetReturnDialog
        key={selectedLoan?.id ?? "loan-dialog"}
        loan={selectedLoan}
        open={Boolean(selectedLoan)}
        onOpenChange={(open) => !open && setSelectedLoan(null)}
        onReturned={(message) => void handleChanged(message)}
        onError={handleError}
      />
      <NfcToast value={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
