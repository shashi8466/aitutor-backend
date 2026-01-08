import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import React from 'react';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SettingsProvider } from './contexts/SettingsContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

// Error Boundary to catch runtime errors that cause blank pages
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-red-200 dark:border-red-900 max-w-lg w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">The application encountered an error and could not load.</p>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-xs font-mono mb-4 text-red-500 overflow-auto max-h-32">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <SettingsProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </SettingsProvider>
        </AuthProvider>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);