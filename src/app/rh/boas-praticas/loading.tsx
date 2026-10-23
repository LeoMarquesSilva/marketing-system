export default function BoasPraticasLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
