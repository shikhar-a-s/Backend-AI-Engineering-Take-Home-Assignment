import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console — keep this light and avoid external reporting from here
    console.error('Unhandled error in React tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ color: 'var(--danger)' }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <p style={{ color: 'var(--text-light)' }}>Try refreshing the page or check the console for details.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
