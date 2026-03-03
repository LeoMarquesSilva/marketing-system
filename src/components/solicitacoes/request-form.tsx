"use client";

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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserSelect } from "@/components/solicitacoes/user-select";
import { REQUEST_TYPES, STATUS_OPTIONS } from "@/lib/constants";
import type { User } from "@/lib/users";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  request_type: z.string().min(1, "Tipo de solicitação é obrigatório"),
  solicitante_id: z.string().optional(),
  solicitante: z.string().optional(),
  requesting_area: z.string(),
  description: z.string().min(1, "Detalhe da solicitação é obrigatório"),
  assignee_id: z.string().optional(),
  link: z.string().optional(),
  referencias: z.string().optional(),
  nome_advogado: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]),
  priority: z.enum(["urgente", "alta", "normal", "baixa"]),
  deadline: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RequestFormProps {
  users: User[];
  designers: User[];
  onSuccess?: () => void;
  embedded?: boolean;
}

export function RequestForm({ users, designers, onSuccess, embedded }: RequestFormProps) {
  const router = useRouter();

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
      nome_advogado: "",
      status: "pending",
      priority: "normal",
      deadline: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const user = users.find((u) => u.id === values.solicitante_id);
      const area = user?.department ?? values.requesting_area;
      if (!area) {
        form.setError("requesting_area", { message: "Selecione um solicitante ou informe a área" });
        return;
      }
      const designer = designers.find((d) => d.id === values.assignee_id);
      const title = values.request_type;
      const { error } = await supabase.from("marketing_requests").insert({
        title,
        description: values.description || null,
        requesting_area: area,
        assignee: designer?.name ?? null,
        assignee_id: values.assignee_id || null,
        status: values.status,
        workflow_stage: "tarefas",
        solicitante: user?.name ?? values.solicitante ?? null,
        solicitante_id: values.solicitante_id || null,
        request_type: values.request_type || null,
        link: values.link || null,
        referencias: values.referencias || null,
        nome_advogado: values.nome_advogado || null,
        priority: values.priority ?? "normal",
        deadline: values.deadline || null,
      });

      if (error) throw error;

      form.reset();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/solicitacoes");
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
      form.setError("root", {
        message: "Erro ao salvar. Verifique se o Supabase está configurado.",
      });
    }
  }

  const formContent = (
    <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="request_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Solicitação</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Ex: Comunicado, PPT, Post Redes Sociais" />
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
                        placeholder="Selecione o solicitante (nome e área)"
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
                        <Input
                          placeholder="Nome de quem solicitou"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
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
                        <Input placeholder="Ex: Trabalhista, Cível" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {users.length > 0 && (
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
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detalhe da Solicitação</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Ex: arte para envio no Feedz sobre o benefício econômico mensal"
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
                    <Input
                      type="url"
                      placeholder="https://..."
                      {...field}
                    />
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

            <FormField
              control={form.control}
              name="nome_advogado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do advogado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Advogado que escreveu/solicitou"
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
                        placeholder="Nome do designer (cadastre usuários em Marketing)"
                        {...field}
                        disabled
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Cadastre usuários com departamento Marketing para selecionar
                    </p>
                  </FormItem>
                )}
              />
            )}

            {/* Prioridade + Prazo em grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormLabel>Prazo de entrega</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="w-full" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o status" />
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

            {form.formState.errors.root && (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}

            <Button type="submit" className="w-full sm:w-auto">
              Salvar Solicitação
            </Button>
          </form>
        </Form>
  );

  if (embedded) {
    return (
      <div className="pt-2">
        <p className="text-sm text-muted-foreground mb-4">
          Preencha os dados conforme a planilha de solicitações
        </p>
        {formContent}
      </div>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm max-w-2xl">
      <CardHeader>
        <h2 className="text-lg font-semibold">Nova Solicitação</h2>
        <p className="text-sm text-muted-foreground">
          Preencha os dados conforme a planilha de solicitações
        </p>
      </CardHeader>
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  );
}
