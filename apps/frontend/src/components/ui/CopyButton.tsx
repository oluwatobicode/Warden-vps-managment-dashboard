import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon } from "@hugeicons/core-free-icons";

/** Copies `value` and says so. `label` doubles as the accessible name. */
export function CopyButton({ value, label = "Copy", done = "Copied", text }: { value: string; label?: string; done?: string; text?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(done);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand");
    }
  };
  return text ? (
    <button type="button" onClick={copy} className="shrink-0 cursor-pointer rounded-[9px] border border-navb bg-raised px-[13px] py-[9px] text-[11.5px] font-semibold text-strong hover:bg-nav">
      {text}
    </button>
  ) : (
    <button type="button" onClick={copy} aria-label={label} title={label} className="grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-lg border border-cb text-muted-warm hover:bg-hover">
      <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.5} />
    </button>
  );
}
