import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/**
 * Over-the-air native updates.
 *
 * The app content streams live from Vercel, so the only time an installed APK
 * needs replacing is a *native* change — new Capacitor plugin, permission,
 * icon, or a version bump. Those are shipped as GitHub Releases (the
 * build-apk workflow drafts one on every `v*.*.*` tag with both APKs
 * attached). This module compares the installed native version against the
 * latest GitHub release and hands the user a download link when newer.
 */

export const GITHUB_REPO = "alpha-1-design/terra-core";

export interface OtaUpdate {
  tag: string;
  htmlUrl: string;
  publishedAt: string;
  notes: string;
}

/** Installed native version (versionName) — null on plain web. */
export async function getCurrentAppVersion(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await App.getInfo();
    return info.version || null;
  } catch {
    return null;
  }
}

export async function fetchLatestRelease(): Promise<OtaUpdate | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: { accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    tag_name?: string;
    html_url?: string;
    published_at?: string;
    body?: string;
  };
  if (!data.tag_name) return null;
  return {
    tag: data.tag_name,
    htmlUrl: data.html_url ?? `https://github.com/${GITHUB_REPO}/releases/latest`,
    publishedAt: data.published_at ?? "",
    notes: data.body ?? "",
  };
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((p) => parseInt(p, 10))
    .filter((n) => !Number.isNaN(n));
}

/** True when `latest` tag is newer than the installed `current` version. */
export function isVersionNewer(latestTag: string, currentVersion: string): boolean {
  const a = parseVersion(latestTag);
  const b = parseVersion(currentVersion);
  if (a.length === 0 || b.length === 0) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** Open the GitHub release page (system browser tab) where the APK lives. */
export async function openReleasePage(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url });
      return;
    } catch {
      /* fall through to window.open */
    }
  }
  window.open(url, "_blank", "noopener");
}
