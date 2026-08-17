"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Search } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CpfInput } from "@/components/ui/cpf-input";
import { CepInput } from "@/components/ui/cep-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { formatCEP, formatCPF, isValidCPF, maskOAB, onlyDigits } from "@/lib/masks-br";
import {
  BRAZIL_UF_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  NATIONALITY_OPTIONS,
  type HrQualification,
} from "@/lib/rh/qualifications/types";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  full_name: z.string().min(1, "Nome completo é obrigatório"),
  birth_date: z.string().optional(),
  nationality: z
    .string()
    .refine(
      (value) => NATIONALITY_OPTIONS.some((option) => option.value === value),
      "Selecione uma nacionalidade"
    ),
  marital_status: z.string().min(1, "Estado civil é obrigatório"),
  profession: z.string().min(1, "Profissão é obrigatória"),
  treatment_gender: z.enum(["f", "m"], { message: "Selecione o sexo" }),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .refine((v) => isValidCPF(v), "CPF inválido"),
  rg: z.string().min(1, "RG é obrigatório"),
  rg_issuer: z.string().optional(),
  oab_number: z.string().optional(),
  oab_uf: z.string().optional(),
  cep: z
    .string()
    .min(1, "CEP é obrigatório")
    .refine((v) => onlyDigits(v).length === 8, "CEP deve ter 8 dígitos"),
  street: z.string().min(1, "Logradouro é obrigatório"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional(),
  district: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(2, "UF é obrigatória"),
  personal_phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function toFormValues(q: HrQualification | null, fallbackName: string): FormValues {
  return {
    full_name: q?.full_name ?? fallbackName,
    birth_date: q?.birth_date ?? "",
    nationality: q?.nationality ?? "brasileira",
    marital_status: q?.marital_status ?? "",
    profession: q?.profession ?? "",
    treatment_gender: q?.treatment_gender ?? "f",
    cpf: formatCPF(q?.cpf),
    rg: q?.rg ?? "",
    rg_issuer: q?.rg_issuer ?? "",
    oab_number: q?.oab_number ?? "",
    oab_uf: q?.oab_uf ?? "",
    cep: formatCEP(q?.cep),
    street: q?.street ?? "",
    number: q?.number ?? "",
    complement: q?.complement ?? "",
    district: q?.district ?? "",
    city: q?.city ?? "",
    state: q?.state ?? "",
    personal_phone: q?.personal_phone ?? "",
  };
}

interface QualificacaoFormProps {
  initial: HrQualification | null;
  fallbackName: string;
  onSaved?: (qualification: HrQualification) => void | Promise<void>;
}

export function QualificacaoForm({
  initial,
  fallbackName,
  onSaved,
}: QualificacaoFormProps) {
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);
  const [status, setStatus] = useState(initial?.status ?? "pendente");
  const numberRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(initial, fallbackName),
  });

  const fetchCep = async () => {
    const digits = onlyDigits(form.getValues("cep") ?? "");
    if (digits.length !== 8) {
      setCepError("Informe os 8 dígitos do CEP.");
      return;
    }
    setCepLoading(true);
    setCepError(null);
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (!res.ok) {
        setCepError("CEP não encontrado. Você pode preencher o endereço manualmente.");
        return;
      }
      const data = (await res.json()) as {
        street: string;
        district: string;
        city: string;
        state: string;
      };
      if (data.street) form.setValue("street", data.street, { shouldDirty: true });
      if (data.district) form.setValue("district", data.district, { shouldDirty: true });
      if (data.city) form.setValue("city", data.city, { shouldDirty: true });
      if (data.state) form.setValue("state", data.state, { shouldDirty: true });
      numberRef.current?.focus();
    } catch {
      setCepError("Falha ao consultar CEP. Você pode preencher o endereço manualmente.");
    } finally {
      setCepLoading(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    setSubmitError(null);
    setSubmitOk(false);
    try {
      const res = await fetch("/api/rh/qualificacoes/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          birth_date: values.birth_date || null,
          rg_issuer: values.rg_issuer || null,
          oab_number: values.oab_number || null,
          oab_uf: values.oab_uf || null,
          complement: values.complement || null,
          personal_phone: values.personal_phone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Não foi possível salvar.");
        return;
      }
      const q = data.qualification as HrQualification;
      setStatus(q.status);
      setSubmitOk(true);
      await onSaved?.(q);
    } catch {
      setSubmitError("Erro de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  });

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-xl border px-4 py-3.5 text-sm shadow-[0_1px_2px_rgba(3,32,47,0.03)]",
          status === "completo"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-950"
        )}
      >
        {status === "completo"
          ? "Qualificação completa — o RH já pode usar o texto jurídico."
          : "Qualificação pendente — preencha os campos obrigatórios e salve."}
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-2">
          <section className="space-y-5 rounded-xl border border-[#dce9eb] bg-card p-5 shadow-[0_5px_18px_rgba(3,32,47,0.04)] sm:p-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Identificação</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Informações pessoais usadas na redação dos documentos.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="treatment_gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="f">Feminino</SelectItem>
                        <SelectItem value="m">Masculino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birth_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de nascimento</FormLabel>
                    <FormControl>
                      <DatePickerField
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        startYear={new Date().getFullYear() - 100}
                        endYear={new Date().getFullYear()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nacionalidade</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NATIONALITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
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
                name="marital_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado civil</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MARITAL_STATUS_OPTIONS.map((opt) => (
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
                name="profession"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissão</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="advogada" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-[#dce9eb] bg-card p-5 shadow-[0_5px_18px_rgba(3,32,47,0.04)] sm:p-6">
            <div>
              <h3 className="text-base font-semibold text-foreground">Documentos</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Dados de identificação civil e profissional.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <CpfInput value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00.000.000-0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rg_issuer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão emissor (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="SSP/SP" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oab_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAB (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        value={field.value}
                        onChange={(e) => field.onChange(maskOAB(e.target.value))}
                        placeholder="123,456"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="oab_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF OAB</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BRAZIL_UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-[#dce9eb] bg-card p-5 shadow-[0_5px_18px_rgba(3,32,47,0.04)] sm:p-6 xl:col-span-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Endereço</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Pesquise pelo CEP e confira os dados antes de salvar.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cep"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <CepInput
                          value={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            setCepError(null);
                          }}
                          className="sm:max-w-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 gap-2"
                          disabled={
                            cepLoading || onlyDigits(field.value ?? "").length !== 8
                          }
                          onClick={() => void fetchCep()}
                        >
                          {cepLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                          {cepLoading ? "Pesquisando..." : "Pesquisar CEP"}
                        </Button>
                      </div>
                    </FormControl>
                    {cepError && (
                      <p className="text-xs text-amber-700">{cepError}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        ref={(el) => {
                          field.ref(el);
                          numberRef.current = el;
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="street"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="complement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Apto, sala..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UF</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BRAZIL_UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="space-y-5 rounded-xl border border-[#dce9eb] bg-card p-5 shadow-[0_5px_18px_rgba(3,32,47,0.04)] sm:p-6 xl:col-span-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Contato pessoal</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Canais pessoais para contato administrativo do RH.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="personal_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
          {submitOk && (
            <p className="text-sm text-emerald-700">Qualificação salva com sucesso.</p>
          )}

          <div className="flex justify-end border-t border-[#dce9eb] pt-5">
            <Button type="submit" disabled={saving} className="min-w-44 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar qualificação
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
