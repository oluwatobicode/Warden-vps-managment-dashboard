import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { ForgotPasswordSchema, type ForgotPasswordInput } from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { applyApiIssues, apiMessage } from "../../../utils/apiMessage";
import { useForgotPassword } from "../hooks/usePasswordReset";

export function RequestCodeForm({
  defaultEmail,
  onSent,
}: {
  defaultEmail: string;
  onSent: (email: string) => void;
}) {
  const request = useForgotPassword();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: defaultEmail },
  });

  const onSubmit = (input: ForgotPasswordInput) =>
    request.mutate(input, {
      onSuccess: () => onSent(input.email),
      onError: (e) => applyApiIssues(e, setError) || toast.error(apiMessage(e)),
    });

  return (
    <>
      <h1 className="m-0 text-[26px] font-bold tracking-[-0.6px] text-strong">
        Reset your password
      </h1>
      <p className="mt-[9px] text-[13px] text-pretty text-muted-warm">
        We'll email you a 6-digit code. It works once and expires in 10 minutes.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-6 flex flex-col gap-[18px]"
      >
        <Input
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="you@company.dev"
          error={errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" size="lg" loading={request.isPending}>
          Send code
        </Button>
      </form>
    </>
  );
}
