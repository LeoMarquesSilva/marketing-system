import type { MetadataRoute } from "next";

/**
 * Manifesto do app (PWA): é o que faz o Chrome/Edge oferecer "Instalar ORQESTRAI"
 * e o celular "Adicionar à tela inicial". Servido em /manifest.webmanifest; o
 * Next coloca o <link rel="manifest"> no <head> sozinho.
 * Ícones gerados do símbolo oficial em public/pwa/.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ORQESTRAI",
    short_name: "ORQESTRAI",
    description:
      "Sistema interno do Bismarchi | Pires: marketing, pessoas e cultura, operações legais e facilities.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#04202f",
    background_color: "#04202f",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
