import { isAxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiErrorBody } from "../types/api";

function body(error: unknown): ApiErrorBody | undefined {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data : undefined;
}

/** HTTP status of a failed request, or undefined (network error, not axios). */
export function apiStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** A message safe to show in a toast. The API's messages are written for users. */
export function apiMessage(error: unknown, fallback = "Something went wrong. Please try again"): string {
  if (isAxiosError(error) && !error.response) return "Can't reach Warden. Check your connection";
  return body(error)?.message ?? fallback;
}

/**
 * Put a 400's field errors under the matching form fields. Returns true if
 * any landed, so the caller can skip the toast. Field names match because the
 * form and the API validate with the same shared-types schema.
 */
export function applyApiIssues<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean {
  const issues = body(error)?.issues;
  if (!issues) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(issues)) {
    if (field === "value" || !messages?.length) continue; // whole-body errors stay a toast
    setError(field as Path<T>, { type: "server", message: messages[0] });
    applied = true;
  }
  return applied;
}
