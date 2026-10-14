import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { LoginSchema, type LoginInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useLogin } from "../hooks/useLogin";
import { GithubButton } from "./GithubButton";
import { OrDivider } from "./OrDivider";

export function LoginForm() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = (input: LoginInput) =>
    login.mutate(input, {
      onSuccess: () => {
        toast.dismiss();
        navigate(from, { replace: true });
      },

      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <>
      <h1 className="m-0 text-[26px] font-bold tracking-[-0.6px] text-strong">
        Welcome back
      </h1>
      <p className="mt-[9px] text-[13px] text-muted-warm">
        Sign in to your deploy control plane.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 flex flex-col gap-3.5"
      >
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.dev"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Link
          to="/forgot-password"
          className="self-end text-xs text-link hover:text-[#8bb8f8]"
        >
          Forgot password?
        </Link>
        <Button
          type="submit"
          size="lg"
          loading={login.isPending}
          className="mt-2"
        >
          Sign in
        </Button>
      </form>

      <OrDivider />

      <Link
        to="/signup"
        className="mt-[22px] flex items-center justify-center gap-2.5 rounded-xl border border-fieldb bg-card p-3.5 text-[13px] font-semibold text-strong hover:bg-hover"
      >
        <HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.7} />
        Email me a sign-in link
      </Link>
      <GithubButton />
    </>
  );
}
