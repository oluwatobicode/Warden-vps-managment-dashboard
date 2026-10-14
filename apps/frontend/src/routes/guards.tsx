import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import type { Role } from "shared-types";
import { useAuth } from "../features/auth/hooks/useAuth";
import { atLeast } from "../utils/roles";
import { FullPageSpinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";

/** Logged-in pages. Not logged in → /login, remembering where they were going. */
export function RequireAuth() {
  const { user, isLoading, isError, retry } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (isError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted-warm">Can't reach Warden right now.</p>
          <Button variant="secondary" onClick={retry}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Login, signup… Already logged in → straight to the console. */
export function RedirectIfAuthed() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Hides a whole page from roles below `min`. The API still refuses them anyway. */
export function RequireRole({ min, children }: { min: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!atLeast(user?.role, min)) {
    return <p className="py-16 text-center text-sm text-muted-warm">You don't have access to this page.</p>;
  }
  return children;
}
