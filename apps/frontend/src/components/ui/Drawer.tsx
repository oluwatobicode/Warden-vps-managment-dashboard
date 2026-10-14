import { useEffect, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

/** Full-height panel from the right (Add server). */
export function Drawer({
  open,
  onClose,
  kicker,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="drawer-title" className="flex h-full w-[540px] max-w-[94vw] flex-col overflow-y-auto bg-surface px-[30px] py-[26px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            {kicker && <p className="m-0 text-[11px] font-semibold tracking-[.08em] text-link">{kicker}</p>}
            <h3 id="drawer-title" className="mt-2.5 text-[22px] font-bold tracking-[-0.4px] text-strong">{title}</h3>
            {description && <p className="mt-2 text-[12.5px] text-muted-warm">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-cb bg-field text-strong">
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="mt-6 flex flex-col gap-4">{children}</div>
        {footer && <div className="mt-auto flex items-center justify-between gap-3 pt-6">{footer}</div>}
      </div>
    </div>
  );
}
