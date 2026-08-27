import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { SettingsProvider } from './contexts/SettingsContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { HelmetProvider } from 'react-helmet-async';
import { attemptChunkRecovery, isChunkLoadError } from './utils/chunkRecovery.js';

// CRITICAL: Force clear any existing Service Workers that might be caching an old version
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      console.log('🧹 [ServiceWorker] Unregistering zombie worker:', registration.scope);
      registration.unregister();
    }
  });
}

// Add app versioning debug info
console.log('🚀 [App Status] Latest deployment version initialized at:', new Date().toLocaleString());
console.log('🕒 [Cache Status] Strict no-cache policy applied to entry point.');

// Vite's documented recovery hook for a failed dynamic import (see src/utils/chunkRecovery.js) -
// fires for every failed chunk load across the whole app (React.lazy() components and any bare
// import() call alike), not just ones that happen to bubble into a component's render cycle. This
// is the primary recovery path; the ErrorBoundary below is a backup for anything that still
// reaches a render cycle before/without this event firing.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    console.warn('🚀 [Chunk Recovery] Detected a stale chunk after deployment. Reloading...');
    attemptChunkRecovery();
  });
}

// Error Boundary to catch runtime errors that cause blank pages
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false, giveUp: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    if (isChunkLoadError(error)) {
      // A stale chunk after deployment - never show the technical error screen for this. Recover
      // automatically (bounded, see chunkRecovery.js); only fall back to a UI at all if the retry
      // budget is exhausted, and even then it stays a clean, non-technical message.
      console.warn("🚀 [Error Boundary] Detected chunk loading error. Attempting automatic recovery...");
      const recovering = attemptChunkRecovery();
      if (!recovering) {
        this.setState({ giveUp: true });
      }
      return;
    }

    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        if (this.state.giveUp) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
              <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 max-w-lg w-full text-center">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-3xl">🔄</span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4 italic tracking-tight uppercase">Update available</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium leading-relaxed">
                  A newer version of the app is ready. Please refresh to continue.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98]"
                >
                  Refresh Now
                </button>
                <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  AIPrep365 Platform
                </p>
              </div>
            </div>
          );
        }

        // A reload is already in flight - show a neutral, branded loading state instead of any
        // error UI while it happens. This should only ever be on screen very briefly.
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Loading the latest version...</p>
            </div>
          </div>
        );
      }

      // Genuine application error (not a stale chunk) - existing technical fallback, unchanged.
      const errorMsg = this.state.error?.toString() || '';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-4 italic tracking-tight uppercase">Something went wrong</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium leading-relaxed">
              The application encountered an unexpected error and could not load.
            </p>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-xl text-[10px] font-mono mb-6 text-red-500 overflow-auto max-h-32 text-left border border-red-100/50 dark:border-red-900/50">
              {errorMsg}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg active:scale-[0.98]"
            >
              Reload Application
            </button>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              AIPrep365 Platform
            </p>
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
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <SettingsProvider>
              <ThemeProvider>
                <App />
              </ThemeProvider>
            </SettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>
);