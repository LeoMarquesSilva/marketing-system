import { Card, CardContent } from "@/components/ui/card";

export default function QualificacoesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <Card className="rounded-xl">
        <CardContent className="flex min-h-[280px] items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    </div>
  );
}
