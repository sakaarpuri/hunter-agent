"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise, Warning } from "@phosphor-icons/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[480px] flex-col items-center justify-center rounded-[2rem] border border-[var(--border-soft)] bg-white px-6 py-12 text-center shadow-[0_35px_85px_-38px_rgba(21,49,46,0.12)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
            <Warning size={22} weight="duotone" className="text-amber-600" />
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-[var(--ink)]">
            Something went wrong
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-7 text-[var(--muted)]">
            The dashboard hit an unexpected error. Reload the page to continue — your data is safe.
          </p>
          {this.state.error && (
            <p className="mt-3 font-mono text-xs text-[var(--muted)]/60">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_36px_-20px_rgba(18,108,100,0.7)] transition-all duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <ArrowClockwise size={15} weight="bold" />
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
