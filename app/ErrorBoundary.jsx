// ErrorBoundary component for graceful error handling
// Catches React errors and displays fallback UI instead of white screen

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (in production, send to monitoring service)
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // TODO: Send to Sentry or other error tracking service
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
    // }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#0a0908',
          color: '#d4af70',
          fontFamily: 'Philosopher, serif',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '12px',
            color: '#f5d278'
          }}>
            Щось пішло не так
          </h1>
          <p style={{
            fontSize: '16px',
            marginBottom: '24px',
            opacity: 0.8,
            maxWidth: '500px'
          }}>
            Виникла несподівана помилка. Спробуйте перезавантажити сторінку.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 32px',
              fontSize: '16px',
              fontFamily: 'Philosopher, serif',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #c9a24b, #f5d278)',
              border: 'none',
              borderRadius: '8px',
              color: '#0a0908',
              cursor: 'pointer',
              transition: 'transform 0.2s',
              marginBottom: '20px'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Перезавантажити
          </button>

          {/* Show error details in development */}
          {(window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) && this.state.error && (
            <details style={{
              marginTop: '20px',
              textAlign: 'left',
              background: 'rgba(255,255,255,0.05)',
              padding: '16px',
              borderRadius: '8px',
              maxWidth: '600px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <summary style={{ cursor: 'pointer', marginBottom: '12px', fontWeight: 700 }}>
                Технічні деталі (тільки в dev)
              </summary>
              <pre style={{
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                color: '#ff6b6b'
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Export to window for use in HTML files
window.ErrorBoundary = ErrorBoundary;
