"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Factory,
  Handshake,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PERGUNTAS_6X1, PRODUTO_6X1 } from "@/lib/leads/qualificacao-6x1";
import { formatarTelefone, PERFIS, type Origem, type Perfil } from "@/lib/leads/materiais";

const ASSETS = "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-EMAILS/produtos/";
const POLITICA = "https://www.bismarchipires.com.br/politica-de-privacidade";
const CHAVE_VISITANTE = "bp-materiais-visitante";

const TOPICOS = [
  { icon: Clock3, texto: "Jornada" },
  { icon: CalendarDays, texto: "Descanso semanal" },
  { icon: Handshake, texto: "Normas coletivas" },
  { icon: Factory, texto: "Impactos operacionais" },
  { icon: ShieldAlert, texto: "Riscos trabalhistas" },
];

interface Prefill {
  recipientId: string;
  name: string | null;
  email: string;
  company: string | null;
}

const inputClass =
  "h-12 w-full rounded-md border border-[#E2D6C2] bg-white px-3.5 text-[15px] text-[#0D1E2E] outline-none transition placeholder:text-[#9aa1a9] focus:border-[#9C7434] focus:ring-2 focus:ring-[#E1B16D]/35";

const botaoPrincipal =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0D1E2E] px-7 text-[15px] font-semibold text-[#FCF9F5] transition hover:bg-[#1b3247] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E1B16D] focus-visible:ring-offset-2 disabled:opacity-70";

function primeiroNome(nome: string | null | undefined): string | null {
  const first = nome?.trim().split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  return first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first;
}

/** Id anônimo do navegador (sem IP nem cookie de terceiros), para contar pessoas únicas. */
function idDoVisitante(): string {
  const novo = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
        );
  try {
    const salvo = window.localStorage.getItem(CHAVE_VISITANTE);
    if (salvo) return salvo;
    const id = novo();
    window.localStorage.setItem(CHAVE_VISITANTE, id);
    return id;
  } catch {
    return novo();
  }
}

/** Uma escolha por pergunta, em botões grandes (sem o rádio do navegador). */
function Opcoes<T extends string>({
  name,
  opcoes,
  valor,
  onChange,
  colunas = 1,
}: {
  name: string;
  opcoes: { valor: T; rotulo: string }[];
  valor: T | undefined;
  onChange: (valor: T) => void;
  colunas?: 1 | 2;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("grid gap-2 pt-1", colunas === 2 && "sm:grid-cols-2")}>
      {opcoes.map((opcao) => {
        const marcado = valor === opcao.valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={marcado}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-md border px-3.5 py-2.5 text-left text-[15px] transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E1B16D]",
              marcado ? "border-[#9C7434] bg-[#F4ECE0] text-[#0D1E2E]" : "border-[#E2D6C2] bg-white hover:border-[#C9A56B]"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                marcado ? "border-[#9C7434] bg-[#9C7434] text-white" : "border-[#C9B79A]"
              )}
            >
              {marcado && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

function Perguntas({
  respostas,
  onChange,
}: {
  respostas: Record<string, string>;
  onChange: (id: string, valor: string) => void;
}) {
  return (
    <ol className="space-y-6">
      {PERGUNTAS_6X1.map((pergunta, index) => (
        <li key={pergunta.id} id={`pergunta-${pergunta.id}`}>
          <p className="flex gap-2 text-[15px] font-semibold leading-snug text-[#0D1E2E]">
            <span className="text-[#9C7434]">{index + 1}.</span>
            {pergunta.titulo}
          </p>
          <Opcoes
            name={pergunta.titulo}
            opcoes={pergunta.opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))}
            valor={respostas[pergunta.id]}
            onChange={(valor) => onChange(pergunta.id, valor)}
          />
        </li>
      ))}
    </ol>
  );
}

export function Ebook6x1Page({ prefill, origem, utm }: { prefill: Prefill | null; origem: Origem | null; utm: string | null }) {
  const [usarPrefill, setUsarPrefill] = useState(Boolean(prefill));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<Perfil | undefined>();
  const [site, setSite] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Cadastro feito: o PDF fica liberado. */
  const [lead, setLead] = useState<{ id: string | null; downloadUrl: string; perfil: Perfil | null } | null>(null);
  /** As 5 perguntas depois do download: fechada → aberta → enviada. */
  const [qualificacao, setQualificacao] = useState<"fechada" | "aberta" | "enviada">("fechada");
  const [querContato, setQuerContato] = useState(false);

  const visitante = useRef<string | null>(null);
  const comecou = useRef(false);
  const fluxoEmail = usarPrefill && Boolean(prefill);
  const respondidas = useMemo(() => PERGUNTAS_6X1.filter((p) => respostas[p.id]).length, [respostas]);
  const nomeSaudacao = fluxoEmail ? primeiroNome(prefill?.name) : null;

  const evento = (nomeEvento: "visita" | "inicio") => {
    const payload = JSON.stringify({
      produto: PRODUTO_6X1,
      evento: nomeEvento,
      visitante: visitante.current,
      origem,
      utm,
      ref: typeof document !== "undefined" ? document.referrer.slice(0, 300) : null,
      email: Boolean(prefill),
    });
    try {
      if (navigator.sendBeacon?.("/api/materiais/eventos", new Blob([payload], { type: "text/plain" }))) return;
    } catch {
      /* cai no fetch */
    }
    void fetch("/api/materiais/eventos", { method: "POST", body: payload, keepalive: true }).catch(() => undefined);
  };

  // Uma visita por abertura da página.
  useEffect(() => {
    visitante.current = idDoVisitante();
    evento("visita");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conta só ao abrir
  }, []);

  /** Leva ao topo do cartão do formulário depois que a tela troca (download liberado, respostas enviadas). */
  const rolarParaFormulario = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth", block: "start" }))
    );

  /** Primeiro toque no formulário: "começou a preencher". */
  const marcarInicio = () => {
    if (comecou.current) return;
    comecou.current = true;
    evento("inicio");
  };

  const postar = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/materiais/fim-da-escala-6x1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem, utm, visitante: visitante.current, site, ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      downloadUrl?: string;
      leadId?: string | null;
      wantsContact?: boolean;
    };
    if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar. Tente de novo.");
    return data;
  };

  /** Fluxo curto: nome, WhatsApp, e-mail e "Você é:" liberam o PDF. */
  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 2) return setErro("Informe seu nome.");
    if (telefone.replace(/\D/g, "").length < 10) return setErro("Informe seu WhatsApp com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    if (!perfil) return setErro("Escolha uma opção em \"Você é\".");
    setEnviando(true);
    try {
      const data = await postar({ etapa: "lead", nome, email, telefone, perfil });
      if (!data.downloadUrl) throw new Error("Não foi possível liberar o e-book. Tente de novo.");
      setLead({ id: data.leadId ?? null, downloadUrl: data.downloadUrl, perfil });
      rolarParaFormulario();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const faltandoResposta = () => {
    const faltando = PERGUNTAS_6X1.find((p) => !respostas[p.id]);
    if (faltando) {
      document.getElementById(`pergunta-${faltando.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
  };

  /** Fluxo do e-mail (?r=): as 5 perguntas liberam o PDF, como combinado com a área. */
  const enviarCompleto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (faltandoResposta()) return setErro("Responda todas as perguntas para liberar o e-book.");
    setEnviando(true);
    try {
      const data = await postar({ r: prefill?.recipientId, respostas });
      if (!data.downloadUrl) throw new Error("Não foi possível liberar o e-book. Tente de novo.");
      setLead({ id: data.leadId ?? null, downloadUrl: data.downloadUrl, perfil: null });
      setQuerContato(Boolean(data.wantsContact));
      setQualificacao("enviada");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  /** Depois do download: as 5 perguntas (opcional) classificam o cadastro que acabou de ser criado. */
  const enviarPerguntas = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (faltandoResposta()) return setErro("Responda todas as perguntas para enviar.");
    setEnviando(true);
    try {
      const data = await postar({ etapa: "qualificacao", lead: lead?.id, respostas });
      setQuerContato(Boolean(data.wantsContact));
      setQualificacao("enviada");
      rolarParaFormulario();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const responder = (id: string, valor: string) => {
    marcarInicio();
    setRespostas((r) => ({ ...r, [id]: valor }));
  };

  const mostraConvite = lead && !fluxoEmail && lead.perfil !== "funcionario";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#FCF9F5] font-[family-name:var(--font-material-sans)] text-[#212529]">
      {/* Fênix da marca ao fundo, bem clara */}
      <img
        src="/fenix.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -right-24 top-24 hidden w-[520px] opacity-[0.07] lg:block"
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a href="https://www.bismarchipires.com.br" target="_blank" rel="noreferrer" aria-label="Bismarchi | Pires">
          <img src={`${ASSETS}logo-bismarchi-pires-escuro.png`} alt="Bismarchi | Pires Sociedade de Advogados" className="h-auto w-[170px]" />
        </a>
        <span className="text-xs uppercase tracking-[0.3em] text-[#9C7434]">Trabalhista</span>
      </header>

      {/* No celular: título → formulário → detalhes. No computador: título e detalhes à esquerda, formulário à direita. */}
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 pb-16 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8 lg:pt-10">
        <section className="space-y-5 lg:col-start-1 lg:row-start-1">
          <p className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#9C7434]">
            <span className="h-px w-8 bg-[#9C7434]" aria-hidden />
            E-book gratuito
          </p>
          <h1 className="font-[family-name:var(--font-material-display)] text-[60px] leading-[0.9] text-[#0D1E2E] sm:text-[84px]">
            Fim da escala <span className="text-[#BC8E48]">6x1</span>
          </h1>
          <p className="max-w-md text-xl font-light leading-snug text-[#0D1E2E]">O que sua empresa precisa saber antes de tomar decisões.</p>
          <div className="flex items-center gap-5 pt-1">
            <img
              src={`${ASSETS}ebook-fim-da-escala-6x1-capa.jpg`}
              alt="Capa do e-book Fim da escala 6x1: sua empresa está preparada?"
              className="w-[92px] rounded shadow-[0_8px_18px_rgba(13,30,46,0.25)] sm:w-[120px]"
            />
            <div className="flex items-center gap-3">
              <img src={`${ASSETS}daniel-pressatto-avatar.jpg`} alt="" className="h-12 w-12 rounded-full border-2 border-white object-cover shadow sm:h-14 sm:w-14" />
              <div className="text-sm leading-snug">
                <p className="font-semibold text-[#0D1E2E]">Dr. Daniel Pressatto</p>
                <p className="text-[#5b6570]">Sócio de Área · Trabalhista</p>
              </div>
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section
          id="formulario"
          aria-labelledby="form-titulo"
          className="h-fit scroll-mt-6 rounded-lg border border-[#E8DCC6] bg-white p-6 shadow-[0_10px_30px_rgba(13,30,46,0.06)] sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-8"
        >
          {lead ? (
            <div className="space-y-6" role="status">
              <div className="space-y-4 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 id="form-titulo" className="font-[family-name:var(--font-material-display)] text-4xl text-[#0D1E2E]">
                  Seu e-book está pronto
                </h2>
                <a href={lead.downloadUrl} target="_blank" rel="noreferrer" className={botaoPrincipal}>
                  <Download className="h-4 w-4" />
                  Baixar o e-book (PDF)
                </a>
                {qualificacao === "enviada" ? (
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#5b6570]">
                    {querContato
                      ? "Obrigado! O Dr. Daniel Pressatto vai entrar em contato para conversar sobre a adequação da sua empresa."
                      : "Obrigado pelas respostas. Se quiser conversar sobre a adequação da sua empresa, é só falar com a gente."}
                  </p>
                ) : !mostraConvite ? (
                  <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#5b6570]">Boa leitura!</p>
                ) : null}
              </div>

              {mostraConvite && qualificacao === "fechada" && (
                <div className="space-y-3 rounded-md bg-[#F4ECE0] p-5">
                  <p className="text-[15px] font-semibold leading-snug text-[#0D1E2E]">Quer saber como a mudança afeta a sua empresa?</p>
                  <p className="text-sm leading-relaxed text-[#5b6570]">
                    Responda 5 perguntas em 1 minuto. Se quiser, o Dr. Daniel Pressatto retorna para conversar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setQualificacao("aberta")}
                    className="inline-flex h-11 items-center gap-2 rounded-md border border-[#9C7434] bg-white px-5 text-sm font-semibold text-[#0D1E2E] transition hover:bg-[#FCF9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E1B16D]"
                  >
                    Responder agora
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {mostraConvite && qualificacao === "aberta" && (
                <form onSubmit={enviarPerguntas} noValidate className="space-y-6 border-t border-[#E8DCC6] pt-6">
                  <Perguntas respostas={respostas} onChange={responder} />
                  {erro && (
                    <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                      {erro}
                    </p>
                  )}
                  <div className="space-y-3">
                    <button type="submit" disabled={enviando} className={cn(botaoPrincipal, "w-full")}>
                      {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {enviando ? "Enviando..." : "Enviar respostas"}
                    </button>
                    <p className="text-center text-xs text-[#5b6570]">
                      {respondidas} de {PERGUNTAS_6X1.length} respondidas
                    </p>
                  </div>
                </form>
              )}
            </div>
          ) : fluxoEmail && prefill ? (
            <form onSubmit={enviarCompleto} noValidate className="space-y-6">
              <div className="space-y-1.5">
                <h2 id="form-titulo" className="font-[family-name:var(--font-material-display)] text-4xl text-[#0D1E2E]">
                  Receba o e-book
                </h2>
                <p className="text-sm leading-relaxed text-[#5b6570]">
                  {nomeSaudacao ? `Olá, ${nomeSaudacao}! ` : ""}Responda 5 perguntas rápidas e o PDF é liberado na hora. Elas ajudam nossa
                  equipe a entender o momento da sua empresa.
                </p>
              </div>
              <p className="rounded-md bg-[#F4ECE0] px-4 py-3 text-sm text-[#0D1E2E]">
                Respostas em nome de <strong className="font-semibold">{prefill.email}</strong>
                {prefill.company ? <> ({prefill.company})</> : null}.{" "}
                <button type="button" onClick={() => setUsarPrefill(false)} className="font-medium text-[#9C7434] underline underline-offset-2">
                  Não é você?
                </button>
              </p>
              <Perguntas respostas={respostas} onChange={responder} />
              {erro && (
                <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                  {erro}
                </p>
              )}
              <div className="space-y-3">
                <button type="submit" disabled={enviando} className={cn(botaoPrincipal, "w-full")}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {enviando ? "Enviando..." : "Liberar o e-book"}
                </button>
                <p className="text-center text-xs text-[#5b6570]">
                  {respondidas} de {PERGUNTAS_6X1.length} respondidas · Usamos suas respostas só para entender o momento da sua empresa e, se
                  você pedir, entrar em contato.
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={enviarCadastro} onFocus={marcarInicio} noValidate className="space-y-5">
              <div className="space-y-1.5">
                <h2 id="form-titulo" className="font-[family-name:var(--font-material-display)] text-4xl text-[#0D1E2E]">
                  Receba o e-book
                </h2>
                <p className="text-sm leading-relaxed text-[#5b6570]">Preencha em menos de um minuto e baixe na hora.</p>
              </div>

              <div className="grid gap-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#0D1E2E]">Nome</span>
                  <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#0D1E2E]">WhatsApp</span>
                  <input
                    className={inputClass}
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    autoComplete="tel-national"
                    inputMode="tel"
                    placeholder="(11) 91234-5678"
                    required
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[#0D1E2E]">E-mail</span>
                  <input
                    className={inputClass}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </label>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-[#0D1E2E]">Você é:</p>
                <Opcoes name="Você é" opcoes={PERFIS} valor={perfil} onChange={setPerfil} colunas={2} />
              </div>

              {/* Campo escondido contra robôs */}
              <input
                tabIndex={-1}
                autoComplete="off"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                aria-hidden
                name="site"
              />

              {erro && (
                <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                  {erro}
                </p>
              )}

              <div className="space-y-3">
                <button type="submit" disabled={enviando} className={cn(botaoPrincipal, "w-full")}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {enviando ? "Liberando..." : "Baixar o e-book"}
                </button>
                <p className="text-center text-xs leading-relaxed text-[#5b6570]">
                  Ao baixar, você aceita receber conteúdos do Bismarchi | Pires.{" "}
                  <a href={POLITICA} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    Política de privacidade
                  </a>
                </p>
              </div>
            </form>
          )}
        </section>

        <section className="space-y-6 lg:col-start-1 lg:row-start-2">
          <div className="max-w-lg space-y-4 text-[15px] leading-relaxed">
            <p>
              Em meio a tantas informações desencontradas sobre a alteração da escala 6x1, o escritório Bismarchi | Pires preparou um
              e-book exclusivo para gestores, RHs e empresários.
            </p>
            <p>De forma simples e objetiva, o material explica os pontos que realmente merecem atenção:</p>
          </div>

          <ul className="grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
            {TOPICOS.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-[15px] text-[#0D1E2E]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#9C7434]/45 bg-[#E1B16D]/15 text-[#9C7434]">
                  <Icon className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="relative border-t border-[#E8DCC6] px-5 py-6 text-center text-xs text-[#5b6570] sm:px-8">
        Bismarchi | Pires Sociedade de Advogados ·{" "}
        <a href="https://www.bismarchipires.com.br" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          bismarchipires.com.br
        </a>
      </footer>
    </main>
  );
}
