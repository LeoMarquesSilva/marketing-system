export default function SolicitacoesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 rounded-lg bg-muted/60" />
      {/* Filter bar */}
      <div className="flex gap-2">
        <div className="h-9 flex-1 max-w-xs rounded-xl bg-muted/50" />
        <div className="h-9 w-36 rounded-xl bg-muted/50" />
        <div className="h-9 w-36 rounded-xl bg-muted/50" />
      </div>
      {/* Table skeleton */}
      <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]">
        {/* header */}
        <div className="flex gap-4 px-4 py-3 border-b border-border/30">
          {[80, 120, 100, 160, 90, 90, 80, 90, 100].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted/50" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-border/20 last:border-0">
            {[80, 120, 100, 160, 90, 90, 80, 90, 100].map((w, j) => (
              <div key={j} className="h-3.5 rounded bg-muted/40" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
