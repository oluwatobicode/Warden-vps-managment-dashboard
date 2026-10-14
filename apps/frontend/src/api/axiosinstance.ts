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

// These answer 401 for their own reasons; refreshing would be wrong or a loop.
const NO_REFRESH = ["/auth/refresh", "/auth/login", "/auth/logout"];

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
      !NO_REFRESH.some((p) => url.startsWith(p));
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
