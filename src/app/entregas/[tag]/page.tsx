import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileArchive, FileText, FileVideo, ImageOff } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { loginPathWithReturn } from "@/lib/login-redirect";
import { formatFileSize, plannerTagDeliveryPath, tagFromDeliveryParam } from "@/lib/request-files/domain";
import {
  fetchPlannerTagDelivery,
  type DeliveryFile,
  type DeliveryPiece,
  type DeliveryPieceStatus,
} from "@/lib/request-files/server";
import { CopyCaptionButton } from "./copy-caption-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Peças para publicação — Bismarchi | Pires",
  description: "Artes e legendas preparadas pelo Marketing da Bismarchi | Pires.",
  robots: { index: false, follow: false },
};

const STATUS: Record<DeliveryPieceStatus, { label: string; className: string }> = {
  postada: { label: "Postada", className: "bg-[#10263b] text-white" },
  pronta: { label: "Pronta para postar", className: "bg-emerald-100 text-emerald-800" },
  aprovacao: { label: "Em aprovação", className: "bg-amber-100 text-amber-800" },
  producao: { label: "Em produção", className: "bg-[#10263b]/[0.06] text-[#10263b]/60" },
};

const EMPTY_FILES_TEXT: Record<DeliveryPieceStatus, string> = {
  postada: "Os arquivos desta peça não foram enviados por aqui.",
  pronta: "Os arquivos desta peça ainda não foram enviados por aqui.",
  aprovacao: "Os arquivos desta peça ainda não foram enviados por aqui.",
  producao: "A arte aparece aqui quando a designer enviar para aprovação.",
};

function dateKey(piece: DeliveryPiece): string {
  return piece.deadline ?? "sem-data";
}

function dateLabel(key: string): string {
  if (key === "sem-data") return "Sem data definida";
  const label = format(new Date(`${key}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function NonImageIcon({ contentType }: { contentType: string | null }) {
  if (contentType?.startsWith("video/")) return <FileVideo className="h-5 w-5" aria-hidden />;
  if (contentType === "application/zip") return <FileArchive className="h-5 w-5" aria-hidden />;
  return <FileText className="h-5 w-5" aria-hidden />;
}

function PieceFiles({ piece }: { piece: DeliveryPiece }) {
  const images = piece.files.filter((f) => f.isImage);
  const others = piece.files.filter((f) => !f.isImage);
  const isStories = /stor/i.test(piece.format ?? "");

  if (piece.files.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#10263b]/15 px-4 py-5 text-sm text-[#10263b]/50">
        <ImageOff className="h-4 w-4 shrink-0 text-[#c79b4a]" aria-hidden />
        {EMPTY_FILES_TEXT[piece.status]}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className={`grid gap-2 ${images.length === 1 ? "grid-cols-2" : "grid-cols-3"}`} aria-label={`Artes de ${piece.name}`}>
          {images.map((file: DeliveryFile, index) => (
            <li key={file.id} className="overflow-hidden rounded-xl border border-[#10263b]/10 bg-[#f4f1ea]">
              <a href={file.previewUrl} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={file.previewUrl}
                  alt={images.length > 1 ? `${piece.name} — ${index + 1}` : piece.name}
                  className={`w-full object-cover ${isStories ? "aspect-[9/16]" : "aspect-[4/5]"}`}
                  loading="lazy"
                />
              </a>
              <a
                href={file.downloadUrl}
                className="flex items-center justify-center gap-1.5 border-t border-[#10263b]/10 bg-white px-2 py-2 text-xs font-semibold text-[#10263b] transition hover:bg-[#c79b4a] hover:text-white"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {images.length > 1 ? `Baixar ${index + 1}` : "Baixar"}
              </a>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="space-y-2">
          {others.map((file) => (
            <li key={file.id}>
              <a
                href={file.downloadUrl}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-[#10263b]/10 bg-white px-3 py-2.5 transition hover:border-[#c79b4a]/60"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#10263b] text-[#e3bd74]">
                  <NonImageIcon contentType={file.contentType} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{file.name}</span>
                  <span className="block text-xs text-[#10263b]/45">{formatFileSize(file.sizeBytes)}</span>
                </span>
                <Download className="h-4 w-4 text-[#10263b]/45 transition group-hover:text-[#c79b4a]" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PieceCard({ piece }: { piece: DeliveryPiece }) {
  const status = STATUS[piece.status];
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#10263b]/10 bg-white/80 p-5 shadow-[0_12px_40px_rgba(16,38,59,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        {piece.code && (
          <span className="rounded-lg bg-[#10263b] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#e3bd74]">
            {piece.code}
          </span>
        )}
        {piece.format && (
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#10263b]/50">{piece.format}</span>
        )}
        <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <h3 className="text-lg font-semibold leading-snug tracking-[-0.02em]">
        {piece.name}
        {piece.deadlineTime && (
          <span className="ml-2 text-sm font-medium text-[#10263b]/45">{piece.deadlineTime.slice(0, 5)}</span>
        )}
      </h3>

      <PieceFiles piece={piece} />

      {piece.caption && (
        <div className="space-y-3 rounded-xl bg-[#f4f1ea] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a87824]">Legenda</span>
            <CopyCaptionButton text={piece.caption} />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#10263b]/75">{piece.caption}</p>
        </div>
      )}
    </article>
  );
}

export default async function PlannerDeliveryPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const tag = tagFromDeliveryParam((await params).tag);
  if (!tag) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPathWithReturn(plannerTagDeliveryPath(tag)));

  const delivery = await fetchPlannerTagDelivery(supabase, tag);
  if (delivery.pieces.length === 0) notFound();

  const groups = new Map<string, DeliveryPiece[]>();
  for (const piece of delivery.pieces) {
    const key = dateKey(piece);
    groups.set(key, [...(groups.get(key) ?? []), piece]);
  }
  const counts = delivery.pieces.reduce<Record<DeliveryPieceStatus, number>>(
    (acc, piece) => ({ ...acc, [piece.status]: acc[piece.status] + 1 }),
    { postada: 0, pronta: 0, aprovacao: 0, producao: 0 }
  );
  const summary = (
    [
      ["pronta", "pronta", "prontas"],
      ["aprovacao", "em aprovação", "em aprovação"],
      ["producao", "em produção", "em produção"],
      ["postada", "postada", "postadas"],
    ] as const
  )
    .filter(([status]) => counts[status] > 0)
    .map(([status, one, many]) => `${counts[status]} ${counts[status] === 1 ? one : many}`);

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#10263b]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between gap-4 border-b border-[#10263b]/15 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LOGO HORIZONTAL AZUL.png"
            alt="Bismarchi Pires Sociedade de Advogados"
            className="h-auto w-44 sm:w-64"
          />
          <span className="rounded-full border border-[#c79b4a]/50 bg-white/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a641f]">
            Uso interno
          </span>
        </header>

        <section className="py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a87824]">
            Peças para publicação
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
            Campanha [{delivery.tag}]
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#10263b]/65">
            Baixe a arte de cada peça e copie a legenda na hora de postar. As peças em aprovação ainda podem receber ajustes.
          </p>
          <div className="mt-8 h-px w-20 bg-[#c79b4a]" />
          <p className="mt-5 text-sm text-[#10263b]/55">
            {delivery.pieces.length} peças{summary.length > 0 && ` · ${summary.join(" · ")}`}
          </p>
        </section>

        <div className="flex-1 space-y-12 pb-12">
          {[...groups.entries()].map(([key, pieces]) => (
            <section key={key} aria-labelledby={`dia-${key}`}>
              <div className="mb-4 flex items-center gap-4">
                <h2 id={`dia-${key}`} className="text-sm font-semibold">
                  {dateLabel(key)}
                </h2>
                <span className="h-px flex-1 bg-[#10263b]/10" />
                <span className="text-xs text-[#10263b]/45">
                  {pieces.length} {pieces.length === 1 ? "peça" : "peças"}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {pieces.map((piece) => (
                  <PieceCard key={piece.id} piece={piece} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[#10263b]/15 pt-5 text-xs text-[#10263b]/45 sm:flex-row sm:items-center sm:justify-between">
          <span>Bismarchi | Pires Sociedade de Advogados</span>
          <span>Compartilhado pelo Marketing via ORQESTRAI</span>
        </footer>
      </div>
    </main>
  );
}
