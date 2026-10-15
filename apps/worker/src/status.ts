import type { ServerStatus } from "db";

/** Polls in a row that must fail before a server counts as offline. One blip isn't an outage. */
export const OFFLINE_AFTER_FAILURES = 3;

/**
 * Status after a poll that reached the server: CONNECTED when something is
 * running on it, IDLE when it answers but runs nothing (or Docker can't say).
 */
export function statusAfterSuccess(runningContainers: number | null): ServerStatus {
  return runningContainers && runningContainers > 0 ? "CONNECTED" : "IDLE";
}

/** Status after a failed poll: unchanged until the failures add up. */
export function statusAfterFailure(current: ServerStatus, failuresInARow: number): ServerStatus {
  return failuresInARow >= OFFLINE_AFTER_FAILURES ? "OFFLINE" : current;
}

/**
 * Disk alerts fire once when usage crosses the limit, and re-arm only after
 * it drops 5 points below, so a disk hovering at the line doesn't alert
 * every minute.
 */
export function diskAlert(percent: number, limit: number, alreadyAlerted: boolean): "alert" | "rearm" | "none" {
  if (!alreadyAlerted && percent >= limit) return "alert";
  if (alreadyAlerted && percent < limit - 5) return "rearm";
  return "none";
}
