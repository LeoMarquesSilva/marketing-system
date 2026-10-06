"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ClipboardList, Copy, Loader2, MessageCircle, Plus, Search, Sparkles } from "lucide-react";
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
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { RegistrationReviewSheet } from "@/components/rh/registration/registration-review-sheet";
import { RegistrationStatusBadge } from "@/components/rh/registration/registration-status-badge";
import {
  buildRegistrationMessage,
  createRegistrationRequest,
  registrationPublicUrl,
  whatsappUrl,
} from "@/lib/rh/registration/client";
import {
  isRegistrationExpired,
  REGISTRATION_KIND_LABEL,
  REGISTRATION_KINDS,
  type RegistrationDetail,
  type RegistrationEmployeeRef,
  type RegistrationKind,
  type RegistrationListItem,
} from "@/lib/rh/registration/types";
import { cn } from "@/lib/utils";

type Filter = "abertas" | "pendente" | "recebida" | "sem_vinculo" | "concluidas" | "todas";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "abertas", label: "Em andamento" },
  { value: "pendente", label: "Aguardando resposta" },
  { value: "recebida", label: "Para revisar" },
  { value: "sem_vinculo", label: "Sem colaborador" },
  { value: "concluidas", label: "Concluídas" },
  { value: "todas", label: "Todas" },
];

/** Concluída = aprovada e já copiada para a ficha do colaborador. */
function isDone(item: RegistrationListItem): boolean {
  return item.status === "aprovada" && !!item.employee;
}

function matchesFilter(item: RegistrationListItem, filter: Filter): boolean {
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
  employees: initialEmployees,
}: {
  initialItems: RegistrationListItem[];
  employees: RegistrationEmployeeRef[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [employees, setEmployees] = useState(initialEmployees);
  const [filter, setFilter] = useState<Filter>("abertas");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("ficha"));
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<RegistrationDetail | null>(null);

  const counts = useMemo(
    () => ({
      pendente: items.filter((item) => item.status === "pendente").length,
      recebida: items.filter((item) => item.status === "recebida").length,
      semVinculo: items.filter((item) => matchesFilter(item, "sem_vinculo")).length,
      concluidas: items.filter(isDone).length,
    }),
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

  function upsertItem(form: RegistrationDetail) {
    setItems((current) => {
      const exists = current.some((item) => item.id === form.id);
      return exists ? current.map((item) => (item.id === form.id ? form : item)) : [form, ...current];
    });
    // Vínculo tira o colaborador da lista de vinculáveis (e desvínculo devolve na próxima carga).
    if (form.employee) {
      setEmployees((current) => current.filter((employee) => employee.id !== form.employee?.id));
    }
  }

  function openForm(id: string | null) {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("ficha", id);
    else params.delete("ficha");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Fichas cadastrais</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Envie o link da ficha para quem está entrando. A pessoa responde sem login; depois que o VIOS
            sincronizar a admissão, você vincula a ficha ao colaborador e os dados vão para o cadastro.
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          onClick={() => {
            setCreated(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Nova ficha
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { key: "pendente" as const, label: "Aguardando resposta", value: counts.pendente, tone: "border-amber-200 bg-amber-50/60 text-amber-950" },
          { key: "recebida" as const, label: "Para revisar", value: counts.recebida, tone: "border-sky-200 bg-sky-50/60 text-sky-950" },
          { key: "sem_vinculo" as const, label: "Sem colaborador vinculado", value: counts.semVinculo, tone: "border-[#dce9eb] bg-card text-foreground" },
          { key: "concluidas" as const, label: "Concluídas", value: counts.concluidas, tone: "border-emerald-200 bg-emerald-50/60 text-emerald-950" },
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFilter(card.key)}
            className={cn(
              "rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md",
              card.tone,
              filter === card.key && "ring-2 ring-primary/40"
            )}
          >
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="mt-1 text-2xl font-bold">{card.value}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou e-mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {items.length === 0 ? "Nenhuma ficha enviada ainda" : "Nenhuma ficha neste filtro"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length === 0
                ? "Crie a primeira ficha e envie o link para a pessoa que vai entrar."
                : "Troque o filtro ou a busca para ver outras fichas."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#dce9eb] bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#eef4f5] bg-[#f7fbfc] text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Pessoa</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Colaborador (VIOS)</th>
                  <th className="px-4 py-3">Próximo passo</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[#eef4f5] transition-colors last:border-0 hover:bg-[#f7fbfc]"
                    onClick={() => openForm(item.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{item.declared_name ?? item.invitee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Convite {formatShortDate(item.created_at)}
                        {item.expected_admission_date && ` · admissão ${formatShortDate(item.expected_admission_date)}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{REGISTRATION_KIND_LABEL[item.employment_kind]}</td>
                    <td className="px-4 py-3">
                      <RegistrationStatusBadge status={item.status} expired={isRegistrationExpired(item.expires_at)} />
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{nextStep(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

      <RegistrationReviewSheet
        formId={selectedId}
        employees={employees}
        onOpenChange={(open) => !open && openForm(null)}
        onChanged={upsertItem}
      />
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
              <DialogTitle>Ficha criada</DialogTitle>
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
              <DialogTitle>Nova ficha cadastral</DialogTitle>
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
