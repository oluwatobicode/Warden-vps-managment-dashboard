import { Link } from "react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Project } from "shared-types";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Skeleton } from "../../../components/ui/Skeleton";

const GRID = "mt-[34px] grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4";

export function ProjectCards({ projects }: { projects: Project[] }) {
  return (
    <div className={GRID}>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

function ProjectCard({ project: p }: { project: Project }) {
  return (
    <Link
      to={`/projects/${p.id}`}
      className="flex flex-col gap-[18px] rounded-[18px] border border-cb bg-ink px-6 py-[22px] transition-colors hover:border-[#2e2e2e] hover:bg-field"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="truncate font-display text-[19px] font-bold text-strong">{p.projectName}</span>
          <span className="truncate font-mono text-[11px] text-sand">/{p.slug}</span>
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.5} className="mt-1 shrink-0 text-faint" />
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <Chip>{plural(p.serviceCount, "service")}</Chip>
        <Chip>{plural(p.environmentCount, "environment")}</Chip>
        <StatusPill status={p.status} />
      </span>
    </Link>
  );
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-2xl bg-chip px-3 py-1.5 text-[11px] whitespace-nowrap text-muted-deep">{children}</span>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ProjectCardsSkeleton() {
  return (
    <div className={GRID}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-[18px] rounded-[18px] border border-cb bg-ink px-6 py-[22px]">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-2xl" />
            <Skeleton className="h-6 w-24 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
