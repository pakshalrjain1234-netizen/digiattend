import { Component, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] runtime crash:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-error-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-error-500" />
            </div>
            <h1 className="font-display text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-500 mb-5">
              An unexpected error occurred. Try reloading the page. If the problem persists, contact support.
            </p>
            {this.state.error && (
              <p className="text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-2 mb-4 font-mono break-words">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
