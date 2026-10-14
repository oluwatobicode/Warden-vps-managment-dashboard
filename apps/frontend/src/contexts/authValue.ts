import { createContext } from "react";
import type { SessionUser } from "shared-types";

// Lives apart from AuthProvider so that file only exports a component
// (React fast refresh needs that).

export interface AuthValue {
  /** null = logged out. Role and org come from here, never from the JWT. */
  user: SessionUser | null;
  isLoading: boolean;
  /** /auth/me itself failed (API down), not "logged out". */
  isError: boolean;
  retry: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);
