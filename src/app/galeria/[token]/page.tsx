import type { Metadata } from "next";
import { cache } from "react";
import { PublicGalleryClient } from "@/components/event-photos/public-gallery-client";
import { PublicGalleryUnavailable } from "@/components/event-photos/public-gallery-unavailable";
import { formatAlbumDate } from "@/lib/event-photos/domain";
import { galleryPath } from "@/lib/event-photos/share";
import { loadPublicGallery } from "@/lib/event-photos/shares-server";

// Galeria do convidado (sem login). A página é montada uma vez e fica em cache: as visitas seguintes
// não rodam função na Vercel, e as fotos vêm direto do Storage. Revogar o link refaz a página na hora.
export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

type PageProps = { params: Promise<{ token: string }> };

const loadGallery = cache((token: string) => loadPublicGallery(token));

const ROBOTS = { index: false, follow: false, googleBot: { index: false, follow: false } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const gallery = await loadGallery(token);
  if (!gallery) return { title: "Fotos do evento | Bismarchi | Pires", robots: ROBOTS };

  const title = `${gallery.album.title} | Bismarchi | Pires`;
  const date = formatAlbumDate(gallery.album.eventDate);
  const description = [`${gallery.photos.length} fotos do evento`, date].filter(Boolean).join(" · ");
  const image = gallery.cover?.shareImageUrl;
  return {
    title,
    description,
    robots: ROBOTS,
    alternates: { canonical: galleryPath(token) },
    openGraph: {
      title,
      description,
      url: galleryPath(token),
      siteName: "Bismarchi | Pires",
      locale: "pt_BR",
      type: "website",
      images: image ? [{ url: image, width: 1200, height: 630, alt: gallery.album.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function GaleriaPage({ params }: PageProps) {
  const { token } = await params;
  const gallery = await loadGallery(token);
  if (!gallery) return <PublicGalleryUnavailable />;
  return <PublicGalleryClient gallery={gallery} />;
}
