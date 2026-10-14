import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import {
  EmailOnboardingSchema,
  OAuthOnboardingSchema,
  type OAuthOnboardingInput,
} from "shared-types";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  applyApiIssues,
  apiMessage,
  apiStatus,
} from "../../../utils/apiMessage";
import { useOnboarding } from "../hooks/useOnboarding";
import { StepKicker } from "./StepDots";

export type OnboardingProvider = "EMAIL" | "OAUTH";

type FormValues = OAuthOnboardingInput & { password?: string };

export function OnboardingForm({ provider }: { provider: OnboardingProvider }) {
  const isEmail = provider === "EMAIL";
  const navigate = useNavigate();
  const onboard = useOnboarding();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(
      isEmail ? EmailOnboardingSchema : OAuthOnboardingSchema,
    ) as unknown as Resolver<FormValues>,
  });

  const onSubmit = ({
    firstName,
    lastName,
    organizationName,
    password,
  }: FormValues) =>
    onboard.mutate(
      isEmail
        ? {
            provider: "EMAIL",
            body: {
              firstName,
              lastName,
              organizationName,
              password: password ?? "",
            },
          }
        : {
            provider: "OAUTH",
            body: { firstName, lastName, organizationName },
          },
      {
        onSuccess: (user) => {
          toast.success(`Welcome to ${user.organization.name}`);
          navigate("/", { replace: true });
        },
        onError: (e) => {
          if (applyApiIssues(e, setError)) return;

          toast.error(apiMessage(e), {
            id: apiStatus(e) === 401 ? "signup-expired" : undefined,
          });
        },
      },
    );

  return (
    <div className="mt-[26px] flex flex-col">
      <StepKicker>Step 3 of 3 · Your workspace</StepKicker>
      <span className="mt-3 flex items-center gap-[7px] self-start rounded-full bg-good-s px-[11px] py-[5px] text-[10.5px] font-semibold text-good">
        <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2.8} />
        {isEmail ? "Email verified" : "GitHub connected"}
      </span>
      <h1 className="mt-4 text-[26px] font-bold tracking-[-0.6px] text-strong">
        Name your workspace
      </h1>
      <p className="mt-[9px] text-[13px] text-muted-warm">
        This appears in the console and on every deploy notification.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-[22px] flex flex-col gap-3.5"
      >
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </div>
        <Input
          label="Organization name"
          placeholder="Acme Labs"
          autoComplete="organization"
          error={errors.organizationName?.message}
          {...register("organizationName")}
        />
        {isEmail && (
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            {...register("password")}
          />
        )}
        <Button
          type="submit"
          size="lg"
          loading={onboard.isPending}
          className="mt-2"
        >
          Create workspace
        </Button>
      </form>

      {apiStatus(onboard.error) === 401 && (
        <Link
          to="/signup"
          className="mt-4 self-center text-xs font-semibold text-link"
        >
          Start signup again
        </Link>
      )}
    </div>
  );
}
