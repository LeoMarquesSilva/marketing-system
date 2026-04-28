"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserSelect } from "@/components/solicitacoes/user-select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { REQUEST_TYPES, STATUS_OPTIONS, WORKFLOW_STAGES } from "@/lib/constants";
import type { User } from "@/lib/users";
import type { MarketingRequest } from "@/lib/marketing-requests";
import { updateMarketingRequest } from "@/lib/marketing-requests";
import { format } from "date-fns";

const formSchema = z.object({
  request_type: z.string().min(1, "Tipo de solicitação é obrigatório"),
  solicitante_id: z.string().optional(),
  solicitante: z.string().optional(),
  requesting_area: z.string().min(1, "Área é obrigatória"),
  description: z.string().min(1, "Detalhe da solicitação é obrigatório"),
  assignee_id: z.string().optional(),
  link: z.string().optional(),
  referencias: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]),
  workflow_stage: z.string().optional(),
  requested_at: z.string().min(1, "Data de solicitação é obrigatória"),
  delivered_at: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RequestEditDialogProps {
  request: MarketingRequest | null;
  users: User[];
  designers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequestEditDialog({
  request,
  users,
  designers,
  open,
  onOpenChange,
  onSuccess,
}: RequestEditDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      request_type: "",
      solicitante_id: "",
      solicitante: "",
      requesting_area: "",
      description: "",
      assignee_id: "",
      link: "",
      referencias: "",
      status: "pending",
      workflow_stage: "tarefas",
      requested_at: "",
      delivered_at: "",
    },
  });

  useEffect(() => {
    if (request && open) {
      form.reset({
        request_type: request.request_type || request.title || "",
        solicitante_id: request.solicitante_id || "",
        solicitante: request.solicitante || "",
        requesting_area: request.requesting_area || "",
        description: request.description || "",
        assignee_id: request.assignee_id || "",
        link: request.link || "",
        referencias: request.referencias || "",
        status: request.status,
        workflow_stage: request.workflow_stage || "tarefas",
        requested_at: request.requested_at
          ? format(new Date(request.requested_at), "yyyy-MM-dd")
          : "",
        delivered_at: request.delivered_at
          ? format(new Date(request.delivered_at), "yyyy-MM-dd")
          : "",
      });
    }
  }, [request, open, form]);

  async function onSubmit(values: FormValues) {
    if (!request) return;
    const user = users.find((u) => u.id === values.solicitante_id);
    const designer = designers.find((d) => d.id === values.assignee_id);
    const area = user?.department ?? values.requesting_area;
    const { error } = await updateMarketingRequest(request.id, {
      title: values.request_type,
      request_type: values.request_type,
      description: values.description || null,
      requesting_area: area,
      status: values.status,
      assignee: designer?.name ?? null,
      assignee_id: values.assignee_id || null,
      solicitante: user?.name ?? values.solicitante ?? null,
      solicitante_id: values.solicitante_id || null,
      link: values.link || null,
      referencias: values.referencias || null,
      workflow_stage: (values.workflow_stage as "tarefas" | "em_producao" | "revisao" | "revisado" | "revisao_autor" | "concluido") || null,
      requested_at: values.requested_at,
      delivered_at: values.delivered_at || null,
    });

    if (error) {
      form.setError("root", { message: error });
      return;
    }
    onOpenChange(false);
    onSuccess();
  }

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Solicitação</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="request_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Solicitação</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Ex: Comunicado, PPT" />
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

            {users.length > 0 ? (
              <FormField
                control={form.control}
                name="solicitante_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Solicitante</FormLabel>
                    <FormControl>
                      <UserSelect
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
                        placeholder="Selecione o solicitante"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="solicitante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitante</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="requesting_area"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Área</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Trabalhista, Cível" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhe da Solicitação</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Detalhe da solicitação"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referencias"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referências</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Referências visuais ou briefing"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {designers.length > 0 ? (
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
                        placeholder="Selecione o designer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="assignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designer responsável</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do designer"
                        {...field}
                        disabled
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="workflow_stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etapa do workflow</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || "tarefas"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Etapa" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WORKFLOW_STAGES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requested_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Solicitado em</FormLabel>
                    <FormControl>
                      <DatePickerField
                        id={field.name}
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
                name="delivered_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entregue em</FormLabel>
                    <FormControl>
                      <DatePickerField
                        id={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="DD/MM/AAAA"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
