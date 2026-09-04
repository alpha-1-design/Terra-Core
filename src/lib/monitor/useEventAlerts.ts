import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IssState, Quake } from "./types";
import { isSoundEnabled, playAlertChime, playQuakeTone } from "./sound";

/**
 * Operator alerts: big quakes anywhere + ISS flyovers over watchlisted places.
 *
 * Delivers a Web Notification on the web and a Capacitor local notification
 * inside the Android APK. Every alert is keyed (quake id / place-day) so it
 * fires at most once. Degrades silently when notifications are unavailable.
 */

const QUAKE_ALERT_MAG = 5.5;
const FLYOVER_RADIUS_DEG = 9;
const SEEN_QUAKES = "terra-core.alerts.seenQuakes.v1";
const SEEN_FLYOVERS = "terra-core.alerts.seenFlyovers.v1";
const ENABLED_KEY = "terra-core.alerts.enabled.v1";

function seenSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(key: string, id: string) {
  try {
    const set = seenSet(key);
    set.add(id);
    localStorage.setItem(key, JSON.stringify([...set].slice(-200)));
  } catch {
    /* storage unavailable — alerts still work for this session */
  }
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function notify(title: string, body: string) {
  if (isNative()) {
    void LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Math.floor(Math.random() * 1_000_000),
          smallIcon: "ic_launcher_foreground",
        },
      ],
    }).catch(() => {
      /* plugin not ready — ignore */
    });
    return;
  }
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: `terra-${Date.now()}` });
    } catch {
      /* some browsers throw for untrusted origins */
    }
  }
}

/** One-shot "request permission" — call from a user gesture. */
export async function requestAlertPermission(): Promise<boolean> {
  if (isNative()) return true;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export interface AlertCounts {
  quakeCount: number;
  flyoverCount: number;
}

export function useEventAlerts(opts: {
  quakes: Quake[] | null;
  iss: IssState | null;
  watch: { id: string; name: string; lat: number; lng: number }[];
}) {
  const { quakes, iss, watch } = opts;
  const [enabled, setEnabledState] = useState(
    () => localStorage.getItem(ENABLED_KEY) === "true",
  );
  const [counts, setCounts] = useState<AlertCounts>({
    quakeCount: 0,
    flyoverCount: 0,
  });
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const watchSig = useMemo(
    () =>
      watch
        .map((w) => `${w.id}:${w.lat.toFixed(2)}:${w.lng.toFixed(2)}`)
        .join("|"),
    [watch],
  );
  const quakeSig = useMemo(
    () => (quakes ?? []).map((q) => q.id).join("|"),
    [quakes],
  );
  const issSig = useMemo(
    () => (iss ? `${iss.lat.toFixed(2)},${iss.lng.toFixed(2)}` : ""),
    [iss],
  );

  const enable = async (): Promise<boolean> => {
    const ok = await requestAlertPermission();
    if (ok) {
      setEnabledState(true);
      localStorage.setItem(ENABLED_KEY, "true");
    }
    return ok;
  };

  const disable = () => {
    setEnabledState(false);
    localStorage.setItem(ENABLED_KEY, "false");
  };

  useEffect(() => {
    if (!enabledRef.current) return;
    const run = () => {
      const seenQuakes = seenSet(SEEN_QUAKES);
      const seenFlyovers = seenSet(SEEN_FLYOVERS);
      let quakeHits = 0;
      let flyoverHits = 0;

      for (const q of quakes ?? []) {
        if (q.mag >= QUAKE_ALERT_MAG && !seenQuakes.has(q.id)) {
          markSeen(SEEN_QUAKES, q.id);
          quakeHits += 1;
          notify(`⚠️ EARTHQUAKE M${q.mag.toFixed(1)}`, `${q.place}`);
          if (isSoundEnabled()) playQuakeTone(q.mag);
        }
      }

      if (iss) {
        for (const w of watch) {
          const dLat = Math.abs(iss.lat - w.lat);
          const dLng = Math.abs(iss.lng - w.lng);
          if (dLat > FLYOVER_RADIUS_DEG || dLng > FLYOVER_RADIUS_DEG) continue;
          const key = `${w.id}-${new Date().toISOString().slice(0, 10)}`;
          if (seenFlyovers.has(key)) continue;
          markSeen(SEEN_FLYOVERS, key);
          flyoverHits += 1;
          notify("🛰️ ISS overhead", `Near ${w.name} — look up!`);
          if (isSoundEnabled()) playAlertChime();
        }
      }

      if (quakeHits > 0 || flyoverHits > 0) {
        setCounts((c) => ({
          quakeCount: c.quakeCount + quakeHits,
          flyoverCount: c.flyoverCount + flyoverHits,
        }));
      }
    };
    run();
  }, [enabled, quakeSig, issSig, watchSig, quakes, iss, watch]);

  return {
    enabled,
    counts,
    enable,
    disable,
  };
}
