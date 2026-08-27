import { redirect } from "next/navigation";

export const metadata = {
  title: "Manual NPS — Meus Clientes",
  robots: { index: false, follow: false },
};

export default function ManuaisNpsPage() {
  redirect("/manuais/nps.html");
}
