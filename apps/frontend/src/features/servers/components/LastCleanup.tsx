import { formatBytes } from "../../../utils/formatBytes";
import { timeAgo } from "../../../utils/formatDate";
import { useCleanups } from "../hooks/useMonitoring";

/** One line under the Docker disk card: how the most recent cleanup went. */
export function LastCleanup({ serverId }: { serverId: string }) {
  const cleanups = useCleanups(serverId);
  const last = cleanups.data?.[0];
  if (!last) return null;
  const who = last.triggeredBy ? ` by ${last.triggeredBy}` : "";
  const text =
    last.status === "SUCCESS"
      ? `Last cleanup ${timeAgo(last.finishedAt ?? last.createdAt)}${who} freed ${formatBytes(last.reclaimedBytes)}`
      : last.status === "FAILED"
        ? `Last cleanup ${timeAgo(last.createdAt)}${who} failed: ${last.errorMessage ?? "unknown error"}`
        : `Cleanup ${last.status === "QUEUED" ? "queued" : "running"}${who}…`;
  return <p className={`mt-4 mb-0 border-t border-divider pt-3 text-[11.5px] ${last.status === "FAILED" ? "text-crit" : "text-sand"}`}>{text}</p>;
}
