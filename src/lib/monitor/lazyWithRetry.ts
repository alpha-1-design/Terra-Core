import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy so a failed dynamic import doesn't permanently crash or
 * hang the app. Two real-world cases cause this:
 *
 *   1. A new deploy went out after the user's tab already loaded — the
 *      running app still references the OLD chunk hash, which no longer
 *      resolves. Reloading once picks up the new index.html with correct
 *      hashes and fixes it immediately.
 *   2. A slow/flaky mobile connection just drops the request for a large
 *      chunk (globe.gl/three is ~530KB gzipped) — reloading gives it a
 *      clean second attempt.
 *
 * A sessionStorage flag caps this at one automatic reload per chunk per
 * tab session, so a genuinely offline/broken case fails through to the
 * nearest error boundary instead of reload-looping forever.
 */
// mirrors React.lazy's own signature (ComponentType<any>), required for
// correct prop-type inference on the wrapped component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  key: string,
) {
  return lazy(async () => {
    const storageKey = `terra-chunk-retry:${key}`;
    try {
      const mod = await factory();
      sessionStorage.removeItem(storageKey);
      return mod;
    } catch (err) {
      let alreadyRetried = false;
      try {
        alreadyRetried = sessionStorage.getItem(storageKey) === "1";
      } catch {
        /* storage unavailable — fall through to throwing below */
      }
      if (!alreadyRetried) {
        try {
          sessionStorage.setItem(storageKey, "1");
        } catch {
          /* ignore */
        }
        window.location.reload();
        // Reload is about to replace the page — never resolve/reject so
        // React doesn't render an error state during the brief gap.
        return new Promise<{ default: T }>(() => {});
      }
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      throw err;
    }
  });
}
