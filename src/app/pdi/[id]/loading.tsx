/** Esqueleto da página do plano: topo com foto e progresso, frentes e lateral. */
export default function PlanoPdiLoading() {
  const block = "animate-pulse rounded-xl bg-[#e9eff1]";
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando o plano">
      <div className={`${block} h-5 w-32`} />
      <section className="rounded-2xl border border-[#e1ebee] bg-white p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="flex items-center gap-6">
            <div className="size-20 shrink-0 animate-pulse rounded-full bg-[#e9eff1] sm:size-24" />
            <div className="flex-1 space-y-3">
              <div className={`${block} h-4 w-48`} />
              <div className={`${block} h-8 w-3/4`} />
              <div className="flex gap-2">
                <div className={`${block} h-8 w-32 rounded-full`} />
                <div className={`${block} h-8 w-44 rounded-full`} />
              </div>
            </div>
          </div>
          <div className={`${block} h-36`} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${block} h-52`} />
          ))}
        </div>
        <div className="space-y-4">
          <div className={`${block} h-64`} />
          <div className={`${block} h-40`} />
        </div>
      </div>
    </div>
  );
}
