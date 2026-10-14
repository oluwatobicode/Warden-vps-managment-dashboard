import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { ResetPasswordSchema, type ResetPasswordInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useForgotPassword, useResetPassword } from "../hooks/usePasswordReset";

export function ResetPasswordForm({
  email,
  onChangeEmail,
}: {
  email: string;
  onChangeEmail: () => void;
}) {
  const navigate = useNavigate();
  const reset = useResetPassword();
  const resend = useForgotPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { email },
  });

  const onSubmit = (input: ResetPasswordInput) =>
    reset.mutate(input, {
      onSuccess: () => {
        toast.success("Password updated. Sign in with your new password");
        navigate("/login", { replace: true });
      },

      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  const onResend = () =>
    resend.mutate(
      { email },
      {
        onSuccess: () =>
          toast.success("If the account exists, a new code is on its way"),
        onError: (e) => toast.error(apiMessage(e)),
      },
    );

  return (
    <>
      <h1 className="m-0 text-[26px] font-bold tracking-[-0.6px] text-strong">
        Enter your code
      </h1>
      <p className="mt-[9px] text-[13px] text-pretty text-muted-warm">
        If <strong className="font-semibold text-strong">{email}</strong> has an
        account with a password, a 6-digit code is on its way.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 flex flex-col gap-3.5"
      >
        <Input
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          mono
          className="tracking-[.3em]"
          error={errors.code?.message}
          {...register("code")}
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <Button
          type="submit"
          size="lg"
          loading={reset.isPending}
          className="mt-2"
        >
          Set new password
        </Button>
      </form>
      <div className="mt-[18px] flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onResend}
          disabled={resend.isPending}
          className="cursor-pointer text-xs font-semibold text-link disabled:opacity-50"
        >
          {resend.isPending ? "Sending…" : "Send a new code"}
        </button>
        <span className="h-3 w-px bg-fieldb" />
        <button
          type="button"
          onClick={onChangeEmail}
          className="cursor-pointer text-xs font-semibold text-muted-warm hover:text-strong"
        >
          Use a different email
        </button>
      </div>
    </>
  );
}
