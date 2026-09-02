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
      <p className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
        Catálogo vazio — rode as migrations/seed no Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {initialTypes.map((t) => (
        <article
          key={t.id}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium text-white">{t.label_vios}</h3>
            <span className="text-xs text-zinc-400">
              {t.code} · {t.kind}
              {t.requires_hora ? " · hora" : ""}
            </span>
          </div>
          {t.notes && <p className="mt-1 text-sm text-amber-200/80">{t.notes}</p>}
          {t.aliases.length > 0 && (
            <p className="mt-2 text-xs text-zinc-400">
              Aliases: {t.aliases.join(" · ")}
            </p>
          )}
          {t.flows.map((f) => (
            <div key={f.name} className="mt-3 border-t border-white/10 pt-3">
              <p className="text-sm text-[#c9a227]">{f.name}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-zinc-300">
                {f.steps.map((s) => (
                  <li key={s.step_order}>
                    {s.label}{" "}
                    <code className="text-zinc-500">{s.offset_rule}</code>
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
