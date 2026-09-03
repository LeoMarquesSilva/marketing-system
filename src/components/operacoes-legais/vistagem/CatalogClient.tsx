"use client";

type CatalogType = {
  id: string;
  code: string;
  label_vios: string;
  kind: string;
  requires_hora: boolean;
  notes: string | null;
  aliases: string[];
  flows: Array<{
    name: string;
    steps: Array<{ step_order: number; label: string; offset_rule: string }>;
  }>;
};

export function CatalogClient({ initialTypes }: { initialTypes: CatalogType[] }) {
  if (!initialTypes.length) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Catálogo vazio — rode as migrations/seed no Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {initialTypes.map((t) => (
        <article key={t.id} className="rounded-lg border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-foreground">{t.label_vios}</h3>
            <span className="text-xs text-muted-foreground">
              {t.code} · {t.kind}
              {t.requires_hora ? " · hora" : ""}
            </span>
          </div>
          {t.notes && <p className="mt-1 text-sm text-amber-800">{t.notes}</p>}
          {t.aliases.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Aliases: {t.aliases.join(" · ")}</p>
          )}
          {t.flows.map((f) => (
            <div key={f.name} className="mt-3 border-t border-[#eef5f6] pt-3">
              <p className="text-sm font-medium text-[#285f7a]">{f.name}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                {f.steps.map((s) => (
                  <li key={s.step_order}>
                    {s.label} <code className="text-muted-foreground/80">{s.offset_rule}</code>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
