import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { authKeys } from "../features/auth/hooks/useMe";
import { apiStatus } from "../utils/apiMessage";

/**
 * A 401 that survived the axios refresh means the session is over (expired,
 * revoked, or the member was removed). If someone WAS logged in: drop every
 * cached response and mark them logged out; the route guard then sends them
 * to /login. Toast once, not once per failed query.
 */
function endSessionOn401(error: unknown) {
  if (apiStatus(error) !== 401) return;
  if (!queryClient.getQueryData(authKeys.me)) return;
  queryClient.clear();
  queryClient.setQueryData(authKeys.me, null);
  toast.error("Your session has expired. Please sign in again", { id: "session-expired" });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: endSessionOn401 }),
  mutationCache: new MutationCache({ onError: endSessionOn401 }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx won't fix itself on retry. Network blips and 5xx get one more go.
      retry: (count, error) => {
        const status = apiStatus(error);
        return (status === undefined || status >= 500) && count < 1;
      },
    },
  },
});
