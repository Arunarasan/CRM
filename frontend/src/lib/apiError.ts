/** Pulls a human-readable message out of an axios error, falling back to a supplied default. */
export function apiError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const resp = (e as { response?: { data?: { message?: string; error?: string } } })?.response;
  return resp?.data?.message || resp?.data?.error || (e as { message?: string })?.message || fallback;
}
