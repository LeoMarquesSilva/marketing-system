"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck2,
  CircleHelp,
  Coffee,
  FileText,
  FormInput,
  Globe2,
  ListChecks,
  MessageCircle,
  Plus,
  Save,
  Trash2,
  Umbrella,
  Webhook,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { NfcToast, type NfcToastValue } from "@/components/nfc/nfc-toast";
import type {
  NfcAccessMode,
  NfcActionConfig,
  NfcActionType,
  NfcFormField,
  NfcTag,
  NfcTemplate,
} from "@/lib/nfc/types";
import type { User } from "@/lib/users";

const ENVIRONMENTS = ["Escritório", "Casa", "Evento", "Equipamento", "Material comercial", "Estoque"];
const CATEGORIES = ["Sala", "Equipamento", "Marketing", "Visitante", "Estoque", "Manutenção", "Evento", "Automação pessoal", "Outro"];

const ACTIONS: Array<{ value: NfcActionType; label: string; description: string; icon: typeof Globe2 }> = [
  { value: "url", label: "Abrir URL", description: "Redireciona para um endereço HTTP(S).", icon: Globe2 },
  { value: "custom_page", label: "Página personalizada", description: "Exibe conteúdo e botões.", icon: FileText },
  { value: "form", label: "Formulário", description: "Coleta dados e pode acionar o n8n.", icon: FormInput },
  { value: "webhook", label: "Webhook do n8n", description: "Executa um workflow seguro.", icon: Webhook },
  { value: "whatsapp", label: "Fluxo de WhatsApp", description: "Aciona n8n e Evolution no servidor.", icon: MessageCircle },
  { value: "menu", label: "Menu de ações", description: "Apresenta vários atalhos.", icon: ListChecks },
  { value: "sequence", label: "Múltiplas ações", description: "Executa uma sequência segura.", icon: Workflow },
  { value: "asset_loan", label: "Retirada e devolução", description: "Controla itens emprestados.", icon: Umbrella },
];

const CAFE_FORM_PRESETS: Array<{
  name: string;
  description: string;
  icon: typeof Coffee;
  config: NfcActionConfig;
}> = [
  {
    name: "Confirmar presença",
    description: "Confirmação, colaborador e restrições alimentares.",
    icon: CalendarCheck2,
    config: {
      title: "Café com Cultura",
      description: "Confirme sua participação no próximo encontro.",
      fields: [
        { id: "colaborador", label: "Colaborador", type: "user_select", required: true },
        {
          id: "confirmacao",
          label: "Você participará?",
          type: "select",
          required: true,
          options: ["Sim, confirmo minha presença", "Não poderei participar"],
        },
        {
          id: "restricoes",
          label: "Restrição alimentar ou observação",
          type: "long_text",
          required: false,
        },
      ],
      successMessage: "Sua resposta para o Café com Cultura foi registrada. Obrigado!",
    },
  },
  {
    name: "Check-in do encontro",
    description: "Registro rápido de chegada no Café com Cultura.",
    icon: Coffee,
    config: {
      title: "Check-in — Café com Cultura",
      description: "Que bom ter você por aqui. Selecione seu nome para confirmar a chegada.",
      fields: [
        { id: "colaborador", label: "Colaborador", type: "user_select", required: true },
      ],
      successMessage: "Check-in confirmado. Aproveite o Café com Cultura!",
    },
  },
  {
    name: "Feedback do encontro",
    description: "Avaliação do conteúdo e sugestão para a próxima edição.",
    icon: FormInput,
    config: {
      title: "Feedback — Café com Cultura",
      description: "Sua opinião ajuda a deixar os próximos encontros ainda melhores.",
      fields: [
        { id: "colaborador", label: "Colaborador", type: "user_select", required: true },
        {
          id: "avaliacao",
          label: "Como foi o encontro?",
          type: "select",
          required: true,
          options: ["Excelente", "Muito bom", "Bom", "Pode melhorar"],
        },
        {
          id: "proximo_tema",
          label: "Que tema você gostaria de ver na próxima edição?",
          type: "long_text",
          required: false,
        },
      ],
      successMessage: "Feedback recebido. Obrigado por construir esse encontro com a gente!",
    },
  },
];

const ACCESS_MODES: Array<{ value: NfcAccessMode; label: string; help: string }> = [
  { value: "public", label: "Pública", help: "Qualquer pessoa pode abrir; ações sensíveis ainda exigem confirmação." },
  { value: "public_confirmation", label: "Pública com confirmação", help: "Sempre pede confirmação antes de continuar." },
  { value: "authenticated", label: "Usuários autenticados", help: "Exige login no ORQESTRAI." },
  { value: "admin", label: "Somente administradores", help: "Restringe pelo papel administrativo." },
  { value: "selected_users", label: "Usuários selecionados", help: "Libera somente para a lista definida abaixo." },
];

function emptyConfig(type: NfcActionType): NfcActionConfig {
  switch (type) {
    case "url":
      return { destinationUrl: "", openImmediately: true };
    case "custom_page":
      return { title: "", description: "", successMessage: "Tudo certo." };
    case "form":
      return {
        title: "Formulário",
        description: "",
        fields: [{ id: "campo_1", label: "Campo 1", type: "short_text", required: true }],
        successMessage: "Resposta enviada com sucesso.",
      };
    case "webhook":
      return {
        workflowKey: "",
        requireConfirmation: true,
        loadingMessage: "Executando automação...",
        successMessage: "Automação concluída.",
        errorMessage: "Não foi possível concluir a automação.",
        timeoutMs: 10000,
      };
    case "whatsapp":
      return {
        workflowKey: "",
        phoneMode: "ask",
        messageTemplate: "",
        requireConfirmation: true,
        successMessage: "Fluxo de WhatsApp iniciado.",
      };
    case "menu":
      return { title: "O que você deseja fazer?", menuItems: [] };
    case "sequence":
      return {
        workflowKey: "",
        requireConfirmation: true,
        sequence: [{ type: "webhook" }, { type: "update_scan" }, { type: "success_page" }],
        successMessage: "Sequência concluída.",
      };
    case "asset_loan":
      return {
        title: "Guarda-chuvas compartilhados",
        description: "Registre a retirada ou a devolução de um guarda-chuva.",
        assetLabel: "Guarda-chuva",
        assetNumberLabel: "Número do guarda-chuva",
        checkoutMessage: "Retirada registrada. Cuide bem do nosso guarda-chuva!",
        returnMessage: "Devolução registrada. Obrigado por trazer o guarda-chuva de volta!",
        requireConfirmation: true,
        sensitive: true,
      };
  }
}

function initialValues(tag?: NfcTag | null, template?: NfcTemplate | null) {
  const actionType = tag?.action_type ?? template?.action_type ?? "url";
  const templateRequiresAuth =
    actionType === "asset_loan" ||
    template?.action_config.fields?.some((field) => field.type === "user_select");
  return {
    name: tag?.name ?? "",
    code: tag?.code ?? "",
    description: tag?.description ?? "",
    environment: tag?.environment ?? "",
    location: tag?.location ?? "",
    category: tag?.category ?? template?.category ?? "",
    responsibleUserId: tag?.responsible_user_id ?? "",
    status: tag?.status ?? ("active" as const),
    accessMode:
      tag?.access_mode ??
      (templateRequiresAuth ? ("authenticated" as NfcAccessMode) : ("public" as NfcAccessMode)),
    actionType,
    actionConfig: tag?.action_config ?? template?.action_config ?? emptyConfig(actionType),
    cooldownSeconds: tag?.cooldown_seconds ?? 0,
    notes: tag?.notes ?? "",
  };
}

async function readResponseError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error || "Não foi possível salvar a etiqueta.";
}

function FieldShell({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {help && <p className="text-xs leading-5 text-muted-foreground">{help}</p>}
    </div>
  );
}

export function NfcTagForm({
  initialTag,
  allowedUserIds = [],
  users,
  template,
}: {
  initialTag?: NfcTag | null;
  allowedUserIds?: string[];
  users: User[];
  template?: NfcTemplate | null;
}) {
  const router = useRouter();
  const initial = useMemo(() => initialValues(initialTag, template), [initialTag, template]);
  const [values, setValues] = useState(initial);
  const [selectedUsers, setSelectedUsers] = useState(allowedUserIds);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<NfcToastValue | null>(null);

  const setConfig = (patch: Partial<NfcActionConfig>) => {
    setValues((current) => ({ ...current, actionConfig: { ...current.actionConfig, ...patch } }));
  };

  const setActionType = (actionType: NfcActionType) => {
    setValues((current) => ({
      ...current,
      actionType,
      actionConfig: emptyConfig(actionType),
      accessMode:
        actionType === "asset_loan" &&
        (current.accessMode === "public" || current.accessMode === "public_confirmation")
          ? "authenticated"
          : current.accessMode,
    }));
  };

  const updateFormField = (index: number, patch: Partial<NfcFormField>) => {
    setValues((current) => {
      const fields = [...(current.actionConfig.fields ?? [])];
      fields[index] = { ...fields[index], ...patch };
      return {
        ...current,
        accessMode:
          patch.type === "user_select" &&
          (current.accessMode === "public" || current.accessMode === "public_confirmation")
            ? "authenticated"
            : current.accessMode,
        actionConfig: { ...current.actionConfig, fields },
      };
    });
  };

  const applyFormPreset = (config: NfcActionConfig) => {
    setValues((current) => ({
      ...current,
      actionType: "form",
      accessMode:
        current.accessMode === "public" || current.accessMode === "public_confirmation"
          ? "authenticated"
          : current.accessMode,
      actionConfig: config,
      category: current.category || "Café com Cultura",
      environment: current.environment || "Escritório",
    }));
  };

  const addFormField = () => {
    const fields = values.actionConfig.fields ?? [];
    setConfig({
      fields: [
        ...fields,
        {
          id: `campo_${fields.length + 1}`,
          label: `Campo ${fields.length + 1}`,
          type: "short_text",
          required: false,
        },
      ],
    });
  };

  const menuLines = (values.actionConfig.menuItems ?? [])
    .map((item) => `${item.label}|${String(item.config.destinationUrl ?? "")}`)
    .join("\n");
  const buttonLines = (values.actionConfig.buttons ?? [])
    .map((button) => `${button.label}|${button.url}`)
    .join("\n");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setToast(null);
    const payload = {
      name: values.name,
      ...(initialTag ? {} : values.code ? { code: values.code } : {}),
      description: values.description || null,
      environment: values.environment || null,
      location: values.location || null,
      category: values.category || null,
      responsibleUserId: values.responsibleUserId || null,
      status: values.status,
      accessMode: values.accessMode,
      actionType: values.actionType,
      actionConfig: values.actionConfig,
      cooldownSeconds: Number(values.cooldownSeconds),
      notes: values.notes || null,
      allowedUserIds: values.accessMode === "selected_users" ? selectedUsers : [],
    };
    try {
      const response = await fetch(initialTag ? `/api/nfc/tags/${initialTag.id}` : "/api/nfc/tags", {
        method: initialTag ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readResponseError(response));
      const body = (await response.json()) as { tag: NfcTag };
      setToast({ type: "success", message: initialTag ? "Etiqueta atualizada sem alterar a URL permanente." : "Etiqueta criada com URL permanente." });
      if (!initialTag) {
        router.replace(`/nfc/tags/${body.tag.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form id="editar" onSubmit={submit} className="space-y-4">
      <Card className="gap-4 py-5">
        <CardHeader className="border-b px-5">
          <CardTitle className="text-base">Dados básicos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 md:grid-cols-2">
          <FieldShell label="Nome da etiqueta">
            <Input required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} placeholder="Ex.: Impressora da recepção" />
          </FieldShell>
          <FieldShell label="Código interno" help={initialTag ? "O código é permanente após a criação." : "Deixe vazio para gerar automaticamente."}>
            <Input
              value={values.code}
              onChange={(event) => setValues({ ...values, code: event.target.value.toUpperCase() })}
              disabled={Boolean(initialTag)}
              placeholder="NFC-0001"
              className="font-mono"
            />
          </FieldShell>
          <div className="md:col-span-2">
            <FieldShell label="Descrição">
              <Textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Finalidade e contexto desta etiqueta" />
            </FieldShell>
          </div>
          <FieldShell label="Ambiente">
            <Input list="nfc-environments" value={values.environment} onChange={(event) => setValues({ ...values, environment: event.target.value })} placeholder="Escritório" />
            <datalist id="nfc-environments">{ENVIRONMENTS.map((item) => <option key={item} value={item} />)}</datalist>
          </FieldShell>
          <FieldShell label="Localização">
            <Input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} placeholder="Recepção, sala 3, armário A..." />
          </FieldShell>
          <FieldShell label="Categoria">
            <Input list="nfc-categories" value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} placeholder="Equipamento" />
            <datalist id="nfc-categories">{CATEGORIES.map((item) => <option key={item} value={item} />)}</datalist>
          </FieldShell>
          <FieldShell label="Responsável">
            <Select value={values.responsibleUserId || "__none__"} onValueChange={(value) => setValues({ ...values, responsibleUserId: value === "__none__" ? "" : value })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem responsável</SelectItem>
                {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell label="Status">
            <Select value={values.status} onValueChange={(status: "active" | "inactive") => setValues({ ...values, status })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="inactive">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </FieldShell>
          <FieldShell label="Cooldown (segundos)" help="Evita execuções repetidas pela mesma pessoa em curto intervalo.">
            <Input type="number" min={0} max={86400} value={values.cooldownSeconds} onChange={(event) => setValues({ ...values, cooldownSeconds: Number(event.target.value) })} />
          </FieldShell>
          <div className="md:col-span-2">
            <FieldShell label="Observações internas">
              <Textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} placeholder="Visível somente no NFC Hub" />
            </FieldShell>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="border-b px-5">
          <CardTitle className="text-base">Acesso e proteção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {ACCESS_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setValues({ ...values, accessMode: mode.value })}
                className={`min-h-28 rounded-md border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] ${
                  values.accessMode === mode.value
                    ? "border-[#347796] bg-[#e8f8f8]"
                    : "border-[#dce9eb] bg-white hover:border-[#3e84a8]/40"
                }`}
              >
                <p className="text-sm font-semibold">{mode.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{mode.help}</p>
              </button>
            ))}
          </div>
          {values.accessMode === "selected_users" && (
            <div className="rounded-md border border-[#dce9eb] bg-[#f7fafb] p-4">
              <p className="mb-3 text-sm font-medium">Usuários autorizados</p>
              <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {users.map((user) => (
                  <label key={user.id} className="flex min-h-10 items-center gap-2 rounded border border-transparent px-2 text-sm hover:bg-white">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={(event) =>
                        setSelectedUsers((current) =>
                          event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id)
                        )
                      }
                      className="h-4 w-4 accent-[#347796]"
                    />
                    {user.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" />
            Ações que enviam dados, criam registros ou acionam automações sempre exigem confirmação, independentemente do modo público.
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="border-b px-5">
          <CardTitle className="text-base">Configuração da ação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACTIONS.map((action) => (
              <button
                key={action.value}
                type="button"
                onClick={() => setActionType(action.value)}
                className={`min-h-28 rounded-md border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#47cdd0] ${
                  values.actionType === action.value
                    ? "border-[#347796] bg-[#e8f8f8]"
                    : "border-[#dce9eb] bg-white hover:border-[#3e84a8]/40"
                }`}
              >
                <action.icon className="mb-2 h-5 w-5 text-[#347796]" />
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">{action.description}</p>
              </button>
            ))}
          </div>

          {values.actionType === "url" && (
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <FieldShell label="URL de destino" help="Somente endereços HTTP(S), sem usuário ou senha embutidos.">
                <Input type="url" required value={values.actionConfig.destinationUrl ?? ""} onChange={(event) => setConfig({ destinationUrl: event.target.value })} placeholder="https://..." />
              </FieldShell>
              <FieldShell label="Comportamento">
                <Select value={values.actionConfig.openImmediately ? "immediate" : "confirm"} onValueChange={(value) => setConfig({ openImmediately: value === "immediate", requireConfirmation: value === "confirm" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Abrir imediatamente</SelectItem>
                    <SelectItem value="confirm">Mostrar confirmação</SelectItem>
                  </SelectContent>
                </Select>
              </FieldShell>
            </div>
          )}

          {values.actionType === "custom_page" && (
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Título"><Input value={values.actionConfig.title ?? ""} onChange={(event) => setConfig({ title: event.target.value })} /></FieldShell>
              <FieldShell label="Imagem opcional"><Input type="url" value={values.actionConfig.imageUrl ?? ""} onChange={(event) => setConfig({ imageUrl: event.target.value })} placeholder="https://..." /></FieldShell>
              <div className="md:col-span-2">
                <FieldShell label="Descrição"><Textarea value={values.actionConfig.description ?? ""} onChange={(event) => setConfig({ description: event.target.value })} /></FieldShell>
              </div>
              <FieldShell label="Mensagem de sucesso"><Input value={values.actionConfig.successMessage ?? ""} onChange={(event) => setConfig({ successMessage: event.target.value })} /></FieldShell>
              <div className="md:col-span-2">
                <FieldShell label="Botões de ação" help="Um botão por linha no formato: Rótulo|https://destino.">
                  <Textarea
                    rows={4}
                    value={buttonLines}
                    onChange={(event) => {
                      const buttons = event.target.value
                        .split("\n")
                        .map((line) => {
                          const [label, url] = line.split("|");
                          return { label: label?.trim() ?? "", url: url?.trim() ?? "" };
                        })
                        .filter((button) => button.label);
                      setConfig({ buttons });
                    }}
                    placeholder={"Abrir manual|https://...\nSolicitar ajuda|https://..."}
                  />
                </FieldShell>
              </div>
            </div>
          )}

          {values.actionType === "form" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#bfe8e8] bg-[#f2fbfb] p-4">
                <div className="mb-3 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#347796] shadow-sm">
                    <Coffee className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Modelos Café com Cultura</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Aplique um modelo e continue editando os campos normalmente.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {CAFE_FORM_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyFormPreset(preset.config)}
                      className="rounded-lg border border-[#dce9eb] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#47cdd0] hover:shadow-sm"
                    >
                      <preset.icon className="h-4 w-4 text-[#347796]" />
                      <p className="mt-2 text-sm font-semibold">{preset.name}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FieldShell label="Título"><Input value={values.actionConfig.title ?? ""} onChange={(event) => setConfig({ title: event.target.value })} /></FieldShell>
                <FieldShell label="Workflow n8n opcional"><Input value={values.actionConfig.workflowKey ?? ""} onChange={(event) => setConfig({ workflowKey: event.target.value })} placeholder="capturar-feedback" /></FieldShell>
                <div className="md:col-span-2"><FieldShell label="Descrição"><Textarea value={values.actionConfig.description ?? ""} onChange={(event) => setConfig({ description: event.target.value })} /></FieldShell></div>
              </div>
              <div className="space-y-2">
                {(values.actionConfig.fields ?? []).map((field, index) => (
                  <div key={`${field.id}-${index}`} className="grid gap-2 rounded-md border border-[#dce9eb] bg-[#f7fafb] p-3 md:grid-cols-[1fr_170px_170px_44px]">
                    <Input value={field.label} onChange={(event) => updateFormField(index, { label: event.target.value, id: `campo_${index + 1}` })} aria-label={`Rótulo do campo ${index + 1}`} />
                    <Select value={field.type} onValueChange={(type: NfcFormField["type"]) => updateFormField(index, { type })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_text">Texto curto</SelectItem>
                        <SelectItem value="long_text">Texto longo</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="select">Seleção</SelectItem>
                        <SelectItem value="multiple_choice">Múltipla escolha</SelectItem>
                        <SelectItem value="user_select">Colaborador</SelectItem>
                        <SelectItem value="date">Data</SelectItem>
                        <SelectItem value="image">Imagem</SelectItem>
                        <SelectItem value="audio">Áudio</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={field.required ? "required" : "optional"} onValueChange={(value) => updateFormField(index, { required: value === "required" })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="required">Obrigatório</SelectItem>
                        <SelectItem value="optional">Opcional</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remover campo ${index + 1}`} onClick={() => setConfig({ fields: (values.actionConfig.fields ?? []).filter((_, itemIndex) => itemIndex !== index) })}>
                      <Trash2 />
                    </Button>
                    {(field.type === "select" || field.type === "multiple_choice") && (
                      <Input
                        className="md:col-span-4"
                        value={(field.options ?? []).join(", ")}
                        onChange={(event) =>
                          updateFormField(index, {
                            options: event.target.value
                              .split(",")
                              .map((option) => option.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Opções separadas por vírgula"
                        aria-label={`Opções do campo ${index + 1}`}
                      />
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={addFormField}><Plus /> Adicionar campo</Button>
              </div>
            </div>
          )}

          {values.actionType === "asset_loan" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex gap-3 rounded-xl border border-[#bfe8e8] bg-[#f2fbfb] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#347796] shadow-sm">
                  <Umbrella className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Controle de retirada e devolução</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A pessoa informa o número, escolhe o colaborador na retirada e, na devolução,
                    confirma o mesmo item. O histórico fica salvo no NFC Hub.
                  </p>
                </div>
              </div>
              <FieldShell label="Título da página">
                <Input value={values.actionConfig.title ?? ""} onChange={(event) => setConfig({ title: event.target.value })} />
              </FieldShell>
              <FieldShell label="Nome do item">
                <Input value={values.actionConfig.assetLabel ?? ""} onChange={(event) => setConfig({ assetLabel: event.target.value })} placeholder="Guarda-chuva" />
              </FieldShell>
              <div className="md:col-span-2">
                <FieldShell label="Descrição">
                  <Textarea value={values.actionConfig.description ?? ""} onChange={(event) => setConfig({ description: event.target.value })} />
                </FieldShell>
              </div>
              <FieldShell label="Rótulo do número">
                <Input value={values.actionConfig.assetNumberLabel ?? ""} onChange={(event) => setConfig({ assetNumberLabel: event.target.value })} placeholder="Número do guarda-chuva" />
              </FieldShell>
              <FieldShell label="Mensagem após retirada">
                <Input value={values.actionConfig.checkoutMessage ?? ""} onChange={(event) => setConfig({ checkoutMessage: event.target.value })} />
              </FieldShell>
              <div className="md:col-span-2">
                <FieldShell label="Mensagem após devolução">
                  <Input value={values.actionConfig.returnMessage ?? ""} onChange={(event) => setConfig({ returnMessage: event.target.value })} />
                </FieldShell>
              </div>
            </div>
          )}

          {(values.actionType === "webhook" || values.actionType === "sequence") && (
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Identificador do workflow" help="A URL real fica exclusivamente em NFC_N8N_WEBHOOK_URL no servidor.">
                <Input required value={values.actionConfig.workflowKey ?? ""} onChange={(event) => setConfig({ workflowKey: event.target.value })} placeholder="abrir-ticket-impressora" />
              </FieldShell>
              <FieldShell label="Timeout (ms)">
                <Input type="number" min={1000} max={30000} value={values.actionConfig.timeoutMs ?? 10000} onChange={(event) => setConfig({ timeoutMs: Number(event.target.value) })} />
              </FieldShell>
              <FieldShell label="Mensagem durante execução"><Input value={values.actionConfig.loadingMessage ?? ""} onChange={(event) => setConfig({ loadingMessage: event.target.value })} /></FieldShell>
              <FieldShell label="Mensagem de sucesso"><Input value={values.actionConfig.successMessage ?? ""} onChange={(event) => setConfig({ successMessage: event.target.value })} /></FieldShell>
            </div>
          )}

          {values.actionType === "whatsapp" && (
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Identificador do workflow"><Input required value={values.actionConfig.workflowKey ?? ""} onChange={(event) => setConfig({ workflowKey: event.target.value })} placeholder="whatsapp-boas-vindas" /></FieldShell>
              <FieldShell label="Número">
                <Select value={values.actionConfig.phoneMode ?? "ask"} onValueChange={(phoneMode: "fixed" | "ask") => setConfig({ phoneMode })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ask">Solicitar na tela</SelectItem><SelectItem value="fixed">Número fixo</SelectItem></SelectContent>
                </Select>
              </FieldShell>
              {values.actionConfig.phoneMode === "fixed" && <FieldShell label="Número fixo"><Input value={values.actionConfig.fixedPhone ?? ""} onChange={(event) => setConfig({ fixedPhone: event.target.value })} /></FieldShell>}
              <div className="md:col-span-2"><FieldShell label="Modelo da mensagem"><Textarea value={values.actionConfig.messageTemplate ?? ""} onChange={(event) => setConfig({ messageTemplate: event.target.value })} placeholder="Olá, {{nome}}..." /></FieldShell></div>
            </div>
          )}

          {values.actionType === "menu" && (
            <div className="grid gap-4 md:grid-cols-2">
              <FieldShell label="Título"><Input value={values.actionConfig.title ?? ""} onChange={(event) => setConfig({ title: event.target.value })} /></FieldShell>
              <div className="md:col-span-2">
                <FieldShell label="Ações do menu" help="Uma ação por linha no formato: Rótulo|https://destino. No MVP, o editor visual do menu cria atalhos URL seguros.">
                  <Textarea
                    rows={6}
                    value={menuLines}
                    onChange={(event) => {
                      const menuItems = event.target.value
                        .split("\n")
                        .map((line, index) => {
                          const [label, destinationUrl] = line.split("|");
                          return {
                            id: `acao_${index + 1}`,
                            label: label?.trim() ?? "",
                            actionType: "url" as const,
                            config: { destinationUrl: destinationUrl?.trim() ?? "", openImmediately: true },
                          };
                        })
                        .filter((item) => item.label);
                      setConfig({ menuItems });
                    }}
                    placeholder={"Abrir ticket|https://...\nConsultar manual|https://..."}
                  />
                </FieldShell>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-16 z-20 flex items-center justify-end gap-2 rounded-md border border-[#dce9eb] bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          <Save />
          {saving ? "Salvando..." : initialTag ? "Salvar alterações" : "Criar etiqueta"}
        </Button>
      </div>
      <NfcToast value={toast} onDismiss={() => setToast(null)} />
    </form>
  );
}
