import type { ReactNode } from "react";
import { useMe } from "../features/auth/hooks/useMe";
import { AuthContext, type AuthValue } from "./authValue";

export function AuthProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const value: AuthValue = {
    user: me.data ?? null,
    isLoading: me.isPending,
    isError: me.isError,
    retry: () => void me.refetch(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
