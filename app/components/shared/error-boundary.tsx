'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
}

/**
 * Error Boundary Component
 *
 * Catches React errors in child components and displays a fallback UI.
 * Prevents the entire application from crashing due to errors in individual components.
 *
 * Features:
 * - Infinite loop prevention with retry count limiting
 * - Automatic reset when resetKeys change
 * - Enhanced UI with retry counter and error details
 * - Production error reporting capabilities
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<div>Something went wrong</div>}
 *   maxRetries={3}
 *   resetKeys={[userId, routeId]}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    // Increment retry counter to track consecutive errors
    this.setState((prev) => ({
      retryCount: prev.retryCount + 1,
      errorInfo,
    }));

    // Gather comprehensive error details for logging and debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'SSR',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      retryCount: retryCount + 1,
    };

    console.error('Error capturado por ErrorBoundary:', errorDetails);

    // Invoke optional error callback for custom handling
    this.props.onError?.(error, errorInfo);

    // Prevent infinite error loops by limiting retry attempts
    if (retryCount >= maxRetries) {
      console.error(
        `ErrorBoundary: Se alcanzó el límite de reintentos (${maxRetries}). ` +
          'El componente tiene un error persistente.'
      );
      return;
    }

    // Send error details to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportErrorToService(errorDetails);
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Automatically reset error state when resetKeys change
    // This allows parent components to trigger a reset by changing these keys
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      !this.areArraysEqual(this.props.resetKeys, prevProps.resetKeys)
    ) {
      this.handleReset();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }

  handleReset = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      if (typeof window !== 'undefined') {
        const shouldReload = confirm('Se ha detectado un error persistente. ¿Recargar la página?');
        if (shouldReload) {
          window.location.reload();
        }
      }
      return;
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  /**
   * Compare arrays for resetKeys equality
   * Used to detect when resetKeys change and trigger auto-reset
   */
  private areArraysEqual(a?: Array<string | number>, b?: Array<string | number>): boolean {
    if (!a || !b) return a === b;
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }

  /**
   * Send error details to external monitoring service
   * In production, this should integrate with services like Sentry or LogRocket
   */
  private async reportErrorToService(errorDetails: {
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: string;
    userAgent: string;
    url: string;
    retryCount: number;
  }) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorDetails),
      });
    } catch (e) {
      console.warn('Failed to report error:', e);
    }
  }

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError && error) {
      // Si se provee un fallback custom como función, usarlo
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }

      // Si se provee un fallback custom como ReactNode, usarlo
      if (fallback) {
        return fallback;
      }

      // Render default fallback UI with retry functionality
      const canRetry = retryCount < maxRetries;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h2>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error.message || 'Ha ocurrido un error inesperado'}
            </p>

            {/* Display retry counter when user has attempted retries */}
            {retryCount > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
                Intentos: {retryCount}/{maxRetries}
              </p>
            )}

            {/* Action buttons for retry or reload */}
            <div className="flex gap-2 mb-4">
              {canRetry ? (
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
                >
                  Reintentar
                </button>
              ) : (
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
                >
                  Recargar página
                </button>
              )}

              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(`${error.message}\n\n${error.stack || ''}`);
                  }
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-md transition-colors"
                title="Copiar detalles del error"
              >
                📋
              </button>
            </div>

            {/* Technical details visible only in development mode */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  Detalles del error (solo en desarrollo)
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto max-h-48 text-left">
                  {error.stack}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-3 rounded overflow-auto max-h-48 text-left">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
