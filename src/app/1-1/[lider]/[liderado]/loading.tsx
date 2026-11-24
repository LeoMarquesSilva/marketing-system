/** Esqueleto da página da dupla: topo com fotos e métricas, histórico e lateral. */
export default function DuplaUmAUmLoading() {
  const block = "animate-pulse rounded-xl bg-[#e9eff1]";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando a dupla">
      <section className="rounded-2xl border border-[#e1ebee] bg-white p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_44rem] xl:items-center">
          <div className="flex items-center gap-5">
            <div className="flex">
              <div className="size-20 animate-pulse rounded-full bg-[#e9eff1] ring-4 ring-white sm:size-24" />
              <div className="-ml-5 size-20 animate-pulse rounded-full bg-[#e9eff1] ring-4 ring-white sm:size-24" />
            </div>
            <div className="flex-1 space-y-2.5">
              <div className={`${block} h-7 w-3/4`} />
              <div className={`${block} h-4 w-1/2`} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`${block} h-[84px]`} />
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className={`${block} h-2.5 w-full max-w-xl`} />
          <div className="ml-auto flex gap-2.5">
            <div className={`${block} h-11 w-28`} />
            <div className={`${block} h-11 w-36`} />
          </div>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <div className={`${block} h-6 w-52`} />
          <div className={`${block} h-80`} />
          {[0, 1, 2].map((item) => (
            <div key={item} className={`${block} h-20`} />
          ))}
        </div>
        <div className="space-y-5">
          <div className={`${block} h-80`} />
          <div className={`${block} h-48`} />
        </div>
      </div>
    </div>
  );
}
