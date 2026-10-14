import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-fieldb px-6 py-12 text-center">
      <p className="font-display text-base font-bold text-strong">{title}</p>
      {children && <p className="max-w-md text-[12.5px] text-pretty text-muted-warm">{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
