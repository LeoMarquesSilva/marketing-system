"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const ABOUT_PARAGRAPHS = [
  "O Bismarchi Pires Sociedade de Advogados nasceu com o propósito de impulsionar a economia brasileira, oferecendo soluções jurídicas estratégicas e inovadoras em casos de alta complexidade empresarial.",
  "Com sede em Campinas/SP e atuação nacional, o escritório reúne mais de 60 profissionais altamente qualificados, em áreas como Reestruturação de Empresas, Direito Empresarial, Societário, Contratos Empresariais, M&A, Tributário, Trabalhista Empresarial, dentre outras.",
  "São mais de 8 mil processos distribuídos em cerca de 200 clientes ativos na base do escritório, representando mais de R$ 6 bilhões sob gestão jurídica.",
  "O Núcleo de Legal Operations do escritório é um dos maiores diferenciais mercadológicos, aliando tecnologia, segurança e inteligência de dados à prática jurídica, garantindo precisão, eficiência e previsibilidade nos resultados.",
  "Desde 2018 o escritório figura entre os mais admirados do país, consolidando sua excelência técnica e reputação nacional.",
] as const;

const ABOUT_TEXT = ABOUT_PARAGRAPHS.join("\n\n");

export function CopyableAbout() {
  const [copied, setCopied] = useState(false);

  async function copyAbout() {
    await navigator.clipboard.writeText(ABOUT_TEXT);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="mb-12 overflow-hidden rounded-3xl bg-[#10263b] text-white shadow-[0_20px_70px_rgba(16,38,59,0.15)]">
      <div className="grid lg:grid-cols-[0.7fr_1.3fr]">
        <div className="border-b border-white/10 p-7 sm:p-9 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#e3bd74]">
            Texto institucional
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">
            Sobre o escritório
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
            Conteúdo preparado para a seção “Sobre” do estande virtual.
          </p>
          <button
            type="button"
            onClick={() => void copyAbout()}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#e3bd74] px-4 py-2.5 text-sm font-semibold text-[#10263b] transition hover:bg-[#efca84] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e3bd74]"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Texto copiado" : "Copiar texto"}
          </button>
        </div>

        <div className="space-y-5 p-7 text-sm leading-7 text-white/75 sm:p-9">
          {ABOUT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
