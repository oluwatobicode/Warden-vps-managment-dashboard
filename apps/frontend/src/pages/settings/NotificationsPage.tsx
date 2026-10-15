import { useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InformationCircleIcon,
  PlusSignCircleIcon,
} from "@hugeicons/core-free-icons";
import type { NotificationChannel } from "shared-types";
import { Button } from "../../components/ui/Button";
import { Chip, SectionHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  useDeleteChannel,
  useNotificationChannels,
  useRevealChannel,
  useTestChannel,
} from "../../features/notifications/hooks/useNotificationChannels";
import { ChannelModal } from "../../features/notifications/components/ChannelModal";
import {
  EVENT_CHIP,
  TEST_FAILURE,
  TYPE_LABEL,
} from "../../features/notifications/components/eventInfo";
import { apiMessage } from "../../utils/apiMessage";
import { atLeast } from "../../utils/roles";

export default function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = atLeast(user?.role, "ADMIN");
  const channels = useNotificationChannels();
  const test = useTestChannel();
  const reveal = useRevealChannel();
  const del = useDeleteChannel();
  const [modal, setModal] = useState<{ editing?: NotificationChannel } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<NotificationChannel | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const onTest = (c: NotificationChannel) =>
    test.mutate(c.id, {
      onSuccess: (r) =>
        r.ok
          ? toast.success(`Test sent to ${c.name}`)
          : toast.error(
              TEST_FAILURE[r.reason ?? ""] ?? "The test didn't go through",
            ),
      onError: (e) => toast.error(apiMessage(e)),
    });

  const onReveal = (c: NotificationChannel) =>
    revealed[c.id]
      ? setRevealed((cur) => {
          const next = { ...cur };
          delete next[c.id];
          return next;
        })
      : reveal.mutate(c.id, {
          onSuccess: (r) =>
            setRevealed((cur) => ({ ...cur, [c.id]: r.webhookUrl })),
          onError: (e) => toast.error(apiMessage(e)),
        });

  const onDelete = () =>
    deleting &&
    del.mutate(deleting.id, {
      onSuccess: () => (
        toast.success(`${deleting.name} deleted`),
        setDeleting(null)
      ),
      onError: (e) => (toast.error(apiMessage(e)), setDeleting(null)),
    });

  return (
    <>
      <SectionHeader
        title="Notifications"
        sub="Pick which events reach which channel. Slack, Discord or email."
        action={
          isAdmin && (
            <Button onClick={() => setModal({})}>
              <HugeiconsIcon
                icon={PlusSignCircleIcon}
                size={14}
                strokeWidth={1.5}
              />
              Add channel
            </Button>
          )
        }
      />

      <div className="mt-[18px] flex items-start gap-3 rounded-2xl bg-ink px-5 py-3.5">
        <HugeiconsIcon
          icon={InformationCircleIcon}
          size={15}
          strokeWidth={1.5}
          className="mt-px shrink-0 text-link"
        />
        <p className="m-0 text-xs text-muted-warm">
          Real alerts start once deploys and server monitoring are running.
          Until then, <span className="text-strong">Send test</span> is how you
          check a channel works.
        </p>
      </div>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 pb-2">
        {channels.isPending &&
          [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        {channels.isError && (
          <p className="text-sm text-crit">{apiMessage(channels.error)}</p>
        )}
        {channels.data?.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              title="No channels yet"
              action={
                isAdmin && (
                  <Button onClick={() => setModal({})}>Add channel</Button>
                )
              }
            >
              Add a Discord or Slack webhook, or a list of email addresses.
            </EmptyState>
          </div>
        )}
        {channels.data?.map((c) => (
          <article
            key={c.id}
            className="flex flex-col gap-3 rounded-2xl border border-cb bg-card px-[18px] py-[17px]"
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold text-strong">
                  {c.name}
                </span>
                <Chip>{TYPE_LABEL[c.type]}</Chip>
              </span>
              <span
                className={`flex items-center gap-1.5 rounded-full px-[9px] py-1 text-[10.5px] font-semibold ${c.enabled ? "bg-good-s text-good" : "bg-raised text-sand"}`}
              >
                <span
                  className={`size-1.5 rounded-full ${c.enabled ? "bg-good" : "bg-sand"}`}
                />
                {c.enabled ? "Enabled" : "Disabled"}
              </span>
            </span>
            <span className="truncate font-mono text-[11px] text-sand">
              {c.type === "EMAIL"
                ? c.emailRecipients.join(", ")
                : (revealed[c.id] ?? c.webhookUrlMasked)}
            </span>
            <span className="flex flex-wrap gap-1">
              {c.events.map((e) => (
                <span
                  key={e}
                  className="rounded-md border border-cb px-1.5 py-0.5 text-[10px] text-muted-deep"
                >
                  {EVENT_CHIP[e]}
                </span>
              ))}
            </span>
            {isAdmin && (
              <span className="mt-auto flex flex-wrap items-center gap-3 border-t border-divider pt-3">
                <button
                  type="button"
                  onClick={() => onTest(c)}
                  disabled={test.isPending && test.variables === c.id}
                  className="cursor-pointer rounded-[10px] border border-fieldb bg-surface px-[13px] py-[7px] text-[11.5px] font-semibold text-strong hover:bg-hover disabled:opacity-50"
                >
                  {test.isPending && test.variables === c.id
                    ? "Sending…"
                    : "Send test"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ editing: c })}
                  className="cursor-pointer text-[11.5px] font-semibold text-link"
                >
                  Edit
                </button>
                {c.type !== "EMAIL" && (
                  <button
                    type="button"
                    onClick={() => onReveal(c)}
                    className="cursor-pointer text-[11.5px] font-semibold text-link"
                  >
                    {revealed[c.id] ? "Hide URL" : "Show URL"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleting(c)}
                  className="ml-auto cursor-pointer text-[11.5px] font-semibold text-crit"
                >
                  Delete
                </button>
              </span>
            )}
          </article>
        ))}
      </div>

      {modal && (
        <ChannelModal editing={modal.editing} onClose={() => setModal(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete ${deleting?.name}?`}
        body="Nothing will be posted to it any more. Its webhook stays valid on the provider's side; delete it there too if it's not needed."
        cta="Delete channel"
      />
    </>
  );
}
