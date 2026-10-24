import type { ProxyLiveRoute } from "shared-types";
import { Card } from "../../../components/ui/Card";

const OWNER: Record<string, string> = { docker: "Warden app", file: "warden.yml" };

/** Every route Traefik serves on this server right now, read live. Warden's own are rebuilt on each deploy, so they're shown, not edited. */
export function RoutesCard({ routes }: { routes: ProxyLiveRoute[] | null }) {
  return (
    <Card title="Routes right now" sub="Read live from this server's Traefik. Routes of apps Warden deploys come from the deploys themselves; yours come from warden.yml.">
      {routes === null ? (
        <p className="mt-3.5 mb-0 text-[12px] text-warn">Couldn't reach the server to read them.</p>
      ) : !routes.length ? (
        <p className="mt-3.5 mb-0 text-[12px] text-faint">No routes yet.</p>
      ) : (
        <ul className="mt-3.5 mb-0 flex list-none flex-col divide-y divide-divider p-0">
          {routes.map((r) => (
            <li key={r.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-[120px] shrink-0 text-[11px] text-sand">{r.serviceName ? `App: ${r.serviceName}` : (OWNER[r.provider] ?? r.provider)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-body" title={r.rule}>
                {r.rule}
              </span>
              <span className="font-mono text-[10.5px] text-faint">{r.entryPoints.join(", ")}</span>
              {r.tls && <span className="rounded-full bg-good-s px-2 py-px text-[10px] font-semibold text-good">HTTPS</span>}
              {r.status !== "enabled" && (
                <span className="w-full font-mono text-[11px] break-words text-crit" title={r.error ?? undefined}>
                  {r.status}: {r.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
