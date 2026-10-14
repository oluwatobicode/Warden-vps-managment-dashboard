import { useState } from "react";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  SquareLock02Icon,
  TextIcon,
} from "@hugeicons/core-free-icons";
import type { Variable } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { apiMessage } from "../../../utils/apiMessage";
import { timeAgo } from "../../../utils/formatDate";
import {
  useDeleteVariable,
  useRevealVariable,
  useVariables,
  type VariableOwner,
} from "../hooks/useVariables";
import { VariableModal } from "./VariableModal";

const MASK = "••••••••••••••••••••";

export function VariablesPanel({
  owner,
  canEdit,
  summary,
}: {
  owner: VariableOwner;
  canEdit: boolean;
  summary: string;
}) {
  const vars = useVariables(owner);
  const reveal = useRevealVariable(owner);
  const del = useDeleteVariable(owner);

  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [modal, setModal] = useState<{ editing?: Variable } | null>(null);
  const [deleting, setDeleting] = useState<Variable | null>(null);

  const toggleReveal = (v: Variable) => {
    if (revealed[v.id] !== undefined) {
      setRevealed((cur) => {
        const next = { ...cur };
        delete next[v.id];
        return next;
      });
      return;
    }
    reveal.mutate(v.id, {
      onSuccess: (r) => setRevealed((cur) => ({ ...cur, [v.id]: r.value })),
      onError: (e) => toast.error(apiMessage(e)),
    });
  };

  const onDelete = () =>
    deleting &&
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.key} deleted`);
        setDeleting(null);
      },
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="m-0 text-[12.5px] text-muted-warm">
          {vars.data
            ? `${vars.data.length} variable${vars.data.length === 1 ? "" : "s"} · `
            : ""}
          {summary}
        </p>
        {canEdit && (
          <Button
            onClick={() => setModal({})}
            className="px-[15px] py-2.5 text-xs"
          >
            Add variable
          </Button>
        )}
      </div>

      {vars.isPending && (
        <div className="mt-3.5 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      )}
      {vars.isError && (
        <p className="mt-4 text-sm text-crit">{apiMessage(vars.error)}</p>
      )}
      {vars.data?.length === 0 && (
        <div className="mt-3.5">
          <EmptyState title="No variables yet">
            {canEdit
              ? "Add DATABASE_URL, API keys, feature flags… They're encrypted at rest and injected at deploy time."
              : "Nothing set here yet."}
          </EmptyState>
        </div>
      )}

      {!!vars.data?.length && (
        <div className="mt-3.5 overflow-x-auto rounded-2xl border border-cb">
          <div className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_110px_150px] items-center gap-3.5 border-b border-cb bg-head px-[18px] py-[11px] text-[10.5px] font-semibold tracking-[.06em] text-label uppercase">
            <span>Key</span>
            <span>Value</span>
            <span>Updated</span>
            <span />
          </div>
          {vars.data.map((v) => {
            const shown = revealed[v.id];
            const masked = v.isSecret && shown === undefined;
            return (
              <div
                key={v.id}
                className="grid min-w-[640px] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_110px_150px] items-center gap-3.5 border-b border-divider bg-card px-[18px] py-[11px] last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-[9px]">
                  <HugeiconsIcon
                    icon={v.isSecret ? SquareLock02Icon : TextIcon}
                    size={13}
                    strokeWidth={1.5}
                    className={
                      v.isSecret
                        ? "shrink-0 text-[#eab308]"
                        : "shrink-0 text-sand"
                    }
                  />
                  <span className="truncate font-mono text-xs text-body">
                    {v.key}
                  </span>
                </span>
                <span
                  className={`truncate font-mono text-xs ${masked ? "text-[#6b6960]" : "text-body"}`}
                >
                  {masked
                    ? MASK
                    : (shown ?? v.value) || (
                        <em className="text-sand not-italic">(empty)</em>
                      )}
                </span>
                <span className="text-[11.5px] text-sand">
                  {timeAgo(v.updatedAt)}
                </span>
                <span className="flex items-center justify-end gap-3">
                  {v.isSecret && canEdit && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(v)}
                      disabled={reveal.isPending && reveal.variables === v.id}
                      className="cursor-pointer text-[11.5px] font-semibold text-link disabled:opacity-50"
                    >
                      {shown === undefined ? "Reveal" : "Hide"}
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => setModal({ editing: v })}
                        className="cursor-pointer text-[11.5px] font-semibold text-link"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(v)}
                        aria-label={`Delete ${v.key}`}
                        className="grid size-7 cursor-pointer place-items-center rounded-lg text-sand hover:bg-crit-s hover:text-crit"
                      >
                        <HugeiconsIcon
                          icon={Delete02Icon}
                          size={14}
                          strokeWidth={1.5}
                        />
                      </button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <VariableModal
          owner={owner}
          editing={modal.editing}
          onClose={() => setModal(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        loading={del.isPending}
        title={`Delete ${deleting?.key}?`}
        body="Services stop receiving it on their next deploy. This can't be undone."
        cta="Delete variable"
      />
    </div>
  );
}
