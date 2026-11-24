/** Esqueleto da Gestão das 1:1: abas, números e duplas por gestor. */
export default function GestaoUmAUmLoading() {
  const block = "animate-pulse rounded-xl bg-[#e9eff1]";
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando a gestão das 1:1">
      <div className={`${block} h-12 w-[26rem] max-w-full`} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className={`${block} h-20`} />
        ))}
      </div>
      <div className={`${block} h-14`} />
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`${block} h-72`} />
        ))}
      </div>
    </div>
  );
}
