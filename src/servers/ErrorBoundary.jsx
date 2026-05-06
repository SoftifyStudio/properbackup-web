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
    console.error('[ProperBackup] UI error caught by boundary:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl2 border border-danger/30 bg-dangerLight p-5 text-sm text-danger space-y-2">
          <p className="font-semibold">
            {this.props.title || 'Something went wrong'}
          </p>
          <p className="text-xs text-text3">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            {this.props.retryLabel || 'Try again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
