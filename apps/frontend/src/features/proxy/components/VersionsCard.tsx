import toast from "react-hot-toast";
import type { ProxyVersion } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { useRevertProxy } from "../hooks/useProxyConfig";

const SOURCE = { FORM: "form", RAW: "YAML", REVERT: "revert" } as const;

/** Every saved version, newest first. Revert re-applies one (checked like any change). */
export function VersionsCard({ serverId, versions, currentId, canEdit }: { serverId: string; versions: ProxyVersion[]; currentId: string | null; canEdit: boolean }) {
  const revert = useRevertProxy(serverId);
  const onRevert = (v: ProxyVersion) =>
    revert.mutate(
      { versionId: v.id, baseVersionId: currentId },
      {
        onSuccess: (r) => (r.applied ? toast.success("That version is live again") : toast.error(`Traefik refused it, so nothing changed: ${r.problems[0]?.message ?? ""}`)),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );
  return (
    <Card title="Versions" sub="Every change is kept. A change Traefik refused was rolled back by itself and is listed with its reason.">
      {!versions.length ? (
        <p className="mt-3.5 mb-0 text-[12px] text-faint">No changes yet.</p>
      ) : (
        <ul className="mt-3.5 mb-0 flex list-none flex-col divide-y divide-divider p-0">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="text-[12.5px] text-body" title={formatDate(v.createdAt)}>
                  {timeAgo(v.createdAt)}
                </span>
                <span className="text-[11px] text-faint">
                  {" "}
                  · {SOURCE[v.source]}
                  {v.createdByName ? ` · ${v.createdByName}` : ""}
                  {v.note ? ` · ${v.note}` : ""}
                </span>
                {v.problems.map((p, i) => (
                  <span key={i} className="mt-0.5 block font-mono text-[11px] break-words text-crit">
                    {p.message}
                  </span>
                ))}
              </span>
              {v.id === currentId ? (
                <span className="rounded-full bg-good-s px-2 py-0.5 text-[10.5px] font-semibold text-good">live</span>
              ) : v.status === "ROLLED_BACK" ? (
                <span className="rounded-full bg-crit-s px-2 py-0.5 text-[10.5px] font-semibold text-crit">refused, rolled back</span>
              ) : (
                canEdit && (
                  <Button variant="ghost" onClick={() => onRevert(v)} loading={revert.isPending && revert.variables?.versionId === v.id} className="px-2 py-1 text-[11px]">
                    Revert to this
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
