export default function LimpezaLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="h-36 animate-pulse rounded-xl bg-muted" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
