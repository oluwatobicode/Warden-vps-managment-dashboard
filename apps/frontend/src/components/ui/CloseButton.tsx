import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

/** The × in the top-right corner of every modal. */
export function CloseButton({ onClick, disabled, label = "Close" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-[10px] text-sand transition-colors hover:bg-hover hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"
    >
      <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.8} />
    </button>
  );
}
