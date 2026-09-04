import { Capacitor } from "@capacitor/core";
import { useCallback, useEffect, useState } from "react";
import {
  fetchLatestRelease,
  getCurrentAppVersion,
  isVersionNewer,
  type OtaUpdate,
} from "./ota";

const CACHE_KEY = "terra-core.ota.lastCheck.v1";
const DISMISS_KEY = "terra-core.ota.dismissed.v1";
const CACHE_TTL_MS = 6 * 60 * 60_000; // GitHub API: 60 req/hr unauthenticated

interface CacheEntry {
  at: number;
  current: string | null;
  tag: string | null;
  htmlUrl: string | null;
  available: boolean;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

/**
 * Native-only update watcher: on mount (and every 6h) compares the installed
 * app version against the latest GitHub release tag. A non-null `update` is
 * returned only when a genuinely newer release exists and hasn't been
 * dismissed on this device.
 */
export function useOtaUpdate() {
  const isNative = Capacitor.isNativePlatform();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [update, setUpdate] = useState<OtaUpdate | null>(null);
  const [checked, setChecked] = useState(false);

  const apply = useCallback((cache: CacheEntry) => {
    setCurrentVersion(cache.current);
    const dismissed = localStorage.getItem(DISMISS_KEY);
    const available = cache.available && cache.tag && cache.htmlUrl;
    setUpdate(
      available && dismissed !== cache.tag
        ? {
            tag: cache.tag!,
            htmlUrl: cache.htmlUrl!,
            publishedAt: "",
            notes: "",
          }
        : null,
    );
  }, []);

  const check = useCallback(
    async (force = false) => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        if (!force) {
          const cached = readCache();
          if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
            apply(cached);
            return;
          }
        }
        const [version, release] = await Promise.all([
          getCurrentAppVersion(),
          fetchLatestRelease(),
        ]);
        setCurrentVersion(version);
        const entry: CacheEntry = {
          at: Date.now(),
          current: version,
          tag: release?.tag ?? null,
          htmlUrl: release?.htmlUrl ?? null,
          available: !!release && !!version && isVersionNewer(release.tag, version),
        };
        writeCache(entry);
        apply(entry);
      } catch {
        setUpdate(null);
      } finally {
        setChecked(true);
      }
    },
    [apply],
  );

  const dismiss = useCallback((tag: string) => {
    localStorage.setItem(DISMISS_KEY, tag);
    setUpdate(null);
  }, []);

  useEffect(() => {
    if (!isNative) return;
    const first = window.setTimeout(() => void check(), 0);
    const timer = window.setInterval(() => void check(), CACHE_TTL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [isNative, check]);

  return { isNative, update, currentVersion, checked, check, dismiss };
}
