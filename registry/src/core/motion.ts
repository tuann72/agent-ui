/** Agent honors prefers-reduced-motion: exit animations are skipped entirely. */
export function motionDisabled(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
