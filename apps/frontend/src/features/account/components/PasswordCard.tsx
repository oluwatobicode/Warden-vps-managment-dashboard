import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  ChangePasswordSchema,
  SetPasswordSchema,
  type ChangePasswordInput,
  type SessionUser,
  type SetPasswordInput,
} from "shared-types";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useChangePassword, useRequestPasswordCode, useSetPassword } from "../hooks/useAccount";

/** Change it with the current one; or, for GitHub sign-ups without one, add it with an emailed code. */
export function PasswordCard({ user }: { user: SessionUser }) {
  return user.hasPassword ? <ChangePassword /> : <AddPassword email={user.email} />;
}

function ChangePassword() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(ChangePasswordSchema) });

  const onSubmit = (input: ChangePasswordInput) =>
    change.mutate(input, {
      onSuccess: () => {
        reset();
        toast.success("Password changed. Other devices were signed out");
      },
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <Card title="Password" sub="Changing it signs you out everywhere else. This browser stays signed in.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
        <Input label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} />
        <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} />
        <div className="flex justify-end">
          <Button type="submit" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AddPassword({ email }: { email: string }) {
  const [codeSent, setCodeSent] = useState(false);
  const requestCode = useRequestPasswordCode();
  const setPassword = useSetPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SetPasswordInput>({ resolver: zodResolver(SetPasswordSchema) });

  const sendCode = () =>
    requestCode.mutate(undefined, {
      onSuccess: () => {
        setCodeSent(true);
        toast.success(`Code sent to ${email}`);
      },
      onError: (e) => toast.error(apiMessage(e)),
    });

  const onSubmit = (input: SetPasswordInput) =>
    setPassword.mutate(input, {
      onSuccess: () => toast.success("Password added. You can sign in with it too"),
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <Card title="Password" sub="You signed up with GitHub, so you don't have a password yet. Add one to also sign in with your email.">
      {!codeSent ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="m-0 max-w-[420px] text-[12px] text-muted-warm">
            To prove it's really you, we'll email a 6-digit code to <span className="text-strong">{email}</span> first.
          </p>
          <Button onClick={sendCode} loading={requestCode.isPending}>
            Email me a code
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 flex flex-col gap-4">
          <Input label="6-digit code" inputMode="numeric" autoComplete="one-time-code" mono error={errors.code?.message} {...register("code")} />
          <Input label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={sendCode} loading={requestCode.isPending} className="px-0 text-xs">
              Send a new code
            </Button>
            <Button type="submit" loading={setPassword.isPending}>
              Add password
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
