import type { ReactNode } from "react";
import { useParams } from "react-router";
import type { PlatformHealth, PlatformOverview } from "shared-types";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { apiMessage } from "../../utils/apiMessage";
import { formatBytes } from "../../utils/formatBytes";
import { formatDate } from "../../utils/formatDate";
import { usePlatformHealth, usePlatformOverview, usePlatformUser } from "../../features/platform/hooks/usePlatform";
import { fmtInt, fmtPct, fmtSeconds } from "../../features/platform/format";
import { DayChart } from "../../features/platform/components/DayChart";
import { Funnel } from "../../features/platform/components/Funnel";
import { HealthTab } from "../../features/platform/components/HealthTab";
import { DeploysList } from "../../features/platform/components/DeploysTable";
import { OrgsTable } from "../../features/platform/components/OrgsTable";
import { UserDetail } from "../../features/platform/components/UserDetail";
import { UsersTable } from "../../features/platform/components/UsersTable";
import { Breakdown, StatTile, TileGrid } from "../../features/platform/components/StatTile";

/*
 * One page per sidebar item. Overview, Growth, Activation, Deploys and
 * Infrastructure all read GET /platform/overview (one cached request, so
 * moving between them is instant); Health reads /platform/health. Deploys
 * also lists every deploy (/platform/deploys); Users and a user's page read
 * /platform/users.
 */

const STATUS_DOT: Record<string, string> = {
  SUCCESS: "bg-good",
  FAILED: "bg-crit",
  GATE_FAILED: "bg-crit",
  ROLLED_BACK: "bg-serious",
  CANCELLED: "bg-faint",
};
const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Succeeded",
  FAILED: "Failed",
  GATE_FAILED: "Health check failed",
  ROLLED_BACK: "Rolled back",
  CANCELLED: "Cancelled",
};

function Loading() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-[104px] rounded-[18px]" />
      ))}
    </div>
  );
}

/** Loads the overview once and hands it to the page. */
function WithOverview({ children }: { children: (data: PlatformOverview) => ReactNode }) {
  const q = usePlatformOverview();
  if (q.isPending) return <Loading />;
  if (q.isError) return <p className="py-16 text-center text-sm text-crit">{apiMessage(q.error)}</p>;
  return <div className="flex flex-col gap-5">{children(q.data)}</div>;
}

export function OverviewPage() {
  return (
    <WithOverview>
      {({ growth: g, deploys: d, infra: i }) => (
        <>
          <TileGrid count={6}>
            <StatTile label="Users" value={fmtInt(g.users.total)} sub={`+${g.users.new7d} in 7 days · +${g.users.new30d} in 30`} />
            <StatTile label="Organizations" value={fmtInt(g.orgs.total)} sub={`+${g.orgs.new7d} in 7 days · +${g.orgs.new30d} in 30`} />
            <StatTile label="Active users" value={`${g.activeUsers.d1} / ${g.activeUsers.d7} / ${g.activeUsers.d30}`} sub="day / week / month" />
            <StatTile label="Deploys (30 days)" value={fmtInt(d.last30d)} sub={`${d.last7d} in 7 days · ${fmtInt(d.total)} ever`} />
            <StatTile label="Deploy success" value={fmtPct(d.successRate)} sub="last 30 days, cancelled left out" tone={d.successRate !== null && d.successRate < 0.8 ? "warn" : undefined} />
            <StatTile label="Platform bucket" value={formatBytes(i.backupBytes.platform)} sub={`orgs' own: ${formatBytes(i.backupBytes.org)}`} />
          </TileGrid>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Signups per day" sub="Last 30 days, UTC">
              <DayChart data={g.signupsPerDay} unit="signups" />
            </Card>
            <Card title="Deploys per day" sub="Last 30 days, UTC">
              <DayChart data={d.perDay} unit="deploys" />
            </Card>
          </div>
        </>
      )}
    </WithOverview>
  );
}

export function GrowthPage() {
  return (
    <WithOverview>
      {({ growth: g }) => (
        <>
          <TileGrid count={6}>
            <StatTile label="Users" value={fmtInt(g.users.total)} sub={`+${g.users.new7d} in 7 days · +${g.users.new30d} in 30`} />
            <StatTile label="Organizations" value={fmtInt(g.orgs.total)} sub={`+${g.orgs.new7d} in 7 days · +${g.orgs.new30d} in 30`} />
            <StatTile label="Active today" value={fmtInt(g.activeUsers.d1)} sub="signed-in users" />
            <StatTile label="Active this week" value={fmtInt(g.activeUsers.d7)} sub="last 7 days" />
            <StatTile label="Active this month" value={fmtInt(g.activeUsers.d30)} sub="last 30 days" />
            <StatTile label="Dormant orgs" value={fmtInt(g.dormantOrgs)} sub="no activity or deploy in 30 days" tone={g.dormantOrgs > 0 ? "warn" : undefined} />
          </TileGrid>
          <Card title="Signups per day" sub="Last 30 days, UTC">
            <DayChart data={g.signupsPerDay} unit="signups" />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="How people sign up">
              <Breakdown
                rows={[
                  { label: "Email", value: fmtInt(g.signupsByProvider.EMAIL) },
                  { label: "GitHub", value: fmtInt(g.signupsByProvider.GITHUB) },
                  { label: "Google", value: fmtInt(g.signupsByProvider.GOOGLE) },
                ]}
              />
            </Card>
            <Card title="Teams and churn">
              <Breakdown
                rows={[
                  { label: "Solo orgs / teams (2+ members)", value: `${g.teamSize.solo} / ${g.teamSize.team}` },
                  { label: "Invitations pending / accepted", value: `${g.invitations.pending} / ${g.invitations.accepted}` },
                  { label: "Deleted orgs (30 days / ever)", value: `${g.deletedOrgs.last30d} / ${g.deletedOrgs.total}` },
                  { label: "Deleted after a successful deploy", value: fmtInt(g.deletedOrgs.everDeployedOk) },
                ]}
              />
              <p className="mt-3 text-[11px] text-sand">
                {g.activityTrackedSince
                  ? `Activity tracked since ${formatDate(g.activityTrackedSince)}: until 30 days have passed, older orgs look dormant.`
                  : "No activity recorded yet."}
              </p>
            </Card>
          </div>
        </>
      )}
    </WithOverview>
  );
}

export function ActivationPage() {
  return (
    <WithOverview>
      {({ funnel, growth: g }) => {
        const succeeded = funnel.steps.find((s) => s.step === "successDeploy")?.orgs ?? 0;
        return (
          <>
            <TileGrid count={3}>
              <StatTile label="Orgs" value={fmtInt(g.orgs.total)} sub="the top of the funnel" />
              <StatTile label="Reached a successful deploy" value={fmtInt(succeeded)} sub={g.orgs.total ? `${fmtPct(succeeded / g.orgs.total)} of orgs` : "no orgs yet"} />
              <StatTile label="Time to first deploy" value={fmtSeconds(funnel.medianSecondsToFirstSuccess)} sub="median, from org created" />
            </TileGrid>
            <Card title="Activation funnel" sub="Orgs that reached each step. Red: how many dropped since the step above.">
              <Funnel steps={funnel.steps} />
            </Card>
          </>
        );
      }}
    </WithOverview>
  );
}

export function DeploysPage() {
  return (
    <WithOverview>
      {({ deploys: d }) => (
        <>
          <TileGrid count={4}>
            <StatTile label="Deploys (30 days)" value={fmtInt(d.last30d)} sub={`${d.last7d} in 7 days · ${fmtInt(d.total)} ever`} />
            <StatTile label="Success rate" value={fmtPct(d.successRate)} sub="last 30 days, cancelled left out" tone={d.successRate !== null && d.successRate < 0.8 ? "warn" : undefined} />
            <StatTile label="Duration p50" value={fmtSeconds(d.durationSeconds.p50)} sub={`p95: ${fmtSeconds(d.durationSeconds.p95)}`} />
            <StatTile label="Rollbacks" value={fmtInt(d.rollbacks)} sub="last 30 days" />
          </TileGrid>
          <Card title="Deploys per day" sub="Last 30 days, UTC">
            <DayChart data={d.perDay} unit="deploys" />
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="How they ended" sub="Last 30 days">
              <Breakdown rows={Object.keys(STATUS_LABEL).map((s) => ({ label: STATUS_LABEL[s], value: fmtInt(d.byStatus[s as keyof typeof d.byStatus]), dot: STATUS_DOT[s] }))} />
            </Card>
            <Card title="How they ran" sub="Last 30 days">
              <Breakdown
                rows={[
                  { label: "Dockerfile / Railpack", value: `${d.byBuildMethod.DOCKERFILE} / ${d.byBuildMethod.RAILPACK}` },
                  { label: "Manual / on push", value: `${d.byType.MANUAL} / ${d.byType.AUTOMATED}` },
                  { label: "Started by an API token", value: fmtInt(d.byApiToken) },
                ]}
              />
            </Card>
          </div>
          <DeploysList />
        </>
      )}
    </WithOverview>
  );
}

export function InfrastructurePage() {
  return (
    <WithOverview>
      {({ infra: i }) => (
        <>
          <TileGrid count={4}>
            <StatTile label="Servers connected" value={fmtInt(i.serversByStatus.CONNECTED)} sub={`${i.serversByStatus.IDLE} idle · ${i.serversByStatus.OFFLINE} offline`} />
            <StatTile label="Offline over 24 h" value={fmtInt(i.serversOfflineOver24h)} sub="probably abandoned" tone={i.serversOfflineOver24h ? "warn" : undefined} />
            <StatTile label="Platform bucket" value={formatBytes(i.backupBytes.platform)} sub={`orgs' own: ${formatBytes(i.backupBytes.org)}`} />
            <StatTile label="Backups failed" value={fmtInt(i.backups30d.failed)} sub={`${i.backups30d.success} ok, last 30 days`} tone={i.backups30d.failed ? "crit" : undefined} />
          </TileGrid>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Servers and services">
              <Breakdown
                rows={[
                  { label: "Proxy set up / not", value: `${i.proxy.installed} / ${i.proxy.notInstalled}` },
                  { label: "Apps / workers / databases", value: `${i.servicesByType.APPLICATION} / ${i.servicesByType.WORKER} / ${i.servicesByType.DATABASE}` },
                  { label: "Services healthy / failed", value: `${i.servicesByStatus.HEALTHY} / ${i.servicesByStatus.FAILED}` },
                  { label: "Custom domains", value: fmtInt(i.customDomains) },
                  { label: "GitHub App installs", value: fmtInt(i.githubInstallations) },
                  { label: "Orgs with their own bucket", value: fmtInt(i.orgsWithOwnStorage) },
                  { label: "API tokens (read / deploy)", value: `${i.apiTokens.byScope.READ} / ${i.apiTokens.byScope.DEPLOY + i.apiTokens.byScope.ADMIN}` },
                ]}
              />
            </Card>
            <div className="flex flex-col gap-5">
              <Card title="Servers by provider" sub="As people typed it, lower-cased">
                <Breakdown rows={i.serversByProvider.map((p) => ({ label: p.provider, value: fmtInt(p.count) }))} />
                {!i.serversByProvider.length && <p className="mt-3 text-xs text-sand">No servers yet.</p>}
              </Card>
              <Card title="Databases" sub="By engine and version">
                <Breakdown rows={i.databases.map((db) => ({ label: `${db.engine.toLowerCase()} ${db.version}`, value: fmtInt(db.count) }))} />
                {!i.databases.length && <p className="mt-3 text-xs text-sand">No databases yet.</p>}
              </Card>
            </div>
          </div>
        </>
      )}
    </WithOverview>
  );
}

export function OrgsPage() {
  return <OrgsTable />;
}

export function UsersPage() {
  return <UsersTable />;
}

export function UserPage() {
  const { id = "" } = useParams();
  const q = usePlatformUser(id);
  if (q.isPending) return <Loading />;
  if (q.isError) return <p className="py-16 text-center text-sm text-crit">{apiMessage(q.error)}</p>;
  return <UserDetail user={q.data} />;
}

export function HealthPage() {
  const q = usePlatformHealth();
  if (q.isPending) return <Loading />;
  if (q.isError) return <p className="py-16 text-center text-sm text-crit">{apiMessage(q.error)}</p>;
  return <HealthTab data={q.data as PlatformHealth} />;
}
