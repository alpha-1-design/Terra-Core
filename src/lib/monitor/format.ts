export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });

export function timeAgo(tsMs: number): string {
  const diff = Math.max(0, Date.now() - tsMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function utcClock(d: Date): string {
  return d.toISOString().slice(11, 19) + "Z";
}

export function utcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function timeStr(tsMs: number): string {
  return new Date(tsMs).toISOString().replace("T", " ").slice(5, 16) + "Z";
}

export const fmtFt = (meters: number | null) => fmtNum((meters ?? 0) * 3.28084);
export const fmtKt = (ms: number | null) => fmtNum((ms ?? 0) * 1.94384);
