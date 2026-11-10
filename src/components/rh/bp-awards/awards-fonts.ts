import localFont from "next/font/local";

/**
 * Identidade do Bismarchi | Pires Awards: sans geométrica (Montserrat no lugar
 * da Gotham), títulos em negrito e caixa alta. O nome "BISMARCHI | PIRES AWARDS"
 * aparece sempre pela logo em imagem, nunca recomposto em fonte.
 */
const sans = localFont({
  src: "../../../fonts/montserrat-latin-variable.woff2",
  weight: "300 700",
  variable: "--font-aw-sans",
  display: "swap",
});

export const awardsFontVariables = sans.variable;
