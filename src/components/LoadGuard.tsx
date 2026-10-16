import { Component, lazy, useMemo, useState, type ComponentType, type ReactNode } from 'react';

/**
 * If a part of the app that loads on demand (like the map) can't load, e.g. offline before it was
 * ever opened, show a small message with Try again instead of breaking the whole screen.
 */
export class LoadGuard extends Component<{ children: ReactNode; className?: string; label?: string; onRetry?: () => void }, { failed: boolean; key: number }> {
  state = { failed: false, key: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('Part of the screen failed to load', e); }
  render() {
    if (!this.state.failed) return <div key={this.state.key} className="contents">{this.props.children}</div>;
    return (
      <div className={`grid place-items-center rounded-[20px] bg-surface-2 p-5 text-center text-[14px] text-muted ${this.props.className ?? ''}`}>
        <div>
          <p className="m-0">{this.props.label ?? 'The map couldn’t load'}{navigator.onLine ? '.' : ' while offline.'}</p>
          <button className="mt-2 font-semibold text-cobalt" onClick={() => { this.props.onRetry?.(); this.setState(s => ({ failed: false, key: s.key + 1 })); }}>Try again</button>
        </div>
      </div>
    );
  }
}

/** like React.lazy, but "Try again" starts a fresh load (React remembers a failed one) */
export function useRetryableLazy<P>(factory: () => Promise<{ default: ComponentType<P> }>) {
  const [n, setN] = useState(0);
  const C = useMemo(() => lazy(factory), [n]);   // eslint-disable-line react-hooks/exhaustive-deps
  return [C, () => setN(x => x + 1)] as const;
}
