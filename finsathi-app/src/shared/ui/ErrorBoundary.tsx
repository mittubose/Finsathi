import React, { Component, type ReactNode } from 'react';
import { logSystemError } from '../lib/errorLog';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logSystemError(
      'fatal',
      'ReactErrorBoundary',
      error.message || 'React render crash',
      error,
      { componentStack: errorInfo.componentStack }
    );
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetVault = () => {
    try {
      localStorage.removeItem('finsathi-storage');
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#0a0a0a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              maxWidth: '620px',
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid #ff4444',
              borderRadius: '4px',
              padding: '24px',
              boxShadow: '0 0 30px rgba(255, 68, 68, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ff4444',
                  boxShadow: '0 0 8px #ff4444',
                }}
              />
              <span style={{ color: '#ff4444', fontWeight: 700, fontSize: '13px' }}>
                SYSTEM FAULT // COMPONENT_CRASH_DETECTED
              </span>
            </div>

            <h1 style={{ fontSize: '18px', margin: '0 0 12px 0', fontFamily: 'Space Grotesk, sans-serif' }}>
              A UI Exception Occurred
            </h1>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              The runtime captured and recorded this fault into the local error log for automated diagnostic analysis. Your financial database remains safe.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: '12px',
                borderRadius: '2px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '11px',
                color: '#ffb3ba',
                overflowX: 'auto',
                marginBottom: '20px',
                maxHeight: '160px',
              }}
            >
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: 'var(--primary-container, #00ff41)',
                  color: '#000',
                  border: 'none',
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  fontFamily: 'monospace',
                }}
              >
                RELOAD APPLICATION
              </button>
              <button
                onClick={() => window.location.href = '/audit'}
                style={{
                  backgroundColor: 'transparent',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  padding: '8px 14px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  fontFamily: 'monospace',
                }}
              >
                VIEW ERROR LOGS →
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
