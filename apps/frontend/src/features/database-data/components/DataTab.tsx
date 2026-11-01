import type { DatabaseEngine } from "shared-types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useAuth } from "../../auth/hooks/useAuth";
import { atLeast } from "../../../utils/roles";
import { RedisBrowser } from "./RedisBrowser";
import { SqlBrowser } from "./SqlBrowser";

/**
 * A database's Data tab: browse, query and edit. Developer and up (decided
 * 2026-11-01), the same people who can delete the database's data anyway.
 */
export function DataTab({ serviceId, engine, running }: { serviceId: string; engine: DatabaseEngine; running: boolean }) {
  const { user } = useAuth();
  if (!atLeast(user?.role, "DEVELOPER")) {
    return (
      <div className="mt-[18px]">
        <EmptyState title="Data is for Developers and up">A database's rows are your users' data. Ask an Admin if you need access.</EmptyState>
      </div>
    );
  }
  if (!running) {
    return (
      <div className="mt-[18px]">
        <EmptyState title="The database isn't running">Start it (Overview → Restart), then its data shows here.</EmptyState>
      </div>
    );
  }
  return engine === "REDIS" ? <RedisBrowser serviceId={serviceId} /> : <SqlBrowser serviceId={serviceId} />;
}
