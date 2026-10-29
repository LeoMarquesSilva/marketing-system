export default function OpsPlannerLoading() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
