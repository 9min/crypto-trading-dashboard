'use client';

// =============================================================================
// ErrorBoundary Component
// =============================================================================
// React Error Boundary that catches render errors in its subtree and displays
// an ErrorFallback UI. Error Boundaries MUST be class components — this is the
// one exception to the "functions only" rule per React documentation.
//
// Each widget should be wrapped in its own ErrorBoundary to prevent a single
// widget crash from taking down the entire dashboard.
// =============================================================================

import { Component, type ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** Content to render when no error has occurred */
  children: ReactNode;
  /** Display name shown in the error fallback UI */
  widgetName?: string;
}

interface ErrorBoundaryState {
  /** The caught error, or null if no error has occurred */
  error: Error | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Catches JavaScript errors in its child component tree, logs them, and
 * renders a fallback UI instead of crashing the entire dashboard.
 *
 * Note: Error Boundaries are the one case where React requires a class
 * component — there is no hooks equivalent for componentDidCatch /
 * getDerivedStateFromError.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary] ${this.props.widgetName ?? 'Unknown'} crashed`, {
      error,
      componentStack: info.componentStack,
      timestamp: Date.now(),
    });
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          widgetName={this.props.widgetName}
        />
      );
    }
    return this.props.children;
  }
}
