"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarClock, Send, StickyNote, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import { UserSelect } from "@/components/solicitacoes/user-select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DialogHeaderIcon, DialogSectionHeading } from "@/components/eventos/dialog-section-heading";
import { REQUEST_TYPES } from "@/lib/constants";
import { promoteEventTaskToPlanner, type EventTask, type OrgEvent } from "@/lib/eventos";
import type { User } from "@/lib/users";
import { useAuth } from "@/contexts/auth-context";

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  request_type: z.string().min(1),
  solicitante_id: z.string().optional(),
  solicitante: z.string().optional(),
  requesting_area: z.string().min(1),
  description: z.string().min(1),
  link: z.string().optional(),
  referencias: z.string().optional(),
  assignee_id: z.string().optional(),
  priority: z.enum(["urgente", "alta", "normal", "baixa"]),
  deadline: z.string().optional(),
  deadline_time: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EnviarEventoAoPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: EventTask | null;
  event: OrgEvent;
  users: User[];
  designers: User[];
  onSuccess?: (requestId: string) => void;
}

export function EnviarEventoAoPlannerDialog({
  open,
  onOpenChange,
  task,
  event,
  users,
  designers,
  onSuccess,
}: EnviarEventoAoPlannerDialogProps) {
  const { profile } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      request_type: "Evento",
      requesting_area: "Marketing",
      description: "",
      priority: "normal",
    },
  });

  useEffect(() => {
    if (!open || !task) return;
    const assignee = task.assigneeId ? users.find((u) => u.id === task.assigneeId) : null;
    const descParts = [
      event.objectives,
      task.description,
      `Evento: ${event.name} (${event.year})`,
      event.eventDate ? `Data do evento: ${event.eventDate}` : null,
    ].filter(Boolean);

    form.reset({
      title: `Evento: ${event.name} — ${task.title}`,
      request_type: "Evento",
      solicitante_id: assignee?.id ?? "",
      solicitante: assignee?.name ?? "",
      requesting_area: assignee?.department ?? "Marketing",
      description: descParts.join("\n\n"),
      link: "",
      referencias: "",
      assignee_id: task.assigneeId ?? "",
      priority: "normal",
      deadline: task.dueDate ?? event.eventDate ?? "",
      deadline_time: "",
    });
  }, [open, task, event, users, form]);

  async function onSubmit(values: FormValues) {
    if (!task) return;
    const { error, requestId } = await promoteEventTaskToPlanner(
      task.id,
      event,
      {
        title: values.title,
        request_type: values.request_type,
        solicitante_id: values.solicitante_id || null,
        solicitante: values.solicitante || null,
        requesting_area: values.requesting_area,
        description: values.description,
        link: values.link || null,
        referencias: values.referencias || null,
        assignee_id: values.assignee_id || null,
        priority: values.priority,
        deadline: values.deadline || null,
        deadline_time: values.deadline_time || null,
      },
      { id: profile?.id ?? null, name: profile?.name ?? null }
    );

    if (!error && requestId) {
      onOpenChange(false);
      onSuccess?.(requestId);
    } else if (error) {
      form.setError("root", { message: error });
    }
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogHeaderIcon icon={Send} />
            <DialogTitle className="text-lg">Enviar ao Planner</DialogTitle>
          </div>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Send}>Solicitação</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título <span className="text-red-500">*</span></FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="request_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de solicitação</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REQUEST_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={Users}>Solicitante e execução</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="solicitante_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitante</FormLabel>
                      <FormControl>
                        <UserSelectSearch
                          users={users}
                          value={field.value || ""}
                          onValueChange={(v) => {
                            field.onChange(v);
                            const u = users.find((x) => x.id === v);
                            if (u) {
                              form.setValue("requesting_area", u.department);
                              form.setValue("solicitante", u.name);
                            }
                          }}
                          placeholder="Solicitante"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="requesting_area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          className="bg-muted"
                          placeholder="Preenchido ao selecionar o solicitante"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Preenchido automaticamente com o departamento do solicitante
                      </p>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assignee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designer responsável</FormLabel>
                      <FormControl>
                        <UserSelect
                          users={designers}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Selecionar designer"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={StickyNote}>Detalhamento</DialogSectionHeading>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detalhe da solicitação</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-[110px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 space-y-4">
              <DialogSectionHeading icon={CalendarClock}>Prazo e prioridade</DialogSectionHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo</FormLabel>
                      <FormControl>
                        <DatePickerField value={field.value ?? ""} onChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(["urgente", "alta", "normal", "baixa"] as const).map((p) => (
                            <SelectItem key={p} value={p} className="capitalize">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-red-600">{form.formState.errors.root.message}</p>
            )}

            <div className="sticky bottom-0 -mx-1 -mb-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex justify-end gap-2 px-1 pb-1 pt-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Enviar ao Planner</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
