import toast from "react-hot-toast";
import type { Deployment, Service } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { apiMessage } from "../../../utils/apiMessage";
import { timeAgo } from "../../../utils/formatDate";
import { useRollback } from "../hooks/useDeploys";

/**
 * Going back to an older version. It's a new deploy that reuses that
 * version's image (or rebuilds its commit). What it can't undo is said here,
 * every time: the database and the variables stay as they are now.
 */
export function RollbackDialog({ service, target, onClose, onStarted }: { service: Service; target: Deployment; onClose: () => void; onStarted: (d: Deployment) => void }) {
  const rollback = useRollback(service.id);
  const onConfirm = () =>
    rollback.mutate(target.id, {
      onSuccess: (d) => {
        toast.success(`Rolling back to #${target.number}`);
        onClose();
        onStarted(d);
      },
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Go back to #${target.number}?`}
      description={`${target.commitMessage ?? target.commitSha?.slice(0, 7) ?? "This version"}, deployed ${timeAgo(target.finishedAt ?? target.createdAt)}. The current version keeps running until #${target.number} is healthy.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="px-0 text-xs">
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={rollback.isPending}>
            Roll back to #{target.number}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5 rounded-xl border border-warn/40 bg-warn-s px-3.5 py-3 text-[12px] text-warn">
        <p className="m-0">
          <strong>The database is not rolled back.</strong> If a later deploy changed it (a migration), the old code may not fit the new data. To go back with the data too, restore a database
          backup from before that deploy, on the database's page.
        </p>
        <p className="m-0">
          <strong>Variables are not rolled back.</strong> The old version starts with today's variables.
        </p>
      </div>
    </Modal>
  );
}
