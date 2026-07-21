import type { Metadata } from "next";
import { Geist, Geist_Mono, Baloo_Bhaijaan_2 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { ContentTourProvider } from "@/contexts/content-tour-context";
import { AppLayout } from "@/components/layout/app-layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Fonte de marca ORQESTRAI — usar só em pontos de marca (login, telas institucionais), não na UI corrida. */
const baloo = Baloo_Bhaijaan_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
  title: "ORQESTRAI — Sistema de Marketing",
  description: "Rastreamento de solicitações e métricas de eficiência para equipe de marketing",
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
      </body>
    </html>
  );
}
