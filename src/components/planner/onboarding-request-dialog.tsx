"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { DatePickerField } from "@/components/ui/date-picker-field";
import { UserSelectSearch } from "@/components/solicitacoes/user-select-search";
import {
  createOnboardingRequest,
  ONBOARDING_CHECKLIST_ITEMS,
  ONBOARDING_REQUESTING_AREA,
} from "@/lib/request-checklist";
import { useAuth } from "@/contexts/auth-context";
import type { User } from "@/lib/users";
import { UserPlus, ListChecks } from "lucide-react";

const formSchema = z.object({
  collaborator_name: z.string().min(1, "Nome do colaborador é obrigatório"),
  assignee_id: z.string().optional(),
  deadline: z.string().optional(),
  deadline_time: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface OnboardingRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (requestId?: string) => void;
  designers: User[];
}

export function OnboardingRequestDialog({
  open,
  onOpenChange,
  onSuccess,
  designers,
}: OnboardingRequestDialogProps) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      collaborator_name: "",
      assignee_id: "",
      deadline: "",
      deadline_time: "",
      notes: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const designer = designers.find((d) => d.id === values.assignee_id);
    const { error, requestId } = await createOnboardingRequest({
      collaboratorName: values.collaborator_name,
      assigneeId: values.assignee_id || null,
      assigneeName: designer?.name ?? null,
      deadline: values.deadline || null,
      deadlineTime: values.deadline_time || null,
      notes: values.notes || null,
      createdById: profile?.id ?? null,
      createdByName: profile?.name ?? null,
    });
    setSubmitting(false);

    if (error) {
      form.setError("root", { message: error });
      return;
    }

    form.reset();
    onOpenChange(false);
    onSuccess?.(requestId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-background dark:via-background dark:to-background/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]"
        aria-describedby="onboarding-request-description"
      >
        <div className="shrink-0 border-b border-white/30 dark:border-border/50 px-6 py-4 pr-12 bg-white/80 dark:bg-[linear-gradient(135deg,var(--primary-dark-from)_0%,var(--primary-dark-to)_100%)] backdrop-blur-sm">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground leading-snug flex items-center gap-2">
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              Novo colaborador — pacote MKT
            </DialogTitle>
            <p id="onboarding-request-description" className="mt-1.5 text-sm text-muted-foreground/90">
              Cria uma solicitação em Aguardando produção com checklist de boas-vindas.
            </p>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4 space-y-5">
          <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              Checklist incluído
            </p>
            <ul className="space-y-1">
              {ONBOARDING_CHECKLIST_ITEMS.map((item) => (
                <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary/70 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="collaborator_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do colaborador</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Maria Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-sm text-muted-foreground">
                Área da solicitação: <span className="font-medium text-foreground">{ONBOARDING_REQUESTING_AREA}</span>
              </p>

              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designer (opcional)</FormLabel>
                    <FormControl>
                      <UserSelectSearch
                        users={designers}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Atribuir a um designer"
                        allowClear
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-3">
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem className="min-w-[140px] flex-1">
                      <FormLabel>Prazo (opcional)</FormLabel>
                      <FormControl>
                        <DatePickerField
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="DD/MM/AAAA"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline_time"
                  render={({ field }) => (
                    <FormItem className="min-w-[100px]">
                      <FormLabel>Horário</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações (opcional)</FormLabel>
                    <FormControl>
                      <textarea
                        {...field}
                        rows={2}
                        placeholder="Informações extras para o time de MKT..."
                        className="flex min-h-[60px] w-full resize-none rounded-xl border border-input bg-white/80 dark:bg-background/50 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar pacote de onboarding"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
