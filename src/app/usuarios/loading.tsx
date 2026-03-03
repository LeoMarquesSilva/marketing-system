export default function UsuariosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-36 rounded-lg bg-muted/60" />
      <div className="flex justify-between items-center">
        <div className="h-9 w-48 rounded-xl bg-muted/50" />
        <div className="h-9 w-32 rounded-xl bg-muted/50" />
      </div>
      <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-sm overflow-hidden shadow-[0_2px_12px_-4px_rgba(0,0,0,0.07)]">
        <div className="flex gap-4 px-4 py-3 border-b border-border/30">
          {[40, 160, 140, 100, 80, 80].map((w, i) => (
            <div key={i} className="h-3 rounded bg-muted/50" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border/20 last:border-0">
            <div className="h-8 w-8 rounded-full bg-muted/40 shrink-0" />
            {[140, 160, 100, 80, 80].map((w, j) => (
              <div key={j} className="h-3.5 rounded bg-muted/40" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
