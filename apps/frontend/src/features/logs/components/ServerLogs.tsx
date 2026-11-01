import type { SourceState } from "shared-types";
import { CopyButton } from "../../../components/ui/CopyButton";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuth } from "../../auth/hooks/useAuth";
import { atLeast } from "../../../utils/roles";
import { useServerLogSources } from "../hooks/useLogs";
import { SERVER_SOURCES } from "../lines";
import { LogViewer } from "./LogViewer";

const DOT: Record<SourceState, string> = {
  ok: "bg-good",
  missing: "bg-faint",
  "no-journal": "bg-faint",
  "no-permission": "bg-serious",
  unknown: "bg-faint",
};
const STATE_TEXT: Record<SourceState, string> = {
  ok: "Reading",
  missing: "Not running",
  "no-journal": "No journal",
  "no-permission": "No access",
  unknown: "Not checked yet",
};

/** A server's Logs tab: which sources Warden can read, then the lines. Developer and up, like app logs. */
export function ServerLogs({ serverId }: { serverId: string }) {
  const { user } = useAuth();
  const allowed = atLeast(user?.role, "DEVELOPER");
  const sources = useServerLogSources(serverId, allowed);
  if (!allowed) {
    return (
      <div className="mt-[18px]">
        <EmptyState title="Logs are for Developers and up">Server logs can contain things not everyone should see. Ask an Admin if you need access.</EmptyState>
      </div>
    );
  }

  const states = new Map((sources.data?.sources ?? []).map((s) => [s.source, s.state]));
  const denied = states.get("DOCKER") === "no-permission";
  const fix = `sudo usermod -aG systemd-journal ${sources.data?.sshUser ?? "<ssh user>"}`;
  const notes = [
    states.get("TRAEFIK") === "missing" && "Traefik isn't running on this server, so there's nothing to read. Set it up under Proxy.",
    states.get("DOCKER") === "no-journal" && "This server has no systemd journal (it may itself run in a container), so Docker and system logs can't be read.",
    states.get("DOCKER") === "unknown" && "Warden hasn't reached this server since it started; sources are checked as soon as it does.",
  ].filter((n): n is string => !!n);

  return (
    <div className="flex flex-col">
      <div className="mt-[18px] flex flex-wrap gap-2">
        {SERVER_SOURCES.map((s) => {
          const state = states.get(s.id) ?? "unknown";
          return (
            <span key={s.id} className="flex items-center gap-2 rounded-lg border border-cb bg-raised px-3 py-1.5 text-[11.5px]">
              <span className={`size-[7px] rounded-full ${DOT[state]}`} />
              <span className="text-strong">{s.name}</span>
              <span className="text-faint">{STATE_TEXT[state]}</span>
            </span>
          );
        })}
      </div>

      {denied && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-serious/40 bg-serious/5 px-4 py-3 text-[12px] text-body">
          <span>
            The SSH user can't read the system journal, so Docker and system logs are missing. Run this on the server; Warden reconnects by itself within a minute:
          </span>
          <span className="flex items-center gap-3">
            <code className="rounded-md bg-field px-2 py-1 font-mono text-[11.5px] text-strong">{fix}</code>
            <CopyButton value={fix} text="Copy" done="Command copied" />
          </span>
        </div>
      )}
      {notes.map((n) => (
        <p key={n} className="mt-2 text-[11.5px] text-faint">
          {n}
        </p>
      ))}

      <LogViewer key={serverId} scope={{ serverId }} services={SERVER_SOURCES.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
