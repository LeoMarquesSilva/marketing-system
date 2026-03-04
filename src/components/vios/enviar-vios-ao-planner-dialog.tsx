"use client";

import { useEffect } from "react";
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
import { REQUEST_TYPES } from "@/lib/constants";
import type { User } from "@/lib/users";
import type { ViosTask } from "@/lib/vios-tasks";
import { promoteViosTaskToPlannerWithForm, filterLeonardoFromResponsaveis } from "@/lib/vios-tasks";
import { useAuth } from "@/contexts/auth-context";

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  request_type: z.string().min(1, "Tipo é obrigatório"),
  solicitante_id: z.string().optional(),
  solicitante: z.string().optional(),
  requesting_area: z.string().min(1, "Área é obrigatória"),
  description: z.string().min(1, "Detalhe da solicitação é obrigatório"),
  link: z.string().optional(),
  referencias: z.string().optional(),
  assignee_id: z.string().optional(),
  priority: z.enum(["urgente", "alta", "normal", "baixa"]),
  deadline: z.string().optional(),
  deadline_time: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function normalizeArea(area: string | null): string {
  const a = (area ?? "").trim();
  const map: Record<string, string> = {
    "Special Situations": "Distressed Deals - Special Situations",
    Civel: "Cível",
    "Área Cível": "Cível",
    "Área Trabalhista": "Trabalhista",
    "Área Controladoria": "Operações Legais",
  };
  return map[a] || a || "Outros";
}

interface EnviarViosAoPlannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: ViosTask | null;
  users: User[];
  designers: User[];
  onSuccess?: (requestId: string) => void;
}

export function EnviarViosAoPlannerDialog({
  open,
  onOpenChange,
  task,
  users,
  designers,
  onSuccess,
}: EnviarViosAoPlannerDialogProps) {
  const { profile } = useAuth();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      request_type: "Post Redes Sociais",
      solicitante_id: "",
      solicitante: "",
      requesting_area: "",
      description: "",
      link: "",
      referencias: "",
      assignee_id: "",
      priority: "normal",
      deadline: "",
      deadline_time: "",
    },
  });

  useEffect(() => {
    if (open && task) {
      const firstResp = (filterLeonardoFromResponsaveis(task.responsaveis) ?? "")
        .split(/\s*\|\s*/)[0]
        ?.trim() ?? "";
      const matchedUser = users.find((u) =>
        firstResp
          .toLowerCase()
          .split(/\s+/)
          .every((w) => (u.name ?? "").toLowerCase().includes(w))
      );
      const area = normalizeArea(task.area_processo);
      const desc = [task.descricao, task.historico].filter(Boolean).join("\n\n") || "";

      form.reset({
        title: `VIOS: ${task.etiquetas_tarefa || "REELS/POST/ARTIGO"} - CI ${task.vios_id}`,
        request_type: "Post Redes Sociais",
        solicitante_id: matchedUser?.id ?? task.assignee_id ?? "",
        solicitante: (matchedUser?.name ?? firstResp) || "",
        requesting_area: matchedUser?.department ?? area,
        description: desc,
        link: "",
        referencias: "",
        assignee_id: "",
        priority: "normal",
        deadline: task.data_limite ?? "",
        deadline_time: "",
      });
    }
  }, [open, task, users, form]);

  async function onSubmit(values: FormValues) {
    if (!task) return;
    const { error, requestId } = await promoteViosTaskToPlannerWithForm(
      task.vios_id,
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
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0 rounded-2xl border border-white/50 dark:border-white/10 bg-gradient-to-br from-white/95 via-white/90 to-white/85 dark:from-background dark:via-background dark:to-background/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.05)]"
        aria-describedby="vios-planner-description"
      >
        <div className="shrink-0 border-b border-white/30 dark:border-border/50 px-6 py-4 pr-12 bg-white/80 dark:bg-[linear-gradient(135deg,var(--primary-dark-from)_0%,var(--primary-dark-to)_100%)] backdrop-blur-sm">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground leading-snug">
              Enviar ao Planner
            </DialogTitle>
            <p id="vios-planner-description" className="mt-1.5 text-sm text-muted-foreground/90">
              Preencha as informações que chegaram no e-mail (CI {task.vios_id})
            </p>
          </DialogHeader>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: VIOS: REELS/POST/ARTIGO - CI 123" {...field} />
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
                    <FormLabel>Tipo de Solicitação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Ex: Post Redes Sociais" />
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
                          onSelect={(u) => {
                            form.setValue("requesting_area", u.department);
                            form.setValue("solicitante", u.name);
                          }}
                          placeholder="Pesquisar ou selecionar solicitante"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="solicitante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solicitante</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome de quem solicitou" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="requesting_area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={users.length > 0 ? "Preenchido ao selecionar o solicitante" : "Ex: Trabalhista, Cível"}
                        readOnly={!!form.watch("solicitante_id")}
                        className={form.watch("solicitante_id") ? "bg-muted" : ""}
                      />
                    </FormControl>
                    {users.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Preenchido ao selecionar o solicitante; edite se necessário
                      </p>
                    )}
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
                        placeholder="Informações que chegaram no e-mail (roteiro, briefing, etc.)"
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
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Prioridade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="urgente">Urgente</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="baixa">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo de entrega (data)</FormLabel>
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
                  name="deadline_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de entrega</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} className="w-full" />
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

              <div className="flex gap-2 pt-2">
                <Button type="submit">Enviar ao Planner</Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
