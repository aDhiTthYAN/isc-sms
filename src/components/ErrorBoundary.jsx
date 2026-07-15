import { Component } from 'react';

// Catches render errors on any page and shows the message instead of a white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, maxWidth: 760, margin: '40px auto', fontFamily: 'var(--font-body)' }}>
          <h2 style={{ color: 'var(--red-ink, #b00)', marginBottom: 12 }}>This page hit an error</h2>
          <p style={{ color: 'var(--text-sub, #555)', marginBottom: 16 }}>
            The rest of the app still works — use the sidebar to navigate away. Details below:
          </p>
          <pre style={{ background: '#FEF2F2', color: '#991B1B', padding: 16, borderRadius: 10, overflowX: 'auto', fontSize: 12.5, whiteSpace: 'pre-wrap' }}>
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: 14, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent, #0F9E8E)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
