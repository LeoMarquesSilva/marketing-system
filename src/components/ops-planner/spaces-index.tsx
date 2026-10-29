import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  OPS_SPACE_ROLE_LABEL,
  OPS_SPACES_PATH,
  type OpsPlannerContext,
  type OpsSpaceCounters,
} from "@/lib/ops-planner/types";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./ops-ui";

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className={cn("text-lg font-semibold tabular-nums", value > 0 && tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function SpacesIndex({ context, counters }: { context: OpsPlannerContext; counters: Record<string, OpsSpaceCounters> }) {
  const people = new Map(context.people.map((person) => [person.id, person]));
  if (context.spaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#dce9eb] bg-white px-4 py-12 text-center">
        <p className="font-medium">Você ainda não faz parte de um espaço.</p>
        <p className="mt-1 text-sm text-muted-foreground">Peça à liderança da sua equipe para incluir você no espaço dela.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {context.spaces.map((space) => {
        const count = counters[space.id] ?? { open: 0, overdue: 0, today: 0, waiting: 0 };
        const members = context.members.filter((member) => member.space_id === space.id);
        const myRole = context.memberships.find((member) => member.space_id === space.id)?.role;
        return (
          <Link
            key={space.id}
            href={`${OPS_SPACES_PATH}/${space.slug}`}
            className="group flex flex-col rounded-lg border border-[#dce9eb] bg-white p-4 shadow-[0_1px_2px_rgba(3,32,47,0.05)] transition-colors hover:border-[#47cdd0]/70"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-semibold">
                  <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: space.color }} />
                  <span className="truncate">{space.name}</span>
                </h2>
                {space.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{space.description}</p>}
              </div>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <Count label="Abertas" value={count.open} />
              <Count label="Atrasadas" value={count.overdue} tone="text-red-700" />
              <Count label="Hoje" value={count.today} tone="text-amber-700" />
              <Count label="Aguardando" value={count.waiting} tone="text-amber-800" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#eef3f4] pt-3">
              <AvatarStack ids={members.map((member) => member.user_id)} people={people} max={6} emptyLabel="Sem membros" />
              {myRole && <span className="text-xs text-muted-foreground">Você: {OPS_SPACE_ROLE_LABEL[myRole]}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
