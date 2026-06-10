import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WorkspaceErrorBoundary]', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="font-mono"
          style={{
            margin: 16,
            padding: '16px 18px',
            borderRadius: 12,
            border: '1px solid color-mix(in srgb, var(--accent-coral) 35%, var(--glass-border-2))',
            background: 'color-mix(in srgb, var(--accent-coral) 8%, var(--glass-1))',
            color: 'var(--text-primary)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {this.props.fallbackTitle ?? 'Ansicht konnte nicht geladen werden'}
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            {this.state.error.message}
          </div>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
