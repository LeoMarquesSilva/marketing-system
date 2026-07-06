import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Sistema de Eficiência de Marketing",
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
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 antialiased`}
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
