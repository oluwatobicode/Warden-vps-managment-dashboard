import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Buttons row at the bottom. */
  footer?: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, description, children, footer, width = "w-[520px]" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 px-6 pt-[90px] pb-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`${width} max-h-[calc(100dvh-114px)] max-w-full overflow-y-auto rounded-2xl border border-track bg-card shadow-[0_32px_80px_rgba(0,0,0,.6)]`}
      >
        <div className="border-b border-cb px-[22px] py-5">
          <h3 id="modal-title" className="text-lg font-bold tracking-[-0.3px] text-strong">
            {title}
          </h3>
          {description && <p className="mt-[7px] text-xs text-sand">{description}</p>}
        </div>
        {children && <div className="flex flex-col gap-4 px-[22px] py-5">{children}</div>}
        {footer && (
          <div className="flex items-center justify-between gap-3 border-t border-cb px-[18px] py-3.5">{footer}</div>
        )}
      </div>
    </div>
  );
}
