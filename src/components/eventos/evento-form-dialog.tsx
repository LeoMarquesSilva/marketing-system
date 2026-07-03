"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, CalendarDays, Flag, Gift, LayoutGrid, MapPin, StickyNote, Tag, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { AREAS } from "@/lib/constants";
import {
  EVENT_SIZE_OPTIONS,
  EVENT_STAGE_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_TYPE_OPTIONS,
  RISK_LEVEL_LABEL,
  createEventTasksFromTemplate,
  insertEvent,
  updateEvent,
  type EventStageStatus,
  type EventTemplate,
  type EventStatus,
  type OrgEvent,
} from "@/lib/eventos";
import type { User } from "@/lib/users";

const schema = z.object({
  year: z.string().min(4),
  name: z.string().min(1, "Nome é obrigatório"),
  month_label: z.string().optional(),
  commemorative_date: z.string().optional(),
  event_date: z.string().optional(),
  gifts_notes: z.string().optional(),
  organization_team: z.string().optional(),
  objectives: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["nao_iniciada", "em_andamento", "concluida", "cancelada"]),
  event_type: z.string().optional(),
  event_size: z.string().optional(),
  target_audience: z.string().optional(),
  priority: z.enum(["baixa", "normal", "alta", "urgente"]),
  requesting_area: z.string().optional(),
  location: z.string().optional(),
  participants_expected: z.string().optional(),
  participants_actual: z.string().optional(),
  stage_status: z.enum([
    "ideia_cadastrada",
    "em_validacao",
    "aprovado",
    "orcando",
    "em_producao",
    "em_comunicacao",
    "pronto_para_execucao",
    "realizado",
    "pos_evento",
    "arquivado",
  ]),
  risk_level: z.enum(["baixo", "medio", "alto"]),
  template_id: z.string().optional(),
  owner_user_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface EventoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear: number;
  event?: OrgEvent | null;
  templates?: EventTemplate[];
  users?: User[];
  onSuccess?: () => void;
}

export function EventoFormDialog({
  open,
  onOpenChange,
  defaultYear,
  event,
  templates: providedTemplates,
  users = [],
  onSuccess,
}: EventoFormDialogProps) {
  const isEdit = !!event;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: String(defaultYear),
      name: "",
      status: "nao_iniciada",
      priority: "normal",
      stage_status: "ideia_cadastrada",
      risk_level: "baixo",
      template_id: "__none__",
      owner_user_id: "__none__",
    },
  });

  const templates = providedTemplates ?? [];

  useEffect(() => {
    if (!open) return;
    if (event) {
      form.reset({
        year: String(event.year),
        name: event.name,
        month_label: event.monthLabel ?? "",
        commemorative_date: event.commemorativeDate ?? "",
        event_date: event.eventDate ?? "",
        gifts_notes: event.giftsNotes ?? "",
        organization_team: event.organizationTeam ?? "",
        objectives: event.objectives ?? "",
        notes: event.notes ?? "",
        status: event.status,
        event_type: event.eventType ?? "",
        event_size: event.eventSize ?? "",
        target_audience: event.targetAudience ?? "",
        priority: event.priority,
        requesting_area: event.requestingArea ?? "",
        location: event.location ?? "",
        participants_expected: event.participantsExpected != null ? String(event.participantsExpected) : "",
        participants_actual: event.participantsActual != null ? String(event.participantsActual) : "",
        stage_status: event.stageStatus,
        risk_level: event.riskLevel,
        template_id: "__none__",
        owner_user_id: event.ownerUserId ?? "__none__",
      });
    } else {
      form.reset({
        year: String(defaultYear),
        name: "",
        month_label: "",
        commemorative_date: "",
        event_date: "",
        gifts_notes: "",
        organization_team: "",
        objectives: "",
        notes: "",
        status: "nao_iniciada",
        event_type: "",
        event_size: "",
        target_audience: "",
        priority: "normal",
        requesting_area: "",
        location: "",
        participants_expected: "",
        participants_actual: "",
        stage_status: "ideia_cadastrada",
        risk_level: "baixo",
        template_id: "__none__",
        owner_user_id: "__none__",
      });
    }
  }, [open, event, defaultYear, form]);

  async function onSubmit(values: FormValues) {
    const payload = {
      year: Number(values.year),
      name: values.name.trim(),
      monthLabel: values.month_label?.trim() || null,
      commemorativeDate: values.commemorative_date || null,
      eventDate: values.event_date || null,
      giftsNotes: values.gifts_notes?.trim() || null,
      organizationTeam: values.organization_team?.trim() || null,
      status: values.status as EventStatus,
      objectives: values.objectives?.trim() || null,
      budgetPlanned: null,
      notes: values.notes?.trim() || null,
      eventType: values.event_type?.trim() || null,
      eventSize: values.event_size?.trim() || null,
      targetAudience: values.target_audience?.trim() || null,
      priority: values.priority,
      requestingArea: values.requesting_area?.trim() || null,
      ownerUserId: values.owner_user_id && values.owner_user_id !== "__none__" ? values.owner_user_id : null,
      location: values.location?.trim() || null,
      participantsExpected: values.participants_expected ? Number(values.participants_expected) : null,
      participantsActual: values.participants_actual ? Number(values.participants_actual) : null,
      stageStatus: values.stage_status as EventStageStatus,
      riskLevel: values.risk_level,
    };

    let createdId: string | null = null;
    let ok = false;
    if (isEdit && event) {
      ok = await updateEvent(event.id, payload);
      createdId = event.id;
    } else {
      const created = await insertEvent(payload);
      ok = !!created;
      createdId = created?.id ?? null;
    }

    if (ok && createdId && !isEdit && values.template_id && values.template_id !== "__none__" && values.event_date) {
      await createEventTasksFromTemplate(createdId, values.template_id, values.event_date);
    }

    if (ok) {
      onOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogHeaderIcon icon={CalendarDays} />
            <div>
              <DialogTitle className="text-lg">{isEdit ? "Editar evento" : "Novo evento"}</DialogTitle>
              <DialogDescription className="mt-0.5">
                Preencha os dados estratégicos, operacionais e de execução. Ao criar um evento com template, as tarefas padrão serão geradas automaticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={LayoutGrid}>Dados básicos</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Nome do evento <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do evento" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="template_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Sem template</SelectItem>
                          {templates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Tag}>Classificação</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="event_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de evento</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Não informado</SelectItem>
                        {EVENT_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="event_size" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porte</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Não informado</SelectItem>
                        {EVENT_SIZE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="target_audience" render={({ field }) => (
                  <FormItem><FormLabel>Público-alvo</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Users}>Responsáveis e área</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="requesting_area" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área solicitante</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Não informado</SelectItem>
                        {AREAS.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="owner_user_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável pelo evento</FormLabel>
                    <FormControl>
                      <UserSelectSearch
                        users={users}
                        value={field.value && field.value !== "__none__" ? field.value : ""}
                        onValueChange={(v) => field.onChange(v || "__none__")}
                        placeholder="Selecionar responsável"
                        allowClear
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="organization_team" render={({ field }) => (
                  <FormItem><FormLabel>Equipe / organização</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Flag}>Prioridade e status</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risco</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(RISK_LEVEL_LABEL).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status geral</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.keys(EVENT_STATUS_LABEL) as EventStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{EVENT_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="stage_status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status por etapa</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.keys(EVENT_STAGE_LABEL) as EventStageStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{EVENT_STAGE_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={CalendarClock}>Agenda e local</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField control={form.control} name="event_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do evento</FormLabel>
                    <FormControl><DatePickerField value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="commemorative_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data comemorativa</FormLabel>
                    <FormControl><DatePickerField value={field.value ?? ""} onChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="participants_expected" render={({ field }) => (
                  <FormItem><FormLabel>Qtd. prevista</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="participants_actual" render={({ field }) => (
                  <FormItem><FormLabel>Qtd. real</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Local</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={StickyNote}>Detalhes adicionais</DialogSectionHeading>
              <FormField control={form.control} name="gifts_notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" />Brindes</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="objectives" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivos</FormLabel>
                    <FormControl>
                      <textarea className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <textarea className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="sticky bottom-0 -mx-1 -mb-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex justify-end gap-2 px-1 pb-1 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">{isEdit ? "Salvar" : "Criar evento"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
