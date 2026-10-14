import type { ConnectionStepName, Server, ServerStatus } from "shared-types";

export const SERVER_DOT: Record<ServerStatus, string> = {
  CONNECTED: "bg-good",
  IDLE: "bg-sand",
  OFFLINE: "bg-crit animate-pulse-dot",
};

export const STEP_LABEL: Record<ConnectionStepName, string> = {
  reach: "Reach the host",
  login: "SSH login",
  system: "System info",
  docker: "Docker daemon",
};

/** "Hetzner · Falkenstein", or the address when neither is set. */
export const serverWhere = (s: Pick<Server, "provider" | "serverLocation" | "serverIp">) =>
  [s.provider, s.serverLocation].filter(Boolean).join(" · ") || s.serverIp;
