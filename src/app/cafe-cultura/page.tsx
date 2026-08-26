import type { Metadata } from "next";
import { Suspense } from "react";
import { CafeAdminClient } from "@/components/cafe-cultura/cafe-admin-client";

export const metadata: Metadata = {
  title: "Café com Cultura — Administração",
  description: "Painel administrativo do Café com Cultura.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function CafeCulturaAdminPage() {
  return (
    <Suspense fallback={<div className="min-h-[48vh] animate-pulse rounded-3xl bg-muted/40" />}>
      <CafeAdminClient />
    </Suspense>
  );
}
