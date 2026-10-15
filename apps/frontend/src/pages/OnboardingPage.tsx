import { useSearchParams } from "react-router";
import { AuthLayout } from "../components/layout/AuthLayout";
import { StepDots } from "../features/auth/components/StepDots";
import {
  OnboardingForm,
  type OnboardingProvider,
} from "../features/auth/components/OnboardingForm";

/**
 * Step 3 of sign-up. Which form (with or without a password) comes from
 * ?provider= in the URL, so a reload keeps it: EMAIL from the magic link
 * (VerifyPage), GITHUB from the API's OAuth redirect.
 */
export default function OnboardingPage() {
  const [params] = useSearchParams();
  const provider: OnboardingProvider = params.get("provider") === "EMAIL" ? "EMAIL" : "OAUTH";
  return (
    <AuthLayout>
      <StepDots step={3} />
      <OnboardingForm provider={provider} />
    </AuthLayout>
  );
}
