import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  cta: string;
  /** Destructive actions make the user type this (e.g. the server's name). */
  phrase?: string;
  loading?: boolean;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  if (!props.open) return null;
  // Mounted fresh each time it opens, so the typed phrase always starts empty.
  return <ConfirmDialogBody {...props} />;
}

function ConfirmDialogBody({ onClose, onConfirm, title, body, cta, phrase, loading }: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const ready = !phrase || typed.trim() === phrase;

  return (
    <div
      className="fixed inset-0 z-60 grid place-items-center bg-black/75 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div role="alertdialog" aria-modal="true" className="w-[480px] max-w-full rounded-[20px] border border-cb bg-surface px-7 py-[26px]">
        <div className="flex items-start gap-[13px]">
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-crit-s text-crit">
            <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[19px] font-bold tracking-[-0.3px] text-strong">{title}</h3>
            <p className="mt-[9px] text-[12.5px] text-pretty text-muted-warm">{body}</p>
          </div>
        </div>
        {phrase && (
          <label className="mt-[18px] flex flex-col gap-2">
            <span className="text-xs text-label">
              Type <span className="font-mono text-strong">{phrase}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={phrase}
              className="rounded-xl border border-cb bg-field px-[15px] py-[13px] font-mono text-[13px] text-body outline-none focus:border-brand-border"
            />
          </label>
        )}
        <div className="mt-[22px] flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!ready} loading={loading}>{cta}</Button>
        </div>
      </div>
    </div>
  );
}
