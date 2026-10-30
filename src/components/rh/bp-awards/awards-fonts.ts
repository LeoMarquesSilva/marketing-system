import { Montserrat } from "next/font/google";

/**
 * Identidade do Bismarchi | Pires Awards: sans geométrica (Montserrat no lugar
 * da Gotham), títulos em negrito e caixa alta. O nome "BISMARCHI | PIRES AWARDS"
 * aparece sempre pela logo em imagem, nunca recomposto em fonte.
 */
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-aw-sans",
  display: "swap",
});

export const awardsFontVariables = sans.variable;
