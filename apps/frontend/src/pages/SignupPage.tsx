import { useState } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../components/layout/AuthLayout";
import { StepDots } from "../features/auth/components/StepDots";
import { SignupEmailStep } from "../features/auth/components/SignupEmailStep";
import { CheckInboxStep } from "../features/auth/components/CheckInboxStep";

export default function SignupPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  return (
    <AuthLayout
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-link">
            Sign in
          </Link>
        </>
      }
    >
      <StepDots step={sentTo ? 2 : 1} />
      {sentTo ? (
        <CheckInboxStep email={sentTo} onChangeEmail={() => setSentTo(null)} />
      ) : (
        <SignupEmailStep
          defaultEmail={email}
          onSent={(e) => {
            setEmail(e);
            setSentTo(e);
          }}
        />
      )}
    </AuthLayout>
  );
}
