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
  forgetSession(queryClient);
  toast.error("Your session has expired. Please sign in again", { id: "session-expired" });
}

/**
 * Mark the user logged out and drop every other cached response.
 * Order matters: set "me" to null on the EXISTING query first, so the auth
 * context (which is subscribed to it) sees the change. clear() would delete
 * that query and leave the context holding the old, logged-in user.
 */
export function forgetSession(client: QueryClient) {
  client.setQueryData(authKeys.me, null);
  client.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
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
