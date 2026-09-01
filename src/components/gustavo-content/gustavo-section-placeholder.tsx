import Link from "next/link";

export function GustavoSectionPlaceholder({
  kicker,
  title,
  body,
  actionHref,
  actionLabel,
}: {
  kicker: string;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white px-5 py-10 sm:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#347796]">
        {kicker}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-[#04202f]">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-5 inline-flex h-9 items-center rounded-full bg-[#04202f] px-4 text-sm font-medium text-white hover:bg-[#0a2f42]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
