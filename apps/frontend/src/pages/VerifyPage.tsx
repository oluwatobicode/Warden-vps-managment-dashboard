import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CancelCircleIcon } from "@hugeicons/core-free-icons";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Spinner } from "../components/ui/Spinner";
import { AuthNotice } from "../features/auth/components/AuthNotice";
import { useVerifyMagicLink } from "../features/auth/hooks/useVerifyMagicLink";
import { authKeys } from "../features/auth/hooks/useMe";

export default function VerifyPage() {
  const token = useSearchParams()[0].get("token");
  const verify = useVerifyMagicLink(token);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (!verify.data || handled.current) return;
    handled.current = true;
    if (verify.data.status === "authenticated") {
      void queryClient
        .refetchQueries({ queryKey: authKeys.me })
        .then(() => navigate("/", { replace: true }));
    } else {
      // In the URL, not router state: state is lost on reload.
      navigate(`/onboarding?provider=${verify.data.provider}`, { replace: true });
    }
  }, [verify.data, navigate, queryClient]);

  if (!token || verify.isError) {
    return (
      <AuthLayout>
        <AuthNotice
          icon={CancelCircleIcon}
          tone="crit"
          title="This link doesn't work"
        >
          <p className="mt-2.5 text-[13px] text-pretty text-muted-warm">
            Sign-in links expire after 15 minutes and work once. Ask for a new
            one.
          </p>
          <div className="mt-5 flex gap-4 text-xs font-semibold">
            <Link to="/signup" className="text-link">
              Send a new link
            </Link>
            <Link to="/login" className="text-muted-warm hover:text-strong">
              Sign in with a password
            </Link>
          </div>
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="flex items-center justify-center gap-3 py-6 text-[13px] text-muted-warm">
        <Spinner /> Signing you in…
      </div>
    </AuthLayout>
  );
}
