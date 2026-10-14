import toast from "react-hot-toast";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { apiMessage } from "../../../utils/apiMessage";
import { useMagicLink } from "../hooks/useMagicLink";
import { AuthNotice } from "./AuthNotice";

export function CheckInboxStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const resend = useMagicLink();

  const onResend = () =>
    resend.mutate(
      { email },
      {
        onSuccess: () => toast.success("New link sent. The previous one no longer works"),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  return (
    <div className="mt-[26px]">
      <AuthNotice icon={Mail01Icon} title="Check your inbox">
        <p className="mt-2.5 text-[13px] text-pretty text-muted-warm">
          We sent a sign-in link to <strong className="font-semibold text-strong">{email}</strong>. It expires in 15 minutes and works once.
          Open it on this device to continue.
        </p>
        <div className="mt-[22px] flex items-center gap-4">
          <button
            type="button"
            onClick={onResend}
            disabled={resend.isPending}
            className="cursor-pointer text-xs font-semibold text-link disabled:opacity-50"
          >
            {resend.isPending ? "Sending…" : "Resend link"}
          </button>
          <span className="h-3 w-px bg-fieldb" />
          <button type="button" onClick={onChangeEmail} className="cursor-pointer text-xs font-semibold text-muted-warm hover:text-strong">
            Use a different email
          </button>
        </div>
      </AuthNotice>
    </div>
  );
}
