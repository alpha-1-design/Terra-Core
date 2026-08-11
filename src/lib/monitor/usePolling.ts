import { useCallback, useEffect, useRef, useState } from "react";

interface PollingOptions {
  enabled?: boolean;
  intervalMs: number;
  onError?: (error: unknown) => void;
}

export class RateLimitError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Poll a fetcher on an interval and surface { data, error, loading, updatedAt, refresh }.
 * Handles unmount safely and swallows transient errors so the UI never crashes.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { enabled = true, intervalMs, onError }: PollingOptions,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fetcherRef = useRef(fetcher);

  // Keep the latest fetcher without resetting the polling cadence.
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown stream error";
      setError(msg);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
          setUpdatedAt(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Unknown stream error";
          setError(msg);
          onError?.(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs, onError]);

  return { data, error, loading, updatedAt, refresh };
}
