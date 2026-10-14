import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { MagicLinkRequestSchema, type MagicLinkRequest } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useMagicLink } from "../hooks/useMagicLink";
import { GithubButton } from "./GithubButton";
import { OrDivider } from "./OrDivider";
import { StepKicker } from "./StepDots";

export function SignupEmailStep({ defaultEmail, onSent }: { defaultEmail: string; onSent: (email: string) => void }) {
  const send = useMagicLink();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MagicLinkRequest>({
    resolver: zodResolver(MagicLinkRequestSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = (input: MagicLinkRequest) =>
    send.mutate(input, {
      onSuccess: () => onSent(input.email),
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <div className="mt-[26px] flex flex-col">
      <StepKicker>Step 1 of 3 · Your email</StepKicker>
      <h1 className="mt-3 text-[26px] font-bold tracking-[-0.6px] text-strong">Create your instance</h1>
      <p className="mt-[9px] text-[13px] text-pretty text-muted-warm">
        No password yet. We email you a secure link that signs you in and starts the setup.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 flex flex-col gap-[18px]">
        <Input label="Work email" type="email" autoComplete="email" placeholder="you@company.dev" error={errors.email?.message} {...register("email")} />
        <Button type="submit" size="lg" loading={send.isPending}>
          Email me a secure link
        </Button>
      </form>

      <OrDivider />
      <div className="mt-3">
        <GithubButton />
      </div>
    </div>
  );
}
