"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleOff,
  RadioTower,
  ScanLine,
  TriangleAlert,
  Workflow,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import type { NfcDashboardData } from "@/lib/nfc/types";

const ACTION_LABELS: Record<string, string> = {
  url: "Abrir URL",
  custom_page: "Página",
  form: "Formulário",
  webhook: "Webhook n8n",
  whatsapp: "WhatsApp",
  menu: "Menu",
  sequence: "Sequência",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Sucesso",
  error: "Erro",
  running: "Em execução",
  pending: "Pendente",
  skipped: "Ignorada",
};

const COLORS = ["#47cdd0", "#3e84a8", "#48466e", "#45bdc7", "#347796", "#7b91a1"];

function formatCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function NfcDashboardClient({ data: initialData }: { data: NfcDashboardData }) {
  const [data, setData] = useState(initialData);
  const [days, setDays] = useState("30");
  const [environment, setEnvironment] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [actionType, setActionType] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ days });
    if (environment !== "all") params.set("environment", environment);
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    if (actionType !== "all") params.set("actionType", actionType);
    fetch(`/api/nfc/dashboard?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao atualizar filtros.");
        return (await response.json()) as NfcDashboardData;
      })
      .then(setData)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [days, environment, category, status, actionType]);

  const metrics = [
    { label: "Total de etiquetas", value: data.totals.tags, icon: RadioTower, tone: "text-[#347796] bg-[#e8f8f8]" },
    { label: "Etiquetas ativas", value: data.totals.active, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Etiquetas inativas", value: data.totals.inactive, icon: CircleOff, tone: "text-slate-600 bg-slate-100" },
    { label: "Leituras hoje", value: data.totals.scansToday, icon: ScanLine, tone: "text-[#48466e] bg-violet-50" },
    { label: `Leituras em ${days} dias`, value: data.totals.scans30Days, icon: Activity, tone: "text-[#3e84a8] bg-blue-50" },
    { label: "Automações executadas", value: data.totals.executions, icon: Workflow, tone: "text-[#347796] bg-cyan-50" },
    { label: "Execuções com erro", value: data.totals.errors, icon: TriangleAlert, tone: "text-red-700 bg-red-50" },
    { label: "Taxa de sucesso", value: `${data.totals.successRate}%`, icon: Zap, tone: "text-amber-700 bg-amber-50" },
  ];

  if (data.totals.tags === 0) {
    return (
      <div className="space-y-5">
        <NfcPageHeading
          title="NFC Hub"
          description="Conecte etiquetas NFC a automações, formulários, páginas e fluxos do n8n."
          primaryAction={false}
        />
        <NfcSubnav />
        <Card className="min-h-[430px] justify-center border-dashed">
          <CardContent className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f8f8] text-[#347796]">
              <RadioTower className="h-8 w-8" />
            </span>
            <h3 className="text-xl font-semibold">Conecte o mundo físico ao ORQESTRAI</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Cadastre uma etiqueta NFC, grave sua URL permanente e conecte objetos, ambientes e materiais aos seus fluxos digitais.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button asChild>
                <Link href="/nfc/tags/nova">Cadastrar primeira etiqueta</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/nfc/modelos">Conhecer possibilidades</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="NFC Hub"
        description="Acompanhe etiquetas, leituras e automações conectadas ao ambiente físico."
      />
      <NfcSubnav />

      <Card className="gap-3 py-4">
        <CardContent className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent>
          </Select>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os ambientes</SelectItem>{data.filterOptions.environments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{data.filterOptions.categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="active">Ativas</SelectItem><SelectItem value="inactive">Inativas</SelectItem></SelectContent>
          </Select>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as ações</SelectItem>{Object.entries(ACTION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section aria-label="Indicadores do NFC Hub" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="gap-3 py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${metric.tone}`}>
                <metric.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xl font-semibold text-foreground sm:text-2xl">
                  {typeof metric.value === "number" ? formatCompact(metric.value) : metric.value}
                </p>
                <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Leituras por dia</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] px-2 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.scansByDay}>
                <defs>
                  <linearGradient id="nfcScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#47cdd0" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#47cdd0" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5eef0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => String(value).slice(5).split("-").reverse().join("/")}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  labelFormatter={(value) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")}
                  formatter={(value) => [Number(value), "Leituras"]}
                  contentStyle={{ borderRadius: 6, borderColor: "#dce9eb" }}
                />
                <Area type="monotone" dataKey="scans" stroke="#347796" strokeWidth={2} fill="url(#nfcScans)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Distribuição por ambiente</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] px-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.byEnvironment}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {data.byEnvironment.map((item, index) => (
                    <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [Number(value), "Etiquetas"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-5 text-xs text-muted-foreground">
            {data.byEnvironment.map((item, index) => (
              <span key={item.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {item.name} ({item.value})
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Etiquetas mais utilizadas</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] px-2 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topTags} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid stroke="#e5eef0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={116}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => [Number(value), "Leituras"]} />
                <Bar dataKey="scans" fill="#3e84a8" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="gap-4 py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {data.recentActivity.length ? (
              <ol className="divide-y divide-[#e5eef0]">
                {data.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        item.status === "success" ? "bg-emerald-500" : item.status === "error" ? "bg-red-500" : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.tagName}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTION_LABELS[item.actionType] ?? item.actionType} · {STATUS_LABELS[item.status] ?? item.status}
                      </p>
                    </div>
                    <time className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(item.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">
                Nenhuma automação executada no período.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
