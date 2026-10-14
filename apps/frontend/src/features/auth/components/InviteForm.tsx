import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { AcceptInviteSchema, type AcceptInviteInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useAcceptInvite, useDeclineInvite } from "../hooks/useInvitation";

export function InviteForm({ token, onDeclined }: { token: string; onDeclined: () => void }) {
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const decline = useDeclineInvite();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AcceptInviteInput>({ resolver: zodResolver(AcceptInviteSchema), defaultValues: { token } });

  const onSubmit = (input: AcceptInviteInput) =>
    accept.mutate(input, {
      onSuccess: (user) => {
        toast.success(`Welcome to ${user.organization.name}`);
        navigate("/", { replace: true });
      },
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  const onDecline = () =>
    decline.mutate({ token }, { onSuccess: onDeclined, onError: (e) => toast.error(apiMessage(e)) });

  return (
    <>
      <h1 className="m-0 text-[26px] font-bold tracking-[-0.6px] text-strong">Join your team</h1>
      <p className="mt-[9px] text-[13px] text-pretty text-muted-warm">
        You've been invited to a Warden workspace. Create your account to accept. You'll join with the role the admin picked.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
          <Input label="Last name" autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
        </div>
        <Input label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
        <Button type="submit" size="lg" loading={accept.isPending} disabled={decline.isPending} className="mt-2">
          Accept invite
        </Button>
      </form>
      <Button variant="ghost" onClick={onDecline} loading={decline.isPending} disabled={accept.isPending} className="mt-3 self-center text-xs">
        Decline invite
      </Button>
    </>
  );
}
