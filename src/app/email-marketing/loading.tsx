export default function EmailMarketingLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando e-mail marketing">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-lg border border-[#dce9eb] bg-white" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-lg border border-[#dce9eb] bg-white" />
      ))}
    </div>
  );
}
