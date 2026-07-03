/** Convert unknown errors consistently; eliminates repeated Error-instance narrowing before diagnostic logging. */
export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
