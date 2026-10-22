import type { ReactNode } from "react";
import { Kanit, Montserrat } from "next/font/google";
import { studioFontFaceCss } from "@/lib/estudio/server";

/*
 * Fontes dos modelos OAB: Kanit (livre) direto do next/font; Century Gothic e Neulis
 * Neue (licenciadas) pela rota /api/estudio/fontes, só se o arquivo estiver na pasta.
 * Enquanto a Neulis não chegar, os títulos usam a Montserrat Bold.
 */
const kanit = Kanit({ subsets: ["latin"], weight: ["600"], variable: "--font-estudio-kanit", display: "block" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-estudio-titulo", display: "block" });

export const dynamic = "force-dynamic";

export default async function EstudioLayout({ children }: { children: ReactNode }) {
  const fontFaces = await studioFontFaceCss();
  return (
    <div className={`${kanit.variable} ${montserrat.variable}`} style={{ ["--font-estudio-apoio" as string]: "var(--font-estudio-titulo)" }}>
      {fontFaces && <style dangerouslySetInnerHTML={{ __html: fontFaces }} />}
      {children}
    </div>
  );
}
