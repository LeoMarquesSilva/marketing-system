"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  Flame,
  Mail,
  MessageCircle,
  MousePointerClick,
  PhoneCall,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase/client";
import { PERGUNTAS_6X1, PRODUTO_6X1, TEMPERATURA_ROTULO, type Temperatura } from "@/lib/leads/qualificacao-6x1";
import { ORIGEM_ROTULO, PERFIL_ROTULO, formatarTelefone, type Origem, type Perfil } from "@/lib/leads/materiais";
import { BlockHeader, MetricBand } from "./email-marketing-visuals";

const SITE = "https://www.orqestrai.com.br";
const PAGINA = "/materiais/fim-da-escala-6x1";
const CAPA = "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-EMAILS/produtos/ebook-fim-da-escala-6x1-capa.jpg";

const LINKS: { origem: Origem; rotulo: string; dica: string }[] = [
  { origem: "instagram", rotulo: "Linktree / Instagram", dica: "o link da bio (Reels e stories)" },
  { origem: "whatsapp", rotulo: "WhatsApp", dica: "para mandar em conversas e grupos" },
  { origem: "linkedin", rotulo: "LinkedIn", dica: "posts e perfil dos sócios" },
];

type Periodo = "7" | "30" | "tudo";
type FiltroLead = "todos" | "potencial" | "contato" | "quentes";

interface EventRow {
  event: string;
  source: string;
  visitor_id: string | null;
  created_at: string;
}

interface LeadRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  profile: Perfil | null;
  source: Origem;
  temperature: Temperatura | null;
  score: number | null;
  reason: string | null;
  answers: Record<string, string> | null;
  download_count: number;
  qualified_at: string | null;
  created_at: string;
}

const TEMP_STYLE: Record<Temperatura, string> = {
  quente: "bg-rose-50 text-rose-800 ring-rose-200",
  morno: "bg-amber-50 text-amber-900 ring-amber-200",
  frio: "bg-sky-50 text-sky-800 ring-sky-200",
};

const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0);
const diaChave = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");

function inicioDoPeriodo(periodo: Periodo): Date | null {
  if (periodo === "tudo") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (Number(periodo) - 1));
  return d;
}

function TempPill({ lead }: { lead: LeadRow }) {
  if (!lead.temperature) {
    return <span className="inline-flex h-6 items-center rounded-full bg-[#f1f5f7] px-2 text-xs text-[#4b5b66]">Só baixou</span>;
  }
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset", TEMP_STYLE[lead.temperature])}>
      {lead.temperature === "quente" && <Flame className="size-3" />}
      {TEMPERATURA_ROTULO[lead.temperature]}
    </span>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-xs",
        tone === "brand" ? "bg-[#eaf2f5] text-[#285f7a]" : "bg-[#f1f5f7] text-[#3b5560]"
      )}
    >
      {children}
    </span>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="gap-1.5"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
    >
      {copiado ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {copiado ? "Copiado" : "Copiar"}
    </Button>
  );
}

function whatsappLink(phone: string | null): string | null {
  const d = phone?.replace(/\D/g, "");
  return d && d.length >= 10 ? `https://wa.me/55${d}` : null;
}

function exportarCsv(leads: LeadRow[]) {
  const linhas = [
    ["Nome", "E-mail", "WhatsApp", "Você é", "Origem", "Temperatura", "Pontos", "Pediu contato", "Downloads", "Data"],
    ...leads.map((l) => [
      l.name ?? "",
      l.email,
      l.phone ? formatarTelefone(l.phone) : "",
      l.profile ? PERFIL_ROTULO[l.profile] : "",
      ORIGEM_ROTULO[l.source] ?? l.source,
      l.temperature ? TEMPERATURA_ROTULO[l.temperature] : "Só baixou",
      l.score ?? "",
      l.answers?.contato === "sim" ? "Sim" : "",
      l.download_count,
      new Date(l.created_at).toLocaleString("pt-BR"),
    ]),
  ];
  const csv = linhas.map((linha) => linha.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `leads-ebook-6x1-${new Date().toLocaleDateString("sv-SE")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LeadDialog({ lead, onClose }: { lead: LeadRow | null; onClose: () => void }) {
  if (!lead) return null;
  const wa = whatsappLink(lead.phone);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-[#eaf2f5] px-6 py-5 pr-12 text-left">
          <DialogTitle className="text-lg text-[#0d2a38]">{lead.name ?? lead.email}</DialogTitle>
          <DialogDescription>
            {[lead.profile ? PERFIL_ROTULO[lead.profile] : null, `veio por ${ORIGEM_ROTULO[lead.source] ?? lead.source}`].filter(Boolean).join(" · ")}
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <TempPill lead={lead} />
            {lead.answers?.contato === "sim" && <Chip tone="brand">Pediu contato</Chip>}
            <Chip>
              {lead.download_count > 0 ? `Baixou ${lead.download_count}×` : "Ainda não clicou em baixar"}
            </Chip>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[#5a717b]">E-mail</dt>
              <dd className="break-words text-[#0d2a38]">{lead.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#5a717b]">WhatsApp</dt>
              <dd className="text-[#0d2a38]">{lead.phone ? formatarTelefone(lead.phone) : "Não informado"}</dd>
            </div>
            {lead.company && (
              <div>
                <dt className="text-xs text-[#5a717b]">Empresa</dt>
                <dd className="text-[#0d2a38]">{lead.company}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[#5a717b]">Quando</dt>
              <dd className="text-[#0d2a38]">{new Date(lead.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</dd>
            </div>
          </dl>
          {lead.qualified_at ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[#0d2a38]">Respostas</h3>
              <ul className="divide-y divide-[#eaf2f5]">
                {PERGUNTAS_6X1.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <p className="text-xs text-[#5a717b]">{p.titulo}</p>
                    <p className="text-[#0d2a38]">{p.opcoes.find((o) => o.valor === lead.answers?.[p.id])?.rotulo ?? "—"}</p>
                  </li>
                ))}
              </ul>
              {lead.reason && <p className="text-xs text-[#5a717b]">Por que {lead.temperature}: {lead.reason}</p>}
            </section>
          ) : (
            <p className="rounded-md bg-[#f7fafb] px-3 py-2.5 text-sm text-[#3b5560]">
              Baixou sem responder as 5 perguntas. Vale um contato curto para entender o momento da empresa.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#eaf2f5] px-6 py-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button variant="secondary" className="gap-1.5" asChild>
            <a href={`mailto:${lead.email}`}>
              <Mail className="size-4" />
              E-mail
            </a>
          </Button>
          {wa && (
            <Button className="gap-1.5" asChild>
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Aba Materiais: os links para divulgar o e-book e o funil (visitas → cadastros → downloads → respostas) por origem. */
export function MateriaisTab() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [eventos, setEventos] = useState<EventRow[] | null>(null);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  /** Período dos dados na tela: trocar o período mostra o carregando até chegar o novo. */
  const [carregadoPara, setCarregadoPara] = useState<Periodo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroLead>("todos");
  const [aberto, setAberto] = useState<LeadRow | null>(null);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      const desde = inicioDoPeriodo(periodo);
      const linhas: EventRow[] = [];
      for (let de = 0; de < 20000; de += 1000) {
        let q = supabase
          .from("product_material_events")
          .select("event, source, visitor_id, created_at")
          .eq("product", PRODUTO_6X1)
          .order("created_at", { ascending: true })
          .range(de, de + 999);
        if (desde) q = q.gte("created_at", desde.toISOString());
        const { data, error } = await q;
        if (error) throw error;
        linhas.push(...((data ?? []) as EventRow[]));
        if (!data || data.length < 1000) break;
      }
      let ql = supabase
        .from("product_lead_responses")
        .select(
          "id, name, email, phone, company, profile, source, temperature, score, reason, answers, download_count, qualified_at, created_at"
        )
        .eq("product", PRODUTO_6X1)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (desde) ql = ql.gte("created_at", desde.toISOString());
      const { data: leadRows, error: leadError } = await ql;
      if (leadError) throw leadError;
      if (!cancelado) {
        setEventos(linhas);
        setLeads((leadRows ?? []) as LeadRow[]);
        setCarregadoPara(periodo);
      }
    };
    carregar().catch((err) => !cancelado && setErro(err instanceof Error ? err.message : "Erro ao carregar os números."));
    return () => {
      cancelado = true;
    };
  }, [periodo]);

  const numeros = useMemo(() => {
    if (!eventos || !leads || carregadoPara !== periodo) return null;
    const visitas = eventos.filter((e) => e.event === "visita");
    const pessoas = new Set(visitas.map((e) => e.visitor_id).filter(Boolean)).size || visitas.length;
    const comecaram = new Set(eventos.filter((e) => e.event === "inicio").map((e, i) => e.visitor_id ?? `sem-id-${i}`)).size;
    const downloads = eventos.filter((e) => e.event === "download").length;
    const baixaram = leads.filter((l) => l.download_count > 0).length;
    const responderam = leads.filter((l) => l.qualified_at).length;
    const quentes = leads.filter((l) => l.temperature === "quente").length;
    const contato = leads.filter((l) => l.answers?.contato === "sim").length;

    const origens = new Map<string, { pessoas: Set<string>; visitas: number; cadastros: number; baixaram: number }>();
    const linha = (o: string) => {
      let r = origens.get(o);
      if (!r) origens.set(o, (r = { pessoas: new Set(), visitas: 0, cadastros: 0, baixaram: 0 }));
      return r;
    };
    for (const e of visitas) {
      const r = linha(e.source);
      r.visitas++;
      if (e.visitor_id) r.pessoas.add(e.visitor_id);
    }
    for (const l of leads) {
      const r = linha(l.source);
      r.cadastros++;
      if (l.download_count > 0) r.baixaram++;
    }

    const dias = new Map<string, { visitas: number; cadastros: number }>();
    for (const e of visitas) {
      const k = diaChave(e.created_at);
      const d = dias.get(k) ?? { visitas: 0, cadastros: 0 };
      d.visitas++;
      dias.set(k, d);
    }
    for (const l of leads) {
      const k = diaChave(l.created_at);
      const d = dias.get(k) ?? { visitas: 0, cadastros: 0 };
      d.cadastros++;
      dias.set(k, d);
    }
    const primeiroDia = dias.size ? new Date([...dias.keys()].sort()[0]) : null;
    const diasDesdeOPrimeiro = primeiroDia ? Math.ceil((new Date().getTime() - primeiroDia.getTime()) / 86400000) + 1 : 7;
    const nDias = periodo === "tudo" ? Math.min(60, Math.max(7, diasDesdeOPrimeiro)) : Number(periodo);
    const serie = Array.from({ length: nDias }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (nDias - 1 - i));
      const k = d.toLocaleDateString("sv-SE");
      return { dia: d, ...(dias.get(k) ?? { visitas: 0, cadastros: 0 }) };
    });

    return {
      visitas: visitas.length,
      pessoas,
      comecaram,
      cadastros: leads.length,
      downloads,
      baixaram,
      responderam,
      quentes,
      contato,
      origens: Array.from(origens.entries())
        .map(([origem, r]) => ({ origem, pessoas: r.pessoas.size || r.visitas, visitas: r.visitas, cadastros: r.cadastros, baixaram: r.baixaram }))
        .sort((a, b) => b.pessoas - a.pessoas || b.cadastros - a.cadastros),
      serie,
    };
  }, [eventos, leads, periodo, carregadoPara]);

  const leadsFiltrados = useMemo(
    () =>
      (leads ?? []).filter((l) => {
        if (filtro === "potencial") return l.profile !== "funcionario";
        if (filtro === "contato") return l.answers?.contato === "sim";
        if (filtro === "quentes") return l.temperature === "quente";
        return true;
      }),
    [leads, filtro]
  );

  const maxDia = Math.max(1, ...(numeros?.serie.map((s) => s.visitas) ?? [1]));

  return (
    <div className="space-y-5">
      {/* O material e os links para divulgar */}
      <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CAPA} alt="" className="w-16 shrink-0 rounded shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[#0d2a38]">E-book &quot;Fim da escala 6x1&quot;</p>
            <p className="text-sm text-[#5a717b]">Trabalhista · Dr. Daniel Pressatto · nome, WhatsApp, e-mail e &quot;Você é&quot; liberam o PDF</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 self-start sm:self-auto" asChild>
            <a href={`${SITE}${PAGINA}/instagram`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Ver a página
            </a>
          </Button>
        </div>
        <ul className="divide-y divide-[#eaf2f5] border-t border-[#eaf2f5]">
          {LINKS.map((link) => {
            const url = `${SITE}${PAGINA}/${link.origem}`;
            return (
              <li key={link.origem} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="w-48 shrink-0">
                  <p className="text-sm font-medium text-[#0d2a38]">{link.rotulo}</p>
                  <p className="text-xs text-[#5a717b]">{link.dica}</p>
                </div>
                <code className="min-w-0 flex-1 truncate rounded bg-[#f4f6f8] px-2 py-1 text-xs text-[#285f7a]" title={url}>
                  {url}
                </code>
                <CopyLink url={url} />
              </li>
            );
          })}
        </ul>
        <p className="border-t border-[#eaf2f5] px-4 py-2.5 text-xs text-[#5a717b]">
          O e-mail da campanha já leva o link de cada destinatário (continua com as 5 perguntas, como combinado com a Trabalhista).
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <BlockHeader icon={MousePointerClick} title="Funil" description="Visitas contam cada abertura da página; pessoas, cada navegador. Ninguém é identificado antes de preencher." />
        <div className="flex gap-1 rounded-lg border border-[#dce9eb] bg-white p-1" role="tablist" aria-label="Período">
          {(
            [
              ["7", "7 dias"],
              ["30", "30 dias"],
              ["tudo", "Tudo"],
            ] as [Periodo, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={periodo === id}
              onClick={() => setPeriodo(id)}
              className={cn(
                "h-8 rounded-md px-3 text-sm transition-colors",
                periodo === id ? "bg-[#347796] font-medium text-white" : "text-[#5a717b] hover:bg-[#eaf2f5]"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {erro}
        </div>
      ) : !numeros ? (
        <div className="h-[104px] animate-pulse rounded-lg border border-[#dce9eb] bg-white" />
      ) : (
        <>
          <MetricBand
            metrics={[
              { id: "visitas", icon: Eye, label: "Visitas", value: numeros.visitas.toLocaleString("pt-BR"), hint: `${numeros.pessoas} ${numeros.pessoas === 1 ? "pessoa" : "pessoas"}` },
              { id: "inicio", icon: MousePointerClick, label: "Começaram", value: numeros.comecaram, hint: `${pct(numeros.comecaram, numeros.pessoas)}% de quem abriu` },
              { id: "cadastros", icon: UserPlus, label: "Cadastros", value: numeros.cadastros, hint: `${pct(numeros.cadastros, numeros.pessoas)}% de conversão` },
              { id: "baixaram", icon: FileDown, label: "Baixaram", value: numeros.baixaram, hint: `${numeros.downloads} ${numeros.downloads === 1 ? "download" : "downloads"} no total` },
              { id: "responderam", icon: ClipboardCheck, label: "Responderam as 5", value: numeros.responderam, hint: `${numeros.quentes} ${numeros.quentes === 1 ? "quente" : "quentes"}` },
              { id: "contato", icon: PhoneCall, label: "Pediram contato", value: numeros.contato, hint: "para o Dr. Daniel" },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:items-start">
            <section className="rounded-lg border border-[#dce9eb] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0d2a38]">Por dia</h3>
                <span className="flex items-center gap-3 text-xs text-[#5a717b]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#bfe7e8]" aria-hidden />
                    visitas
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#347796]" aria-hidden />
                    cadastros
                  </span>
                </span>
              </div>
              <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Visitas e cadastros por dia">
                {numeros.serie.map((s) => (
                  <div
                    key={s.dia.toISOString()}
                    className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={`${s.dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${s.visitas} visitas, ${s.cadastros} cadastros`}
                  >
                    <div className="relative w-full rounded-t-sm bg-[#bfe7e8]" style={{ height: `${(s.visitas / maxDia) * 100}%`, minHeight: s.visitas ? 3 : 0 }}>
                      {s.cadastros > 0 && (
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-t-sm bg-[#347796]"
                          style={{ height: `${Math.min(100, (s.cadastros / Math.max(s.visitas, 1)) * 100)}%`, minHeight: 3 }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-[#5a717b]">
                <span>{numeros.serie[0]?.dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                <span>hoje</span>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm">
              <h3 className="border-b border-[#eaf2f5] px-4 py-3 text-sm font-semibold text-[#0d2a38]">Por origem</h3>
              {numeros.origens.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">Ninguém abriu a página neste período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[#5a717b]">
                      <th className="px-4 py-2 font-medium">Origem</th>
                      <th className="px-2 py-2 text-right font-medium">Pessoas</th>
                      <th className="px-2 py-2 text-right font-medium">Cadastros</th>
                      <th className="px-4 py-2 text-right font-medium">Conversão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaf2f5]">
                    {numeros.origens.map((o) => (
                      <tr key={o.origem}>
                        <td className="px-4 py-2.5 text-[#0d2a38]">{ORIGEM_ROTULO[o.origem as Origem] ?? o.origem}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{o.pessoas}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{o.cadastros}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#285f7a]">{o.pessoas ? `${pct(o.cadastros, o.pessoas)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#eaf2f5] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" role="group" aria-label="Filtrar leads">
                {(
                  [
                    ["todos", "Todos", leads?.length ?? 0],
                    ["potencial", "Clientes em potencial", (leads ?? []).filter((l) => l.profile !== "funcionario").length],
                    ["contato", "Pediram contato", numeros.contato],
                    ["quentes", "Quentes", numeros.quentes],
                  ] as [FiltroLead, string, number][]
                ).map(([id, rotulo, n]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={filtro === id}
                    onClick={() => setFiltro(id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                      filtro === id ? "border-[#347796] bg-[#347796] font-medium text-white" : "border-[#dce9eb] bg-white text-[#3b5560] hover:bg-[#eaf2f5]"
                    )}
                  >
                    {rotulo}
                    <span className={cn("tabular-nums", filtro === id ? "text-white/80" : "text-muted-foreground")}>{n}</span>
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 self-start" disabled={!leadsFiltrados.length} onClick={() => exportarCsv(leadsFiltrados)}>
                <Download className="size-3.5" />
                Exportar planilha
              </Button>
            </div>
            {leadsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#eaf2f5] text-[#285f7a]">
                  <UserPlus className="size-5" />
                </span>
                <p className="font-medium text-[#0d2a38]">{leads?.length ? "Ninguém neste filtro" : "Nenhum cadastro ainda"}</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {leads?.length ? "Troque o filtro para ver os outros cadastros." : "Quem baixar o e-book aparece aqui na hora, com WhatsApp e perfil."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#eaf2f5]">
                {leadsFiltrados.map((lead) => {
                  const wa = whatsappLink(lead.phone);
                  return (
                    <li key={lead.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[#f5f9fa] sm:flex-row sm:items-center">
                      <button type="button" onClick={() => setAberto(lead)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:underline">
                        <p className="truncate text-sm font-medium text-[#0d2a38]">{lead.name ?? lead.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {lead.email}
                          {lead.phone ? ` · ${formatarTelefone(lead.phone)}` : ""}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {lead.profile && <Chip>{PERFIL_ROTULO[lead.profile]}</Chip>}
                        <Chip tone="brand">{ORIGEM_ROTULO[lead.source] ?? lead.source}</Chip>
                        <TempPill lead={lead} />
                        <span className="w-20 text-right text-xs tabular-nums text-[#5a717b]">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                        {wa && (
                          <Button variant="ghost" size="icon-sm" asChild aria-label={`WhatsApp de ${lead.name ?? lead.email}`}>
                            <a href={wa} target="_blank" rel="noreferrer">
                              <MessageCircle className="size-4 text-[#285f7a]" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <LeadDialog lead={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}
