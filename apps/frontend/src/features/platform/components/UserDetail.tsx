import type { ReactNode } from "react";
import { Link } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { PLATFORM_USER_RECENT_DEPLOYS, type PlatformUserDetail } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { CopyButton } from "../../../components/ui/CopyButton";
import { apiMessage } from "../../../utils/apiMessage";
import { formatDate, timeAgo } from "../../../utils/formatDate";
import { useRevealEmail } from "../hooks/usePlatform";
import { AUTH_LABEL, fmtInt, fmtPct } from "../format";
import { DeployTable } from "./DeploysTable";
import { StatTile, TileGrid } from "./StatTile";

/** One user: who they are, how their deploys went, their newest deploys. The email stays hidden until "Show email" (logged). */
export function UserDetail({ user: u }: { user: PlatformUserDetail }) {
  const d = u.deploys;
  return (
    <div className="flex flex-col gap-5">
      <Link to="/platform/users" className="flex w-fit items-center gap-1.5 text-[11.5px] text-muted-warm hover:text-white">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={13} strokeWidth={1.5} />
        All users
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="m-0 truncate font-display text-[22px] font-extrabold text-strong">{u.name || "No name"}</h2>
            <p className="m-0 text-xs text-muted-deep">{u.org ? u.org.name : "No organization"}</p>
          </div>
          <EmailReveal userId={u.id} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-divider pt-4 text-xs sm:grid-cols-3">
          <Fact label="Signed up with">{AUTH_LABEL[u.authProcess]}</Fact>
          <Fact label="Joined">{formatDate(u.createdAt)}</Fact>
          <Fact label="Last active">{u.lastActiveAt ? timeAgo(u.lastActiveAt) : "never"}</Fact>
        </dl>
      </Card>

      <TileGrid count={4}>
        <StatTile label="Deploys" value={fmtInt(d.total)} sub="started by them, ever" />
        <StatTile label="Succeeded" value={fmtInt(d.succeeded)} sub="went live" />
        <StatTile label="Failed" value={fmtInt(d.failed)} sub="failed or health check failed" tone={d.failed ? "crit" : undefined} />
        <StatTile label="Success rate" value={fmtPct(d.successRate)} sub="cancelled left out" tone={d.successRate !== null && d.successRate < 0.8 ? "warn" : undefined} />
      </TileGrid>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="m-0 text-[14.5px] font-bold text-strong">Recent deploys</h3>
          <p className="mt-[7px] mb-0 text-[11.5px] text-sand">Their newest {PLATFORM_USER_RECENT_DEPLOYS}.</p>
        </div>
        <DeployTable rows={u.recentDeploys} showTriggeredBy={false} empty="They haven't started a deploy." />
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10.5px] font-semibold tracking-[.08em] text-sand uppercase">{label}</dt>
      <dd className="m-0 text-body">{children}</dd>
    </div>
  );
}

/** Hidden until asked for; each click is one access-log row on the api. The email lives in the mutation only. */
function EmailReveal({ userId }: { userId: string }) {
  const reveal = useRevealEmail(userId);
  if (reveal.data) {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-cb bg-raised px-3 py-2">
        <span className="font-mono text-xs text-body">{reveal.data.email}</span>
        <CopyButton value={reveal.data.email} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        loading={reveal.isPending}
        onClick={() => reveal.mutate(undefined, { onError: (e) => toast.error(apiMessage(e)) })}
        className="px-3.5 py-2 text-xs"
      >
        <HugeiconsIcon icon={ViewIcon} size={14} strokeWidth={1.5} />
        Show email
      </Button>
      <span className="text-[10.5px] text-sand">Every reveal is logged.</span>
    </div>
  );
}
