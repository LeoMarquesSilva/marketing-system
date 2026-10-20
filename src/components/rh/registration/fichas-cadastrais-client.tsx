"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  UserPlus,
  UserRoundPen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { KpiCard } from "@/components/rh/kpi-card";
import { ColaboradoresTab } from "@/components/rh/registration/colaboradores-tab";
import { EmployeeRegistrationSheet } from "@/components/rh/registration/employee-registration-sheet";
import { RegistrationReviewSheet } from "@/components/rh/registration/registration-review-sheet";
import { RegistrationStatusBadge } from "@/components/rh/registration/registration-status-badge";
import {
  buildRegistrationMessage,
  buildSelfUpdateMessage,
  createRegistrationRequest,
  registrationPublicUrl,
  selfRegistrationUrl,
  whatsappUrl,
} from "@/lib/rh/registration/client";
import {
  isRegistrationExpired,
  REGISTRATION_KIND_LABEL,
  REGISTRATION_KINDS,
  type EmployeeRegistrationRow,
  type RegistrationDetail,
  type RegistrationEmployeeRef,
  type RegistrationKind,
  type RegistrationListItem,
} from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

type Tab = "colaboradores" | "admissoes";

type AdmissionFilter = "abertas" | "pendente" | "recebida" | "sem_vinculo" | "concluidas" | "todas";

const ADMISSION_FILTERS: { value: AdmissionFilter; label: string }[] = [
  { value: "abertas", label: "Em andamento" },
  { value: "pendente", label: "Aguardando resposta" },
  { value: "recebida", label: "Para revisar" },
  { value: "sem_vinculo", label: "Sem colaborador" },
  { value: "concluidas", label: "Concluídas" },
  { value: "todas", label: "Todas" },
];

/** ?aba=admissoes (e o antigo ?origem=admissao) abre direto nas admissões. */
function parseTab(params: { get(name: string): string | null }): Tab {
  if (params.get("aba") === "admissoes" || params.get("origem") === "admissao") return "admissoes";
  return "colaboradores";
}

/** Concluída = aprovada e já copiada para a ficha do colaborador. */
function isDone(item: RegistrationListItem): boolean {
  return item.status === "aprovada" && !!item.employee;
}

function matchesFilter(item: RegistrationListItem, filter: AdmissionFilter): boolean {
  switch (filter) {
    case "abertas":
      return item.status !== "cancelada" && !isDone(item);
    case "pendente":
      return item.status === "pendente";
    case "recebida":
      return item.status === "recebida";
    case "sem_vinculo":
      return (item.status === "recebida" || item.status === "aprovada") && !item.employee;
    case "concluidas":
      return isDone(item);
    default:
      return true;
  }
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function nextStep(item: RegistrationListItem): string {
  if (item.status === "cancelada") return "Cancelada";
  if (item.status === "pendente") {
    if (!item.public_path) return "Aguardando correção (com login)";
    return isRegistrationExpired(item.expires_at) ? "Gerar novo link" : `Aguardando · link até ${formatShortDate(item.expires_at)}`;
  }
  if (item.status === "recebida") return "Revisar e aprovar";
  if (!item.employee) return item.suggestions.length ? "Confirmar vínculo sugerido" : "Aguardando o VIOS";
  return "Concluída";
}

function sortKey(item: RegistrationListItem): number {
  // Ação da RH primeiro: revisar, vincular, aguardando, concluídas, canceladas.
  if (item.status === "recebida") return 0;
  if (item.status === "aprovada" && !item.employee) return item.suggestions.length ? 1 : 2;
  if (item.status === "pendente") return 3;
  if (isDone(item)) return 4;
  return 5;
}

export function FichasCadastraisClient({
  initialItems,
  initialEmployees,
}: {
  initialItems: RegistrationListItem[];
  initialEmployees: EmployeeRegistrationRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [employeeRows, setEmployeeRows] = useState(initialEmployees);
  const [tab, setTab] = useState<Tab>(parseTab(searchParams));
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("ficha"));
  const [employeeSheetId, setEmployeeSheetId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<RegistrationDetail | null>(null);
  const [selfUpdateOpen, setSelfUpdateOpen] = useState(false);

  const admissions = useMemo(() => items.filter((item) => item.origin === "admissao"), [items]);
  const activeRows = useMemo(() => employeeRows.filter((row) => row.isActive), [employeeRows]);

  // Para o vínculo manual na revisão: ativos ainda sem ficha.
  const linkableEmployees = useMemo<RegistrationEmployeeRef[]>(
    () =>
      activeRows
        .filter((row) => !row.formId)
        .map((row) => ({
          id: row.employeeId,
          full_name: row.fullName,
          department: row.department,
          position: row.position,
          is_active: true,
          employment_type: row.employmentType,
        })),
    [activeRows]
  );

  const kpis = useMemo(() => {
    const complete = activeRows.filter((row) => row.missingFields.length === 0).length;
    return {
      active: activeRows.length,
      inactive: employeeRows.length - activeRows.length,
      complete,
      pending: activeRows.length - complete,
      notSent: activeRows.filter((row) => row.status === "sem_envio").length,
      toReview: items.filter((item) => item.status === "recebida").length,
      admissionsOpen: admissions.filter((item) => item.status !== "cancelada" && !isDone(item)).length,
    };
  }, [activeRows, employeeRows.length, items, admissions]);

  const pendingEmails = useMemo(
    () =>
      activeRows
        .filter((row) => row.status === "sem_envio")
        .map((row) => row.email)
        .filter((value): value is string => !!value),
    [activeRows]
  );

  const refreshEmployees = useCallback(async () => {
    const response = await fetch("/api/rh/fichas-cadastrais/colaboradores", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json().catch(() => ({}))) as { items?: EmployeeRegistrationRow[] };
    if (data.items) setEmployeeRows(data.items);
  }, []);

  function upsertItem(form: RegistrationDetail) {
    setItems((current) => {
      const exists = current.some((item) => item.id === form.id);
      return exists ? current.map((item) => (item.id === form.id ? form : item)) : [form, ...current];
    });
    // Aprovar, devolver ou vincular muda a situação do colaborador na outra aba.
    void refreshEmployees();
  }

  function replaceParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("origem");
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  function openForm(id: string | null) {
    setSelectedId(id);
    replaceParam("ficha", id);
  }

  function chooseTab(next: Tab) {
    setTab(next);
    replaceParam("aba", next === "colaboradores" ? null : next);
  }

  function openEmployee(row: EmployeeRegistrationRow) {
    if (row.formId) openForm(row.formId);
    else setEmployeeSheetId(row.employeeId);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Fichas cadastrais</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Os dados cadastrais da equipe: quem já atualizou a ficha, o que falta e as admissões em andamento. Tudo
            passa pela revisão de Pessoas e Cultura antes de ir para o cadastro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => setSelfUpdateOpen(true)}>
            <UserRoundPen className="size-4" />
            Atualização cadastral
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              setCreated(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            Nova admissão
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={Users}
          label="Colaboradores ativos"
          value={kpis.active}
          hint={kpis.inactive ? `${kpis.inactive} ex-colaborador${kpis.inactive === 1 ? "" : "es"} na base` : "Base do VIOS"}
        />
        <KpiCard
          icon={CircleCheck}
          label="Fichas completas"
          value={kpis.complete}
          hint={kpis.active ? `${Math.round((kpis.complete / kpis.active) * 100)}% da equipe ativa` : "Nenhum colaborador ativo"}
        />
        <KpiCard
          icon={ClipboardList}
          label="Com pendências"
          value={kpis.pending}
          hint={`${kpis.notSent} ainda não enviaram a ficha`}
          tone={kpis.pending ? "warning" : "neutral"}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="Para revisar"
          value={kpis.toReview}
          hint="Enviadas, esperando sua aprovação"
          tone={kpis.toReview ? "warning" : "neutral"}
        />
        <KpiCard
          icon={UserPlus}
          label="Admissões em andamento"
          value={kpis.admissionsOpen}
          hint="Links enviados a quem está entrando"
        />
      </div>

      <div className="flex gap-1 border-b">
        {(
          [
            ["colaboradores", "Colaboradores", kpis.active],
            ["admissoes", "Admissões", kpis.admissionsOpen],
          ] as Array<[Tab, string, number]>
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => chooseTab(key)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>
          </button>
        ))}
      </div>

      {tab === "colaboradores" ? (
        <ColaboradoresTab rows={employeeRows} onOpenEmployee={openEmployee} />
      ) : (
        <AdmissoesTab
          items={admissions}
          onOpen={(id) => openForm(id)}
          onCreate={() => {
            setCreated(null);
            setCreateOpen(true);
          }}
        />
      )}

      <CreateRegistrationDialog
        open={createOpen}
        created={created}
        onOpenChange={setCreateOpen}
        onCreated={(form) => {
          upsertItem(form);
          setCreated(form);
        }}
      />

      <SelfUpdateDialog open={selfUpdateOpen} onOpenChange={setSelfUpdateOpen} pendingEmails={pendingEmails} />

      <EmployeeRegistrationSheet employeeId={employeeSheetId} onOpenChange={(open) => !open && setEmployeeSheetId(null)} />

      <RegistrationReviewSheet
        formId={selectedId}
        employees={linkableEmployees}
        onOpenChange={(open) => !open && openForm(null)}
        onChanged={upsertItem}
      />
    </div>
  );
}

/** Links de admissão: quem está entrando responde sem login; a RH vincula ao colaborador do VIOS. */
function AdmissoesTab({
  items,
  onOpen,
  onCreate,
}: {
  items: RegistrationListItem[];
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<AdmissionFilter>("abertas");
  const [search, setSearch] = useState("");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ADMISSION_FILTERS.map((option) => [option.value, items.filter((item) => matchesFilter(item, option.value)).length])
      ) as Record<AdmissionFilter, number>,
    [items]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((item) => matchesFilter(item, filter))
      .filter((item) => {
        if (!term) return true;
        return [item.invitee_name, item.declared_name, item.invitee_personal_email, item.employee?.full_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => sortKey(a) - sortKey(b) || b.created_at.localeCompare(a.created_at));
  }, [items, filter, search]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative min-w-[200px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ADMISSION_FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? "default" : "outline"}
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className="tabular-nums opacity-70">{counts[option.value]}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Pessoa</TableHead>
                <TableHead className="w-[14%]">Vínculo</TableHead>
                <TableHead className="w-[16%]">Status</TableHead>
                <TableHead className="w-[20%]">Colaborador (VIOS)</TableHead>
                <TableHead className="w-[22%]">Próximo passo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    {items.length === 0 ? (
                      <span className="inline-flex flex-col items-center gap-3">
                        Nenhuma admissão ainda. Crie uma e envie o link para quem vai entrar.
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onCreate}>
                          <Plus className="size-3.5" />
                          Nova admissão
                        </Button>
                      </span>
                    ) : (
                      "Nenhuma admissão neste filtro."
                    )}
                  </TableCell>
                </TableRow>
              )}
              {visible.map((item) => (
                <TableRow
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => onOpen(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpen(item.id);
                    }
                  }}
                >
                  <TableCell>
                    <span className="block truncate font-medium text-foreground">{item.declared_name ?? item.invitee_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Convite {formatShortDate(item.created_at)}
                      {item.expected_admission_date && ` · admissão ${formatShortDate(item.expected_admission_date)}`}
                    </span>
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">
                    {REGISTRATION_KIND_LABEL[item.employment_kind]}
                  </TableCell>
                  <TableCell>
                    <RegistrationStatusBadge status={item.status} expired={isRegistrationExpired(item.expires_at)} />
                  </TableCell>
                  <TableCell className="truncate text-sm">
                    {item.employee ? (
                      <span className="text-foreground">{item.employee.full_name}</span>
                    ) : item.suggestions[0] && item.status !== "pendente" ? (
                      <span className="inline-flex items-center gap-1 text-sky-800">
                        <Sparkles className="size-3.5" />
                        {item.suggestions[0].fullName}?
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {nextStep(item)}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#285f7a]" />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function CreateRegistrationDialog({
  open,
  created,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  created: RegistrationDetail | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (form: RegistrationDetail) => void;
}) {
  const [kind, setKind] = useState<RegistrationKind | "">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [admission, setAdmission] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const reset = () => {
    setKind("");
    setName("");
    setEmail("");
    setPhone("");
    setAdmission("");
    setError(null);
    setCopied(null);
  };

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch {
      setCopied(null);
    }
  }

  async function submit() {
    if (!kind) return setError("Selecione o vínculo.");
    if (!name.trim()) return setError("Informe o nome da pessoa.");
    setSaving(true);
    setError(null);
    const result = await createRegistrationRequest({
      kind,
      inviteeName: name,
      personalEmail: email,
      phone,
      expectedAdmissionDate: admission,
    });
    setSaving(false);
    if (!result.form) return setError(result.error ?? "Não foi possível criar a ficha.");
    onCreated(result.form);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Admissão criada</DialogTitle>
              <DialogDescription>
                Envie o link para {created.invitee_name.split(" ")[0]}. Ele vale por 30 dias e só funciona até a
                ficha ser enviada.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={registrationPublicUrl(created)} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={() => copy("link", registrationPublicUrl(created))}>
                  {copied === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied === "link" ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <div className="whitespace-pre-line rounded-lg bg-muted/60 p-3 text-xs leading-5 text-foreground">
                {buildRegistrationMessage(created)}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => copy("msg", buildRegistrationMessage(created))}>
                {copied === "msg" ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem"}
              </Button>
              <Button type="button" className="gap-1.5" asChild>
                <a href={whatsappUrl(created.invitee_phone, buildRegistrationMessage(created))} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" />
                  Enviar pelo WhatsApp
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nova admissão</DialogTitle>
              <DialogDescription>
                O vínculo define os campos da ficha. Nome, e-mail e telefone já chegam preenchidos para a pessoa
                confirmar.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="fc-new-name">Nome da pessoa</label>
                <Input id="fc-new-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="fc-new-kind">Vínculo</label>
                <Select value={kind || undefined} onValueChange={(value) => setKind(value as RegistrationKind)}>
                  <SelectTrigger id="fc-new-kind" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRATION_KINDS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {REGISTRATION_KIND_LABEL[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="fc-new-admission">
                  Admissão prevista <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <DatePickerField id="fc-new-admission" value={admission} onChange={setAdmission} placeholder="dd/mm/aaaa" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="fc-new-email">
                  E-mail pessoal <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Input id="fc-new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="fc-new-phone">
                  Celular <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <PhoneInput id="fc-new-phone" value={phone} onChange={setPhone} />
              </div>
              {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Criar e gerar link
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Campanha de atualização: um link só (com login) para toda a equipe. O
 * acompanhamento de quem já enviou fica na aba Colaboradores.
 */
function SelfUpdateDialog({
  open,
  onOpenChange,
  pendingEmails,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** E-mails corporativos de quem ainda não enviou a ficha. */
  pendingEmails: string[];
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const message = buildSelfUpdateMessage();

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
    } catch {
      setCopied(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atualização cadastral</DialogTitle>
          <DialogDescription>
            Um link para toda a equipe. Cada pessoa entra com o próprio login e vê a ficha do seu vínculo, já com o que
            temos, marcando o que falta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Link</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={selfRegistrationUrl()}
                className="h-9 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                onClick={() => copy("link", selfRegistrationUrl())}
              >
                {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied === "link" ? "Copiado" : "Copiar"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Mensagem pronta</p>
            <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-3 text-xs leading-5 text-foreground">
              {message}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={pendingEmails.length === 0}
            onClick={() => copy("emails", pendingEmails.join("; "))}
            title="Para colar no Outlook (Cco)"
          >
            {copied === "emails" ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied === "emails" ? "E-mails copiados" : `E-mails de quem não enviou (${pendingEmails.length})`}
          </Button>
          <Button type="button" className="gap-1.5" onClick={() => copy("msg", message)}>
            {copied === "msg" ? <Check className="size-4" /> : <MessageCircle className="size-4" />}
            {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
