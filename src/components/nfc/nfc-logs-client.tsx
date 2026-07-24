"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NfcPageHeading } from "@/components/nfc/nfc-page-heading";
import { NfcSubnav } from "@/components/nfc/nfc-subnav";
import { getNfcActionLabel } from "@/lib/nfc/labels";

type LogRow = {
  id: string;
  scanned_at: string;
  authenticated_user_id: string | null;
  anonymous_session_id: string | null;
  platform: string | null;
  result_status: string;
  execution_time_ms: number | null;
  error_code: string | null;
  nfc_tags:
    | {
        id: string;
        name: string;
        code: string;
        environment: string | null;
        location: string | null;
        action_type: string;
      }
    | Array<{
        id: string;
        name: string;
        code: string;
        environment: string | null;
        location: string | null;
        action_type: string;
      }>;
};

const STATUS_LABELS: Record<string, string> = {
  received: "Recebida",
  confirmation_required: "Aguardando confirmação",
  completed: "Sucesso",
  error: "Erro",
  rate_limited: "Limite atingido",
  cooldown: "Cooldown",
  inactive: "Etiqueta inativa",
  access_denied: "Acesso negado",
};

function relatedTag(log: LogRow) {
  return Array.isArray(log.nfc_tags) ? log.nfc_tags[0] : log.nfc_tags;
}

export function NfcLogsClient({ initialLogs }: { initialLogs: Array<Record<string, unknown>> }) {
  const logs = initialLogs as unknown as LogRow[];
  const [search, setSearch] = useState("");
  const [environment, setEnvironment] = useState("all");
  const [action, setAction] = useState("all");
  const [result, setResult] = useState("all");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return logs.filter((log) => {
      const tag = relatedTag(log);
      if (term && !`${tag?.name ?? ""} ${tag?.code ?? ""}`.toLocaleLowerCase("pt-BR").includes(term)) return false;
      if (environment !== "all" && tag?.environment !== environment) return false;
      if (action !== "all" && tag?.action_type !== action) return false;
      if (result === "success" && log.result_status !== "completed") return false;
      if (result === "error" && log.result_status !== "error") return false;
      return true;
    });
  }, [logs, search, environment, action, result]);
  const environments = [...new Set(logs.map((log) => relatedTag(log)?.environment).filter(Boolean) as string[])].sort();
  const actions = [...new Set(logs.map((log) => relatedTag(log)?.action_type).filter(Boolean) as string[])].sort();

  return (
    <div className="space-y-5">
      <NfcPageHeading
        title="Logs e histórico"
        description="Audite leituras, resultados e tempos de execução sem expor payloads ou credenciais."
      />
      <NfcSubnav />
      <Card className="gap-4 py-4">
        <CardContent className="grid gap-3 px-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(160px,0.7fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar etiqueta" className="pl-9" />
          </div>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ambiente" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os ambientes</SelectItem>{environments.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Ação" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas as ações</SelectItem>{actions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os resultados</SelectItem><SelectItem value="success">Sucesso</SelectItem><SelectItem value="error">Erro</SelectItem></SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-md border border-[#dce9eb] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data e horário</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Ambiente / local</TableHead>
              <TableHead>Acesso</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">Tempo</TableHead>
              <TableHead>Código de erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => {
              const tag = relatedTag(log);
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{new Date(log.scanned_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><span className="font-medium">{tag?.name ?? "Etiqueta removida"}</span><p className="font-mono text-xs text-muted-foreground">{tag?.code}</p></TableCell>
                  <TableCell>{tag?.environment || "—"}<p className="text-xs text-muted-foreground">{tag?.location || "—"}</p></TableCell>
                  <TableCell>{log.authenticated_user_id ? "Autenticado" : "Anônimo"}<p className="text-xs text-muted-foreground">{log.platform || "Plataforma não informada"}</p></TableCell>
                  <TableCell>{tag ? getNfcActionLabel(tag.action_type) : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.result_status === "completed" ? "default" : log.result_status === "error" ? "destructive" : "secondary"}>
                      {STATUS_LABELS[log.result_status] ?? log.result_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{log.execution_time_ms == null ? "—" : `${log.execution_time_ms} ms`}</TableCell>
                  <TableCell className="font-mono text-xs text-red-700">{log.error_code || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {!filtered.length && <Card className="border-dashed py-10"><CardContent className="text-center text-sm text-muted-foreground">Nenhum registro corresponde aos filtros.</CardContent></Card>}
    </div>
  );
}
