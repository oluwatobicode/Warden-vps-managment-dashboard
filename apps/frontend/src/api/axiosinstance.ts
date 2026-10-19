import axios, { type AxiosResponse } from "axios";
import type { ApiEnvelope } from "../types/api";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    /** Set once a request has been retried after a refresh, so it never loops. */
    _retried?: boolean;
  }
}

// The API's address, from apps/frontend/.env (VITE_API_URL). Not
// import.meta.env.BASE_URL: that's Vite's own public path ("/").
export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Sends the httpOnly auth cookies. JS never reads the tokens itself.
  withCredentials: true,
});

/** Strip the envelope: `unwrap(await axiosInstance.get(...))` → the data. */
export function unwrap<T>(res: AxiosResponse<ApiEnvelope<T>>): T {
  return res.data.data;
}

// /auth/* routes (login, refresh, signup, verify, reset…) answer 401 for their
// own reasons: refreshing would be wrong or a loop. The exceptions are the two
// logged-in calls: /auth/me, and /auth/logout (after 15 minutes the access
// token has expired; without a refresh the logout would 401 and the session
// would live on in Redis).
const LOGGED_IN_AUTH = ["/auth/me", "/auth/logout"];
const skipsRefresh = (url: string) => url.startsWith("/auth/") && !LOGGED_IN_AUTH.includes(url);

// One refresh at a time: if five requests 401 together, they all wait on
// the same POST /auth/refresh instead of firing five (the refresh token is
// rotated on every use, so the second refresh would be a "reuse" and kill
// the session).
let refreshing: Promise<unknown> | null = null;

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? "";
    const retryable =
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !skipsRefresh(url);
    if (!retryable) return Promise.reject(error);

    original._retried = true;
    refreshing ??= axiosInstance
      .post("/auth/refresh")
      .finally(() => (refreshing = null));
    try {
      await refreshing;
    } catch {
      // Refresh failed: the session is really over. The original 401 goes up.
      return Promise.reject(error);
    }
    return axiosInstance(original);
  },
);

// Shorthands so every hook reads as "GET this, get back that".
export const api = {
  get: async <T>(url: string, params?: Record<string, string>) =>
    unwrap(await axiosInstance.get<ApiEnvelope<T>>(url, { params })),
  post: async <T>(url: string, body?: unknown) => unwrap(await axiosInstance.post<ApiEnvelope<T>>(url, body)),
  patch: async <T>(url: string, body: unknown) => unwrap(await axiosInstance.patch<ApiEnvelope<T>>(url, body)),
  put: async <T>(url: string, body: unknown) => unwrap(await axiosInstance.put<ApiEnvelope<T>>(url, body)),
  /** DELETE answers 204 with no body. */
  delete: async (url: string) => {
    await axiosInstance.delete(url);
  },
};
