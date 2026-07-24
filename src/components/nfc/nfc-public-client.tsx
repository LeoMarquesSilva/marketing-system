"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Umbrella,
  UserRound,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NfcFormField, NfcPublicResolution } from "@/lib/nfc/types";

type Screen = "loading" | "ready" | "executing" | "success" | "error";

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f8f9] p-4 sm:p-6">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#47cdd0]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#3e84a8]/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#47cdd0] via-[#3e84a8] to-[#48466e]" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#dce9eb] bg-white/95 p-5 shadow-[0_28px_80px_-38px_rgba(3,32,47,0.42)] backdrop-blur sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#e5eef0] pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-ai-color.svg"
            alt="ORQESTRAI"
            className="h-7 w-auto"
          />
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#347796]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#47cdd0] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#347796]" />
            </span>
            NFC conectado
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

function LoadingExperience() {
  return (
    <div className="py-7 text-center" aria-live="polite" aria-busy="true">
      <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
        <span className="absolute h-24 w-24 animate-ping rounded-full border border-[#47cdd0]/30 [animation-duration:1.8s]" />
        <span className="absolute h-16 w-16 animate-pulse rounded-full bg-[#e8f8f8]" />
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#347796] text-white shadow-lg shadow-[#347796]/20">
          <RadioTower className="h-6 w-6" />
        </span>
      </div>
      <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#e8f8f8] px-3 py-1 text-xs font-semibold text-[#285f7a]">
        <Sparkles className="h-3.5 w-3.5" />
        Leitura reconhecida
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Só um instante…</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Estamos identificando a etiqueta e preparando a experiência certa para você.
      </p>
      <div className="mx-auto mt-6 grid max-w-xs gap-2 text-left text-xs text-muted-foreground">
        <p className="flex items-center gap-2 rounded-lg bg-[#f7fafb] px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Etiqueta lida
        </p>
        <p className="flex items-center gap-2 rounded-lg bg-[#f7fafb] px-3 py-2">
          <LoaderCircle className="h-4 w-4 animate-spin text-[#347796]" /> Preparando a ação
        </p>
      </div>
    </div>
  );
}

function StateMessage({
  icon: Icon,
  title,
  message,
  children,
  tone = "cyan",
}: {
  icon: typeof RadioTower;
  title: string;
  message: string;
  children?: React.ReactNode;
  tone?: "cyan" | "red" | "amber";
}) {
  const colors =
    tone === "red"
      ? "bg-red-50 text-red-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-[#e8f8f8] text-[#347796]";
  return (
    <div className="py-7 text-center">
      <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${colors}`}>
        <Icon className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{message}</p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </div>
  );
}

function FormField({
  field,
  value,
  onChange,
  directoryUsers,
}: {
  field: NfcFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  directoryUsers: NonNullable<NfcPublicResolution["directoryUsers"]>;
}) {
  const stringValue = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const label = (
    <Label htmlFor={`nfc-field-${field.id}`}>
      {field.label} {field.required && <span className="text-red-600">*</span>}
    </Label>
  );
  if (field.type === "long_text") {
    return <div className="space-y-1.5">{label}<Textarea id={`nfc-field-${field.id}`} required={field.required} value={stringValue} onChange={(event) => onChange(event.target.value)} /></div>;
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={`nfc-field-${field.id}`}
          required={field.required}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:border-[#47cdd0] focus:outline-none focus:ring-2 focus:ring-[#47cdd0]/20"
        >
          <option value="">Selecione</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "user_select") {
    return (
      <div className="space-y-1.5">
        {label}
        <select
          id={`nfc-field-${field.id}`}
          required={field.required}
          value={stringValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm focus:border-[#47cdd0] focus:outline-none focus:ring-2 focus:ring-[#47cdd0]/20"
        >
          <option value="">Selecione o colaborador</option>
          {directoryUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}{user.department ? ` — ${user.department}` : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "multiple_choice") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{field.label} {field.required && <span className="text-red-600">*</span>}</legend>
        {(field.options ?? []).map((option) => (
          <label key={option} className="flex min-h-10 items-center gap-2 rounded-md border border-[#dce9eb] px-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              className="h-4 w-4 accent-[#347796]"
            />
            {option}
          </label>
        ))}
      </fieldset>
    );
  }
  if (field.type === "image" || field.type === "audio") {
    return (
      <div className="space-y-1.5">
        {label}
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Upload de {field.type === "image" ? "imagem" : "áudio"} ainda não está habilitado nesta instalação.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {label}
      <Input
        id={`nfc-field-${field.id}`}
        required={field.required}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={stringValue}
        onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
      />
    </div>
  );
}

export function NfcPublicClient({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>("loading");
  const [resolution, setResolution] = useState<NfcPublicResolution | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [phone, setPhone] = useState("");
  const [loanOperation, setLoanOperation] = useState<"checkout" | "return">("checkout");
  const [assetNumber, setAssetNumber] = useState("");
  const [borrowerUserId, setBorrowerUserId] = useState("");
  const [message, setMessage] = useState("");
  const autoExecuted = useRef(false);

  const execute = useCallback(
    async (menuItemId?: string) => {
      if (!resolution?.scanId) return;
      setScreen("executing");
      try {
        const response = await fetch(`/api/nfc/public/${encodeURIComponent(token)}/execute`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scanId: resolution.scanId,
            confirmed: true,
            menuItemId,
            formData,
            phone: phone || undefined,
            loanOperation: resolution.action?.type === "asset_loan" ? loanOperation : undefined,
            assetNumber: resolution.action?.type === "asset_loan" ? assetNumber : undefined,
            borrowerUserId:
              resolution.action?.type === "asset_loan" && loanOperation === "checkout"
                ? borrowerUserId
                : undefined,
          }),
        });
        const body = (await response.json()) as { error?: string; message?: string; redirectUrl?: string };
        if (!response.ok) throw new Error(body.error || "Não foi possível concluir.");
        if (body.redirectUrl) {
          window.location.replace(body.redirectUrl);
          return;
        }
        setMessage(body.message || resolution.action?.successMessage || "Ação concluída.");
        setScreen("success");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
        setScreen("error");
      }
    },
    [resolution, token, formData, phone, loanOperation, assetNumber, borrowerUserId]
  );

  const load = useCallback(async () => {
    setScreen("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/nfc/public/${encodeURIComponent(token)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const body = (await response.json()) as NfcPublicResolution & { error?: string };
      if (body.error && !body.state) throw new Error(body.error);
      setResolution(body);
      setScreen("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar esta etiqueta.");
      setScreen("error");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (
      screen === "ready" &&
      resolution?.state === "ready" &&
      resolution.action?.type === "url" &&
      !resolution.action.requiresConfirmation &&
      !autoExecuted.current
    ) {
      autoExecuted.current = true;
      execute();
    }
  }, [screen, resolution, execute]);

  useEffect(() => {
    if (resolution?.tag?.name) {
      document.title = `${resolution.tag.name} — ORQESTRAI`;
    }
  }, [resolution?.tag?.name]);

  if (screen === "loading") {
    return <PublicShell><LoadingExperience /></PublicShell>;
  }
  if (screen === "executing") {
    return <PublicShell><StateMessage icon={LoaderCircle} title={resolution?.action?.loadingMessage || "Estamos cuidando disso"} message="Pode deixar esta página aberta. Isso deve levar apenas alguns segundos."><LoaderCircle className="h-5 w-5 animate-spin text-[#347796]" /></StateMessage></PublicShell>;
  }
  if (screen === "success") {
    return <PublicShell><StateMessage icon={CheckCircle2} title="Tudo certo!" message={message} /></PublicShell>;
  }
  if (screen === "error") {
    return <PublicShell><StateMessage icon={TriangleAlert} title="Não foi possível concluir" message={message || "Tente novamente em alguns instantes."} tone="red"><Button onClick={load} variant="outline"><RefreshCw /> Tentar novamente</Button></StateMessage></PublicShell>;
  }

  if (resolution?.state === "not_found") {
    return <PublicShell><StateMessage icon={WifiOff} title="Etiqueta não encontrada" message={resolution.message || "Confira se a URL foi gravada corretamente."} tone="red" /></PublicShell>;
  }
  if (resolution?.state === "inactive") {
    return <PublicShell><StateMessage icon={WifiOff} title="Etiqueta inativa" message={resolution.message || "Esta etiqueta não está disponível no momento."} tone="amber" /></PublicShell>;
  }
  if (resolution?.state === "rate_limited" || resolution?.state === "cooldown") {
    return <PublicShell><StateMessage icon={Clock3} title="Limite temporário atingido" message={`${resolution.message ?? "Aguarde para tentar novamente."}${resolution.retryAfterSeconds ? ` Tente em ${resolution.retryAfterSeconds} segundos.` : ""}`} tone="amber" /></PublicShell>;
  }
  if (resolution?.state === "login_required") {
    return <PublicShell><StateMessage icon={LockKeyhole} title="Login necessário" message={resolution.message || "Entre no ORQESTRAI para continuar."}><Button asChild><a href={`/login?next=${encodeURIComponent(`/t/${token}`)}`}>Entrar no ORQESTRAI</a></Button></StateMessage></PublicShell>;
  }
  if (resolution?.state === "access_denied") {
    return <PublicShell><StateMessage icon={LockKeyhole} title="Acesso não autorizado" message={resolution.message || "Sua conta não possui permissão para esta etiqueta."} tone="red" /></PublicShell>;
  }

  const action = resolution?.action;
  return (
    <PublicShell>
      <div>
        {action?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={action.imageUrl} alt="" className="mb-5 max-h-56 w-full rounded-md border border-[#dce9eb] object-cover" />
        )}
        <p className="font-mono text-xs font-medium text-[#347796]">{resolution?.tag?.code}</p>
        <h1 className="mt-1 text-xl font-semibold">{action?.title || resolution?.tag?.name || "Etiqueta NFC"}</h1>
        {(action?.description || resolution?.tag?.location) && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {action?.description || [resolution?.tag?.environment, resolution?.tag?.location].filter(Boolean).join(" · ")}
          </p>
        )}

        {action?.type === "form" && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              execute();
            }}
          >
            {(action.fields ?? []).map((field) => (
              <FormField
                key={field.id}
                field={field}
                value={formData[field.id]}
                onChange={(value) => setFormData((current) => ({ ...current, [field.id]: value }))}
                directoryUsers={resolution?.directoryUsers ?? []}
              />
            ))}
            <Button type="submit" className="w-full">Confirmar e enviar</Button>
          </form>
        )}

        {action?.type === "whatsapp" && (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              execute();
            }}
          >
            <div className="space-y-1.5"><Label htmlFor="nfc-phone">Número do WhatsApp</Label><Input id="nfc-phone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+55 11 99999-9999" /></div>
            <Button type="submit" className="w-full">Confirmar envio</Button>
          </form>
        )}

        {action?.type === "asset_loan" && (
          <form
            className="mt-6 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              execute();
            }}
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f1f7f8] p-1.5">
              <button
                type="button"
                onClick={() => setLoanOperation("checkout")}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  loanOperation === "checkout"
                    ? "bg-white text-[#285f7a] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Retirar
              </button>
              <button
                type="button"
                onClick={() => setLoanOperation("return")}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                  loanOperation === "return"
                    ? "bg-white text-[#285f7a] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowDownToLine className="h-4 w-4" />
                Devolver
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nfc-asset-number">
                {action.assetNumberLabel || "Número do item"}
              </Label>
              <div className="relative">
                <Umbrella className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#347796]" />
                <Input
                  id="nfc-asset-number"
                  required
                  autoCapitalize="characters"
                  value={assetNumber}
                  onChange={(event) => setAssetNumber(event.target.value)}
                  placeholder="Ex.: 12"
                  className="h-11 pl-10 font-mono"
                />
              </div>
            </div>

            {loanOperation === "checkout" ? (
              <div className="space-y-1.5">
                <Label htmlFor="nfc-borrower">Quem está retirando?</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[#347796]" />
                  <select
                    id="nfc-borrower"
                    required
                    value={borrowerUserId}
                    onChange={(event) => setBorrowerUserId(event.target.value)}
                    className="h-11 w-full appearance-none rounded-md border border-input bg-white pl-10 pr-3 text-sm focus:border-[#47cdd0] focus:outline-none focus:ring-2 focus:ring-[#47cdd0]/20"
                  >
                    <option value="">Selecione o colaborador</option>
                    {(resolution?.directoryUsers ?? []).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}{user.department ? ` — ${user.department}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#dce9eb] bg-[#f7fafb] p-4">
                {(() => {
                  const normalized = assetNumber.trim().toLocaleUpperCase("pt-BR");
                  const loan = resolution?.activeLoans?.find(
                    (item) => item.assetNumber.toLocaleUpperCase("pt-BR") === normalized
                  );
                  if (!assetNumber.trim()) {
                    return (
                      <p className="text-sm text-muted-foreground">
                        Digite o número para localizar a retirada em aberto.
                      </p>
                    );
                  }
                  if (!loan) {
                    return (
                      <p className="text-sm text-amber-800">
                        Não encontramos uma retirada em aberto para esse número.
                      </p>
                    );
                  }
                  return (
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8f8f8] text-[#347796]">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{loan.borrowerName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Retirado em {new Date(loan.checkedOutAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <Button type="submit" className="h-11 w-full">
              {loanOperation === "checkout" ? (
                <><Umbrella /> Confirmar retirada</>
              ) : (
                <><CheckCircle2 /> Confirmar devolução</>
              )}
            </Button>
          </form>
        )}

        {action?.type === "menu" && (
          <div className="mt-6 grid gap-2">
            {(action.menuItems ?? []).map((item) => (
              <Button key={item.id} type="button" variant="outline" className="h-auto min-h-11 justify-between py-2.5" onClick={() => execute(item.id)}>
                {item.label}<ExternalLink className="h-4 w-4" />
              </Button>
            ))}
          </div>
        )}

        {(action?.type === "url" || action?.type === "webhook" || action?.type === "sequence") && (
          <div className="mt-6">
            <Button type="button" className="w-full" onClick={() => execute()}>
              {action.type === "url" ? "Continuar para o destino" : "Confirmar e executar"}
            </Button>
          </div>
        )}

        {action?.type === "custom_page" && (
          <div className="mt-6 space-y-2">
            {(action.buttons ?? []).map((button) => (
              <Button key={`${button.label}-${button.url}`} asChild variant="outline" className="w-full">
                <a href={button.url} target="_blank" rel="noreferrer">{button.label}<ExternalLink /></a>
              </Button>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
