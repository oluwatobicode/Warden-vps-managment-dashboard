import { SectionHeader } from "../../components/ui/Card";
import { ActivityList } from "../../features/audit-logs/components/ActivityList";

const ORG = { kind: "org" } as const;

/** ADMIN only (the route is guarded; the API refuses everyone else too). */
export default function AuditLogPage() {
  return (
    <>
      <SectionHeader
        title="Audit log"
        sub="Who did what in this organization, newest first. Click an entry for its details. Secret values are never recorded, only which secret was revealed."
      />
      <div className="mt-[22px]">
        <ActivityList source={ORG} emptyTitle="Nothing recorded yet" emptyText="Team changes, tokens, servers, keys and secret reveals show up here." />
      </div>
    </>
  );
}
