import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ContentTourProvider } from "@/contexts/content-tour-context";
import { AppLayout } from "@/components/layout/app-layout";
import { DicasDeTitulo } from "@/components/ui/dicas-de-titulo";
import { PUBLIC_APP_ORIGIN } from "@/lib/public-origin";
import { CAPTURA_INSTALACAO_SCRIPT } from "@/lib/pwa";

const geistSans = localFont({
  src: "../fonts/geist-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
});

const geistMono = localFont({
  src: "../fonts/geist-mono-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
});

/** Fonte de marca ORQESTRAI — usar só em pontos de marca (login, telas institucionais), não na UI corrida. */
const baloo = localFont({
  src: "../fonts/baloo-bhaijaan-2-latin-variable.woff2",
  weight: "500 700",
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_APP_ORIGIN),
  applicationName: "ORQESTRAI",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // App instalado no iPhone/iPad (Compartilhar › Adicionar à Tela de Início).
  appleWebApp: {
    capable: true,
    title: "ORQESTRAI",
    statusBarStyle: "default",
  },
  title: "ORQESTRAI — Sistema de Marketing",
  description: "Rastreamento de solicitações e métricas de eficiência para equipe de marketing",
};

/** Cor da barra de título do app instalado e da barra do navegador no celular. */
export const viewport: Viewport = {
  themeColor: "#04202f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} min-h-screen bg-background antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ContentTourProvider>
            <AppLayout>{children}</AppLayout>
          </ContentTourProvider>
        </AuthProvider>
        {/* O balão do navegador (title) sai no padrão do Orquestra em todas as telas. */}
        <DicasDeTitulo />
        {/* Guarda o convite de instalação do navegador antes do React carregar. */}
        <Script id="orqestrai-captura-instalacao" strategy="beforeInteractive">
          {CAPTURA_INSTALACAO_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
