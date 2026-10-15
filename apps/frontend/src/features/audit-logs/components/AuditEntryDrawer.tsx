import type { ReactNode } from "react";
import type { AuditLog } from "shared-types";
import { Drawer } from "../../../components/ui/Drawer";
import { CopyButton } from "../../../components/ui/CopyButton";
import { ROLE_LABEL } from "../../../utils/roles";
import { timeAgo } from "../../../utils/formatDate";
import { describeAudit } from "./describeAudit";

function Row({ label, children, copy }: { label: string; children: ReactNode; copy?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-divider py-[11px]">
      <span className="shrink-0 text-xs text-muted-deep">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 text-right font-mono text-xs break-all text-body">{children}</span>
        {copy && <CopyButton value={copy} label={`Copy ${label.toLowerCase()}`} done={`${label} copied`} />}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="m-0 mb-1 text-[10.5px] font-semibold tracking-[.08em] text-sand uppercase">{title}</h4>
      {children}
    </section>
  );
}

/** Everything one audit entry recorded. Metadata never holds secret values. */
export function AuditEntryDrawer({ entry, onClose }: { entry: AuditLog | null; onClose: () => void }) {
  if (!entry) return null;
  const { text } = describeAudit(entry);
  const meta = Object.entries(entry.metadata ?? {});
  const byToken = !!(entry.apiTokenId || entry.apiTokenName);
  const when = new Date(entry.createdAt);

  return (
    <Drawer open onClose={onClose} kicker="AUDIT LOG ENTRY" title={text}>
      <Section title="What">
        <Row label="Action">{entry.action}</Row>
        <Row label="Affected">{entry.entityType}</Row>
        <Row label="Affected ID" copy={entry.entityId}>{entry.entityId}</Row>
      </Section>

      <Section title="When">
        <Row label="Time">{when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}</Row>
        <Row label="Ago">{timeAgo(entry.createdAt)}</Row>
        <Row label="UTC">{when.toISOString()}</Row>
      </Section>

      <Section title="Who">
        {byToken ? (
          <>
            <Row label="Kind">API token</Row>
            <Row label="Token">{entry.apiTokenName ?? "(deleted)"}</Row>
            {entry.apiTokenId && <Row label="Token ID" copy={entry.apiTokenId}>{entry.apiTokenId}</Row>}
            {entry.performedByRole && <Row label="Acted as">{ROLE_LABEL[entry.performedByRole]}</Row>}
          </>
        ) : (
          <>
            <Row label="Kind">Person</Row>
            <Row label="Email">{entry.performedByEmail ?? "(unknown)"}</Row>
            {entry.performedByRole && <Row label="Role at the time">{ROLE_LABEL[entry.performedByRole]}</Row>}
            <Row label="User ID" copy={entry.performedById ?? undefined}>{entry.performedById ?? "deleted since"}</Row>
          </>
        )}
      </Section>

      <Section title="Metadata">
        {meta.length === 0 ? (
          <p className="m-0 border-t border-divider py-[11px] text-xs text-sand">Nothing extra was recorded for this action.</p>
        ) : (
          meta.map(([k, v]) => <Row key={k} label={k}>{typeof v === "string" ? v : JSON.stringify(v)}</Row>)
        )}
      </Section>

      <Section title="Raw">
        <div className="relative mt-1.5">
          <pre className="m-0 max-h-[260px] overflow-auto rounded-[10px] border border-cb bg-[#0a0a0a] p-3.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-deep">
            {JSON.stringify(entry, null, 2)}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton value={JSON.stringify(entry, null, 2)} label="Copy entry as JSON" done="Entry copied" />
          </div>
        </div>
        <p className="mt-2 text-[10.5px] text-faint">Entry ID {entry.id}</p>
      </Section>
    </Drawer>
  );
}
