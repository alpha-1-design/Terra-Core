import { Component, type ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a lazy-loaded panel/globe/map. If its chunk still fails to load
 * after lazyWithRetry's one automatic reload (e.g. genuinely offline),
 * this shows an inline retry affordance scoped to just that piece of the
 * UI instead of taking down the whole dashboard with a full-page crash.
 */
export default class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    console.warn(`[TERRA-CORE] ${this.props.label} failed to load:`, err.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-2 bg-chalk px-4 text-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Couldn't load {this.props.label} — check your connection
          </span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border-2 border-ink bg-volt px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors hover:bg-ink hover:text-paper"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
