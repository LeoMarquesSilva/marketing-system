export default function TeamPostsLoading() {
  return (
    <div className="flex w-full flex-col gap-5" aria-busy="true" aria-label="Carregando postagens da equipe">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
