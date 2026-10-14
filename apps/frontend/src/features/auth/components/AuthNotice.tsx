import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Mail01Icon } from "@hugeicons/core-free-icons";

type Tone = "brand" | "good" | "crit";
const TILE: Record<Tone, string> = {
  brand: "border-brand-border bg-brand-s text-brand",
  good: "border-good-s bg-good-s text-good",
  crit: "border-crit-border bg-crit-s text-crit",
};

export function AuthNotice({
  icon,
  tone = "brand",
  title,
  children,
}: {
  icon: typeof Mail01Icon;
  tone?: Tone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className={`grid size-[52px] place-items-center rounded-[15px] border ${TILE[tone]}`}
      >
        <HugeiconsIcon icon={icon} size={24} strokeWidth={1.7} />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.5px] text-strong">
        {title}
      </h1>
      {children}
    </div>
  );
}
