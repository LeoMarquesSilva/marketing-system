"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  MailCheck,
  Network,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeAvatar } from "@/components/ferias/employee-avatar";
import {
  AreaChip,
  AudienceIcon,
  AudienceSelect,
  audienceIconStyle,
  formatDay,
  ToolLogo,
} from "@/components/rh/registration/welcome-ui";
import { audienceGroupLabel, audienceLabel, groupLinksByAudience, linksForAudience } from "@/lib/rh/welcome/audience";
import { buildWelcomeEmail } from "@/lib/rh/welcome/email";
import {
  WELCOME_EMPLOYMENT_TYPES,
  WELCOME_SETUP_VALIDITY_DAYS,
  type WelcomeEmployee,
  type WelcomeLink,
} from "@/lib/rh/welcome/types";
import { cn } from "@/lib/utils";

const SENDER = "controladoria@bismarchipires.com.br";

export interface CompleteResult {
  employee: WelcomeEmployee;
  sent: boolean;
  error: string | null;
}

/**
 * Concluir o onboarding de quem está entrando: confere e-mail, vínculo e
 * equipe, mostra o que a pessoa vai encontrar em Meus links e o e-mail
 * exatamente como vai sair (curto: só leva ao acesso).
 */
export function ConcluirOnboardingDialog({
  employee,
  links,
  onOpenChange,
  onDone,
}: {
  employee: WelcomeEmployee | null;
  links: WelcomeLink[];
  onOpenChange: (open: boolean) => void;
  onDone: (result: CompleteResult) => void;
}) {
  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-6xl">
        {employee && (
          <ConcluirForm
            key={employee.employeeId}
            employee={employee}
            links={links}
            onCancel={() => onOpenChange(false)}
            onDone={onDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConcluirForm({
  employee,
  links,
  onCancel,
  onDone,
}: {
  employee: WelcomeEmployee;
  links: WelcomeLink[];
  onCancel: () => void;
  onDone: (result: CompleteResult) => void;
}) {
  const resend = !!employee.record;
  const [email, setEmail] = useState(employee.record?.emailTo ?? employee.email ?? "");
  const [employmentType, setEmploymentType] = useState("");
  const [audience, setAudience] = useState<string | null>(
    employee.placedInOrgChart ? employee.suggestedAudience : (employee.record?.audienceKey ?? employee.suggestedAudience)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsEmploymentType = !employee.employmentType;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const setupAccess = employee.loginState !== "ja_entrou";
  const canSubmit = emailValid && (!needsEmploymentType || !!employmentType) && !saving;

  const groups = useMemo(() => groupLinksByAudience(linksForAudience(links, audience)), [links, audience]);
  const total = groups.reduce((sum, group) => sum + group.links.length, 0);

  const preview = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://orqestrai.com.br";
    return buildWelcomeEmail({
      fullName: employee.fullName,
      loginEmail: email.trim() || "e-mail corporativo",
      access: setupAccess
        ? { kind: "setup", url: `${origin}/primeiro-acesso?token=gerado-no-envio` }
        : { kind: "login", url: `${origin}/meus-links` },
      assetBaseUrl: origin,
    });
  }, [employee.fullName, email, setupAccess]);

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const response = await fetch("/api/rh/boas-vindas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        employeeId: employee.employeeId,
        email: email.trim(),
        audienceKey: audience,
        employmentType: needsEmploymentType ? employmentType : null,
      }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as (CompleteResult & { error?: string }) | null;
    setSaving(false);
    if (!response?.ok || !data?.employee) {
      setError(data?.error ?? "Não foi possível concluir agora. Tente de novo.");
      return;
    }
    onDone(data);
  }

  return (
    <>
      <DialogHeader className="border-b px-6 py-5 pr-12">
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.fullName} avatarUrl={employee.avatarUrl} className="size-12" />
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg">{resend ? "Reenviar boas-vindas" : "Concluir onboarding"}</DialogTitle>
            <DialogDescription className="truncate">
              {employee.fullName}
              {employee.position ? ` · ${employee.position}` : ""}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:overflow-hidden">
        <div className="space-y-5 px-6 py-5 lg:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-1.5">
            <AreaChip department={employee.department} />
            {employee.admissionDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3" aria-hidden />
                Admissão {formatDay(employee.admissionDate)}
              </span>
            )}
            {employee.employmentType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <BadgeCheck className="size-3" aria-hidden />
                {employee.employmentType}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="welcome-email">E-mail corporativo</Label>
            <Input
              id="welcome-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@bismarchipires.com.br"
            />
            <p className="text-xs text-muted-foreground">É o login do ORQESTRAI e para onde vai o e-mail.</p>
          </div>

          {needsEmploymentType && (
            <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <Label htmlFor="welcome-vinculo" className="flex items-center gap-1.5 text-amber-950">
                <TriangleAlert className="size-3.5 text-amber-600" aria-hidden />
                Vínculo
              </Label>
              <p className="text-xs text-amber-900">
                A ficha veio do VIOS sem vínculo. Escolha agora: ele é salvo na ficha junto com a conclusão.
              </p>
              <Select value={employmentType || undefined} onValueChange={setEmploymentType}>
                <SelectTrigger id="welcome-vinculo" className="w-full bg-white">
                  <SelectValue placeholder="Escolha o vínculo" />
                </SelectTrigger>
                <SelectContent>
                  {WELCOME_EMPLOYMENT_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="welcome-audience">Equipe</Label>
            {employee.placedInOrgChart && audience ? (
              <p className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <Network className="size-4 shrink-0 text-[#285f7a]" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{audienceLabel(audience)}</span>
                  <span className="block text-xs text-muted-foreground">
                    Vem do organograma. Para mudar, ajuste a pessoa no organograma.
                  </span>
                </span>
              </p>
            ) : (
              <>
                <AudienceSelect id="welcome-audience" value={audience} onChange={setAudience} placeholder="Escolha a equipe" />
                <p className="text-xs text-muted-foreground">
                  Define os links que ela vê. Quando entrar no organograma, passa a valer a equipe de lá.
                </p>
              </>
            )}
          </div>

          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Link2 className="size-4 text-[#285f7a]" aria-hidden />
              O que vai aparecer em Meus links
              <span className="font-normal text-muted-foreground">· {total}</span>
            </p>
            {groups.map((group) => (
              <div key={group.key} className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className={cn("rounded-md p-1 ring-1", audienceIconStyle(group.key))}>
                    <AudienceIcon audience={group.key} className="size-3" />
                  </span>
                  {audienceGroupLabel(group.key)}
                </p>
                <ul className="divide-y rounded-lg border">
                  {group.links.map((link) => (
                    <li key={link.id} className="flex items-center gap-2.5 px-3 py-2">
                      <ToolLogo url={link.url} size={28} className="rounded-lg" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{link.title}</span>
                        {link.description && (
                          <span className="block text-xs text-muted-foreground">{link.description}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Para incluir, tirar ou mudar um link, use “Links de boas-vindas”. Vale para todo mundo do mesmo público.
            </p>
          </div>

          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">Ao concluir</p>
            <p className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
              {setupAccess
                ? `Cria o acesso ao ORQESTRAI sem senha padrão: a pessoa cria a dela pelo botão do e-mail (vale ${WELCOME_SETUP_VALIDITY_DAYS} dias, uma vez só) e cai direto em Meus links.`
                : "A pessoa já entra no ORQESTRAI: o botão do e-mail leva direto para Meus links."}
            </p>
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
              Envia o e-mail de {SENDER}. As respostas chegam para você.
            </p>
            <p className="flex items-start gap-2">
              <MailCheck className="mt-0.5 size-3.5 shrink-0 text-[#285f7a]" aria-hidden />
              {resend
                ? "Atualiza o registro do envio. A data de conclusão continua a mesma."
                : "Registra o onboarding como concluído, com o seu nome e a data."}
            </p>
          </div>
        </div>

        <div className="flex min-h-[520px] flex-col border-t bg-[#F3EEE6] lg:min-h-0 lg:border-t-0 lg:border-l">
          <div className="border-b bg-white/70 px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prévia do e-mail</p>
            <p className="truncate text-sm font-medium">{preview.subject}</p>
          </div>
          <iframe
            title="Prévia do e-mail de boas-vindas"
            srcDoc={preview.html}
            // Sem allow-scripts: o HTML do e-mail não roda nada. A mesma origem deixa carregar o logo.
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className="min-h-0 w-full flex-1 border-0"
          />
        </div>
      </div>

      <DialogFooter className="items-center gap-2 border-t px-6 py-4 sm:gap-2">
        {error && <p className="mr-auto text-sm text-destructive">{error}</p>}
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" className="gap-2" onClick={() => void submit()} disabled={!canSubmit}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {resend ? "Reenviar e-mail" : "Concluir e enviar e-mail"}
        </Button>
      </DialogFooter>
    </>
  );
}
