import { EventAlbumClient } from "@/components/event-photos/event-album-client";

export const dynamic = "force-dynamic";

export default async function FotosEventoAlbumPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventAlbumClient slug={slug} />;
}
