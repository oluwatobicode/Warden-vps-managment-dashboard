import { useState } from "react";
import { Link } from "react-router";
import { AuthLayout } from "../components/layout/AuthLayout";
import { RequestCodeForm } from "../features/auth/components/RequestCodeForm";
import { ResetPasswordForm } from "../features/auth/components/ResetPasswordForm";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  return (
    <AuthLayout footer={<>Remembered it? <Link to="/login" className="text-link">Sign in</Link></>}>
      {sentTo ? (
        <ResetPasswordForm email={sentTo} onChangeEmail={() => setSentTo(null)} />
      ) : (
        <RequestCodeForm
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
