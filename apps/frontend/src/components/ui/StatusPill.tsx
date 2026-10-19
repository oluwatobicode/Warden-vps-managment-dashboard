import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowTurnBackwardIcon, CancelCircleIcon, Clock01Icon, Loading03Icon, PackageIcon, Shield01Icon, StopCircleIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { DeploymentStatus, ServerStatus, ServiceStatus } from "shared-types";

type Status = ServiceStatus | ServerStatus | DeploymentStatus;
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
  // A deploy's own steps (DEPLOYING and FAILED are shared with services above).
  QUEUED: { label: "Queued", tone: "flat", icon: Clock01Icon },
  BUILDING: { label: "Building", tone: "brand", icon: PackageIcon },
  HEALTH_CHECK: { label: "Health check", tone: "brand", icon: Shield01Icon },
  SUCCESS: { label: "Live", tone: "good", icon: Tick02Icon },
  GATE_FAILED: { label: "Gate failed", tone: "crit", icon: Alert02Icon },
  ROLLED_BACK: { label: "Rolled back", tone: "serious", icon: ArrowTurnBackwardIcon },
  CANCELLED: { label: "Cancelled", tone: "flat", icon: StopCircleIcon },
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
