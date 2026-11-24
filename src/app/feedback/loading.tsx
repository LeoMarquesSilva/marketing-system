/** Esqueleto da tela de feedback: topo com números, abas e cartões. */
export default function FeedbackLoading() {
  const block = "animate-pulse rounded-xl bg-[#e9eff1]";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando o feedback">
      <section className="rounded-2xl border border-[#e1ebee] bg-white p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_38rem] xl:items-center">
          <div className="flex items-center gap-4">
            <div className="size-16 animate-pulse rounded-full bg-[#e9eff1] sm:size-20" />
            <div className="flex-1 space-y-2.5">
              <div className={`${block} h-7 w-40`} />
              <div className={`${block} h-4 w-3/4`} />
              <div className="flex gap-2">
                <div className={`${block} h-10 w-36`} />
                <div className={`${block} h-10 w-36`} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`${block} h-[84px]`} />
            ))}
          </div>
        </div>
      </section>
      <div className={`${block} h-12 w-[30rem] max-w-full`} />
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className={`${block} h-28`} />
      ))}
    </div>
  );
}
