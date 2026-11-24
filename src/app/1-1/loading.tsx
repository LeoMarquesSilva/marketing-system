export default function UmAUmLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
