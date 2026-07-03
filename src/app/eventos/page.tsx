import { EventosClient } from "@/components/eventos/eventos-client";
import { fetchEventosPageData } from "@/lib/eventos-server";
import { fetchActiveUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  const currentYear = new Date().getFullYear();
  const [{ years, events, overview, year }, users] = await Promise.all([
    fetchEventosPageData(currentYear),
    fetchActiveUsers(),
  ]);

  return (
    <EventosClient
      initialYear={year}
      years={years}
      initialEvents={events}
      initialOverview={overview}
      users={users}
    />
  );
}
