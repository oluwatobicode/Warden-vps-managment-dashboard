import { useState } from "react";
import { Link, useParams } from "react-router";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { AuthLayout } from "../components/layout/AuthLayout";
import { AuthNotice } from "../features/auth/components/AuthNotice";
import { InviteForm } from "../features/auth/components/InviteForm";

export default function InvitePage() {
  const { token = "" } = useParams();
  const [declined, setDeclined] = useState(false);

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
      {declined ? (
        <AuthNotice icon={Tick02Icon} tone="good" title="Invite declined">
          <p className="mt-2.5 text-[13px] text-muted-warm">
            The admin who invited you can see it was declined. Nothing else to
            do.
          </p>
        </AuthNotice>
      ) : (
        <InviteForm token={token} onDeclined={() => setDeclined(true)} />
      )}
    </AuthLayout>
  );
}
