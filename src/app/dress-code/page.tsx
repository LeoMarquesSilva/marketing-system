import type { Metadata } from "next";
import { LookGallery } from "./look-gallery";
import { LOOKS_ELAS, LOOKS_ELES, PALETA } from "./looks";

const PAGE_TITLE = "Dress code · 10 anos | Bismarchi | Pires";
const PAGE_DESCRIPTION =
  "Referências de looks na cartela azul e areia para a celebração de 10 anos do Bismarchi | Pires.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/dress-code" },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/dress-code",
    siteName: "Bismarchi | Pires",
    locale: "pt_BR",
    type: "website",
  },
};

const EYEBROW = "text-[13px] font-semibold tracking-[0.32em] text-[#9c7434] uppercase";
const CARD = "rounded-[28px] border border-[#dcc9a0] bg-[#fdfbf7]/70 px-4 py-8 sm:px-8 sm:py-10";

function SectionIntro({ id, eyebrow, children }: { id: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mb-7 max-w-xl text-center">
      <h2 id={id} className={EYEBROW}>
        {eyebrow}
      </h2>
      <p className="mt-4 text-[15px] leading-7 text-[#3a3f45]">{children}</p>
    </div>
  );
}

export default function DressCodePage() {
  return (
    <main className="min-h-screen bg-[#fbf8f2] bg-[radial-gradient(ellipse_at_top_left,#f3e7d3_0%,transparent_45%),radial-gradient(ellipse_at_bottom_right,#f3e7d3_0%,transparent_40%)] font-[family-name:var(--font-dress-sans)] text-[#1f2328]">
      <div className="mx-auto w-full max-w-5xl px-4 pt-10 pb-14 sm:px-8 sm:pt-14">
        <header className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LOGO HORIZONTAL AZUL.png"
            alt="Bismarchi | Pires Sociedade de Advogados"
            width={955}
            height={230}
            className="h-auto w-48 sm:w-56"
          />
          <p className={`${EYEBROW} mt-10`}>Celebração · 10 anos</p>
          <h1 className="mt-3 font-[family-name:var(--font-dress-display)] text-[clamp(4.5rem,18vw,8.5rem)] leading-[0.85] text-[#cfab68]">
            Dress code
          </h1>
          <p className="mt-5 text-lg font-medium text-[#0d1e2e] sm:text-xl">Referências de looks</p>
          <p className="mt-1 text-sm leading-6 text-[#5c6168]">
            Esporte fino · Entardecer na fazenda
            <br />
            17 de dezembro de 2026, às 18h · Fazenda Santa Margarida, Campinas/SP
          </p>
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#3a3f45]">
            Reunimos algumas fotos para inspirar a sua produção na cartela <strong className="font-semibold">azul e areia</strong>.
            São apenas referências: a escolha é sempre sua. Toque em uma foto para ampliar.
          </p>
          <nav aria-label="Seções" className="mt-7 flex gap-3">
            <a
              href="#para-elas"
              className="rounded-full border border-[#cfab68] px-6 py-2.5 text-sm font-medium text-[#0d1e2e] transition hover:bg-[#cfab68] hover:text-white"
            >
              Para elas
            </a>
            <a
              href="#para-eles"
              className="rounded-full border border-[#cfab68] px-6 py-2.5 text-sm font-medium text-[#0d1e2e] transition hover:bg-[#cfab68] hover:text-white"
            >
              Para eles
            </a>
          </nav>
        </header>

        <div className="mt-12 space-y-6 sm:space-y-8">
          <section aria-labelledby="paleta" className={CARD}>
            <SectionIntro id="paleta" eyebrow="Paleta de cores">
              Tons neutros, terrosos e diferentes nuances de azul. As cores podem ser combinadas entre si, mantendo a
              harmonia e a elegância do conjunto.
            </SectionIntro>
            <ul className="grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-10 sm:gap-x-3">
              {PALETA.map((swatch) => (
                <li key={swatch.name} className="text-center">
                  <span
                    className="block aspect-[5/4] w-full rounded-lg border border-[#e6dccb]"
                    style={{ backgroundColor: swatch.hex }}
                    aria-hidden
                  />
                  <span className="mt-1.5 block text-[10px] leading-tight text-[#3a3f45] sm:text-[11px]">{swatch.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 text-center text-sm text-[#5c6168]">
              <span className="font-semibold text-[#3a3f45]">Tecidos:</span> linho, crepe, viscose e cetim.
            </p>
          </section>

          <section id="para-elas" aria-labelledby="para-elas-titulo" className={`${CARD} scroll-mt-6`}>
            <SectionIntro id="para-elas-titulo" eyebrow="Para elas">
              Vestidos longos, conjuntos de alfaiataria e macacões, do celeste ao marinho. Acessórios em areia, palha ou
              dourado completam o look.
            </SectionIntro>
            <LookGallery looks={LOOKS_ELAS} label="Para elas" />
          </section>

          <section id="para-eles" aria-labelledby="para-eles-titulo" className={`${CARD} scroll-mt-6`}>
            <SectionIntro id="para-eles-titulo" eyebrow="Para eles">
              Blazer ou terno sem gravata, camisa clara e o linho como grande aliado. Sapatos e cinto em couro marrom
              fecham o visual.
            </SectionIntro>
            <LookGallery looks={LOOKS_ELES} label="Para eles" />
          </section>
        </div>

        <footer className="mt-14 flex flex-col items-center text-center">
          <p className="text-[15px] text-[#3a3f45]">Escolha o seu look e venha celebrar conosco.</p>
          <p className={`${EYEBROW} mt-3`}>17 · dezembro · 2026 · 18h</p>
          <p className="mt-2 text-sm text-[#5c6168]">Fazenda Santa Margarida, Campinas/SP</p>
          <p className="mt-10 text-xs text-[#8a8478]">Bismarchi | Pires Sociedade de Advogados</p>
        </footer>
      </div>
    </main>
  );
}
