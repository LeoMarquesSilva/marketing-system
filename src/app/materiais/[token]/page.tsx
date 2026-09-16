import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, File, FileImage, FileText, Video } from "lucide-react";
import { fetchPublicEventShare } from "@/lib/event-public";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Materiais do evento — Bismarchi | Pires",
  description: "Arquivos institucionais compartilhados pela Bismarchi | Pires.",
  robots: { index: false, follow: false },
};

function attachmentPresentation(fileType: string) {
  switch (fileType) {
    case "foto":
      return { label: "Imagem", Icon: FileImage };
    case "video":
      return { label: "Vídeo", Icon: Video };
    case "apresentacao":
      return { label: "Apresentação", Icon: FileText };
    default:
      return { label: "Arquivo", Icon: File };
  }
}

export default async function EventMaterialsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const share = await fetchPublicEventShare(token, supabase);

  if (!share) notFound();

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#10263b]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between border-b border-[#10263b]/15 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/LOGO HORIZONTAL AZUL.png"
            alt="Bismarchi Pires Sociedade de Advogados"
            className="h-auto w-52 sm:w-64"
          />
          <span className="rounded-full border border-[#c79b4a]/50 bg-white/55 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a641f]">
            Uso institucional
          </span>
        </header>

        <section className="grid flex-1 items-start gap-10 py-12 lg:grid-cols-[1fr_1.25fr] lg:py-16">
          <div className="lg:sticky lg:top-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#a87824]">
              Compartilhamento de arquivos
            </p>
            <h1 className="mt-4 max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
              {share.title}
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#10263b]/65">
              {share.description ?? share.eventName}
            </p>
            <div className="mt-8 h-px w-20 bg-[#c79b4a]" />
            <p className="mt-5 text-sm leading-6 text-[#10263b]/55">
              Selecione um arquivo para abrir ou baixar a versão original.
            </p>
          </div>

          <div>
            {share.attachments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#10263b]/20 bg-white/55 px-6 py-14 text-center">
                <File className="mx-auto h-8 w-8 text-[#c79b4a]" />
                <h2 className="mt-4 text-lg font-semibold">Materiais em preparação</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#10263b]/55">
                  Os arquivos selecionados para este compartilhamento aparecerão aqui.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Arquivos compartilhados">
                {share.attachments.map((attachment, index) => {
                  const { label, Icon } = attachmentPresentation(attachment.fileType);
                  return (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-[#10263b]/10 bg-white/80 p-4 shadow-[0_12px_40px_rgba(16,38,59,0.04)] transition hover:-translate-y-0.5 hover:border-[#c79b4a]/55 hover:bg-white sm:p-5"
                      >
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#10263b] text-[#e3bd74]">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{attachment.title}</span>
                          <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-[#10263b]/45">
                            {String(index + 1).padStart(2, "0")} · {label}
                          </span>
                        </span>
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-[#10263b]/10 text-[#10263b]/55 transition group-hover:border-[#c79b4a] group-hover:bg-[#c79b4a] group-hover:text-white">
                          <Download className="h-4 w-4" aria-hidden />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-[#10263b]/15 pt-5 text-xs text-[#10263b]/45 sm:flex-row sm:items-center sm:justify-between">
          <span>Bismarchi | Pires Sociedade de Advogados</span>
          <span>Documento compartilhado com segurança pelo ORQESTRAI</span>
        </footer>
      </div>
    </main>
  );
}
