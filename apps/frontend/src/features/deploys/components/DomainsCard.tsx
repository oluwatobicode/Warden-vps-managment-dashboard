import { useState } from "react";
import toast from "react-hot-toast";
import { AddDomainSchema, type DeployInfo, type Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { apiMessage } from "../../../utils/apiMessage";
import { timeAgo } from "../../../utils/formatDate";
import { useAddDomain, useRemoveDomain, useVerifyDomain } from "../hooks/useDeploys";

/**
 * Custom domains: HTTPS with a free Let's Encrypt certificate. The domain's
 * DNS must point at the server; Warden checks it, and the domain is used from
 * the next deploy (Traefik reads a container's names when it starts).
 */
export function DomainsCard({ service, info, canEdit }: { service: Service; info: DeployInfo; canEdit: boolean }) {
  const add = useAddDomain(service.id);
  const verify = useVerifyDomain(service.id);
  const remove = useRemoveDomain(service.id);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string>();

  const onAdd = () => {
    const r = AddDomainSchema.shape.domain.safeParse(domain);
    if (!r.success) return setError(r.error.issues[0]?.message);
    setError(undefined);
    add.mutate(r.data, {
      onSuccess: (d) => {
        setDomain("");
        toast.success(d.verifiedAt ? `${d.domain} points here. Deploy again to start using it` : `${d.domain} added. Point its DNS here, then deploy again`);
      },
      onError: (e) => setError(apiMessage(e)),
    });
  };
  const onVerify = (id: string) =>
    verify.mutate(id, {
      onSuccess: (d) =>
        d.verifiedAt
          ? toast.success(`${d.domain} points at this server`)
          : toast.error(d.dnsIps.length ? `${d.domain} points at ${d.dnsIps.join(", ")}, not ${info.serverIp}` : `${d.domain} has no A record yet`),
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <Card title="Domains" sub={`Your own domain, with HTTPS. Without one, the app answers at its automatic address over http.`}>
      {info.serverIp && (
        <p className="mt-3.5 rounded-xl border border-cb bg-field px-3.5 py-2.5 text-[12px] text-muted-deep">
          At your domain provider, add an <strong className="text-body">A record</strong> for the domain pointing to <span className="font-mono text-body">{info.serverIp}</span>. Then press Check, and deploy
          again so the new domain is used.
        </p>
      )}
      {!!info.domains?.length && (
        <ul className="mt-3.5 mb-0 flex list-none flex-col divide-y divide-divider p-0">
          {info.domains.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-body hover:underline">
                {d.domain}
              </a>
              <span className={`text-[11px] ${d.verifiedAt ? "text-good" : "text-warn"}`}>{d.verifiedAt ? `DNS ok · ${timeAgo(d.verifiedAt)}` : "DNS doesn't point here yet"}</span>
              <Button variant="ghost" onClick={() => onVerify(d.id)} loading={verify.isPending && verify.variables === d.id} className="px-2 py-1 text-[11px]">
                Check
              </Button>
              {canEdit && (
                <Button variant="ghost" onClick={() => remove.mutate(d.id, { onSuccess: () => toast.success(`${d.domain} removed`), onError: (e) => toast.error(apiMessage(e)) })} className="px-2 py-1 text-[11px]">
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-3.5 flex items-end gap-2">
          <div className="flex-1">
            <Input label="Add a domain" mono placeholder="api.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())} error={error} />
          </div>
          <Button onClick={onAdd} loading={add.isPending} disabled={!domain.trim()} className={error ? "mb-[26px]" : ""}>
            Add
          </Button>
        </div>
      )}
    </Card>
  );
}
