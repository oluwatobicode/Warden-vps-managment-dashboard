import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { apiMessage } from "../../../utils/apiMessage";
import { useSessions, useSignOutOthers } from "../hooks/useAccount";

export function SessionsCard() {
  const sessions = useSessions();
  const signOut = useSignOutOthers();
  const [confirming, setConfirming] = useState(false);
  const others = sessions.data?.others ?? 0;

  const onConfirm = () =>
    signOut.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.success("Signed out of other devices");
      },
      onError: (e) => toast.error(apiMessage(e)),
    });

  return (
    <Card
      title="Sessions"
      sub={
        sessions.isPending
          ? "Checking…"
          : others
            ? `You're also signed in on ${others} other browser${others === 1 ? "" : "s"} or device${others === 1 ? "" : "s"}.`
            : "You're only signed in here."
      }
      action={
        <Button variant="secondary" onClick={() => setConfirming(true)} disabled={!others} className="px-3.5 py-2 text-xs">
          Sign out of other devices
        </Button>
      }
    >
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={onConfirm}
        loading={signOut.isPending}
        title="Sign out of other devices?"
        body="Every other browser and device signed in as you is signed out now. This one stays signed in."
        cta="Sign out others"
      />
    </Card>
  );
}
