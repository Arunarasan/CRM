import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * App-level error boundary. Renders a calm, on-brand fallback instead of a white screen or a raw
 * stack trace — customers never see technical errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Hook for a real error-reporting service later.
    console.error('Unhandled error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-ivory px-6 text-center">
          <span className="mb-4 font-serif text-2xl font-bold text-gold">JB DECOR</span>
          <h1 className="font-serif text-3xl font-semibold text-forest">Something went wrong</h1>
          <p className="mt-3 max-w-sm text-forest/60">
            We hit an unexpected snag. Please refresh the page — if it persists, our team is on it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 bg-gold px-6 py-3 text-sm font-semibold uppercase tracking-wide text-forest transition-colors hover:bg-gold-dark"
          >
            Refresh
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
