import { Card, CardContent } from "@/components/ui/card";

export default function ClimaLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="h-9 w-28 shrink-0 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
      <Card className="rounded-xl">
        <CardContent className="flex min-h-[400px] items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    </div>
  );
}
