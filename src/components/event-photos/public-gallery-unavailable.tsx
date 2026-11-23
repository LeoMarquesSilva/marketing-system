/** Link de galeria inexistente, revogado, vencido ou de álbum oculto: mesma mensagem para todos. */
export function PublicGalleryUnavailable() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#FCF9F5] px-6 py-16 font-[family-name:var(--font-galeria-sans)] text-[#0D1E2E]">
      <div className="max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/galeria/logo-bp-escuro.png" alt="Bismarchi | Pires" width={220} height={53} className="mx-auto h-auto w-[200px]" />
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9C7434]">Fotos do evento</p>
        <h1 className="mt-3 text-2xl font-semibold leading-tight">Este link não está mais disponível</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#4a5560]">
          O endereço pode ter vencido ou sido desativado. Se ainda precisar das fotos, fale com quem enviou o link.
        </p>
      </div>
    </main>
  );
}
