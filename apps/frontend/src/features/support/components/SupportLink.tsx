import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CustomerSupportIcon } from "@hugeicons/core-free-icons";
import { useSupportStatus } from "../hooks/useSupport";
import { SupportModal } from "./SupportModal";

/**
 * Opens the Support form. Renders nothing when this Warden has no support
 * inbox (MAIL_SUPPORT unset), so self-hosted installs never show it by accident.
 * `sidebar`: a row in the project sidebar. `header`: a pill beside the avatar.
 */
export function SupportLink({ variant }: { variant: "sidebar" | "header" }) {
  const status = useSupportStatus();
  const [open, setOpen] = useState(false);
  if (!status.data?.enabled) return null;

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] text-[#7c8088] hover:text-white"
        >
          <HugeiconsIcon icon={CustomerSupportIcon} size={17} strokeWidth={1.5} />
          Support
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex cursor-pointer items-center gap-2 rounded-3xl border border-[#2e2e2e] px-4 py-3 text-[13px] font-semibold text-muted-warm hover:bg-raised hover:text-strong"
        >
          <HugeiconsIcon icon={CustomerSupportIcon} size={16} strokeWidth={1.6} />
          Support
        </button>
      )}
      {open && <SupportModal onClose={() => setOpen(false)} />}
    </>
  );
}
