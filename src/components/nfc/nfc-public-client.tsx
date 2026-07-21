"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  RadioTower,
  RefreshCw,
  TriangleAlert,
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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f8f9] p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#47cdd0] via-[#3e84a8] to-[#48466e]" />
      <div className="w-full max-w-lg rounded-lg border border-[#dce9eb] bg-white p-5 shadow-[0_28px_80px_-38px_rgba(3,32,47,0.42)] sm:p-7">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#e5eef0] pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ORQESTRAI/identidade-visual/logos/orquestrai-logo-horizontal-ai-color.svg"
            alt="ORQESTRAI"
            className="h-7 w-auto"
          />
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#347796]">
            <RadioTower className="h-4 w-4" /> NFC Hub
          </span>
        </div>
        {children}
      </div>
    </main>
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
}: {
  field: NfcFormField;
  value: unknown;
  onChange: (value: unknown) => void;
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
    [resolution, token, formData, phone]
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

  if (screen === "loading") {
    return <PublicShell><StateMessage icon={LoaderCircle} title="Carregando etiqueta" message="Identificando a etiqueta e preparando a ação com segurança."><LoaderCircle className="h-5 w-5 animate-spin text-[#347796]" /></StateMessage></PublicShell>;
  }
  if (screen === "executing") {
    return <PublicShell><StateMessage icon={LoaderCircle} title={resolution?.action?.loadingMessage || "Ação em andamento"} message="Mantenha esta página aberta por alguns instantes."><LoaderCircle className="h-5 w-5 animate-spin text-[#347796]" /></StateMessage></PublicShell>;
  }
  if (screen === "success") {
    return <PublicShell><StateMessage icon={CheckCircle2} title="Ação concluída" message={message} /></PublicShell>;
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
