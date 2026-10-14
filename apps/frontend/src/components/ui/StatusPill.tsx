import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CancelCircleIcon, Clock01Icon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { ServerStatus, ServiceStatus } from "shared-types";

type Status = ServiceStatus | ServerStatus;
type Tone = "good" | "warn" | "serious" | "crit" | "brand" | "flat";

// One table for every status the API returns, so a status never looks
// different on two pages. Colour is never alone: always icon + label.
const STATUS: Record<Status, { label: string; tone: Tone; icon: typeof Tick02Icon }> = {
  NOT_DEPLOYED: { label: "Not deployed", tone: "flat", icon: Clock01Icon },
  DEPLOYING: { label: "Deploying", tone: "brand", icon: Loading03Icon },
  HEALTHY: { label: "Healthy", tone: "good", icon: Tick02Icon },
  DEGRADED: { label: "Degraded", tone: "serious", icon: Alert02Icon },
  FAILED: { label: "Failed", tone: "crit", icon: CancelCircleIcon },
  CONNECTED: { label: "Connected", tone: "good", icon: Tick02Icon },
  IDLE: { label: "Idle", tone: "flat", icon: Clock01Icon },
  OFFLINE: { label: "Offline", tone: "crit", icon: CancelCircleIcon },
};

const TONE: Record<Tone, string> = {
  good: "bg-good-s text-good",
  warn: "bg-warn-s text-warn",
  serious: "bg-serious-s text-serious",
  crit: "bg-crit-s text-crit",
  brand: "bg-brand-s text-brand",
  flat: "bg-raised text-sand",
};

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE[s.tone]}`}>
      <HugeiconsIcon icon={s.icon} size={13} strokeWidth={2} className={status === "DEPLOYING" ? "animate-spin" : ""} />
      {s.label}
    </span>
  );
}
