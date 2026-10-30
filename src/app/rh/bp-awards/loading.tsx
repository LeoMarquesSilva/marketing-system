export default function BpAwardsCommitteeLoading() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
