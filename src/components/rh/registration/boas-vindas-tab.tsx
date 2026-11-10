"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CircleAlert,
  KeyRound,
  Link2,
  LogIn,
  Mail,
  MailCheck,
  PartyPopper,
  RotateCw,
  Search,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  ConcluirOnboardingDialog,
  type CompleteResult,
} from "@/components/rh/registration/concluir-onboarding-dialog";
import { WelcomeLinksDialog } from "@/components/rh/registration/welcome-links-dialog";
import { AreaChip, formatDay } from "@/components/rh/registration/welcome-ui";
import { searchKey } from "@/lib/rh/registration/combo-search";
import { WELCOME_QUEUE_START, type WelcomeEmployee, type WelcomeOverview } from "@/lib/rh/welcome/types";
import { cn } from "@/lib/utils";

export function welcomePendingCount(overview: WelcomeOverview): number {
  return overview.employees.filter((employee) => employee.inQueue && !employee.record).length;
}

function LoginState({ employee }: { employee: WelcomeEmployee }) {
  if (employee.loginState === "ja_entrou") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
        <LogIn className="size-3.5" aria-hidden />
        Entrou no ORQESTRAI em {formatDay(employee.lastSignInAt)}
      </span>
    );
  }
  if (employee.loginState === "nunca_entrou") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" aria-hidden />
        Acesso criado, ainda não entrou
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <KeyRound className="size-3.5" aria-hidden />
      Ainda sem acesso ao ORQESTRAI
    </span>
  );
}

/**
 * Dados cadastrais › Boas-vindas: quando a integração termina, o RH conclui o
 * onboarding aqui. O sistema cria o acesso ao ORQESTRAI e envia o e-mail com os
 * links da área (mantidos em "Links de boas-vindas").
 */
export function BoasVindasTab({
  overview,
  onChange,
}: {
  overview: WelcomeOverview;
  onChange: (overview: WelcomeOverview) => void;
}) {
  const [concluding, setConcluding] = useState<WelcomeEmployee | null>(null);
  const [linksOpen, setLinksOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const queue = useMemo(
    () =>
      overview.employees
        .filter((employee) => employee.inQueue && !employee.record)
        .sort((a, b) => (b.admissionDate ?? "").localeCompare(a.admissionDate ?? "")),
    [overview.employees]
  );
  const done = useMemo(
    () =>
      overview.employees
        .filter((employee) => employee.record)
        .sort((a, b) => (b.record?.completedAt ?? "").localeCompare(a.record?.completedAt ?? "")),
    [overview.employees]
  );
  const activeLinks = overview.links.filter((link) => link.isActive).length;

  function handleDone(result: CompleteResult) {
    onChange({
      ...overview,
      employees: overview.employees.map((employee) =>
        employee.employeeId === result.employee.employeeId ? result.employee : employee
      ),
    });
    setConcluding(null);
    const firstName = result.employee.fullName.split(/\s+/)[0];
    setNotice(
      result.sent
        ? { tone: "ok", text: `Onboarding de ${firstName} concluído. E-mail enviado para ${result.employee.record?.emailTo}.` }
        : {
            tone: "error",
            text: `Onboarding de ${firstName} registrado, mas o e-mail não saiu: ${result.error ?? "erro no envio"} Use “Reenviar”.`,
          }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-[#e8f8f8] p-2.5 text-[#285f7a]">
            <PartyPopper className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold">Boas-vindas</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Quando a integração terminar, conclua o onboarding: o sistema cria o acesso ao ORQESTRAI e envia um
              e-mail curto com o botão de entrada. Os links e as explicações da área ficam em Meus links, onde a
              pessoa cai no primeiro acesso.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => setLinksOpen(true)}>
            <Link2 className="size-4" />
            Links de boas-vindas
            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{activeLinks}</span>
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => setPickerOpen(true)}>
            <UserPlus className="size-4" />
            Outro colaborador
          </Button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          )}
        >
          {notice.tone === "ok" ? (
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <p className="flex-1">{notice.text}</p>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
            Fechar
          </button>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Aguardando conclusão
          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{queue.length}</span>
        </h3>
        {queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center">
            <PartyPopper className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Ninguém aguardando</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Quem entrar pelo VIOS a partir de {formatDay(WELCOME_QUEUE_START)} aparece aqui. Para quem já estava na
              equipe, use “Outro colaborador”.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {queue.map((employee) => (
              <article key={employee.employeeId} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <EmployeeAvatar name={employee.fullName} avatarUrl={employee.avatarUrl} className="size-12" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{employee.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">{employee.position ?? "Cargo não informado"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <AreaChip department={employee.department} />
                  {employee.employmentType ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <BadgeCheck className="size-3" aria-hidden />
                      {employee.employmentType}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      <CircleAlert className="size-3" aria-hidden />
                      Sem vínculo
                    </span>
                  )}
                  {employee.admissionDate && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3" aria-hidden />
                      {formatDay(employee.admissionDate)}
                    </span>
                  )}
                </div>
                <LoginState employee={employee} />
                <Button type="button" className="mt-auto gap-2" onClick={() => setConcluding(employee)}>
                  <Mail className="size-4" />
                  Concluir onboarding
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Concluídos
          <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{done.length}</span>
        </h3>
        {done.length === 0 ? (
          <p className="rounded-xl border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">
            Nenhum onboarding concluído pelo ORQESTRAI ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-sm">
            {done.map((employee) => {
              const record = employee.record!;
              return (
                <li key={employee.employeeId} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <EmployeeAvatar name={employee.fullName} avatarUrl={employee.avatarUrl} className="size-10" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 truncate font-medium">
                        {employee.fullName}
                        <AreaChip department={employee.department} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concluído em {formatDay(record.completedAt)}
                        {record.completedByName ? ` por ${record.completedByName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:w-72">
                    {record.lastError ? (
                      <span className="inline-flex items-start gap-1.5 text-xs text-amber-800">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        E-mail não saiu: {record.lastError}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MailCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                        {record.emailSendCount > 1 ? `Enviado ${record.emailSendCount}x, último` : "Enviado"} em{" "}
                        {formatDay(record.emailSentAt)} para {record.emailTo}
                      </span>
                    )}
                    <LoginState employee={employee} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => setConcluding(employee)}
                  >
                    <RotateCw className="size-3.5" />
                    Reenviar
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConcluirOnboardingDialog
        employee={concluding}
        links={overview.links}
        onOpenChange={(open) => !open && setConcluding(null)}
        onDone={handleDone}
      />

      <WelcomeLinksDialog
        open={linksOpen}
        links={overview.links}
        onOpenChange={setLinksOpen}
        onChange={(links) => onChange({ ...overview, links })}
      />

      <EmployeePicker
        open={pickerOpen}
        employees={overview.employees.filter((employee) => !employee.record && !employee.inQueue)}
        onOpenChange={setPickerOpen}
        onPick={(employee) => {
          setPickerOpen(false);
          setConcluding(employee);
        }}
      />
    </div>
  );
}

/** Para quem já estava na equipe antes da fila começar. */
function EmployeePicker({
  open,
  employees,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  employees: WelcomeEmployee[];
  onOpenChange: (open: boolean) => void;
  onPick: (employee: WelcomeEmployee) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const term = searchKey(query);
    return employees.filter((employee) => !term || searchKey(employee.fullName).includes(term)).slice(0, 40);
  }, [employees, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[80dvh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <DialogTitle>Outro colaborador</DialogTitle>
          <DialogDescription>Ativos que ainda não receberam as boas-vindas pelo ORQESTRAI.</DialogDescription>
        </DialogHeader>
        <div className="border-b px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pelo nome…"
              className="h-9 pl-9 text-sm"
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.length === 0 && (
            <li className="px-6 py-8 text-center text-sm text-muted-foreground">Ninguém com esse nome.</li>
          )}
          {visible.map((employee) => (
            <li key={employee.employeeId}>
              <button
                type="button"
                onClick={() => onPick(employee)}
                className="flex w-full items-center gap-3 px-6 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <EmployeeAvatar name={employee.fullName} avatarUrl={employee.avatarUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{employee.fullName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{employee.position ?? "—"}</span>
                </span>
                <AreaChip department={employee.department} />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
