import { useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, PlusSignCircleIcon } from "@hugeicons/core-free-icons";
import type { ApiToken } from "shared-types";
import { Button } from "../../components/ui/Button";
import { SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useApiTokens, useRevokeApiToken } from "../../features/api-tokens/hooks/useApiTokens";
import { CreateTokenModal } from "../../features/api-tokens/components/CreateTokenModal";
import { apiMessage } from "../../utils/apiMessage";
import { formatDate, timeAgo } from "../../utils/formatDate";

const SCOPE = { READ: "Read only", DEPLOY: "Deploy", ADMIN: "Admin" } as const;
const GRID = "grid min-w-[760px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_110px_120px_60px] items-center gap-3.5";

/** ADMIN only (the route is guarded and the API refuses everyone else). */
export default function ApiTokensPage() {
  const tokens = useApiTokens(true);
  const revoke = useRevokeApiToken();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);

  const onRevoke = () =>
    revoking &&
    revoke.mutate(revoking.id, {
      onSuccess: () => (toast.success(`${revoking.apiName} revoked`), setRevoking(null)),
      onError: (e) => (toast.error(apiMessage(e)), setRevoking(null)),
    });

  return (
    <>
      <SectionHeader
        title="API tokens"
        sub="For CI and scripts. A token is shown once, when it's created, and never again."
        action={
          <Button onClick={() => setCreating(true)}>
            <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
            Create token
          </Button>
        }
      />

      <div className="mt-[22px]">
        {tokens.isPending && <Skeleton className="h-32 rounded-2xl" />}
        {tokens.isError && <p className="text-sm text-crit">{apiMessage(tokens.error)}</p>}
        {tokens.data?.length === 0 && (
          <EmptyState title="No tokens yet" action={<Button onClick={() => setCreating(true)}>Create token</Button>}>
            Create one for GitHub Actions or a script. Pick the smallest scope that does the job.
          </EmptyState>
        )}
        {!!tokens.data?.length && (
          <div className="overflow-x-auto rounded-2xl border border-cb">
            <div className={`${GRID} border-b border-cb bg-head px-5 py-[11px] text-[10.5px] font-semibold tracking-[.06em] text-label uppercase`}>
              <span>Name</span>
              <span>Token</span>
              <span>Scope</span>
              <span>Last used</span>
              <span>Expires</span>
              <span />
            </div>
            {tokens.data.map((t) => {
              const expired = !!t.expiresAt && new Date(t.expiresAt) < new Date();
              return (
                <div key={t.id} className={`${GRID} border-b border-divider bg-card px-5 py-3 last:border-b-0`}>
                  <span className="truncate font-mono text-xs text-body">{t.apiName}</span>
                  <span className="font-mono text-xs text-sand">{t.tokenPrefix}••••</span>
                  <span className="text-[11.5px] text-muted-deep">{SCOPE[t.apiTokenScope]}</span>
                  <span className="text-[11.5px] text-sand">{t.lastUsedAt ? timeAgo(t.lastUsedAt) : "never"}</span>
                  <span className={`text-[11.5px] ${expired ? "text-crit" : "text-sand"}`}>{t.expiresAt ? (expired ? "expired" : formatDate(t.expiresAt)) : "never"}</span>
                  <button type="button" onClick={() => setRevoking(t)} className="cursor-pointer justify-self-start text-[11.5px] font-semibold text-crit">Revoke</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3.5 mb-2 flex items-start gap-3 rounded-2xl bg-ink px-5 py-[18px]">
        <HugeiconsIcon icon={InformationCircleIcon} size={15} strokeWidth={1.5} className="mt-0.5 shrink-0 text-link" />
        <span className="flex min-w-0 flex-col gap-2">
          <span className="text-xs text-muted-warm">Send it as a Bearer token. Check one works with:</span>
          <code className="font-mono text-[11.5px] break-all text-muted-deep">curl -H "Authorization: Bearer wdn_…" {import.meta.env.VITE_API_URL}/api-tokens/whoami</code>
        </span>
      </div>

      {creating && <CreateTokenModal onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={onRevoke}
        loading={revoke.isPending}
        title={`Revoke ${revoking?.apiName}?`}
        body="Anything using it stops working immediately. This can't be undone."
        cta="Revoke token"
      />
    </>
  );
}
