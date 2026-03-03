export default function PerfilLoading() {
  return (
    <div className="space-y-6 max-w-xl animate-pulse">
      <div className="h-7 w-32 rounded-lg bg-muted/60" />
      <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] space-y-6">
        {/* Avatar + name */}
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-full bg-muted/50 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-48 rounded bg-muted/50" />
            <div className="h-3 w-32 rounded bg-muted/40" />
          </div>
        </div>
        {/* Fields */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-muted/50" />
            <div className="h-9 w-full rounded-xl bg-muted/40" />
          </div>
        ))}
        <div className="h-9 w-36 rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}
