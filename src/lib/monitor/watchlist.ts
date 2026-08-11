import { useCallback, useSyncExternalStore } from "react";

/**
 * Local-first watchlist. Persists tracked locations in localStorage so the
 * whole app runs as a static client-side build with zero backend.
 */

export interface WatchItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  createdAt: number;
}

const STORAGE_KEY = "terra-core.watchlist.v1";

const listeners = new Set<() => void>();

let cache: WatchItem[] | null = null;

function read(): WatchItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WatchItem[]) : [];
  } catch {
    return [];
  }
}

function get(): WatchItem[] {
  if (cache === null) cache = read();
  return cache;
}

function write(items: WatchItem[]) {
  cache = items;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable (private mode) — keep in-memory state.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function makeId(): string {
  return `watch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useWatchlist() {
  const items = useSyncExternalStore(subscribe, get, get);

  const add = useCallback(
    (name: string, lat: number, lng: number, category?: string) => {
      if (get().some((w) => w.name === name)) return false;
      const item: WatchItem = {
        id: makeId(),
        name,
        lat,
        lng,
        category,
        createdAt: Date.now(),
      };
      write([...get(), item]);
      return true;
    },
    [],
  );

  const remove = useCallback((id: string) => {
    write(get().filter((w) => w.id !== id));
  }, []);

  const isWatched = useCallback((name: string) => {
    return get().some((w) => w.name === name);
  }, []);

  return { items, add, remove, isWatched };
}
