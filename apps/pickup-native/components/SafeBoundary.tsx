import React from "react";

type Props = {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = { error: Error | null };

export class SafeBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn(`[SafeBoundary:${this.props.name}]`, error?.message, info?.componentStack);
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}
