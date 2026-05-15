import { Component } from 'react';

/**
 * React Error Boundary — catches render errors in child components.
 * Shows a friendly fallback UI instead of a white screen crash.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button className="auth-btn" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
