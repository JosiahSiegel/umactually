/** Promise-based timer shared by async provider code; eliminates duplicated sleep helpers. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
