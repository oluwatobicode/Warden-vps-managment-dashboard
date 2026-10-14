import { useLocation } from "react-router";
import { AuthLayout } from "../components/layout/AuthLayout";
import { StepDots } from "../features/auth/components/StepDots";
import {
  OnboardingForm,
  type OnboardingProvider,
} from "../features/auth/components/OnboardingForm";

export default function OnboardingPage() {
  const state = useLocation().state as { provider?: OnboardingProvider } | null;
  const provider = state?.provider ?? "OAUTH";
  return (
    <AuthLayout>
      <StepDots step={3} />
      <OnboardingForm provider={provider} />
    </AuthLayout>
  );
}
