"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Factory,
  Handshake,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PERGUNTAS_6X1 } from "@/lib/leads/qualificacao-6x1";

const ASSETS = "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-EMAILS/produtos/";

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

function primeiroNome(nome: string | null | undefined): string | null {
  const first = nome?.trim().split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  return first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first;
}

export function Ebook6x1Page({ prefill, origem }: { prefill: Prefill | null; origem: "whatsapp" | null }) {
  const [usarPrefill, setUsarPrefill] = useState(Boolean(prefill));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [site, setSite] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ downloadUrl: string; wantsContact: boolean } | null>(null);

  const respondidas = useMemo(() => PERGUNTAS_6X1.filter((p) => respostas[p.id]).length, [respostas]);
  const nomeSaudacao = usarPrefill ? primeiroNome(prefill?.name) : null;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    const faltando = PERGUNTAS_6X1.find((p) => !respostas[p.id]);
    if (faltando) {
      setErro("Responda todas as perguntas para liberar o e-book.");
      document.getElementById(`pergunta-${faltando.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/materiais/fim-da-escala-6x1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r: usarPrefill ? prefill?.recipientId : null,
          origem,
          nome,
          email,
          empresa,
          telefone,
          respostas,
          site,
        }),
      });
      const data = (await res.json()) as { error?: string; downloadUrl?: string; wantsContact?: boolean };
      if (!res.ok || !data.downloadUrl) throw new Error(data.error ?? "Não foi possível enviar. Tente de novo.");
      setResultado({ downloadUrl: data.downloadUrl, wantsContact: Boolean(data.wantsContact) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

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

      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14 lg:pt-10">
        {/* Apresentação do material */}
        <section className="space-y-7 lg:sticky lg:top-8 lg:self-start">
          <div className="space-y-4">
            <p className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#9C7434]">
              <span className="h-px w-8 bg-[#9C7434]" aria-hidden />
              E-book gratuito
            </p>
            <h1 className="font-[family-name:var(--font-material-display)] text-[64px] leading-[0.9] text-[#0D1E2E] sm:text-[84px]">
              Fim da escala <span className="text-[#BC8E48]">6x1</span>
            </h1>
            <p className="max-w-md text-xl font-light leading-snug text-[#0D1E2E]">
              O que sua empresa precisa saber antes de tomar decisões.
            </p>
            <a
              href="#formulario"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#0D1E2E] px-6 text-[15px] font-semibold text-[#FCF9F5] lg:hidden"
            >
              <Download className="h-4 w-4" />
              Responder e baixar
            </a>
          </div>

          <div className="max-w-lg space-y-4 text-[15px] leading-relaxed">
            <p>
              Em meio a tantas informações desencontradas sobre a alteração da escala 6x1, o escritório Bismarchi | Pires
              preparou um e-book exclusivo para gestores, RHs e empresários.
            </p>
            <p>
              De forma simples e objetiva, o material explica os pontos que realmente merecem atenção:
            </p>
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

          <div className="flex items-center gap-5 pt-2">
            <img
              src={`${ASSETS}ebook-fim-da-escala-6x1-capa.jpg`}
              alt="Capa do e-book Fim da escala 6x1: sua empresa está preparada?"
              className="w-[110px] rounded shadow-[0_8px_18px_rgba(13,30,46,0.25)] sm:w-[130px]"
            />
            <div className="flex items-center gap-3">
              <img
                src={`${ASSETS}daniel-pressatto-avatar.jpg`}
                alt=""
                className="h-14 w-14 rounded-full border-2 border-white object-cover shadow"
              />
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
          className="h-fit scroll-mt-6 rounded-lg border border-[#E8DCC6] bg-white p-6 shadow-[0_10px_30px_rgba(13,30,46,0.06)] sm:p-8"
        >
          {resultado ? (
            <div className="space-y-5 py-4 text-center" role="status">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h2 id="form-titulo" className="font-[family-name:var(--font-material-display)] text-4xl text-[#0D1E2E]">
                Seu e-book está liberado
              </h2>
              <a
                href={resultado.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0D1E2E] px-7 text-[15px] font-semibold text-[#FCF9F5] transition hover:bg-[#1b3247]"
              >
                <Download className="h-4 w-4" />
                Baixar o e-book (PDF)
              </a>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-[#5b6570]">
                {resultado.wantsContact
                  ? "Obrigado! O Dr. Daniel Pressatto vai entrar em contato para conversar sobre a adequação da sua empresa."
                  : "Obrigado pelas respostas. Se quiser conversar sobre a adequação da sua empresa, é só falar com a gente."}
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="space-y-6">
              <div className="space-y-1.5">
                <h2 id="form-titulo" className="font-[family-name:var(--font-material-display)] text-4xl text-[#0D1E2E]">
                  Receba o e-book
                </h2>
                <p className="text-sm leading-relaxed text-[#5b6570]">
                  {nomeSaudacao ? `Olá, ${nomeSaudacao}! ` : ""}Responda 5 perguntas rápidas e o PDF é liberado na hora. Elas
                  ajudam nossa equipe a entender o momento da sua empresa.
                </p>
              </div>

              {usarPrefill && prefill ? (
                <p className="rounded-md bg-[#F4ECE0] px-4 py-3 text-sm text-[#0D1E2E]">
                  Respostas em nome de <strong className="font-semibold">{prefill.email}</strong>
                  {prefill.company ? <> ({prefill.company})</> : null}.{" "}
                  <button type="button" onClick={() => setUsarPrefill(false)} className="font-medium text-[#9C7434] underline underline-offset-2">
                    Não é você?
                  </button>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-[#0D1E2E]">Nome *</span>
                    <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-[#0D1E2E]">E-mail corporativo *</span>
                    <input
                      className={inputClass}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-[#0D1E2E]">Empresa</span>
                    <input className={inputClass} value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="organization" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-[#0D1E2E]">Telefone / WhatsApp</span>
                    <input className={inputClass} value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" inputMode="tel" />
                  </label>
                </div>
              )}

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

              <ol className="space-y-6">
                {PERGUNTAS_6X1.map((pergunta, index) => (
                  <li key={pergunta.id} id={`pergunta-${pergunta.id}`}>
                    <fieldset className="space-y-2.5">
                      <legend className="flex gap-2 text-[15px] font-semibold leading-snug text-[#0D1E2E]">
                        <span className="text-[#9C7434]">{index + 1}.</span>
                        {pergunta.titulo}
                      </legend>
                      <div className="grid gap-2 pt-1">
                        {pergunta.opcoes.map((opcao) => {
                          const marcado = respostas[pergunta.id] === opcao.valor;
                          return (
                            <label
                              key={opcao.valor}
                              className={cn(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-[15px] transition",
                                marcado
                                  ? "border-[#9C7434] bg-[#F4ECE0] text-[#0D1E2E]"
                                  : "border-[#E2D6C2] bg-white hover:border-[#C9A56B]"
                              )}
                            >
                              <input
                                type="radio"
                                name={pergunta.id}
                                value={opcao.valor}
                                checked={marcado}
                                onChange={() => setRespostas((r) => ({ ...r, [pergunta.id]: opcao.valor }))}
                                className="h-4 w-4 accent-[#9C7434]"
                              />
                              {opcao.rotulo}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  </li>
                ))}
              </ol>

              {erro && (
                <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
                  {erro}
                </p>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={enviando}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0D1E2E] px-6 text-[15px] font-semibold text-[#FCF9F5] transition hover:bg-[#1b3247] disabled:opacity-70"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {enviando ? "Enviando..." : "Liberar o e-book"}
                </button>
                <p className="text-center text-xs text-[#5b6570]">
                  {respondidas} de {PERGUNTAS_6X1.length} respondidas · Usamos suas respostas só para entender o momento da
                  sua empresa e, se você pedir, entrar em contato.
                </p>
              </div>
            </form>
          )}
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
