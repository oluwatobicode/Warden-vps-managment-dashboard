import { useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignCircleIcon } from "@hugeicons/core-free-icons";
import type { Member, Role } from "shared-types";
import { Button } from "../../components/ui/Button";
import { SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { useInvitations, useMembers, useRemoveMember, useResendInvitation, useRevokeInvitation, useUpdateMemberRole } from "../../features/team/hooks/useTeam";
import { InviteModal } from "../../features/team/components/InviteModal";
import { ROLE_DETAIL, ROLE_DOT, ROLE_ORDER } from "../../features/team/components/roleInfo";
import { apiMessage } from "../../utils/apiMessage";
import { formatDate } from "../../utils/formatDate";
import { ROLE_LABEL, atLeast } from "../../utils/roles";

const STATUS_DOT = { ACTIVE: "bg-good", PENDING: "bg-warn", SUSPENDED: "bg-crit" } as const;
const GRID = "grid min-w-[700px] grid-cols-[minmax(0,1.4fr)_150px_110px_110px_80px] items-center gap-3.5";

export default function TeamPage() {
  const { user } = useAuth();
  const isAdmin = atLeast(user?.role, "ADMIN");
  const members = useMembers();
  const invites = useInvitations(isAdmin);
  const changeRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const onRole = (m: Member, role: Role) =>
    changeRole.mutate(
      { id: m.id, role },
      {
        onSuccess: () => toast.success(`${m.firstName} is now ${ROLE_LABEL[role]}. They'll sign in again`),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  const onRemove = () =>
    removing &&
    remove.mutate(removing.id, {
      onSuccess: () => {
        toast.success(`${removing.firstName} removed`);
        setRemoving(null);
      },
      onError: (e) => {
        toast.error(apiMessage(e));
        setRemoving(null);
      },
    });

  const active = (members.data ?? []).filter((m) => m.status === "ACTIVE");

  return (
    <>
      <SectionHeader
        title="Team & roles"
        sub="Four roles, each able to do everything the one before it can. Roles apply to the whole organization."
        action={
          isAdmin && (
            <Button onClick={() => setInviting(true)}>
              <HugeiconsIcon icon={PlusSignCircleIcon} size={14} strokeWidth={1.5} />
              Invite member
            </Button>
          )
        }
      />

      <div className="mt-[22px] grid grid-cols-4 gap-3">
        {ROLE_ORDER.map((r) => {
          const n = active.filter((m) => m.role === r).length;
          return (
            <div key={r} className="flex flex-col gap-2.5 rounded-2xl border border-cb bg-card px-[18px] py-[17px]">
              <span className="flex items-center justify-between gap-2.5">
                <span className="text-sm font-bold text-strong">{ROLE_LABEL[r]}</span>
                <span className={`size-2 rounded-full ${ROLE_DOT[r]}`} />
              </span>
              <span className="text-[11px] leading-normal text-pretty text-sand">{ROLE_DETAIL[r]}</span>
              <span className="mt-auto border-t border-divider pt-2.5 font-mono text-[11px] text-muted-deep">
                {n} member{n === 1 ? "" : "s"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 overflow-x-auto rounded-2xl border border-cb">
        <div className={`${GRID} border-b border-cb bg-head px-5 py-[11px] text-[10.5px] font-semibold tracking-[.06em] text-label uppercase`}>
          <span>Member</span>
          <span>Role</span>
          <span>Status</span>
          <span>Joined</span>
          <span />
        </div>
        {members.isPending && <Skeleton className="m-4 h-10" />}
        {members.isError && <p className="m-4 text-sm text-crit">{apiMessage(members.error)}</p>}
        {members.data?.map((m) => {
          const self = m.userId === user?.id;
          const editable = isAdmin && !self && m.status === "ACTIVE";
          return (
            <div key={m.id} className={`${GRID} border-b border-divider bg-card px-5 py-3 last:border-b-0`}>
              <span className="flex min-w-0 items-center gap-[11px]">
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#18181b] text-[11px] font-semibold text-muted-warm">
                  {m.firstName[0]}
                  {m.lastName[0]}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[12.5px] text-body">
                    {m.firstName} {m.lastName}
                    {self && <span className="ml-1.5 text-[10.5px] text-sand">(you)</span>}
                  </span>
                  <span className="truncate text-[10.5px] text-sand">{m.email}</span>
                </span>
              </span>
              {editable ? (
                <select
                  aria-label={`Role for ${m.firstName}`}
                  value={m.role}
                  onChange={(e) => onRole(m, e.target.value as Role)}
                  disabled={changeRole.isPending}
                  className="cursor-pointer justify-self-start rounded-[9px] border border-cb bg-field px-[11px] py-[7px] text-[11.5px] text-body outline-none"
                >
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : (
                <span className="text-[11.5px] text-body">{ROLE_LABEL[m.role]}</span>
              )}
              <span className="flex items-center gap-[7px] text-[11px] text-muted-deep">
                <span className={`size-[7px] rounded-full ${STATUS_DOT[m.status]}`} />
                {m.status === "ACTIVE" ? "Active" : m.status === "SUSPENDED" ? "Removed" : "Pending"}
              </span>
              <span className="text-[11.5px] text-sand">{formatDate(m.joinedAt)}</span>
              {editable ? (
                <button type="button" onClick={() => setRemoving(m)} className="cursor-pointer justify-self-start text-[11.5px] font-semibold text-crit">Remove</button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && !!invites.data?.length && (
        <section className="mt-3.5 mb-2 rounded-2xl border border-cb bg-card px-5 py-4">
          <h3 className="m-0 text-[13.5px] font-bold text-strong">Pending invitations</h3>
          {invites.data.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-t border-divider py-[11px] first-of-type:mt-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[12.5px] text-body">{i.email}</span>
                <span className="text-[10.5px] text-sand">{ROLE_LABEL[i.role]} · expires {formatDate(i.expiresAt)}</span>
              </span>
              <span className="flex shrink-0 gap-3.5">
                <button
                  type="button"
                  disabled={resend.isPending}
                  onClick={() => resend.mutate(i.id, { onSuccess: () => toast.success("Invite sent again"), onError: (e) => toast.error(apiMessage(e)) })}
                  className="cursor-pointer text-[11.5px] font-semibold text-link disabled:opacity-50"
                >
                  Resend
                </button>
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(i.id, { onSuccess: () => toast.success("Invite revoked"), onError: (e) => toast.error(apiMessage(e)) })}
                  className="cursor-pointer text-[11.5px] font-semibold text-crit disabled:opacity-50"
                >
                  Revoke
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={onRemove}
        loading={remove.isPending}
        title={`Remove ${removing?.firstName} ${removing?.lastName}?`}
        body="Their access ends now and they're signed out everywhere. Inviting the same email later brings their account back."
        cta="Remove member"
      />
    </>
  );
}
