import { notFound } from "next/navigation";
import { EventoDetailClient } from "@/components/eventos/evento-detail-client";
import { fetchEventoDetailData } from "@/lib/eventos-server";
import { fetchActiveUsers, fetchDesigners } from "@/lib/users";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EventoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [{ event, tasks, budgetItems, linkedSuppliers, catalogSuppliers, quotes, invites, communications, attachments, postmortem, history, templates }, users, designers] = await Promise.all([
    fetchEventoDetailData(id),
    fetchActiveUsers(),
    fetchDesigners(),
  ]);

  if (!event) notFound();

  return (
    <EventoDetailClient
      initialEvent={event}
      initialTasks={tasks}
      initialBudgetItems={budgetItems}
      initialLinkedSuppliers={linkedSuppliers}
      initialCatalogSuppliers={catalogSuppliers}
      initialQuotes={quotes}
      initialInvites={invites}
      initialCommunications={communications}
      initialAttachments={attachments}
      initialPostmortem={postmortem}
      initialHistory={history}
      templates={templates}
      users={users}
      designers={designers}
    />
  );
}
