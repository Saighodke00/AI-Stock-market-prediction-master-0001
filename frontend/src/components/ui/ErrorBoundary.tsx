import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 m-4 rounded-xl border border-red-dim bg-red-dim/20 text-center gap-4">
                    <div className="p-3 bg-red/10 rounded-full text-red glow-red">
                        <AlertOctagon size={32} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="font-display font-bold text-lg text-primary">SYSTEM FAULT DETECTED</h2>
                        <p className="font-body text-secondary max-w-md mx-auto">
                            {this.state.error?.message || 'An unexpected error occurred in the terminal view.'}
                        </p>
                    </div>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 mt-2 bg-raised border border-dim rounded hover:border-red hover:bg-red/10 transition-colors text-primary font-body text-sm"
                    >
                        <RefreshCw size={16} /> Retry Subsystem
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
