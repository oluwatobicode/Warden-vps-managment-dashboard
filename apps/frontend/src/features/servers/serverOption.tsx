import type { Server } from "shared-types";
import type { SelectOption } from "../../components/ui/Select";

const DOT: Record<Server["status"], string> = { CONNECTED: "bg-good", IDLE: "bg-sand", OFFLINE: "bg-crit" };
const WORD: Record<Server["status"], string> = { CONNECTED: "connected", IDLE: "idle", OFFLINE: "offline" };

/** A server as a dropdown choice: name, IP + status underneath, a status dot in front. */
export function serverOption(s: Pick<Server, "id" | "serverName" | "serverIp" | "status">): SelectOption {
  return {
    value: s.id,
    label: s.serverName,
    hint: `${s.serverIp} · ${WORD[s.status]}`,
    icon: <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[s.status]}`} />,
  };
}
